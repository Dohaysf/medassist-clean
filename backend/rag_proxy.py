from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
CORS(app)

# ⚠️ IMPORTANT : Utiliser le MÊME modèle que pour la vectorisation
print("🔄 Chargement du modèle d'embedding (identique à la vectorisation)...")
model = SentenceTransformer('distiluse-base-multilingual-cased-v2')
print(f"✅ Modèle chargé (dimension: {model.get_sentence_embedding_dimension()})")

# Connexion à ChromaDB
client = chromadb.HttpClient(host="localhost", port=8000)
print("✅ Connecté à ChromaDB")

# Récupérer la collection
try:
    collection = client.get_collection("medical_rag_new")
    count = collection.count()
    print(f"✅ Collection medical_rag_new trouvée - {count} documents")
except Exception as e:
    print(f"❌ Collection medical_rag_new non trouvée: {e}")
    collection = None

@app.route('/health', methods=['GET'])
def health():
    if collection:
        return jsonify({
            'status': 'ok',
            'collection': 'medical_rag_new',
            'documents': collection.count()
        })
    return jsonify({'status': 'error', 'message': 'Collection non trouvée'})

@app.route('/search', methods=['POST'])
def search():
    if not collection:
        return jsonify({'matched': False, 'error': 'Collection non disponible'})
    
    data = request.json
    message = data.get('message', '')
    print(f"🔍 Recherche: '{message[:50]}...'")
    
    try:
        # ⚠️ Générer l'embedding avec le MÊME modèle
        query_embedding = model.encode([message]).tolist()
        
        # Utiliser l'embedding pour la requête
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=1
        )
        
        if results['distances'][0]:
            distance = results['distances'][0][0]
            similarity = 1 - min(distance, 1)
            metadata = results['metadatas'][0][0]
            
            print(f"✅ Match: {metadata['key']} (similarité: {similarity:.2%})")
            
            return jsonify({
                'matched': True,
                'key': metadata['key'],
                'distance': distance,
                'similarity': similarity,
                'metadata': metadata
            })
        else:
            print("❌ Aucun match")
            return jsonify({'matched': False})
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return jsonify({'matched': False, 'error': str(e)})

if __name__ == '__main__':
    print("\n🚀 Démarrage du proxy RAG sur http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)