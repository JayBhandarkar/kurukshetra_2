# Pramaan — System Architecture Audit & Remaining Tasks

---

## 1. Executive Summary & Audit Status

We have conducted a full technical audit of the **Pramaan Sovereign Document Intelligence Platform** against all architectural specifications:
- **Landing Page**: 100% preserved and untouched (`/`).
- **Authenticated AI Workspace**: ChatGPT-inspired minimal conversational interface with floating composer, streaming agent activity stages, and slide-in **Evidence Drawer** (`/app`).
- **Document Intelligence & Extraction**: **PyMuPDF (`fitz`)** for native digital PDFs + **OpenAI GPT-4o Vision** for scanned physical gazettes.
- **Agentic AI**: **LangChain** 6-stage pipeline (`Query Understanding` ➔ `Orchestrator Agent` ➔ `Hybrid Retrieval` ➔ `Reasoning & Comparison` ➔ `Evidence Validation` ➔ `Response Generation`).
- **Asynchronous Task Queue**: **Celery + Redis** worker architecture for background PDF ingestion and 1536-dimensional vector embedding generation.
- **Vector Database**: **Supabase PostgreSQL + pgvector** with HNSW cosine index.

---

## 2. Completed Architecture Matrix

| Component | Technology | File / Location | Status |
| :--- | :--- | :--- | :--- |
| **Landing Page** | Next.js 16 + React + Tailwind | [`frontend/src/app/page.tsx`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/page.tsx) |  **Approved & Preserved** |
| **Auth & Verification Gate** | Resend API + Supabase Auth | [`frontend/src/app/verify/page.tsx`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/verify/page.tsx), [`email.ts`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/lib/email.ts) |  **Complete** |
| **ChatGPT-Style Workspace** | React + Lucide Icons | [`frontend/src/app/app/page.tsx`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/app/page.tsx) |  **Complete & Verified** |
| **Evidence / Source Drawer** | Slide-in Side Panel | [`frontend/src/app/app/page.tsx`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/app/page.tsx) |  **Complete & Verified** |
| **Live RAG API Routes** | Next.js API Routes | [`/api/rag/chat/route.ts`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/api/rag/chat/route.ts), [`/api/rag/ingest/route.ts`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/api/rag/ingest/route.ts) |  **Complete** |
| **OpenAI Embeddings (1536-dim)** | `text-embedding-3-small` | [`frontend/src/lib/openaiClient.ts`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/lib/openaiClient.ts) |  **Configured** |
| **Document Intelligence Engine** | PyMuPDF (`fitz`) + GPT-4o Vision | [`backend_ai/extractor.py`](file:///c:/Users/chinm/Documents/kurukshetra/backend_ai/extractor.py) |  **Complete** |
| **Agentic RAG Orchestrator** | LangChain + OpenAI | [`backend_ai/agent.py`](file:///c:/Users/chinm/Documents/kurukshetra/backend_ai/agent.py) |  **Complete** |
| **Async Background Workers** | Celery + Redis | [`backend_ai/tasks.py`](file:///c:/Users/chinm/Documents/kurukshetra/backend_ai/tasks.py), [`celery_app.py`](file:///c:/Users/chinm/Documents/kurukshetra/backend_ai/celery_app.py) |  **Complete** |
| **FastAPI Microservice** | FastAPI + Uvicorn | [`backend_ai/main.py`](file:///c:/Users/chinm/Documents/kurukshetra/backend_ai/main.py) |  **Complete** |
| **Docker Orchestration** | Docker Compose | [`docker-compose.yml`](file:///c:/Users/chinm/Documents/kurukshetra/docker-compose.yml) |  **Complete** |

---

## 3. Remaining Action Items (Action Checklist)

### Task 1: Execute `pgvector` Schema in Supabase SQL Editor
* **Status**: ⏳ *Pending User SQL Execution*
* **Action**: Run the provided SQL migration in your [Supabase SQL Editor](https://supabase.com/dashboard) to enable the `vector` extension and create:
  1. `public.documents`
  2. `public.document_chunks` (with column `embedding vector(1536)`)
  3. `document_chunks_embedding_idx` (HNSW Cosine Index)
  4. `match_document_chunks` RPC function

```sql
-- Quick copy-paste for Supabase SQL Editor:
create extension if not exists vector;

create table if not exists public.documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  ministry text not null,
  doc_type text not null,
  gazette_number text,
  publication_date date,
  file_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.document_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  chunk_index int not null,
  content text not null,
  page_number int,
  section text,
  clause text,
  embedding vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_threshold float default 0.60,
  match_count int default 5,
  filter_ministry text default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  doc_title text,
  ministry text,
  gazette_number text,
  page_number int,
  section text,
  clause text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    dc.id,
    dc.document_id,
    dc.content,
    d.title as doc_title,
    d.ministry,
    d.gazette_number,
    dc.page_number,
    dc.section,
    dc.clause,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where (filter_ministry is null or filter_ministry = 'All' or d.ministry = filter_ministry)
    and (1 - (dc.embedding <=> query_embedding)) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

### Task 2: Ingest Initial Live PDF Circulars
* **Status**: ⏳ *Ready to Run*
* **Action**: Once the Supabase SQL script is executed, populate the database with real Indian gazettes:
  * Option A: Use the `[Upload Document]` button in [`/app/documents`](http://localhost:3000/app) or call [`/api/rag/ingest`](file:///c:/Users/chinm/Documents/kurukshetra/frontend/src/app/api/rag/ingest/route.ts).
  * Option B: Trigger the Celery worker task `tasks.ingest_pdf_async` via FastAPI endpoint `POST http://localhost:8000/api/tasks/ingest`.

---

### Task 3: Background Worker Startup (Optional for Local Python)
* **Status**: ⏳ *Optional for Local Execution*
* **Action**: If you wish to run the Celery + Redis worker locally:
  ```bash
  # 1. Start Redis
  docker run -d -p 6379:6379 redis:alpine
  
  # 2. Start FastAPI Service
  cd backend_ai
  pip install -r requirements.txt
  uvicorn main:app --port 8000 --reload

  # 3. Start Celery Worker
  celery -A celery_app.celery_app worker --loglevel=info
  ```
  *(Or simply run `docker compose up --build`)*.

---

### Task 4: Push to GitHub Remote
* **Status**: ⏸️ *Paused per your instruction ("dont push wait")*
* **Action**: When you are ready to push to [`https://github.com/JayBhandarkar/kurukshetra_2.git`](https://github.com/JayBhandarkar/kurukshetra_2.git), simply let me know.
