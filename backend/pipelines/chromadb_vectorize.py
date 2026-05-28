import json
import chromadb
from sentence_transformers import SentenceTransformer
import hashlib
import os

# Chemin vers la base RAG
rag_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'rag_knowledge_base.json')

print("🚀 VECTORISATION CHROMADB")
print("=" * 50)
print(f"📁 Chemin RAG: {rag_path}")
print(f"📁 Existe: {os.path.exists(rag_path)}")

# Vérifier que le fichier RAG existe
if not os.path.exists(rag_path):
    print(f"❌ Fichier non trouvé: {rag_path}")
    print("💡 Assurez-vous que backend/data/rag_knowledge_base.json existe")
    exit(1)

# 1. Charger la base RAG
print("\n📖 Chargement de la base RAG...")
with open(rag_path, 'r', encoding='utf-8') as f:
    rag_data = json.load(f)
print(f"✅ {len(rag_data)} entrées chargées")

# 2. Connexion à ChromaDB
print("\n🔌 Connexion à ChromaDB...")
client = chromadb.HttpClient(host="localhost", port=8000)

# 3. Supprimer l'ancienne collection si elle existe
try:
    client.delete_collection("medical_rag_new")
    print("🔄 Ancienne collection supprimée")
except:
    print("ℹ️ Aucune ancienne collection trouvée")

# 4. Créer la nouvelle collection
print("\n📁 Création de la collection medical_rag_new...")
collection = client.create_collection(
    name="medical_rag_new",
    metadata={"hnsw:space": "cosine"}
)

# 5. Charger le modèle d'embedding (MULTILINGUE + RAPIDE)
print("\n🧠 Chargement du modèle d'embedding...")
print("   Modèle: distiluse-base-multilingual-cased-v2")
print("   🌍 Support: Français, Arabe, Darija")
print("   ⚡ Modèle rapide et optimisé")
model = SentenceTransformer('distiluse-base-multilingual-cased-v2')
print(f"✅ Modèle chargé (dimension: {model.get_sentence_embedding_dimension()})")

# 6. Préparer les documents
print("\n📝 Préparation des documents...")
documents = []
metadatas = []
ids = []

for idx, (key, data) in enumerate(rag_data.items()):
    # ✅ Utiliser le conseil + mots-clés comme texte de recherche
    parts = []
    
    # Ajouter le conseil (contenu principal)
    if data.get('conseil'):
        parts.append(data['conseil'][:300])
    
    # Ajouter les mots-clés
    if data.get('mots_cles'):
        parts.append(" ".join(data['mots_cles']))
    if data.get('mots_cles_french'):
        parts.append(" ".join(data['mots_cles_french']))
    
    # Fallback sur la clé si rien d'autre
    if not parts:
        parts.append(key.replace('_', ' '))
    
    search_text = " ".join(parts)
    
    documents.append(search_text)
    metadatas.append({
        "key": key,
        "urgence": str(data.get('urgence', False)),
        "priority": data.get('priority', 4),
        "source": data.get('source', 'base_medicale')  # ✅ Ajouter la source
    })
    ids.append(f"rag_{hashlib.md5(key.encode()).hexdigest()[:16]}")
    
    if (idx + 1) % 20 == 0:
        print(f"   ⏳ {idx + 1}/{len(rag_data)} préparés")
# 7. Générer les embeddings
print("\n🧮 Génération des embeddings...")
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
print("\n" + "=" * 50)
print(f"✅ VECTORISATION TERMINÉE !")
print(f"   - {len(documents)} documents indexés")
print(f"   - Collection: medical_rag_new")
print(f"   - Modèle: distiluse-base-multilingual-cased-v2")
print(f"   - Serveur: http://localhost:8001")

# Afficher quelques statistiques
print(f"\n📊 Aperçu des documents:")
for i in range(min(3, len(documents))):
    print(f"   {i+1}. {ids[i]} -> {metadatas[i]['key']}")