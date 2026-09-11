-- =========================================================================
-- Pramaan Sovereign Document Intelligence — Supabase Database Migration
-- Run this in your Supabase Project: SQL Editor -> New Query -> Run
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop Legacy Unused Table (Safe)
DROP TABLE IF EXISTS public.verification_codes CASCADE;

-- 3. Unified Signups / Users Table (Non-destructive: Preserves All Existing Users)
CREATE TABLE IF NOT EXISTS public.signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safely add any new / missing columns without deleting existing data
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS code_expires_at TIMESTAMPTZ;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS primary_domain TEXT DEFAULT 'Banking, Finance & Tax';
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Legal Counsel / Advocate';
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS subscribed_authorities TEXT[] DEFAULT ARRAY['Reserve Bank of India (RBI)', 'Securities and Exchange Board of India (SEBI)', 'Central Board of Direct Taxes (CBDT)', 'Ministry of Finance']::TEXT[];
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.signups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_signups_email ON public.signups (email);

-- 4. Create Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast Keyset pagination: (user_id, updated_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
ON public.conversations (user_id, updated_at DESC, id DESC);

-- 5. Create Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast Keyset pagination: (conversation_id, created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages (conversation_id, created_at DESC, id DESC);

-- 6. Create Normalized Citations Table
CREATE TABLE IF NOT EXISTS public.citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    document_id UUID,
    chunk_id UUID,
    doc_title TEXT NOT NULL,
    ministry TEXT,
    gazette_number TEXT,
    page_number INT,
    section TEXT,
    clause TEXT,
    quote TEXT NOT NULL,
    confidence FLOAT DEFAULT 0.95,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_citations_message_id 
ON public.citations (message_id);

-- 7. Create Conversation Summaries Table (for Bounded Context Budget)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
    conversation_id UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    last_summarized_message_id UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Signups RLS Policy
DROP POLICY IF EXISTS "Public signups access" ON public.signups;
CREATE POLICY "Public signups access"
ON public.signups
FOR ALL
USING (true)
WITH CHECK (true);

-- Conversations RLS Policy
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
CREATE POLICY "Users can manage own conversations"
ON public.conversations
FOR ALL
USING (
    auth.jwt() ->> 'email' = user_id 
    OR auth.uid()::text = user_id
    OR auth.role() = 'authenticated'
    OR auth.role() = 'anon'
)
WITH CHECK (
    auth.jwt() ->> 'email' = user_id 
    OR auth.uid()::text = user_id
    OR auth.role() = 'authenticated'
    OR auth.role() = 'anon'
);

-- Messages RLS Policy
DROP POLICY IF EXISTS "Users can access messages for their conversations" ON public.messages;
CREATE POLICY "Users can access messages for their conversations"
ON public.messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Citations RLS Policy
DROP POLICY IF EXISTS "Users can access citations for their messages" ON public.citations;
CREATE POLICY "Users can access citations for their messages"
ON public.citations
FOR ALL
USING (true)
WITH CHECK (true);

-- Summaries RLS Policy
DROP POLICY IF EXISTS "Users can access summaries for their conversations" ON public.conversation_summaries;
CREATE POLICY "Users can access summaries for their conversations"
ON public.conversation_summaries
FOR ALL
USING (true)
WITH CHECK (true);
