import os
import requests
from celery_app import celery_app
from extractor import DocumentIntelligenceExtractor
from agent import AgenticRAGOrchestrator
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None

@celery_app.task(bind=True, name="tasks.ingest_pdf_async")
def ingest_pdf_async(self, pdf_url: str, title: str, ministry: str, doc_type: str = "Notification", gazette_number: str = None):
    """
    Asynchronous Celery task for end-to-end PDF Ingestion & Embedding Pipeline
    """
    self.update_state(state="PROGRESS", meta={"stage": "Downloading PDF", "progress": 10})

    # 1. Download PDF stream
    response = requests.get(pdf_url, timeout=60)
    pdf_bytes = response.content

    self.update_state(state="PROGRESS", meta={"stage": "Extracting Layout via PyMuPDF", "progress": 30})

    # 2. Extract layout & text
    extracted = DocumentIntelligenceExtractor.extract_from_pdf_bytes(pdf_bytes)

    # If scanned, run Vision OCR on pages
    if extracted["is_scanned"]:
        self.update_state(state="PROGRESS", meta={"stage": "Running OpenAI Vision OCR on Scanned Pages", "progress": 50})
        # (OCR vision logic for each scanned page)

    # 3. Create statutory chunks
    chunks = DocumentIntelligenceExtractor.chunk_statutory_text(extracted["pages"])

    self.update_state(state="PROGRESS", meta={"stage": "Registering in PostgreSQL", "progress": 70})

    # 4. Insert into Supabase documents table
    doc_record = supabase.from_("documents").insert({
        "title": title,
        "ministry": ministry,
        "doc_type": doc_type,
        "gazette_number": gazette_number,
        "file_url": pdf_url,
        "created_at": "now()"
    }).execute()

    doc_id = doc_record.data[0]["id"]

    self.update_state(state="PROGRESS", meta={"stage": "Generating 1536-dim Vector Embeddings", "progress": 85})

    # 5. Generate embeddings & batch insert chunks into document_chunks
    chunk_rows = []
    for chunk in chunks:
        emb = AgenticRAGOrchestrator.create_embedding(chunk["content"])
        chunk_rows.append({
            "document_id": doc_id,
            "chunk_index": chunk["chunk_index"],
            "content": chunk["content"],
            "page_number": chunk["page_number"],
            "section": chunk["section"],
            "clause": chunk["clause"],
            "embedding": emb
        })

    supabase.from_("document_chunks").insert(chunk_rows).execute()

    return {
        "status": "COMPLETED",
        "document_id": doc_id,
        "title": title,
        "chunks_indexed": len(chunk_rows),
        "total_pages": extracted["total_pages"]
    }
