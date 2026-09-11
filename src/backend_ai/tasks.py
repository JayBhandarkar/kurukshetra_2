import os
import requests
from celery_app import celery_app
from extractor import DocumentIntelligenceExtractor
from crawler import SovereignDocumentCrawler
from agent import AgenticRAGOrchestrator
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None

@celery_app.task(bind=True, name="tasks.run_daily_gazette_crawl")
def run_daily_gazette_crawl(self, limit: int = 5):
    """
    Automated recurring task triggered by Celery Beat:
    Discovers new gazettes, computes SHA-256, extracts, uploads to Supabase storage,
    and indexes embeddings into pgvector.
    """
    print("⏰ [Celery Beat] Initiating daily government document crawl...")
    result = SovereignDocumentCrawler.run_live_crawl(limit=limit)
    return {
        "status": "COMPLETED",
        "task_name": "daily_gazette_crawl",
        "result": result
    }

@celery_app.task(bind=True, name="tasks.ingest_pdf_async")
def ingest_pdf_async(self, pdf_url: str, title: str, ministry: str, doc_type: str = "Notification", gazette_number: str = None):
    """
    Asynchronous Celery task for on-demand single document ingestion
    """
    doc_meta = {
        "title": title,
        "ministry": ministry,
        "doc_type": doc_type,
        "gazette_number": gazette_number,
        "pdf_url": pdf_url
    }
    return SovereignDocumentCrawler.process_and_ingest_document(doc_meta)
