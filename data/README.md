# Sovereign Data & Ingestion Specifications

This directory houses the dataset documentation, schema specifications, and portal crawler targets for **Pramaan (प्रमाण)**.

---

## 🏛 1. Official Data Sources & Crawl Targets

Pramaan indexes Indian central and state government notifications, gazettes, circulars, and statutory orders from authoritative portals:

| Source | Official Portal | Document Types & Jurisdiction |
| :--- | :--- | :--- |
| **eGazette of India** | `https://egazette.gov.in` | Extraordinary & Ordinary Gazette Notifications, Acts, Statutory Orders |
| **Press Information Bureau (PIB)** | `https://pib.gov.in` | Cabinet Decisions, Policy Releases, Ministry Press Releases |
| **Central Ministries** | `MeitY`, `MoF`, `MoE`, `MoHFW`, `MoRD` | Circulars, Office Memorandums, Operational Guidelines |

---

## 📊 2. Database & Vector Schemas

### A. `documents` Table
Stores immutable document metadata, ministry taxonomy, gazette identifiers, and publication dates.

```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  ministry TEXT NOT NULL,
  doc_type TEXT NOT NULL,          -- 'Notification', 'Circular', 'Government Order', 'Act'
  gazette_number TEXT,             -- e.g. 'F.No. 12-4/2025-U.Policy'
  publication_date DATE,
  file_url TEXT,
  file_size TEXT,
  status TEXT DEFAULT 'Indexed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### B. `document_chunks` Table (pgvector 1536d)
Stores extracted clauses, verbatim excerpts, physical page numbers, and 1536-dimensional dense vector embeddings with an HNSW cosine index.

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,           -- Clause / Section excerpt
  section TEXT,                    -- e.g. 'Section 4.2'
  clause TEXT,                     -- e.g. 'Clause 4.2(a)'
  page_number INTEGER,             -- Physical PDF page number
  embedding VECTOR(1536),          -- OpenAI text-embedding-3-small
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HNSW Vector Index for sub-15ms semantic search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops);
```

---

## 🔄 3. Ingestion & Extraction Workflow

1. **Discovery & Polling**: Crawlers fetch newly published notifications via automated background workers or live on-demand triggers (`/api/rag/crawl`).
2. **Deduplication**: Gazette numbers and SHA-256 hashes are matched against existing records to avoid duplicate processing.
3. **Extraction**:
   - **PyMuPDF (`fitz`)**: Instant structure, clause, and table parsing for digital born PDFs.
   - **GPT-4o Vision OCR**: High-fidelity layout and text recovery for scanned stamped gazettes.
4. **Vector Embedding**: Text chunks are embedded into 1536-dimensional vectors using OpenAI `text-embedding-3-small`.
5. **Storage & Instant Retrieval**: Saved directly to PostgreSQL (`pgvector`) for grounded Agentic RAG responses with verifiable citations.
