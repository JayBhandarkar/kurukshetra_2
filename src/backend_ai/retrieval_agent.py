from __future__ import annotations

import json
import os
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from dotenv import load_dotenv
from openai import OpenAI
from supabase import Client, create_client

from query_router import RoutingDecision, QueryIntent

load_dotenv()

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

_SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL",      "")
_SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
_OPENAI_KEY   = os.getenv("OPENAI_API_KEY",                "")

_openai_client: OpenAI           = OpenAI(api_key=_OPENAI_KEY)

# Thread-local Supabase client — each thread gets its own independent HTTP session.
# This prevents concurrent sub-query threads from sharing connection state, which
# caused random empty results when multiple queries ran in parallel.
_thread_local = threading.local()

def _get_supabase() -> Optional[Client]:
    """Return a thread-local Supabase client, creating one if needed."""
    if not (_SUPABASE_URL and _SUPABASE_KEY):
        return None
    if not getattr(_thread_local, "client", None):
        _thread_local.client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
    return _thread_local.client

# ---------------------------------------------------------------------------
# Domain → Ministry mapping  (mirrors agent.py for consistency)
# ---------------------------------------------------------------------------

DOMAIN_MINISTRY_MAP: dict[str, list[str]] = {
    "Banking, Finance & Tax": [
        "Ministry of Finance",
        "Ministry of Finance (CBDT)",
        "Ministry of Finance (RBI)",
        "Ministry of Finance (SEBI)",
        "Reserve Bank of India",
        "Reserve Bank of India (RBI)",
        "Securities and Exchange Board of India (SEBI)",
        "Central Board of Direct Taxes (CBDT)",
    ],
    "Corporate Law & Insolvency": [
        "Ministry of Corporate Affairs",
        "Ministry of Corporate Affairs (IBBI)",
        "Insolvency and Bankruptcy Board of India (IBBI)",
        "Competition Commission of India (CCI)",
    ],
    "Tech, AI & Data Protection": [
        "Ministry of Electronics & Information Technology (MeitY)",
        "Ministry of Electronics and Information Technology (MeitY)",
        "Ministry of Electronics and Information Technology",
        "Ministry of Electronics & IT (MeitY)",
        "MeitY",
        "Ministry of Communications",
        "Parliament of India",
    ],
    "Education & Research": [
        "Ministry of Education",
        "Ministry of Education (UGC)",
        "University Grants Commission",
        "All India Council for Technical Education",
    ],
    "Environment, Energy & Infra": [
        "Ministry of Environment, Forest & Climate Change",
        "Ministry of Environment, Forest and Climate Change",
        "Ministry of Environment, Forest and Climate Change (MoEFCC)",
        "Central Pollution Control Board",
        "Ministry of Power",
        "Ministry of New and Renewable Energy",
    ],
    "General Sovereign Administration": [
        "Cabinet Secretariat",
        "Parliament of India",
        "Department of Personnel and Training",
        "Government of India",
        "Ministry of Consumer Affairs",
        "Ministry of Health and Family Welfare",
        "Ministry of Commerce and Industry",
        "Ministry of Rural Development",
        "Ministry of Road Transport and Highways",
        "Ministry of Defence",
        "Ministry of Youth Affairs and Sports",
        "Ministry of Micro, Small & Medium Enterprises",
        "Ministry of Micro, Small and Medium Enterprises",
    ],
}

# Source authority weights for ranking (higher = more authoritative)
SOURCE_AUTHORITY: dict[str, float] = {
    "parliament of india":                                      1.00,
    "cabinet secretariat":                                      0.98,
    "supreme court of india":                                   0.97,
    "reserve bank of india":                                    0.96,
    "securities and exchange board of india (sebi)":            0.95,
    "central board of direct taxes (cbdt)":                     0.94,
    "ministry of finance":                                      0.93,
    "ministry of corporate affairs":                            0.92,
    "ministry of electronics & information technology (meity)": 0.91,
    "ministry of education":                                    0.90,
    "ministry of environment, forest & climate change":         0.89,
}

