from flask import Flask, request, jsonify
from flask_cors import CORS
import chromadb
from sentence_transformers import SentenceTransformer
import os
import json

app = Flask(__name__)
CORS(app)

CHROMA_HOST = os.getenv('CHROMA_HOST', 'localhost')
CHROMA_PORT = int(os.getenv('CHROMA_PORT', 8000))

PROTOCOLS_COLLECTION = os.getenv('PROTOCOLS_COLLECTION', 'medical_protocols')
CASES_COLLECTION = os.getenv('CASES_COLLECTION', 'medical_cases')

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, 'data')

PROTOCOLS_JSON_PATH = os.path.join(DATA_DIR, 'rag_knowledge_base.json')
CASES_JSON_PATH = os.path.join(DATA_DIR, 'data_UM.json')

print(f"🔧 Connexion à ChromaDB: {CHROMA_HOST}:{CHROMA_PORT}")

protocols_json = {}
cases_json = {}

if os.path.exists(PROTOCOLS_JSON_PATH):
    with open(PROTOCOLS_JSON_PATH, 'r', encoding='utf-8') as f:
        protocols_json = json.load(f)
    print(f"✅ Protocoles JSON chargé: {len(protocols_json)} entrées")
else:
    print(f"⚠️ Protocoles JSON non trouvé: {PROTOCOLS_JSON_PATH}")

if os.path.exists(CASES_JSON_PATH):
    with open(CASES_JSON_PATH, 'r', encoding='utf-8') as f:
        cases_json = json.load(f)
    print(f"✅ Cas patients JSON chargé: {len(cases_json)} entrées")
else:
    print(f"⚠️ Cas patients JSON non trouvé: {CASES_JSON_PATH}")

print("🔄 Chargement du modèle d'embedding...")
model = SentenceTransformer('distiluse-base-multilingual-cased-v2')
print("✅ Modèle chargé")

try:
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    print("✅ Connecté à ChromaDB")
except Exception as e:
    print(f"❌ Erreur connexion ChromaDB: {e}")
    client = None

protocols_collection = None
cases_collection = None

if client:
    try:
        protocols_collection = client.get_collection(PROTOCOLS_COLLECTION)
        print(f"✅ Collection '{PROTOCOLS_COLLECTION}' - {protocols_collection.count()} documents")
    except Exception as e:
        print(f"❌ Collection protocoles non trouvée: {e}")

    try:
        cases_collection = client.get_collection(CASES_COLLECTION)
        print(f"✅ Collection '{CASES_COLLECTION}' - {cases_collection.count()} documents")
    except Exception as e:
        print(f"❌ Collection cas patients non trouvée: {e}")


def get_collection_by_type(source_type):
    if source_type == 'case':
        return cases_collection, cases_json, CASES_COLLECTION
    return protocols_collection, protocols_json, PROTOCOLS_COLLECTION


def format_results(results, source_json, top_k):
    if not results or not results.get('documents') or not results['documents'][0]:
        return []

    formatted = []

    for i in range(len(results['documents'][0])):
        distance = results['distances'][0][i] if results.get('distances') and results['distances'][0] else 1.0
        similarity = max(0, 1 - min(distance, 1))

        if similarity < 0.3:
            continue

        metadata = results['metadatas'][0][i] if results.get('metadatas') and results['metadatas'][0] else {}
        key = metadata.get('key', 'unknown')
        source = metadata.get('source', 'base_medicale')
        source_type = metadata.get('source_type', 'protocol')

        entry = source_json.get(key, {}) if isinstance(source_json, dict) else {}
        conseil = entry.get('conseil', results['documents'][0][i])
        protocole = entry.get('protocole_oms', None)
        urgence = entry.get('urgence', False)
        priority = entry.get('priority', 4)

        content = conseil
        if protocole:
            content += f"\n\n📋 Protocole OMS/Croix-Rouge : {protocole}"

        formatted.append({
            'content': content,
            'conseil': conseil,
            'protocole_oms': protocole,
            'source': source,
            'source_type': source_type,
            'key': key,
            'similarity': round(similarity, 2),
            'urgence': urgence,
            'priority': priority
        })

        if len(formatted) >= top_k:
            break

    return formatted


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok' if client else 'error',
        'protocols_collection': PROTOCOLS_COLLECTION,
        'cases_collection': CASES_COLLECTION,
        'protocols_documents': protocols_collection.count() if protocols_collection else 0,
        'cases_documents': cases_collection.count() if cases_collection else 0,
        'chroma_host': CHROMA_HOST,
        'chroma_port': CHROMA_PORT
    })


@app.route('/search', methods=['POST'])
def search():
    if not client:
        return jsonify({'matched': False, 'results': [], 'error': 'Client ChromaDB non disponible'})

    data = request.get_json(silent=True) or {}
    query = data.get('query', '')
    language = data.get('language', 'fr')
    top_k = int(data.get('top_k', 3))
    source_type = data.get('source_type', 'protocol')

    print(f"🔍 [RAG] Recherche: '{query[:80]}' | source_type={source_type}")

    if not query:
        return jsonify({'matched': False, 'results': []})

    collection, source_json, collection_name = get_collection_by_type(source_type)

    if not collection:
        return jsonify({
            'matched': False,
            'results': [],
            'error': f"Collection indisponible: {collection_name}"
        })

    try:
        query_embedding = model.encode([query]).tolist()

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
            include=['documents', 'metadatas', 'distances']
        )

        formatted_results = format_results(results, source_json, top_k)

        if formatted_results:
            print(f"✅ [RAG] {len(formatted_results)} résultats - Top: {formatted_results[0]['key']} ({formatted_results[0]['similarity']*100:.0f}%)")
            return jsonify({
                'matched': True,
                'source_type': source_type,
                'results': formatted_results
            })

        print("❌ [RAG] Aucun résultat")
        return jsonify({'matched': False, 'source_type': source_type, 'results': []})

    except Exception as e:
        print(f"❌ [RAG] Erreur: {e}")
        return jsonify({'matched': False, 'results': [], 'error': str(e)})


@app.route('/search_protocols', methods=['POST'])
def search_protocols():
    data = request.get_json(silent=True) or {}
    data['source_type'] = 'protocol'
    with app.test_request_context(json=data):
        return search()


@app.route('/search_cases', methods=['POST'])
def search_cases():
    data = request.get_json(silent=True) or {}
    data['source_type'] = 'case'
    with app.test_request_context(json=data):
        return search()


if __name__ == '__main__':
    print(f"\n🚀 Proxy RAG sur http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)