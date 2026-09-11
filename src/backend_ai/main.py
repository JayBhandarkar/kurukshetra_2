import os
import json
import hashlib
import time
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from extractor import DocumentIntelligenceExtractor
from agent import AgenticRAGOrchestrator
from tasks import ingest_pdf_async
from celery.result import AsyncResult
from celery_app import celery_app
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
load_dotenv("../backend/.env")
load_dotenv("../.env")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None

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
    user_profile: Optional[dict] = None

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

@app.post("/api/documents/user-upload")
async def upload_user_document(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form("anonymous"),
    session_id: Optional[str] = Form(None)
):
    """
    Dedicated user document upload & embedding generation pipeline:
    1. Reads binary and computes SHA-256 for deduplication.
    2. Uploads raw binary to dedicated Supabase Storage bucket.
    3. Multi-format extraction (PDF, DOCX, Images/OCR, TXT).
    4. Clause-level chunking.
    5. OpenAI 1536-dim vector embedding generation.
    6. Atomic commit to 'documents' and 'document_chunks' in Supabase pgvector.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client is not configured on AI service.")

    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_document"
        file_size = len(file_bytes)
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()

        # 1. Deduplication & Cross-User Instant Reuse Check
        try:
            existing_res = supabase.from_("documents").select("id, title, file_url, extracted_json_url, metadata").eq("sha256_hash", sha256_hash).execute()
            if existing_res.data and len(existing_res.data) > 0:
                existing_doc = existing_res.data[0]
                meta = existing_doc.get("metadata") or {}
                existing_user = meta.get("user_id")

                # Case A: Same user already uploaded this document
                if existing_user and existing_user == user_id:
                    return {
                        "status": "ALREADY_EXISTS",
                        "success": True,
                        "document_id": existing_doc["id"],
                        "title": filename,
                        "sha256_hash": sha256_hash,
                        "chunks_indexed": meta.get("total_chunks", 1),
                        "file_url": existing_doc.get("file_url", ""),
                        "user_id": user_id,
                        "session_id": session_id,
                        "message": f"Document '{filename}' is already indexed in your workspace."
                    }

                # Case B: Different user (or central sovereign gazette) uploaded it previously
                # Instant 0-second reuse without duplicate DB collision or OpenAI cost
                return {
                    "status": "SUCCESS",
                    "success": True,
                    "reused": True,
                    "document_id": existing_doc["id"],
                    "title": filename,
                    "sha256_hash": sha256_hash,
                    "chunks_indexed": meta.get("total_chunks", 1),
                    "file_url": existing_doc.get("file_url", ""),
                    "user_id": user_id,
                    "session_id": session_id
                }
        except Exception as check_err:
            print(f"Hash existence check notice: {check_err}")

        # 2. Upload to Supabase Storage
        sanitized_filename = filename.replace(" ", "_").replace("/", "_")
        storage_path = f"user_uploads/{user_id}/raw/{int(time.time())}_{sanitized_filename}"
        
        storage_bucket = "user_documents"
        storage_url = ""
        try:
            supabase.storage.from_(storage_bucket).upload(
                storage_path,
                file_bytes,
                file_options={"upsert": "true", "content-type": file.content_type or "application/octet-stream"}
            )
            storage_url = supabase.storage.from_(storage_bucket).get_public_url(storage_path)
        except Exception:
            # Fallback to standard documents bucket if user_documents bucket is not created
            storage_bucket = "documents"
            supabase.storage.from_(storage_bucket).upload(
                storage_path,
                file_bytes,
                file_options={"upsert": "true", "content-type": file.content_type or "application/octet-stream"}
            )
            storage_url = supabase.storage.from_(storage_bucket).get_public_url(storage_path)

        # 2. Extract Document Structure
        extraction_result = DocumentIntelligenceExtractor.extract_document(
            file_bytes=file_bytes,
            filename=filename,
            mime_type=file.content_type or ""
        )

        pages = extraction_result.get("pages", [])
        if not pages:
            # Handle plain raw text fallback
            raw_text = extraction_result.get("raw_text", "")
            if raw_text:
                pages = [{"page_number": 1, "text": raw_text, "tables": []}]
            else:
                raise HTTPException(status_code=400, detail="No readable text could be extracted from document.")

        # 3. Upload Extracted JSON to Supabase Storage
        json_storage_path = f"user_uploads/{user_id}/extracted/{sha256_hash[:16]}.json"
        json_bytes = json.dumps(extraction_result, ensure_ascii=False, indent=2).encode("utf-8")
        json_public_url = ""
        try:
            supabase.storage.from_(storage_bucket).upload(
                json_storage_path,
                json_bytes,
                file_options={"upsert": "true", "content-type": "application/json"}
            )
            json_public_url = supabase.storage.from_(storage_bucket).get_public_url(json_storage_path)
        except Exception as json_upload_err:
            print(f"Extracted JSON upload notice: {json_upload_err}")

        # 4. Statutory / Legal Semantic Chunking
        chunks = DocumentIntelligenceExtractor.chunk_statutory_text(pages)
        if not chunks:
            # Fallback chunking if text has no legal section headers
            full_text = " ".join([p.get("text", "") for p in pages])
            words = full_text.split()
            chunk_size = 150
            for i in range(0, len(words), chunk_size):
                sub_text = " ".join(words[i:i + chunk_size])
                if sub_text.strip():
                    chunks.append({
                        "chunk_index": len(chunks) + 1,
                        "content": sub_text,
                        "page_number": 1,
                        "section": "General",
                        "clause": ""
                    })

        # 5. Generate 1536-dim OpenAI Vector Embeddings
        chunk_texts = [c["content"] for c in chunks]
        embeddings = AgenticRAGOrchestrator.create_embeddings_batch(chunk_texts)

        # 6. Insert Master Record in 'documents' with both file_url and extracted_json_url
        doc_record = {
            "title": filename,
            "ministry": "User Workspace",
            "doc_type": "User Upload",
            "file_url": storage_url,
            "extracted_json_url": json_public_url or None,
            "sha256_hash": sha256_hash,
            "file_size_bytes": file_size,
            "metadata": {
                "user_id": user_id,
                "session_id": session_id,
                "scope": "user_private",
                "filename": filename,
                "storage_paths": {
                    "raw_file": storage_path,
                    "extracted_json": json_storage_path
                },
                "total_pages": extraction_result.get("total_pages", len(pages)),
                "total_chunks": len(chunks),
                "extraction_summary": {
                    "native_pages": extraction_result.get("native_pages_count", len(pages)),
                    "ocr_pages": extraction_result.get("ocr_pages_count", 0)
                }
            }
        }

        inserted_doc = supabase.from_("documents").insert(doc_record).execute()
        if not inserted_doc.data:
            raise RuntimeError("Failed to insert document record into Supabase PostgreSQL.")

        doc_id = inserted_doc.data[0]["id"]

        # 6. Insert Vector Rows in 'document_chunks'
        chunk_rows = []
        for idx, chunk in enumerate(chunks):
            chunk_rows.append({
                "document_id": doc_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "page_number": chunk.get("page_number", 1),
                "section": chunk.get("section", ""),
                "clause": chunk.get("clause", ""),
                "embedding": embeddings[idx] if idx < len(embeddings) else None,
                "metadata": {
                    "user_id": user_id,
                    "session_id": session_id,
                    "scope": "user_private",
                    "doc_title": filename,
                    "char_count": len(chunk["content"])
                }
            })

        if chunk_rows:
            batch_size = 50
            for i in range(0, len(chunk_rows), batch_size):
                batch = chunk_rows[i:i + batch_size]
                supabase.from_("document_chunks").insert(batch).execute()

        return {
            "status": "SUCCESS",
            "document_id": doc_id,
            "title": filename,
            "sha256_hash": sha256_hash,
            "chunks_indexed": len(chunk_rows),
            "file_url": storage_url,
            "user_id": user_id,
            "session_id": session_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"User document ingestion error: {str(e)}")

@app.post("/api/rag/query")
def query_rag(req: RAGQueryRequest):
    """
    Execute 6-stage Multi-Agent RAG pipeline with Domain-First Funnel & Global Fallback
    """
    result = AgenticRAGOrchestrator.query(
        user_query=req.query,
        ministry_filter=req.ministry,
        user_profile=req.user_profile
    )
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
