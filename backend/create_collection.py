import chromadb
import json
import hashlib
import sys
import os

print("=" * 60)
print("🚀 CRÉATION DE LA COLLECTION CHROMADB")
print("=" * 60)

# 1. Connexion à ChromaDB
print("\n📡 Connexion à ChromaDB sur localhost:8001...")
client = chromadb.HttpClient(host="localhost", port=8001)
print("✅ Connecté")

# 2. Supprimer l'ancienne collection si elle existe
try:
    client.delete_collection("medical_rag")
    print("🔄 Ancienne collection supprimée")
except Exception as e:
    print("ℹ️ Aucune ancienne collection trouvée")

# 3. Créer la nouvelle collection
print("\n📁 Création de la collection 'medical_rag'...")
collection = client.create_collection(
    name="medical_rag",
    metadata={"hnsw:space": "cosine"}
)
print("✅ Collection créée")

# 4. Charger la base RAG
rag_path = r"C:\Users\yousf\OneDrive\Bureau\prehospital-medical-chatbot\backend\data\rag_knowledge_base.json"
print(f"\n📖 Chargement de la base RAG: {rag_path}")

if not os.path.exists(rag_path):
    print(f"❌ Fichier non trouvé: {rag_path}")
    sys.exit(1)

with open(rag_path, 'r', encoding='utf-8') as f:
    rag_data = json.load(f)
print(f"✅ {len(rag_data)} entrées chargées")

# 5. Charger le modèle d'embedding
print("\n🧠 Chargement du modèle d'embedding (paraphrase-MiniLM-L3-v2)...")
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('paraphrase-MiniLM-L3-v2')
    print(f"✅ Modèle chargé - Dimension: {model.get_sentence_embedding_dimension()}")
except ImportError:
    print("❌ SentenceTransformers non installé. Installation...")
    os.system("pip install sentence-transformers")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('paraphrase-MiniLM-L3-v2')

# 6. Préparer les documents
print("\n📝 Préparation des documents...")
documents = []
metadatas = []
ids = []

for key, data in rag_data.items():
    # Texte de recherche
    search_text = key.replace('_', ' ')
    if data.get('mots_cles'):
        search_text += " " + " ".join(data['mots_cles'][:3])
    
    documents.append(search_text)
    metadatas.append({
        "key": key,
        "urgence": str(data.get('urgence', False)),
        "priority": str(data.get('priority', 4))
    })
    id_hash = hashlib.md5(key.encode()).hexdigest()[:16]
    ids.append(f"rag_{id_hash}")
    
# 7. Générer les embeddings
print(f"\n🧮 Génération des embeddings pour {len(documents)} documents...")
embeddings = model.encode(documents, show_progress_bar=True).tolist()

# 8. Ajouter à ChromaDB
print("\n💾 Ajout des vecteurs à ChromaDB...")
collection.add(
    embeddings=embeddings,
    documents=documents,
    metadatas=metadatas,
    ids=ids
)

# 9. Vérification
print("\n" + "=" * 60)
print("✅ VECTORISATION TERMINÉE !")
print(f"   - {len(documents)} documents indexés")
print(f"   - Collection: medical_rag")
print(f"   - IDs: {ids[:3]}...")

# 10. Tester la recherche
print("\n🔍 Test de recherche...")
test_result = collection.query(query_texts=["douleur poitrine"], n_results=1)
if test_result['distances'][0]:
    similarity = 1 - test_result['distances'][0][0]
    print(f"✅ Test réussi !")
    print(f"   - Match: {test_result['metadatas'][0][0]['key']}")
    print(f"   - Similarité: {similarity:.2%}")
else:
    print("⚠️ Test de recherche sans résultat")

print("\n🎯 Collection prête à être utilisée par Node.js!")