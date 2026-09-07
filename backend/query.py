from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

def search_documents(query_text, k=3):
    print("1. Loading vector database and embedding model...")
    # Initialize the same embedding model used to build the database
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Load the persisted Chroma database
    vector_store = Chroma(
        persist_directory="./chroma_db",
        embedding_function=embeddings
    )
    
    # Perform similarity search
    print(f"\n2. Searching database for context relevant to: '{query_text}'...\n")
    results = vector_store.similarity_search(query_text, k=k)
    
    return results

if __name__ == "__main__":
    # Replace this query with any question relevant to your sample.pdf
    user_query = "What is the main topic of this document?"
    
    matching_chunks = search_documents(user_query, k=3)
    
    print(f"--- Found {len(matching_chunks)} Relevant Result(s) ---\n")
    for i, doc in enumerate(matching_chunks, 1):
        page_num = doc.metadata.get("page", 0) + 1
        print(f"Result {i} (Page {page_num}):")
        print(doc.page_content.strip())
        print("-" * 50 + "\n")