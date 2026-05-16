from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from sentence_transformers import SentenceTransformer
import os

app = Flask(__name__)
CORS(app)

# ================= CONFIGURATION DOCKER =================
# ⚠️ Votre Docker ChromaDB est sur le port 8001
CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', 8000))  # ← Port 8001 !
COLLECTION_NAME = "medical_rag_new"

print(f"🔧 Connexion à ChromaDB: {CHROMA_HOST}:{CHROMA_PORT}")

# Chargement du modèle
print("🔄 Chargement du modèle d'embedding...")
model = SentenceTransformer('distiluse-base-multilingual-cased-v2')
print(f"✅ Modèle chargé (dimension: {model.get_sentence_embedding_dimension()})")

# Connexion à ChromaDB
try:
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    print(f"✅ Connecté à ChromaDB sur {CHROMA_HOST}:{CHROMA_PORT}")
except Exception as e:
    print(f"❌ Erreur connexion ChromaDB: {e}")
    client = None

# Récupérer la collection
collection = None
if client:
    try:
        collection = client.get_collection(COLLECTION_NAME)
        count = collection.count()
        print(f"✅ Collection '{COLLECTION_NAME}' trouvée - {count} documents")
    except Exception as e:
        print(f"❌ Collection '{COLLECTION_NAME}' non trouvée: {e}")

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
    return jsonify({
        'status': 'error',
        'message': 'Collection non trouvée',
        'chroma_host': CHROMA_HOST,
        'chroma_port': CHROMA_PORT
    })

@app.route('/search', methods=['POST'])
def search():
    if not collection:
        return jsonify({'matched': False, 'results': [], 'error': 'Collection non disponible'})
    
    data = request.json
    query = data.get('query', '')
    language = data.get('language', 'fr')
    top_k = data.get('top_k', 3)

    print(f"🔍 [RAG] Recherche: '{query[:80]}...'")

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
                
                if similarity >= 0.5:
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    formatted_results.append({
                        'content': results['documents'][0][i],
                        'source': metadata.get('source', 'base_medicale'),
                        'key': metadata.get('key', 'unknown'),
                        'similarity': round(similarity, 2)
                    })
            
            if formatted_results:
                print(f"✅ [RAG] {len(formatted_results)} résultats (score: {formatted_results[0]['similarity']*100:.0f}%)")
            
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
    print(f"\n🚀 Démarrage du proxy RAG sur http://localhost:5001")
    print(f"💾 ChromaDB: {CHROMA_HOST}:{CHROMA_PORT}")
    print(f"📁 Collection: {COLLECTION_NAME}\n")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)