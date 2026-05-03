import chromadb
import json
import hashlib
from sentence_transformers import SentenceTransformer

print("=" * 60)
print("🚀 INITIALISATION CHROMADB")
print("=" * 60)

# Connexion
print("\n📡 Connexion à ChromaDB...")
client = chromadb.HttpClient(host="localhost", port=8001)

# Supprimer ancienne collection
try:
    client.delete_collection("medical_rag")
    print("🔄 Ancienne collection supprimée")
except:
    print("ℹ️ Aucune ancienne collection")

# Créer nouvelle collection
print("\n📁 Création de la collection...")
collection = client.create_collection(
    name="medical_rag",
    metadata={"hnsw:space": "cosine"}
)
print("✅ Collection medical_rag créée")

# Charger les données
print("\n📖 Chargement des données...")
with open("data/rag_knowledge_base.json", "r", encoding="utf-8") as f:
    rag_data = json.load(f)
print(f"✅ {len(rag_data)} entrées chargées")

# Charger le modèle
print("\n🧠 Chargement du modèle...")
model = SentenceTransformer("paraphrase-MiniLM-L3-v2")
print(f"✅ Modèle chargé - Dimension: {model.get_sentence_embedding_dimension()}")

# Préparer les documents
print("\n📝 Préparation des documents...")
documents = []
metadatas = []
ids = []

for key, data in rag_data.items():
    text = key.replace("_", " ")
    if data.get("mots_cles"):
        text += " " + " ".join(data["mots_cles"][:3])
    documents.append(text)
    metadatas.append({
        "key": key,
        "urgence": str(data.get("urgence", False))
    })
    ids.append(f"rag_{hashlib.md5(key.encode()).hexdigest()[:16]}")

print(f"✅ {len(documents)} documents préparés")

# Générer les embeddings
print("\n🧮 Génération des embeddings...")
embeddings = model.encode(documents, show_progress_bar=True).tolist()

# Ajouter à ChromaDB
print("\n💾 Ajout à ChromaDB...")
collection.add(
    embeddings=embeddings,
    documents=documents,
    metadatas=metadatas,
    ids=ids
)

print("\n" + "=" * 60)
print(f"✅ TERMINÉ ! {len(documents)} documents ajoutés")
print(f"📁 Collection: medical_rag")

# Tester
print("\n🔍 Test de recherche...")
test = collection.query(query_texts=["douleur poitrine"], n_results=1)
if test["distances"][0]:
    similarity = 1 - test["distances"][0][0]
    match = test["metadatas"][0][0]["key"]
    print(f"✅ Test réussi !")
    print(f"   - Match: {match}")
    print(f"   - Similarité: {similarity:.2%}")
else:
    print("⚠️ Test sans résultat")

print("\n🎯 ChromaDB prêt pour Node.js!")