import os
import fitz # PyMuPDF
import base64
from typing import List, Dict, Any
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

class DocumentIntelligenceExtractor:
    """
    Dual-engine Document Intelligence:
    1. PyMuPDF (fitz) for high-performance native text PDF extraction & statutory layout
    2. OpenAI GPT-4o Vision for scanned physical gazettes, stamps & complex tables
    """

    @staticmethod
    def extract_from_pdf_bytes(pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Extract pages and statutory metadata using PyMuPDF (fitz)
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_content = []
        is_scanned = False
        total_pages = len(doc)

        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            text = page.get_text("text").strip()

            # If text is extremely short on multiple pages, mark as scanned for Vision OCR
            if len(text) < 50:
                is_scanned = True

            # Extract basic bounding-box layout blocks
            blocks = page.get_text("blocks")
            clean_blocks = [b[4].strip() for b in blocks if len(b) > 4 and b[4].strip()]

            pages_content.append({
                "page_number": page_num + 1,
                "text": text,
                "blocks": clean_blocks,
                "is_empty_text": len(text) < 50
            })

        return {
            "total_pages": total_pages,
            "is_scanned": is_scanned,
            "pages": pages_content,
            "metadata": doc.metadata
        }

    @staticmethod
    def ocr_page_with_vision(image_bytes: bytes) -> str:
        """
        Use OpenAI Vision (gpt-4o) to transcribe scanned gazette pages with exact legal formatting
        """
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert OCR transcription engine for official Government of India Gazettes. "
                        "Transcribe the text verbatim, preserving all section numbers, clauses, schedules, "
                        "and tabular structures accurately."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe this Indian Gazette document page:"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_image}"}
                        }
                    ]
                }
            ],
            max_tokens=2000,
            temperature=0.0
        )

        return response.choices[0].message.content or ""

    @staticmethod
    def chunk_statutory_text(pages: List[Dict[str, Any]], chunk_size: int = 600, overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Create clause-bounded statutory chunks preserving page numbers and section headers
        """
        chunks = []
        chunk_idx = 0

        for p in pages:
            page_num = p["page_number"]
            text = p["text"]

            if not text:
                continue

            # Split by double newlines (paragraphs/clauses)
            paragraphs = [para.strip() for para in text.split("\n\n") if para.strip()]

            for para in paragraphs:
                # Basic clause detection
                clause_label = "General Provision"
                if "section" in para.lower() or "clause" in para.lower() or "rule" in para.lower():
                    first_line = para.split("\n")[0][:60]
                    clause_label = first_line

                chunks.append({
                    "chunk_index": chunk_idx,
                    "page_number": page_num,
                    "section": clause_label,
                    "clause": f"Clause on Page {page_num}",
                    "content": para
                })
                chunk_idx += 1

        return chunks