# Retrieval thresholds & limits
_TIER1_THRESHOLD = 0.60   # lowered from 0.65 — 0.65 was too aggressive
_TIER2_THRESHOLD = 0.30   # global fallback — wide net to ensure something always returns
_TIER1_PER_MIN   = 4     # chunks per ministry in domain funnel
_TIER1_MAX_MIN   = 6     # search all ministries in the domain (was 3, too narrow)
_TIER2_COUNT     = 8     # global fallback chunk count
_MIN_CHUNKS_PASS = 2     # minimum before triggering global fallback
_MAX_RESULT_CHUNKS = 6   # cap returned to synthesis agent

# ---------------------------------------------------------------------------
# Query optimisation prompt (called via OpenAI directly, LCEL-style)
# ---------------------------------------------------------------------------

_QUERY_OPTIMISATION_SYSTEM = """\
You are a search query optimiser for an Indian government document intelligence system.
Given a user query, extract and return a JSON object with EXACTLY these keys:
- search_text     : A single clean search string (max 80 chars) capturing the retrieval intent.
- keywords        : List of important domain keywords (Acts, rules, tax terms, policy jargon).
- act_names       : List of named Acts, Bills, or Regulations mentioned or implied.
- section_numbers : List of section/clause/rule numbers mentioned (e.g. "Section 80C").
- policy_names    : List of policy or scheme names (e.g. "PMAY", "NEP 2020", "FEMA").
- date_references : List of dates, years, or fiscal periods (e.g. "FY 2024-25", "2023").
- ministry_hint   : The single most relevant government ministry/body, or null.

Return ONLY the JSON object. No markdown, no extra text."""


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class OptimisedQuery:
    """LLM-enriched, searchable representation of the raw query."""
    original:        str
    search_text:     str
    keywords:        list[str]
    act_names:       list[str]
    section_numbers: list[str]
    policy_names:    list[str]
    date_references: list[str]
    ministry_hint:   Optional[str]


@dataclass
class RetrievedChunk:
    """A single ranked document chunk with metadata and provenance."""
    id:               str
    document_id:      str
    doc_title:        str
    ministry:         str
    gazette_number:   str
    doc_type:         str
    publication_date: Optional[str]
    financial_year:   Optional[str]
    page_number:      int
    section:          str
    clause:           str
    content:          str
    similarity:       float
    authority_score:  float
    composite_score:  float


@dataclass
class RetrievalResult:
    """
    Structured output returned to the next agent (e.g. AgenticRAGOrchestrator).
    """
    query:               str
    optimised_query:     OptimisedQuery
    chunks:              list[RetrievedChunk]
    search_mode:         str
    domain_applied:      str
    ministries_searched: list[str]
    filters_applied:     dict[str, Any]
    total_found:         int
    processing_notes:    list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _embed(text: str) -> list[float]:
    """Create a 1536-dim embedding using text-embedding-3-small."""
    resp = _openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text.replace("\n", " ").strip(),
        dimensions=1536,
    )
    return resp.data[0].embedding


def _authority_score(ministry: str) -> float:
    """Return a source authority weight for a given ministry string."""
    key = ministry.lower().strip()
    for name, score in SOURCE_AUTHORITY.items():
        if name in key or key in name:
            return score
    return 0.80


def _composite_score(similarity: float, authority: float, recency_boost: float = 0.0) -> float:
    """60% semantic similarity + 30% source authority + 10% recency boost."""
    return round(0.60 * similarity + 0.30 * authority + 0.10 * recency_boost, 4)


def _recency_boost(publication_date: Optional[str]) -> float:
    """Return a small boost (0.0–1.0) for recently published documents."""
    if not publication_date:
        return 0.0
    try:
        year_match = re.search(r"(\d{4})", publication_date)
        if not year_match:
            return 0.0
        age = datetime.now().year - int(year_match.group(1))
        if age <= 0:  return 1.0
        if age <= 1:  return 0.8
        if age <= 3:  return 0.5
        if age <= 5:  return 0.3
        return 0.1
    except Exception:
        return 0.0


