import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from extractor import DocumentIntelligenceExtractor
from agent import AgenticRAGOrchestrator
from tasks import ingest_pdf_async
from celery.result import AsyncResult
from celery_app import celery_app
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Pramaan AI & Ingestion Microservice",
    description="FastAPI service for PyMuPDF extraction, OpenAI Vision OCR, and LangChain Agentic RAG",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RAGQueryRequest(BaseModel):
    query: str
    ministry: Optional[str] = None

class IngestAsyncRequest(BaseModel):
    pdf_url: str
    title: str
    ministry: str
    doc_type: Optional[str] = "Notification"
    gazette_number: Optional[str] = None

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Pramaan Document Intelligence Microservice",
        "pyMuPDF": True,
        "openAI": bool(os.getenv("OPENAI_API_KEY")),
        "supabase": bool(os.getenv("NEXT_PUBLIC_SUPABASE_URL"))
    }

@app.post("/api/crawl/run")
def run_live_crawl(limit: int = 1):
    """
    Triggers official government document crawl, download, SHA-256 hash, PyMuPDF extraction,
    storage bucket upload (raw PDF & extracted JSON), and pgvector indexing.
    """
    from crawler import SovereignDocumentCrawler
    return SovereignDocumentCrawler.run_live_crawl(limit=limit)

@app.post("/api/extract/document")
@app.post("/api/extract/pdf")
async def extract_document(file: UploadFile = File(...)):
    """
    Universal multi-format document extraction endpoint:
    Supports PDF, Word (.docx), Images (.png, .jpg, .webp), and Plain Text (.txt, .md, .csv)
    """
    try:
        file_bytes = await file.read()
        extracted = DocumentIntelligenceExtractor.extract_document(
            file_bytes=file_bytes,
            filename=file.filename or "uploaded_document",
            mime_type=file.content_type or ""
        )
        return extracted
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Document extraction error: {str(err)}")

@app.post("/api/rag/query")
def query_rag(req: RAGQueryRequest):
    """
    Execute 6-stage Agentic RAG pipeline using LangChain and Supabase pgvector
    """
    result = AgenticRAGOrchestrator.query(user_query=req.query, ministry_filter=req.ministry)
    return result

@app.post("/api/tasks/ingest")
def start_async_ingest(req: IngestAsyncRequest):
    """
    Offload PDF download, PyMuPDF extraction, and pgvector embedding creation to Celery + Redis
    """
    task = ingest_pdf_async.delay(
        pdf_url=req.pdf_url,
        title=req.title,
        ministry=req.ministry,
        doc_type=req.doc_type,
        gazette_number=req.gazette_number
    )
    return {
        "task_id": task.id,
        "status": "QUEUED",
        "message": "PDF ingestion scheduled on Celery worker queue"
    }

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str):
    """
    Poll Celery task status for background ingestion
    """
    task_result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": task_result.status,
        "result": task_result.result if task_result.ready() else None
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
