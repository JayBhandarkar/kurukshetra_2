import os
import io
import re
import base64
from typing import List, Dict, Any, Optional
from openai import OpenAI
import fitz  # PyMuPDF
from PIL import Image
import docx
from dotenv import load_dotenv

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

class DocumentIntelligenceExtractor:
    """
    Universal Multi-Format Document Intelligence Extractor:
    Supported Formats:
    1. PDF (.pdf) - PyMuPDF high-throughput parsing with automated GPT-4o Vision fallback.
    2. Images (.png, .jpg, .jpeg, .webp, .tiff, .bmp) - Direct GPT-4o Vision statutory OCR.
    3. Word Documents (.docx) - Paragraph, section & table extraction.
    4. Text / Markdown / CSV (.txt, .md, .csv) - Robust multi-encoding statutory parser.

    Edge Cases Handled:
    - Empty / zero-byte / corrupt files
    - Password-protected / encrypted PDFs
    - Scanned / blurry / stamped physical pages
    - Multi-encoding text (UTF-8, Latin-1, CP1252, UTF-16)
    - Multi-column legal layout blocks
    """

    @classmethod
    def extract_document(cls, file_bytes: bytes, filename: str = "", mime_type: str = "") -> Dict[str, Any]:
        """
        Universal entry point that detects document format and executes appropriate extraction pipeline
        """
        if not file_bytes or len(file_bytes) == 0:
            raise ValueError("Empty file: 0 bytes received.")

        # Detect format from filename or file signature
        ext = filename.lower().split(".")[-1] if "." in filename else ""

        # Check PDF signature (%PDF-)
        if file_bytes.startswith(b"%PDF-") or ext == "pdf" or "pdf" in mime_type.lower():
            return cls.extract_from_pdf_bytes(file_bytes, filename=filename)

        # Check Word Document (.docx) (PK zip signature)
        elif file_bytes.startswith(b"PK\x03\x04") and (ext == "docx" or "word" in mime_type.lower() or "officedocument" in mime_type.lower()):
            return cls.extract_from_docx_bytes(file_bytes, filename=filename)

        # Check Image formats
        elif ext in ["png", "jpg", "jpeg", "webp", "tiff", "tif", "bmp"] or "image" in mime_type.lower():
            return cls.extract_from_image_bytes(file_bytes, filename=filename)

        # Text / CSV / Markdown
        elif ext in ["txt", "md", "csv", "json", "rtf"] or "text" in mime_type.lower():
            return cls.extract_from_text_bytes(file_bytes, filename=filename)

        # Fallback: Try PDF first, then text
        try:
            return cls.extract_from_pdf_bytes(file_bytes, filename=filename)
        except Exception:
            return cls.extract_from_text_bytes(file_bytes, filename=filename)

    # ==========================================
    # 1. PDF Extraction Engine
    # ==========================================
    @classmethod
    def extract_from_pdf_bytes(cls, pdf_bytes: bytes, filename: str = "", enable_vision_fallback: bool = True) -> Dict[str, Any]:
        """
        Extract pages, statutory metadata, and layout blocks using PyMuPDF (fitz)
        with automated quality scoring and GPT-4o Vision OCR fallback
        """
        if not pdf_bytes.startswith(b"%PDF-") and len(pdf_bytes) < 100:
            raise ValueError("Corrupted or invalid PDF header. Expected '%PDF-'.")

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        except Exception as e:
            raise ValueError(f"Unable to parse PDF stream. File may be corrupted: {e}")

        # Edge Case: Password Protected / Encrypted PDF
        if doc.is_encrypted:
            # Attempt empty password
            if not doc.authenticate(""):
                raise ValueError("PDF is encrypted and password-protected.")

        pages_content = []
        total_pages = len(doc)
        if total_pages == 0:
            raise ValueError("PDF has 0 pages.")

        ocr_pages_count = 0

        for page_num in range(total_pages):
            page = doc.load_page(page_num)
            text = page.get_text("text").strip()

            quality = cls.evaluate_page_quality(text, page)
            extraction_mode = "pymupdf_native"

            # If page is scanned/bad and OpenAI is configured, transcribe with Vision OCR
            if quality["needs_ocr"] and enable_vision_fallback and os.getenv("OPENAI_API_KEY"):
                try:
                    pix = page.get_pixmap(dpi=200)
                    img_bytes = pix.tobytes("png")
                    ocr_text = cls.ocr_page_with_vision(img_bytes)
                    if ocr_text and len(ocr_text.strip()) > 30:
                        text = ocr_text.strip()
                        extraction_mode = "gpt4o_vision"
                        ocr_pages_count += 1
                except Exception as e:
                    print(f"⚠️ Vision OCR fallback failed on page {page_num + 1}: {e}")

            # Extract layout blocks with bounding coordinates
            blocks = page.get_text("blocks")
            clean_blocks = [
                {
                    "bbox": [round(coord, 2) for coord in b[:4]],
                    "text": b[4].strip()
                }
                for b in blocks if len(b) > 4 and b[4].strip()
            ]

            pages_content.append({
                "page_number": page_num + 1,
                "text": text,
                "blocks": clean_blocks,
                "quality": quality,
                "extraction_mode": extraction_mode
            })

        return {
            "format": "PDF",
            "filename": filename,
            "total_pages": total_pages,
            "ocr_pages_count": ocr_pages_count,
            "native_pages_count": total_pages - ocr_pages_count,
            "metadata": doc.metadata,
            "pages": pages_content
        }

    # ==========================================
    # 2. Image Extraction Engine (GPT-4o Vision)
    # ==========================================
    @classmethod
    def extract_from_image_bytes(cls, image_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Transcribes scanned gazette images, notification snapshots, and stamped documents
        """
        try:
            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size
            img_format = img.format or "PNG"
        except Exception as e:
            raise ValueError(f"Invalid or corrupted image file: {e}")

        # OCR transcribe via GPT-4o Vision
        ocr_text = cls.ocr_page_with_vision(image_bytes)

        paragraphs = [p.strip() for p in ocr_text.split("\n\n") if p.strip()]
        blocks = [{"bbox": [0, 0, width, height], "text": p} for p in paragraphs]

        return {
            "format": f"IMAGE ({img_format})",
            "filename": filename,
            "total_pages": 1,
            "ocr_pages_count": 1,
            "native_pages_count": 0,
            "metadata": {"width": width, "height": height, "format": img_format},
            "pages": [
                {
                    "page_number": 1,
                    "text": ocr_text,
                    "blocks": blocks,
                    "quality": {
                        "char_count": len(ocr_text),
                        "word_count": len(ocr_text.split()),
                        "garbled_ratio": 0.0,
                        "image_count": 1,
                        "needs_ocr": True,
                        "reason": "Direct image format"
                    },
                    "extraction_mode": "gpt4o_vision"
                }
            ]
        }

    # ==========================================
    # 3. Word Document (.docx) Extraction Engine
    # ==========================================
    @classmethod
    def extract_from_docx_bytes(cls, docx_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Extracts structured paragraphs, headings, and tables from Word (.docx) documents
        """
        try:
            doc = docx.Document(io.BytesIO(docx_bytes))
        except Exception as e:
            raise ValueError(f"Invalid or corrupted DOCX file: {e}")

        all_text_parts = []
        blocks = []

        # Extract paragraphs & headings
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                all_text_parts.append(text)
                blocks.append({
                    "style": para.style.name if para.style else "Normal",
                    "text": text
                })

        # Extract tables
        for table_idx, table in enumerate(doc.tables):
            table_rows = []
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                if any(row_cells):
                    table_rows.append(" | ".join(row_cells))
            if table_rows:
                table_text = f"--- Table {table_idx + 1} ---\n" + "\n".join(table_rows)
                all_text_parts.append(table_text)
                blocks.append({"style": "Table", "text": table_text})

        full_text = "\n\n".join(all_text_parts)

        return {
            "format": "DOCX",
            "filename": filename,
            "total_pages": 1,
            "ocr_pages_count": 0,
            "native_pages_count": 1,
            "metadata": {"paragraph_count": len(doc.paragraphs), "table_count": len(doc.tables)},
            "pages": [
                {
                    "page_number": 1,
                    "text": full_text,
                    "blocks": blocks,
                    "quality": {
                        "char_count": len(full_text),
                        "word_count": len(full_text.split()),
                        "garbled_ratio": 0.0,
                        "image_count": 0,
                        "needs_ocr": False,
                        "reason": "Clean DOCX document structure"
                    },
                    "extraction_mode": "docx_native"
                }
            ]
        }

    # ==========================================
    # 4. Text / CSV / Markdown Extraction Engine
    # ==========================================
    @classmethod
    def extract_from_text_bytes(cls, text_bytes: bytes, filename: str = "") -> Dict[str, Any]:
        """
        Extracts plain text, CSV, or Markdown with auto-encoding fallback
        """
        text = ""
        used_encoding = "utf-8"

        # Try multiple encodings
        for enc in ["utf-8", "utf-8-sig", "latin-1", "cp1252", "utf-16"]:
            try:
                text = text_bytes.decode(enc)
                used_encoding = enc
                break
            except (UnicodeDecodeError, UnicodeError):
                continue

        if not text:
            text = text_bytes.decode("utf-8", errors="replace")
            used_encoding = "utf-8 (replace)"

        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        blocks = [{"text": p} for p in paragraphs]

        return {
            "format": "TEXT",
            "filename": filename,
            "total_pages": 1,
            "ocr_pages_count": 0,
            "native_pages_count": 1,
            "metadata": {"encoding": used_encoding, "size_bytes": len(text_bytes)},
            "pages": [
                {
                    "page_number": 1,
                    "text": text.strip(),
                    "blocks": blocks,
                    "quality": {
                        "char_count": len(text),
                        "word_count": len(text.split()),
                        "garbled_ratio": 0.0,
                        "image_count": 0,
                        "needs_ocr": False,
                        "reason": f"Plain text ({used_encoding})"
                    },
                    "extraction_mode": "text_native"
                }
            ]
        }

    # ==========================================
    # Quality Heuristics & OCR Helper
    # ==========================================
    @staticmethod
    def evaluate_page_quality(text: str, page: fitz.Page) -> Dict[str, Any]:
        char_count = len(text)
        words = text.split()
        word_count = len(words)

        if char_count > 0:
            garbled_chars = len(re.findall(r'[^\x20-\x7E\u0900-\u097F\n\r\t]', text))
            garbled_ratio = garbled_chars / char_count
        else:
            garbled_ratio = 1.0

        images = page.get_images()
        needs_ocr = False
        reason = "Clean digital text"

        if char_count < 60:
            needs_ocr = True
            reason = "Minimal or empty text extracted (< 60 chars)"
        elif garbled_ratio > 0.25:
            needs_ocr = True
            reason = f"High garbled character ratio ({garbled_ratio:.1%})"

        return {
            "char_count": char_count,
            "word_count": word_count,
            "garbled_ratio": round(garbled_ratio, 3),
            "image_count": len(images),
            "needs_ocr": needs_ocr,
            "reason": reason
        }

    @staticmethod
    def ocr_page_with_vision(image_bytes: bytes) -> str:
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert statutory OCR transcription engine for official Government Gazettes and Legal Acts. "
                        "Transcribe the text verbatim, preserving all section numbers, clauses, schedules, "
                        "tables, and legal numbering hierarchy accurately."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Transcribe this official government document page verbatim:"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{b64_image}"}
                        }
                    ]
                }
            ],
            max_tokens=2500,
            temperature=0.0
        )

        return response.choices[0].message.content or ""

    @staticmethod
    def chunk_statutory_text(pages: List[Dict[str, Any]], chunk_size: int = 800, overlap: int = 150) -> List[Dict[str, Any]]:
        chunks = []
        chunk_idx = 0

        for p in pages:
            page_num = p["page_number"]
            text = p["text"]

            if not text:
                continue

            paragraphs = [para.strip() for para in text.split("\n\n") if para.strip()]

            for para in paragraphs:
                clause_label = f"Page {page_num} Provision"
                lower_para = para.lower()
                if "section" in lower_para or "clause" in lower_para or "rule" in lower_para or "article" in lower_para:
                    first_line = para.split("\n")[0][:80]
                    clause_label = first_line

                chunks.append({
                    "chunk_index": chunk_idx,
                    "page_number": page_num,
                    "section": clause_label,
                    "clause": f"Clause on Page {page_num}",
                    "content": para,
                    "char_count": len(para)
                })
                chunk_idx += 1

        return chunks