def _parse_optimised_query(raw_json: str, original: str) -> OptimisedQuery:
    """Parse LLM JSON output into OptimisedQuery with safe fallbacks."""
    try:
        cleaned = re.sub(r"```(?:json)?", "", raw_json).strip().rstrip("`").strip()
        data = json.loads(cleaned)
        return OptimisedQuery(
            original=original,
            search_text=data.get("search_text", original)[:200],
            keywords=data.get("keywords", []),
            act_names=data.get("act_names", []),
            section_numbers=data.get("section_numbers", []),
            policy_names=data.get("policy_names", []),
            date_references=data.get("date_references", []),
            ministry_hint=data.get("ministry_hint"),
        )
    except Exception:
        return OptimisedQuery(
            original=original,
            search_text=original[:200],
            keywords=[],
            act_names=[],
            section_numbers=[],
            policy_names=[],
            date_references=[],
            ministry_hint=None,
        )


def _map_chunk(raw: dict) -> RetrievedChunk:
    """Convert a raw Supabase row into a typed RetrievedChunk."""
    ministry   = raw.get("ministry", "Government of India")
    pub_date   = raw.get("publication_date") or raw.get("date")
    similarity = float(raw.get("similarity", 0.0))
    authority  = _authority_score(ministry)
    recency    = _recency_boost(str(pub_date) if pub_date else None)

    return RetrievedChunk(
        id=raw.get("id", ""),
        document_id=raw.get("document_id", ""),
        doc_title=raw.get("doc_title", raw.get("title", "Official Gazette")),
        ministry=ministry,
        gazette_number=raw.get("gazette_number", ""),
        doc_type=raw.get("doc_type", "Notification"),
        publication_date=str(pub_date) if pub_date else None,
        financial_year=raw.get("financial_year"),
        page_number=int(raw.get("page_number", 1)),
        section=raw.get("section", ""),
        clause=raw.get("clause", ""),
        content=raw.get("content", ""),
        similarity=similarity,
        authority_score=authority,
        composite_score=_composite_score(similarity, authority, recency),
    )


def _apply_metadata_filters(
    chunks: list[RetrievedChunk],
    filters: dict[str, Any],
) -> list[RetrievedChunk]:
    """Post-filter chunks by metadata. Falls back to original list if all filtered out."""
    doc_type       = filters.get("doc_type")
    date_from      = filters.get("date_from")
    date_to        = filters.get("date_to")
    financial_year = filters.get("financial_year")

    result = []
    for chunk in chunks:
        if doc_type and chunk.doc_type and doc_type.lower() not in chunk.doc_type.lower():
            continue
        if financial_year and chunk.financial_year and financial_year not in chunk.financial_year:
            continue
        if date_from or date_to:
            year_match = re.search(r"(\d{4})", chunk.publication_date or "")
            if year_match:
                year = int(year_match.group(1))
                if date_from and year < date_from:
                    continue
                if date_to and year > date_to:
                    continue
        result.append(chunk)

    return result if result else chunks


def _pgvector_search(
    embedding: list[float],
    threshold: float,
    count: int,
    ministry: Optional[str] = None,
) -> list[dict]:
    """Execute a pgvector RPC call. Returns [] on any error."""
    client = _get_supabase()
    if not client:
        return []
    try:
        resp = client.rpc(
            "match_document_chunks",
            {
                "query_embedding": embedding,
                "match_threshold":  threshold,
                "match_count":      count,
                "filter_ministry":  ministry,
            },
        ).execute()
        return resp.data or []
    except Exception as exc:
        print(f"[RetrievalAgent] pgvector notice (ministry={ministry}): {exc}")
        return []


# ---------------------------------------------------------------------------
# RetrievalAgent
# ---------------------------------------------------------------------------

