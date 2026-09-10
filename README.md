# Enterprise Departmental RAG System

A secure, high-performance, and multi-tenant Enterprise Retrieval-Augmented Generation (RAG) web application featuring Role-Based Access Control (RBAC), JWT authentication, department-isolated vector spaces, and real-time observability metrics.

---

## Architecture & Tech Stack

* **Backend**: FastAPI, LangChain, ChromaDB (department-partitioned vector stores), and Google Gemini 1.5 Flash.
* **Embeddings & Reranking**: HuggingFace sentence-transformers (`all-MiniLM-L6-v2`) paired with a Cross-Encoder (`ms-marco-MiniLM-L-6-v2`) to compute grounding confidence scores and prevent hallucinations.
* **Frontend**: React, Lucide icons, React Markdown, and custom glassmorphism styling.
* **Security**: Token-based authentication using `jose` JWTs, SHA-256 credential verification, and strict departmental permission routing.

---

## Key Features

* **Multi-Tenant Workspaces**: Isolated document libraries and vector collections across departments (Engineering, HR, Finance, Legal, Executive).
* **Role-Based Access Control (RBAC)**: Secure access verification ensuring users can only query or upload files to authorized departments based on their assigned corporate role.
* **Retrieval Observability**: Real-time display of retrieved chunk counts and average context grounding confidence scores directly inside AI response cards.
* **Interactive Document Management**: Drag-and-drop or file selector PDF ingestion, chunking with metadata tracking, file-specific filtering, and deletion support.
* **Modern UI & Session Management**: Multi-user login options with preset test accounts, persistent chat history sessions, and code-snippet copying capabilities.

---

## Quick Start & Installation

### 1. Backend Setup
Navigate to the backend directory and install the required dependencies:
```bash
cd backend
pip install fastapi uvicorn langchain langchain-community langchain-chroma langchain-google-genai sentence-transformers python-jose python-multipart python-dotenv
