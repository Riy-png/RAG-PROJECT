import os
import shutil
import stat
import time
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from extract import process_document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_google_genai import ChatGoogleGenerativeAI
from sentence_transformers import CrossEncoder

load_dotenv()

app = FastAPI(title="Multi-Document RAG API with Reranking")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
reranker_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0.3
)
CHROMA_PATH = "./chroma_db"
query_cache = {}

class QueryRequest(BaseModel):
    question: str
    k: int = 6
    filter_filename: str = None

@app.get("/")
def read_root():
    return {"status": "online", "message": "Multi-Document RAG API with Reranking is running!"}

@app.get("/documents")
def list_documents():
    if not os.path.exists(CHROMA_PATH):
        return {"documents": []}
    
    try:
        vector_store = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        data = vector_store.get(include=["metadatas"])
        filenames = set()
        if data and "metadatas" in data:
            for meta in data["metadatas"]:
                if meta and "filename" in meta:
                    filenames.add(meta["filename"])
        return {"documents": list(filenames)}
    except Exception as e:
        return {"documents": []}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    temp_file_path = f"temp_{file.filename}"
    
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        chunks = process_document(temp_file_path)
        if not chunks:
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")
            
        for chunk in chunks:
            chunk.metadata["filename"] = file.filename

        vector_store = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        vector_store.add_documents(chunks)
        
        query_cache.clear()
        return {
            "status": "success",
            "filename": file.filename,
            "chunks_processed": len(chunks)
        }
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.delete("/documents/{filename}")
def delete_document(filename: str):
    if not os.path.exists(CHROMA_PATH):
        raise HTTPException(status_code=404, detail="Database not found.")
    
    try:
        vector_store = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        data = vector_store.get(include=["metadatas"])
        
        ids_to_delete = []
        if data and "ids" in data and "metadatas" in data:
            for i, meta in enumerate(data["metadatas"]):
                if meta and meta.get("filename") == filename:
                    ids_to_delete.append(data["ids"][i])
                    
        if ids_to_delete:
            vector_store.delete(ids_to_delete)
            query_cache.clear()
            return {"status": "success", "message": f"Deleted {filename} from vector store."}
        
        raise HTTPException(status_code=404, detail="Document not found in vector database.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def invoke_llm_with_retry(llm_instance, prompt, max_retries=3, initial_delay=5):
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            return llm_instance.invoke(prompt)
        except Exception as e:
            err_msg = str(e)
            if ("429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg) and attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise e

@app.post("/query")
def query_document(request: QueryRequest):
    cache_key = f"{request.filter_filename}:{request.question.strip().lower()}"
    if cache_key in query_cache:
        return query_cache[cache_key]

    if not os.path.exists(CHROMA_PATH):
        raise HTTPException(status_code=400, detail="No vector database found. Please upload a PDF first.")
        
    vector_store = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
    
    search_kwargs = {"k": request.k * 2}  # Fetch wider candidate pool for cross-encoder
    if request.filter_filename:
        search_kwargs["filter"] = {"filename": request.filter_filename}

    initial_results = vector_store.similarity_search(request.question, **search_kwargs)
    
    if initial_results:
        pairs = [[request.question, doc.page_content] for doc in initial_results]
        scores = reranker_model.predict(pairs)
        scored_docs = sorted(zip(initial_results, scores), key=lambda x: x[1], reverse=True)
        results = [doc for doc, score in scored_docs[:request.k]]
    else:
        results = []

    context_text = "\n\n---\n\n".join([str(doc.page_content).strip() for doc in results])
    
    prompt = f"""
    You are a precise document assistant. Read all provided context chunks carefully. When the user asks for a list, aggregate and list ALL items found across the entire context chunks.
    If information is completely absent, output: "I cannot find this information in the document."

    Context:
    {context_text}

    Question: {request.question}
    Answer:
    """
    
    try:
        response = invoke_llm_with_retry(llm, prompt)
        answer_text = str(response.content).strip()
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please wait.")
        raise HTTPException(status_code=500, detail=f"Google API Error: {err_msg}")
    
    response_data = {
        "question": request.question,
        "answer": answer_text,
        "context_used": context_text
    }
    query_cache[cache_key] = response_data
    return response_data