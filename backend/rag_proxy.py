from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from sentence_transformers import SentenceTransformer
import os
import json

app = Flask(__name__)
CORS(app)

# ================= CONFIGURATION =================
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', 8000))
COLLECTION_NAME = "medical_rag_new"

# ✅ Chemin vers le JSON (source de vérité)
RAG_JSON_PATH = os.path.join(os.path.dirname(__file__), 'data', 'rag_knowledge_base.json')

print(f"🔧 Connexion à ChromaDB: {CHROMA_HOST}:{CHROMA_PORT}")

# ✅ Charger le JSON complet
rag_knowledge_base = {}
if os.path.exists(RAG_JSON_PATH):
    with open(RAG_JSON_PATH, 'r', encoding='utf-8') as f:
        rag_knowledge_base = json.load(f)
    print(f"✅ RAG JSON chargé: {len(rag_knowledge_base)} entrées")
else:
    print(f"⚠️ JSON non trouvé: {RAG_JSON_PATH}")

# Chargement du modèle
print("🔄 Chargement du modèle d'embedding...")
model = SentenceTransformer('distiluse-base-multilingual-cased-v2')
print(f"✅ Modèle chargé")

# Connexion ChromaDB
try:
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    print(f"✅ Connecté à ChromaDB")
except Exception as e:
    print(f"❌ Erreur connexion ChromaDB: {e}")
    client = None

collection = None
if client:
    try:
        collection = client.get_collection(COLLECTION_NAME)
        print(f"✅ Collection '{COLLECTION_NAME}' - {collection.count()} documents")
    except Exception as e:
        print(f"❌ Collection non trouvée: {e}")

@app.route('/health', methods=['GET'])
def health():
    if collection:
        return jsonify({
            'status': 'ok',
            'collection': COLLECTION_NAME,
            'documents': collection.count(),
            'chroma_host': CHROMA_HOST,
            'chroma_port': CHROMA_PORT
        })
    return jsonify({'status': 'error', 'message': 'Collection non trouvée'})

@app.route('/search', methods=['POST'])
def search():
    if not collection:
        return jsonify({'matched': False, 'results': [], 'error': 'Collection non disponible'})
    
    data = request.json
    query = data.get('query', '')
    language = data.get('language', 'fr')
    top_k = data.get('top_k', 3)

    print(f"🔍 [RAG] Recherche: '{query[:80]}'")

    if not query:
        return jsonify({'matched': False, 'results': []})
    
    try:
        query_embedding = model.encode([query]).tolist()
        
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            include=['documents', 'metadatas', 'distances']
        )
        
        if results['documents'] and results['documents'][0]:
            formatted_results = []
            
            for i in range(len(results['documents'][0])):
                distance = results['distances'][0][i] if results['distances'] else 1.0
                similarity = max(0, 1 - min(distance, 1))
                
                if similarity >= 0.3:
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    key = metadata.get('key', 'unknown')
                    source = metadata.get('source', 'base_medicale')
                    
                    # ✅ Récupérer le vrai contenu depuis le JSON
                    rag_entry = rag_knowledge_base.get(key, {})
                    conseil = rag_entry.get('conseil', results['documents'][0][i])
                    protocole = rag_entry.get('protocole_oms', None)
                    urgence = rag_entry.get('urgence', False)
                    priority = rag_entry.get('priority', 4)
                    
                    # ✅ Construire le contenu enrichi
                    content = conseil
                    if protocole:
                        content += f"\n\n📋 Protocole OMS/Croix-Rouge : {protocole}"
                    
                    formatted_results.append({
                        'content': content,
                        'conseil': conseil,
                        'protocole_oms': protocole,
                        'source': source,
                        'key': key,
                        'similarity': round(similarity, 2),
                        'urgence': urgence,
                        'priority': priority
                    })
            
            if formatted_results:
                print(f"✅ [RAG] {len(formatted_results)} résultats - Top: {formatted_results[0]['key']} ({formatted_results[0]['similarity']*100:.0f}%)")
            
            return jsonify({
                'matched': len(formatted_results) > 0,
                'results': formatted_results
            })
        else:
            print("❌ [RAG] Aucun résultat")
            return jsonify({'matched': False, 'results': []})
            
    except Exception as e:
        print(f"❌ [RAG] Erreur: {e}")
        return jsonify({'matched': False, 'results': [], 'error': str(e)})

if __name__ == '__main__':
    print(f"\n🚀 Proxy RAG sur http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)