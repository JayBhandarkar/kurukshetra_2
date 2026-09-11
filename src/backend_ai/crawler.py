import os
import hashlib
import json
import re
import requests
from typing import List, Dict, Any, Optional
from extractor import DocumentIntelligenceExtractor
from agent import AgenticRAGOrchestrator
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None

class SovereignDocumentCrawler:
    """
    Automated Crawler & Ingestion Pipeline:
    1. Discovers official Indian Government Acts, Circulars, and Gazettes.
    2. Downloads raw PDF binary.
    3. Calculates cryptographic SHA-256 hash for deduplication.
    4. Extracts structure via PyMuPDF (fitz) + automated Vision OCR fallback.
    5. Uploads raw PDF and extracted JSON to Supabase Storage.
    6. Registers master document record in PostgreSQL.
    7. Generates 1536-dim vector embeddings and inserts into pgvector.
    """

    OFFICIAL_PORTAL_CATALOG = [
        {
            "id": "dpdp-2023",
            "title": "Digital Personal Data Protection Act, 2023",
            "ministry": "Ministry of Electronics & Information Technology (MeitY)",
            "doc_type": "Central Act / Gazette",
            "gazette_number": "Act No. 22 of 2023",
            "publication_date": "2023-08-11",
            "pdf_url": "https://prsindia.org/files/bills_acts/bills_parliament/2023/Digital_Personal_Data_Protection_Act,_2023.pdf"
        },
        {
            "id": "telecom-2023",
            "title": "The Telecommunications Bill / Act, 2023",
            "ministry": "Ministry of Communications",
            "doc_type": "Central Act / Gazette",
            "gazette_number": "Bill No. 175 of 2023",
            "publication_date": "2023-12-18",
            "pdf_url": "https://prsindia.org/files/bills_acts/bills_parliament/2023/The%20Telecommunications%20Bill,%202023.pdf"
        }
    ]

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Calculates hexadecimal SHA-256 hash of binary stream"""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def slugify(text: str) -> str:
        """Sanitizes text for storage path keys"""
        clean = re.sub(r'[^a-zA-Z0-9_-]', '_', text.lower())
        return re.sub(r'_+', '_', clean).strip('_')

    @classmethod
    def upload_to_supabase_storage(cls, file_bytes: bytes, destination_path: str, content_type: str = "application/pdf") -> str:
        """
        Uploads binary payload to Supabase Storage 'documents' bucket and returns public URL
        """
        if not supabase:
            raise RuntimeError("Supabase client is not configured.")

        # Upload or overwrite file in storage bucket
        res = supabase.storage.from_("documents").upload(
            path=destination_path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "true"}
        )

        public_url_res = supabase.storage.from_("documents").get_public_url(destination_path)
        return public_url_res

    @classmethod
    def process_and_ingest_document(cls, doc_meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        End-to-End Pipeline for single government document:
        Download -> SHA256 -> Deduplicate -> PyMuPDF Extract -> Storage Upload (PDF + JSON) -> Database & Vectorize
        """
        url = doc_meta["pdf_url"]
        title = doc_meta["title"]
        ministry = doc_meta["ministry"]
        gazette_number = doc_meta.get("gazette_number", "Unnumbered")
        publication_date = doc_meta.get("publication_date", "2024-01-01")
        doc_type = doc_meta.get("doc_type", "Gazette Notification")

        print(f"\n📥 1. Downloading official PDF: {title} from {url}...")
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=45)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to download PDF from {url}. HTTP Status: {resp.status_code}")

        pdf_bytes = resp.content
        file_size = len(pdf_bytes)
        sha256_hash = cls.compute_sha256(pdf_bytes)
        print(f"🔒 Computed SHA-256: {sha256_hash} ({file_size / 1024:.1f} KB)")

        # 2. Check Deduplication in PostgreSQL
        if supabase:
            existing = supabase.from_("documents").select("id, title, sha256_hash").eq("sha256_hash", sha256_hash).execute()
            if existing.data and len(existing.data) > 0:
                print(f"⏩ Document already exists in database with ID: {existing.data[0]['id']}. Skipping duplicate.")
                return {
                    "status": "SKIPPED_DUPLICATE",
                    "document_id": existing.data[0]["id"],
                    "title": title,
                    "sha256_hash": sha256_hash,
                    "message": "Document already indexed with identical cryptographic hash."
                }

        # 3. Robust PyMuPDF Layout Extraction
        print(f"⚙️ 2. Extracting statutory layout and pages via PyMuPDF...")
        extraction_result = DocumentIntelligenceExtractor.extract_from_pdf_bytes(pdf_bytes, enable_vision_fallback=True)
        total_pages = extraction_result["total_pages"]
        print(f"📄 Extracted {total_pages} pages (Native: {extraction_result['native_pages_count']}, OCR: {extraction_result['ocr_pages_count']})")

        # 4. Upload Raw PDF to Supabase Storage
        ministry_slug = cls.slugify(ministry)[:30]
        year = publication_date.split("-")[0] if "-" in publication_date else "2024"
        pdf_storage_path = f"raw/{ministry_slug}/{year}/{sha256_hash[:16]}.pdf"
        json_storage_path = f"extracted/{ministry_slug}/{year}/{sha256_hash[:16]}.json"

        print(f"☁️ 3. Uploading raw PDF & extracted JSON to Supabase Storage...")
        pdf_public_url = cls.upload_to_supabase_storage(pdf_bytes, pdf_storage_path, content_type="application/pdf")

        # Upload Extracted JSON
        json_bytes = json.dumps(extraction_result, indent=2, ensure_ascii=False).encode("utf-8")
        json_public_url = cls.upload_to_supabase_storage(json_bytes, json_storage_path, content_type="application/json")
        print(f"✅ Storage PDF URL: {pdf_public_url}")
        print(f"✅ Storage JSON URL: {json_public_url}")

        # 5. Register in PostgreSQL documents table
        print(f"💾 4. Registering master record in PostgreSQL documents table...")
        doc_record = {
            "title": title,
            "ministry": ministry,
            "doc_type": doc_type,
            "gazette_number": gazette_number,
            "publication_date": publication_date,
            "file_url": pdf_public_url,
            "extracted_json_url": json_public_url,
            "sha256_hash": sha256_hash,
            "file_size_bytes": file_size,
            "metadata": {
                "total_pages": total_pages,
                "source_url": url,
                "storage_paths": {
                    "pdf": pdf_storage_path,
                    "extracted_json": json_storage_path
                },
                "extraction_summary": {
                    "native_pages": extraction_result["native_pages_count"],
                    "ocr_pages": extraction_result["ocr_pages_count"]
                }
            }
        }

        inserted_doc = supabase.from_("documents").insert(doc_record).execute()
        if not inserted_doc.data:
            raise RuntimeError("Failed to insert document record into Supabase PostgreSQL.")

        doc_id = inserted_doc.data[0]["id"]
        print(f"⭐ Master document record created with ID: {doc_id}")

        # 6. Statutory Chunking & Vectorization
        print(f"🧠 5. Creating statutory semantic chunks & generating OpenAI embeddings...")
        chunks = DocumentIntelligenceExtractor.chunk_statutory_text(extraction_result["pages"])
        
        # Batch generate all embeddings in one fast request
        chunk_texts = [c["content"] for c in chunks]
        embeddings = AgenticRAGOrchestrator.create_embeddings_batch(chunk_texts)

        chunk_rows = []
        for idx, chunk in enumerate(chunks):
            chunk_rows.append({
                "document_id": doc_id,
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "page_number": chunk["page_number"],
                "section": chunk["section"],
                "clause": chunk["clause"],
                "embedding": embeddings[idx] if idx < len(embeddings) else None,
                "metadata": {
                    "char_count": chunk.get("char_count", len(chunk["content"])),
                    "doc_title": title,
                    "ministry": ministry
                }
            })

        if chunk_rows:
            # Batch insert in chunks of 50 to avoid request size limits
            batch_size = 50
            for i in range(0, len(chunk_rows), batch_size):
                batch = chunk_rows[i:i + batch_size]
                supabase.from_("document_chunks").insert(batch).execute()
            print(f"🎯 Indexed {len(chunk_rows)} chunks into pgvector successfully!")

        return {
            "status": "SUCCESS",
            "document_id": doc_id,
            "title": title,
            "sha256_hash": sha256_hash,
            "file_size_kb": round(file_size / 1024, 2),
            "total_pages": total_pages,
            "chunks_indexed": len(chunk_rows),
            "storage_pdf_url": pdf_public_url,
            "storage_json_url": json_public_url
        }

    @classmethod
    def run_live_crawl(cls, limit: int = 1) -> Dict[str, Any]:
        """
        Executes discovery and ingestion on the catalog
        """
        results = []
        for item in cls.OFFICIAL_PORTAL_CATALOG[:limit]:
            try:
                res = cls.process_and_ingest_document(item)
                results.append(res)
            except Exception as err:
                print(f"❌ Error processing {item['title']}: {err}")
                results.append({"status": "FAILED", "title": item["title"], "error": str(err)})

        return {
            "processed": len(results),
            "details": results
        }
