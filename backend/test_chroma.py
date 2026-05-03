import chromadb
client = chromadb.HttpClient(host="localhost", port=8001)
collection = client.get_collection("medical_rag")
print("Collection:", collection.name)
print("Documents:", collection.count())
result = collection.query(query_texts=["j ai mal a la poitrine"], n_results=1)
print("Match:", result["metadatas"][0][0]["key"])
print("Similarite:", 1 - result["distances"][0][0])
