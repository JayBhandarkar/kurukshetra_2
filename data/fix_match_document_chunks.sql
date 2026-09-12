-- Drop all existing overloaded versions to eliminate the 300 Multiple Choices error
DROP FUNCTION IF EXISTS match_document_chunks(vector, int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), float, int, text);

-- Single canonical version used by both Python agent and Next.js fallback
-- Parameters match exactly what retrieval_agent.py and route.ts send:
--   query_embedding  : the 1536-dim query vector
--   match_threshold  : minimum cosine similarity (0.0–1.0), default 0.50
--   match_count      : max rows to return, default 5
--   filter_ministry  : exact ministry string filter, NULL = no filter
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT   DEFAULT 0.50,
  match_count      INT     DEFAULT 5,
  filter_ministry  TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  document_id      UUID,
  content          TEXT,
  doc_title        TEXT,
  ministry         TEXT,
  gazette_number   TEXT,
  doc_type         TEXT,
  publication_date DATE,
  financial_year   TEXT,
  section          TEXT,
  clause           TEXT,
  page_number      INT,
  similarity       FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    d.title          AS doc_title,
    d.ministry       AS ministry,
    d.gazette_number AS gazette_number,
    d.doc_type       AS doc_type,
    d.publication_date,
    d.financial_year,
    dc.content,
    dc.section,
    dc.clause,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE
    1 - (dc.embedding <=> query_embedding) >= match_threshold
    AND (filter_ministry IS NULL OR d.ministry = filter_ministry)
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
