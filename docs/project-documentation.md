# Project Documentation — Pramaan (प्रमाण)

**Sovereign Government Document Intelligence & Agentic RAG Platform**

---

## 1. Executive Summary

Navigating Indian government gazettes, policy notifications, and statutory circulars is fraught with complex legalese, fragmented document formats (both scanned and digital), and subtle cross-year amendments. 

**Pramaan** provides an enterprise sovereign intelligence layer over Indian public policy and gazette archives. Built with Next.js, FastAPI, pgvector, and OpenAI LLMs/Embeddings, Pramaan enables citizens, legal professionals, and policy analysts to query, compare, and verify government mandates with clause-level citations and interactive evidence tracing.

---

## 2. Core Architectural Pillars

### 2.1 6-Stage Agentic RAG
Unlike naive single-pass RAG, Pramaan executes queries through six discrete verification stages:
1. **Query Understanding & Normalization**: Strips colloquialisms, identifies Indian statutory terms (e.g. "Rule 37BB", "PMAY-G Phase III", "NEP credit transfer").
2. **Orchestrator Agent**: Formulates multi-clause retrieval plans and routes between semantic search and comparison routines.
3. **Hybrid Dense + Sparse Retrieval**: Queries Supabase pgvector with 1536-dimensional embeddings + keyword matching.
4. **Multi-Document Reasoning & Statutory Diffing**: Reconciles chronological amendments and conflicting circular clauses.
5. **Evidence Validation & Guardrails**: Enforces verbatim grounding, discarding any speculative claims lacking gazette citations.
6. **Cited Response Synthesis**: Generates conversational answers embedded with clickable citation badges linking to exact pages and clauses.

### 2.2 Hybrid Document Parser (PyMuPDF + GPT-4o Vision OCR)
* **Native Digital Born PDFs**: Extracted via PyMuPDF (`fitz`) for sub-millisecond layout, table, and clause bounding-box resolution.
* **Scanned Physical Gazettes**: Processed through OpenAI GPT-4o Vision to handle stamped pages, Hindi-English bilingual columns, and complex administrative tabular structures.

### 2.3 Automated & On-Demand Portal Crawler
* Actively discovers circulars from `egazette.gov.in` and `pib.gov.in`.
* Deduplicates files via SHA-256 and Gazette ID.
* Integrates an on-demand **"Sync / Crawl Portals"** trigger directly into the UI.

---

## 3. UI/UX Paradigm

* **Minimalist ChatGPT-Style Authenticated Workspace (`/app`)**: 70-80% screen space dedicated to AI dialogue and clear answers.
* **Collapsible Navigation Sidebar**: Seamless switching between *Ask Documents*, *Documents Library*, *Compare*, *Sources*, and *Settings*.
* **Slide-in Evidence Drawer**: Slides in from the right when an in-text citation badge is clicked, revealing verbatim excerpts, confidence scores, and official verification links.

---

## 4. Verification & Testing

* **Next.js Production Build**: Verified with 0 errors across all 18 static & dynamic routes.
* **FastAPI Backend**: Verified with full REST OpenAPI schema and Celery task broker.
