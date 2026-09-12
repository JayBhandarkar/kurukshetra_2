-- =========================================================================
-- Fix: match_document_chunks RPC Function
-- Run this in Supabase SQL Editor → New Query → Run
--
-- Problem: Previous version referenced d.financial_year which does not
-- exist in the documents table, causing error 42703 on every query.
-- =========================================================================

-- Drop all existing overloaded versions to eliminate any 300 Multiple Choices error
DROP FUNCTION IF EXISTS match_document_chunks(vector, int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), float, int, text);
DROP FUNCTION IF EXISTS match_document_chunks(vector(1536), float, int, text, text);

-- Canonical version — matches exactly what retrieval_agent.py and route.ts send.
-- Removed financial_year (column does not exist in documents table).
-- Fixed SELECT column order to match RETURNS TABLE definition.
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT   DEFAULT 0.30,
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
    dc.content,
    d.title            AS doc_title,
    d.ministry         AS ministry,
    d.gazette_number   AS gazette_number,
    d.doc_type         AS doc_type,
    d.publication_date AS publication_date,
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
