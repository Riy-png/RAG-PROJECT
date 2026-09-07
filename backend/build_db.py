from extract import process_document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

def create_database():
    print("1. Extracting text from PDF...")
    # Get the chunks using your existing script
    chunks = process_document("sample.pdf")
    
    if not chunks:
        print("Error: No text found. Cannot build database.")
        return

    print("\n2. Loading HuggingFace embedding model...")
    # We are using a highly efficient, free open-source model
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    print("\n3. Building Chroma vector database (this might take a moment)...")
    # This converts the text into vectors and saves it to a local folder
    vector_store = Chroma.from_documents(
        documents=chunks, 
        embedding=embeddings, 
        persist_directory="./chroma_db"
    )
    
    print("\nSuccess! Database created and saved to the './chroma_db' folder.")

if __name__ == "__main__":
    create_database()