class RetrievalAgent:
    """
    Pramaan Retrieval Agent — multi-tier hybrid pgvector retrieval with
    LLM-powered query optimisation and composite result ranking.

    Entry point:
        result = RetrievalAgent.retrieve(
            routing_decision = decision,       # from QueryRouter.route()
            user_profile     = {...},          # from onboarding
            metadata_filters = {"doc_type": "Notification", "date_from": 2023},
        )

    Convenience entry point (no pre-built RoutingDecision needed):
        result = RetrievalAgent.retrieve_from_query(
            query        = "What are TDS rates for FY 2024-25?",
            user_profile = {"primary_domain": "Banking, Finance & Tax"},
        )
    """

    @classmethod
    def retrieve(
        cls,
        routing_decision: RoutingDecision,
        user_profile:      Optional[dict[str, Any]] = None,
        metadata_filters:  Optional[dict[str, Any]] = None,
        explicit_ministry: Optional[str]             = None,
    ) -> RetrievalResult:
        notes:            list[str] = []
        user_profile      = user_profile    or {}
        metadata_filters  = metadata_filters or {}

        # Reconstruct original query text from routing decision.
        # Always prefer the full original question for embedding — extracted
        # parameters (provision_or_policy, document_name) are too narrow and
        # often miss indexed chunks that match the complete question well.
        # Extracted values are still used by _optimise_query to enrich keywords.
        raw_query  = routing_decision.raw.get("original_query", "")
        query_text = raw_query or (
            routing_decision.parameters.get("provision_or_policy")
            or routing_decision.parameters.get("document_name")
            or "government policy"
        )

        # ------------------------------------------------------------------
        # 1. Define search scope
        # ------------------------------------------------------------------
        primary_domain  = user_profile.get("primary_domain", "Banking, Finance & Tax")
        scope_ministries = DOMAIN_MINISTRY_MAP.get(primary_domain, [])

        router_ministry    = routing_decision.parameters.get("ministry")
        effective_ministry = (
            explicit_ministry
            if explicit_ministry and explicit_ministry not in ("All", "All Ministries")
            else (router_ministry or None)
        )
        notes.append(f"Scope: domain='{primary_domain}', ministry='{effective_ministry}'")

        # ------------------------------------------------------------------
        # 2. Optimise the query via OpenAI
        # ------------------------------------------------------------------
        optimised = cls._optimise_query(query_text, notes)

        if not effective_ministry and optimised.ministry_hint:
            effective_ministry = optimised.ministry_hint
            notes.append(f"Ministry hint from optimiser: '{effective_ministry}'")

        # Merge date from routing decision into filters
        if routing_decision.parameters.get("date_or_period") and not metadata_filters.get("date_from"):
            year_match = re.search(r"(\d{4})", routing_decision.parameters["date_or_period"])
            if year_match:
                metadata_filters["date_from"] = int(year_match.group(1))

        # ------------------------------------------------------------------
        # 3. Embed the optimised search text
        # ------------------------------------------------------------------
        query_vector = _embed(optimised.search_text)
        notes.append(f"Embedded: '{optimised.search_text[:60]}…'")

        # ------------------------------------------------------------------
        # 4 & 7. Tiered retrieval (domain funnel → global fallback)
        # ------------------------------------------------------------------
        raw_chunks, search_mode, ministries_searched = cls._tiered_retrieval(
            query_vector=query_vector,
            effective_ministry=effective_ministry,
            primary_domain=primary_domain,
            scope_ministries=scope_ministries,
            notes=notes,
        )

        # ------------------------------------------------------------------
        # 5. Map + metadata post-filter
        # ------------------------------------------------------------------
        typed   = [_map_chunk(r) for r in raw_chunks]
        filtered = _apply_metadata_filters(typed, metadata_filters)
        if len(filtered) < len(typed):
            notes.append(
                f"Metadata filter: {len(typed)} → {len(filtered)} chunks "
                f"(filters={metadata_filters})"
            )

        # ------------------------------------------------------------------
        # 6. Rank by composite score, deduplicate
        # ------------------------------------------------------------------
        ranked = cls._rank(filtered)
        notes.append(f"Ranked {len(ranked)} unique chunks")

        return RetrievalResult(
            query=query_text,
            optimised_query=optimised,
            chunks=ranked[:_MAX_RESULT_CHUNKS],
            search_mode=search_mode,
            domain_applied=primary_domain,
            ministries_searched=ministries_searched,
            filters_applied=metadata_filters,
            total_found=len(ranked),
            processing_notes=notes,
        )

    @classmethod
    def retrieve_from_query(
        cls,
        query:             str,
        user_profile:      Optional[dict[str, Any]] = None,
        metadata_filters:  Optional[dict[str, Any]] = None,
        explicit_ministry: Optional[str]             = None,
    ) -> RetrievalResult:
        """Convenience wrapper — runs QueryRouter internally."""
        from query_router import QueryRouter
        router   = QueryRouter()
        decision = router.route(query)
        decision.raw["original_query"] = query
        return cls.retrieve(
            routing_decision=decision,
            user_profile=user_profile,
            metadata_filters=metadata_filters,
            explicit_ministry=explicit_ministry,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _optimise_query(query: str, notes: list[str]) -> OptimisedQuery:
        """Call OpenAI directly to produce a structured, searchable query."""
        try:
            response = _openai_client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _QUERY_OPTIMISATION_SYSTEM},
                    {"role": "user",   "content": query},
                ],
            )
            raw_json = response.choices[0].message.content or "{}"
            oq = _parse_optimised_query(raw_json, query)
            notes.append(
                f"Query optimised → keywords={oq.keywords}, "
                f"acts={oq.act_names}, sections={oq.section_numbers}"
            )
            return oq
        except Exception as exc:
            notes.append(f"Query optimisation fallback (error: {exc})")
            return OptimisedQuery(
                original=query,
                search_text=query[:200],
                keywords=[],
                act_names=[],
                section_numbers=[],
                policy_names=[],
                date_references=[],
                ministry_hint=None,
            )

    @staticmethod
    def _tiered_retrieval(
        query_vector:      list[float],
        effective_ministry: Optional[str],
        primary_domain:    str,
        scope_ministries:  list[str],
        notes:             list[str],
    ) -> tuple[list[dict], str, list[str]]:
        raw_chunks:          list[dict] = []
        ministries_searched: list[str]  = []
        search_mode:         str        = "GLOBAL_FALLBACK"

        # Tier 1a — explicit ministry filter
        if effective_ministry:
            rows = _pgvector_search(query_vector, _TIER1_THRESHOLD, 5, effective_ministry)
            if rows:
                raw_chunks      = rows
                search_mode     = f"EXPLICIT_MINISTRY_SCOPED ({effective_ministry})"
                ministries_searched.append(effective_ministry)
                notes.append(f"Tier 1a: {len(rows)} chunks from '{effective_ministry}'")

        # Tier 1b — domain funnel across top N ministries
        if not raw_chunks and scope_ministries:
            seen_ids: set[str] = set()
            for ministry in scope_ministries[:_TIER1_MAX_MIN]:
                rows = _pgvector_search(query_vector, _TIER1_THRESHOLD, _TIER1_PER_MIN, ministry)
                ministries_searched.append(ministry)
                for row in rows:
                    if row["id"] not in seen_ids:
                        raw_chunks.append(row)
                        seen_ids.add(row["id"])
            if raw_chunks:
                search_mode = "DOMAIN_FUNNEL_PRIORITIZED"
                notes.append(f"Tier 1b: {len(raw_chunks)} chunks from domain funnel ({primary_domain})")

        # Tier 2 — global fallback
        if len(raw_chunks) < _MIN_CHUNKS_PASS:
            notes.append(f"Tier 2 triggered ({len(raw_chunks)} domain chunks — below threshold)")
            global_rows = _pgvector_search(query_vector, _TIER2_THRESHOLD, _TIER2_COUNT, None)
            seen_ids    = {c["id"] for c in raw_chunks}
            new_chunks  = [r for r in global_rows if r["id"] not in seen_ids]
            raw_chunks.extend(new_chunks)
            search_mode = (
                "CROSS_DOMAIN_EXPANDED"
                if search_mode == "DOMAIN_FUNNEL_PRIORITIZED"
                else "GLOBAL_SOVEREIGN_FALLBACK"
            )
            for r in new_chunks:
                m = r.get("ministry", "Unknown")
                if m not in ministries_searched:
                    ministries_searched.append(m)
            notes.append(f"Tier 2: +{len(new_chunks)} global chunks")

        return raw_chunks, search_mode, ministries_searched

    @staticmethod
    def _rank(chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
        """Sort by composite_score descending, deduplicating by content fingerprint."""
        seen:   set[int]          = set()
        unique: list[RetrievedChunk] = []
        for chunk in sorted(chunks, key=lambda c: c.composite_score, reverse=True):
            fp = hash(chunk.content[:120].strip().lower())
            if fp not in seen:
                seen.add(fp)
                unique.append(chunk)
        return unique

