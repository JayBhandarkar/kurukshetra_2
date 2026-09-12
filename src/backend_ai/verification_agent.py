"""
verification_agent.py
---------------------
Pramaan Verification Agent — Quality-Control Layer

Receives a RetrievalResult from the Retrieval Agent and a user query/intent,
then executes a multi-stage verification pipeline:

  1. Relevance Verification     — LLM scores each chunk against the query
  2. Source Authenticity Check  — validates ministry/source against trusted registry
  3. Evidence Support Check     — confirms claims are grounded in chunk content
  4. Deduplication & Pruning    — removes weak, duplicate, or low-context chunks
  5. Citation Generation        — builds structured citations per verified chunk
  6. Original Document Access   — resolves PDF URLs for direct source access

Output: VerificationResult with verified citations ready for the synthesis agent.

Dependencies: openai, python-dotenv  (already in requirements.txt)
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from dotenv import load_dotenv
from openai import OpenAI

from retrieval_agent import RetrievalResult, RetrievedChunk
from query_router import QueryIntent

load_dotenv()

_OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
_openai_client = OpenAI(api_key=_OPENAI_KEY)

# ---------------------------------------------------------------------------
# Trusted source registry
# ---------------------------------------------------------------------------

# Official government domains — used for PDF URL validation
TRUSTED_DOMAINS: set[str] = {
    "egazette.gov.in",
    "gazette.gov.in",
    "indiacode.nic.in",
    "legislative.gov.in",
    "mca.gov.in",
    "meity.gov.in",
    "rbi.org.in",
    "sebi.gov.in",
    "cbdt.gov.in",
    "incometaxindia.gov.in",
    "pib.gov.in",
    "education.gov.in",
    "ugc.gov.in",
    "moefcc.gov.in",
    "mof.gov.in",
    "finmin.nic.in",
    "ibbi.gov.in",
    "cci.gov.in",
    "cert-in.org.in",
    "dopt.gov.in",
    "cabsec.nic.in",
    "prsindia.org",
    "irdai.gov.in",
    "trai.gov.in",
    "npci.org.in",
    "gov.in",
    "nic.in",
}

# Trusted ministry/body names (lowercase substrings)
TRUSTED_MINISTRY_PATTERNS: list[str] = [
    "ministry of",
    "parliament of india",
    "cabinet secretariat",
    "reserve bank of india",
    "securities and exchange board",
    "central board of direct taxes",
    "central board of indirect taxes",
    "insolvency and bankruptcy board",
    "competition commission",
    "university grants commission",
    "all india council for technical education",
    "central pollution control board",
    "department of",
    "government of india",
    "niti aayog",
    "supreme court",
    "high court",
    "national",
    "cert-in",
    "irdai",
    "trai",
    "npci",
]

# Thresholds
_MIN_RELEVANCE_SCORE   = 0.55   # LLM relevance score below this → rejected
_MIN_SIMILARITY        = 0.45   # pgvector similarity below this → rejected
_MIN_CONTENT_LENGTH    = 40     # characters — too short = insufficient context
_MAX_VERIFIED_CHUNKS   = 5      # cap output to top 5 verified chunks
_DEDUP_FINGERPRINT_LEN = 100    # chars used for content deduplication

# Egazette fallback base URL
_EGAZETTE_BASE = "https://egazette.gov.in"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class VerifiedCitation:
    """
    A single fully-verified, citation-annotated evidence unit
    ready for the synthesis/response agent.
    """
    # Identity
    chunk_id:      str
    document_id:   str

    # Document metadata
    doc_title:     str
    ministry:      str
    gazette_number: str
    doc_type:      str
    publication_date: Optional[str]

    # Location within document
    page_number:   int
    section:       str
    clause:        str

    # Evidence content
    content:       str                 # verbatim statutory text

    # Scores
    similarity:        float           # semantic similarity from pgvector
    relevance_score:   float           # LLM-assigned relevance (0.0–1.0)
    authority_score:   float           # source authority weight
    composite_score:   float           # final ranking score

    # Source access
    pdf_url:       str                 # direct link to original document
    is_trusted_source: bool            # passed authenticity check

    # Citation reference string  (e.g. "CBDT Circular · Page 5 · Section 194C")
    citation_ref:  str


@dataclass
class VerificationResult:
    """
    Output of the Verification Agent — passed to the synthesis/RAG agent.
    """
    query:                  str
    intent:                 str
    verified_citations:     list[VerifiedCitation]   # top verified evidence
    rejected_count:         int                      # chunks that failed checks
    rejection_reasons:      dict[str, list[str]]     # chunk_id → reasons
    all_trusted:            bool                     # True if all sources passed auth
    verification_notes:     list[str]                # trace log


# ---------------------------------------------------------------------------
# System prompt for LLM relevance + evidence scoring
# ---------------------------------------------------------------------------

_VERIFICATION_SYSTEM = """\
You are a verification specialist for Pramaan, an Indian government document intelligence platform.
You will receive a user query and a list of retrieved document chunks.

For each chunk, you must assess:
1. relevance_score  (0.0–1.0): How relevant is this chunk to answering the user's query?
   - 1.0 = directly answers the query with specific statutory provisions
   - 0.7 = related and useful context
   - 0.5 = marginally relevant
   - below 0.5 = not relevant
2. evidence_support (true/false): Does the chunk content directly support or substantiate
   claims that would be made in a response to this query?
3. rejection_reason (string or null): If relevance_score < 0.55 or evidence_support is false,
   provide a brief reason. Otherwise null.

Return a JSON array with one object per chunk, in the same order as input:
[
  {
    "chunk_id": "...",
    "relevance_score": 0.0,
    "evidence_support": true,
    "rejection_reason": null
  },
  ...
]
Return ONLY the JSON array. No markdown, no extra text."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_trusted_domain(url: str) -> bool:
    """Return True if the URL belongs to a known trusted government domain."""
    if not url:
        return False
    url_lower = url.lower()
    return any(domain in url_lower for domain in TRUSTED_DOMAINS)


def _is_trusted_ministry(ministry: str) -> bool:
    """Return True if the ministry string matches a trusted authority pattern."""
    m = ministry.lower().strip()
    return any(pattern in m for pattern in TRUSTED_MINISTRY_PATTERNS)


def _resolve_pdf_url(chunk: RetrievedChunk) -> str:
    """
    Resolve the best available PDF URL for a chunk.
    Falls back to egazette search if no direct URL is available.
    """
    # Check if document has a direct file_url stored (joined via document_id lookup)
    # For now we rely on what's in the chunk; the DB join happens at ingest time
    if hasattr(chunk, "file_url") and chunk.file_url:
        return chunk.file_url
    # Construct a reasonable fallback
    if chunk.gazette_number:
        slug = chunk.gazette_number.replace("/", "-").replace(" ", "-")
        return f"{_EGAZETTE_BASE}/search?q={slug}"
    return _EGAZETTE_BASE


def _build_citation_ref(chunk: RetrievedChunk) -> str:
    """Build a human-readable citation reference string."""
    parts = [chunk.doc_title]
    if chunk.gazette_number:
        parts.append(chunk.gazette_number)
    parts.append(f"Page {chunk.page_number}")
    if chunk.section:
        parts.append(chunk.section)
    if chunk.clause:
        parts.append(chunk.clause)
    return " · ".join(p for p in parts if p)


def _llm_verify_chunks(
    query: str,
    intent: str,
    chunks: list[RetrievedChunk],
) -> list[dict]:
    """
    Call GPT-4o-mini to score relevance and evidence support for each chunk.
    Returns list of dicts with chunk_id, relevance_score, evidence_support, rejection_reason.
    Falls back to heuristic scores on any error.
    """
    if not chunks:
        return []

    chunk_summaries = []
    for i, c in enumerate(chunks):
        chunk_summaries.append({
            "chunk_id": c.id or f"chunk-{i}",
            "doc_title": c.doc_title,
            "ministry": c.ministry,
            "section": c.section,
            "clause": c.clause,
            "content_preview": c.content[:400],
        })

    user_message = (
        f"User Query: {query}\n"
        f"Query Intent: {intent}\n\n"
        f"Retrieved Chunks:\n{json.dumps(chunk_summaries, indent=2)}"
    )

    try:
        response = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _VERIFICATION_SYSTEM},
                {"role": "user",   "content": user_message},
            ],
        )
        raw = response.choices[0].message.content or "[]"
        # The model returns a JSON object wrapping the array
        parsed = json.loads(raw)
        # Handle both {"results": [...]} and direct array wrapped in object
        if isinstance(parsed, dict):
            for key in ("results", "chunks", "verifications", "items"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
            # Single chunk result returned as object
            if "chunk_id" in parsed:
                return [parsed]
            return list(parsed.values())[0] if parsed else []
        if isinstance(parsed, list):
            return parsed
        return []
    except Exception as exc:
        print(f"[VerificationAgent] LLM verification fallback: {exc}")
        # Heuristic fallback — pass everything with similarity-based score
        return [
            {
                "chunk_id": c.id or f"chunk-{i}",
                "relevance_score": min(c.similarity + 0.1, 1.0),
                "evidence_support": c.similarity >= _MIN_SIMILARITY,
                "rejection_reason": None if c.similarity >= _MIN_SIMILARITY
                                    else "Below similarity threshold (fallback)",
            }
            for i, c in enumerate(chunks)
        ]


def _dedup_chunks(chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Remove duplicate chunks based on content fingerprint."""
    seen:   set[int]          = set()
    unique: list[RetrievedChunk] = []
    for chunk in chunks:
        fp = hash(chunk.content[:_DEDUP_FINGERPRINT_LEN].strip().lower())
        if fp not in seen:
            seen.add(fp)
            unique.append(chunk)
    return unique


# ---------------------------------------------------------------------------
# VerificationAgent
# ---------------------------------------------------------------------------

class VerificationAgent:
    """
    Pramaan Verification Agent.

    Entry point:
        result = VerificationAgent.verify(
            retrieval_result = retrieval_result,   # from RetrievalAgent.retrieve()
            query            = "user query string",
            intent           = QueryIntent.QUESTION_ANSWERING,
        )

    Returns a VerificationResult with verified citations ready for synthesis.
    """

    @classmethod
    def verify(
        cls,
        retrieval_result: RetrievalResult,
        query:            str,
        intent:           QueryIntent = QueryIntent.QUESTION_ANSWERING,
    ) -> VerificationResult:
        notes:             list[str]         = []
        rejection_reasons: dict[str, list[str]] = {}
        intent_str = intent.value if hasattr(intent, "value") else str(intent)

        chunks = retrieval_result.chunks
        notes.append(f"Received {len(chunks)} chunks from retrieval agent")

        # ------------------------------------------------------------------
        # Step 1 — Pre-filter: minimum similarity + content length
        # ------------------------------------------------------------------
        pre_filtered: list[RetrievedChunk] = []
        for chunk in chunks:
            reasons: list[str] = []
            if chunk.similarity < _MIN_SIMILARITY:
                reasons.append(
                    f"Similarity {chunk.similarity:.2f} below threshold {_MIN_SIMILARITY}"
                )
            if len(chunk.content.strip()) < _MIN_CONTENT_LENGTH:
                reasons.append("Content too short — insufficient context")
            if reasons:
                rejection_reasons[chunk.id or chunk.doc_title] = reasons
            else:
                pre_filtered.append(chunk)

        notes.append(
            f"Pre-filter: {len(pre_filtered)}/{len(chunks)} chunks passed "
            f"(similarity ≥ {_MIN_SIMILARITY}, length ≥ {_MIN_CONTENT_LENGTH})"
        )

        # ------------------------------------------------------------------
        # Step 2 — Deduplication
        # ------------------------------------------------------------------
        deduped = _dedup_chunks(pre_filtered)
        dropped = len(pre_filtered) - len(deduped)
        if dropped:
            notes.append(f"Deduplication removed {dropped} duplicate chunk(s)")

        # ------------------------------------------------------------------
        # Step 3 — Source authenticity check
        # ------------------------------------------------------------------
        authenticity_map: dict[str, bool] = {}
        for chunk in deduped:
            trusted_ministry = _is_trusted_ministry(chunk.ministry)
            trusted_domain   = _is_trusted_domain(_resolve_pdf_url(chunk))
            authenticity_map[chunk.id] = trusted_ministry or trusted_domain
            if not authenticity_map[chunk.id]:
                key = chunk.id or chunk.doc_title
                rejection_reasons.setdefault(key, []).append(
                    f"Unverified source: '{chunk.ministry}'"
                )
                notes.append(f"  ⚠ Untrusted source flagged: {chunk.ministry}")

        notes.append(
            f"Source auth: {sum(authenticity_map.values())}/{len(deduped)} chunks "
            "from trusted government sources"
        )

        # ------------------------------------------------------------------
        # Step 4 — LLM relevance + evidence support scoring
        # ------------------------------------------------------------------
        llm_scores = _llm_verify_chunks(query, intent_str, deduped)

        # Index by chunk_id for fast lookup
        score_map: dict[str, dict] = {}
        for score in llm_scores:
            cid = score.get("chunk_id", "")
            score_map[cid] = score

        notes.append(f"LLM scored {len(score_map)} chunks for relevance and evidence support")

        # ------------------------------------------------------------------
        # Step 5 — Build verified citations, reject weak chunks
        # ------------------------------------------------------------------
        verified: list[VerifiedCitation] = []

        for chunk in deduped:
            cid    = chunk.id or ""
            scores = score_map.get(cid, {})
            relevance     = float(scores.get("relevance_score",  chunk.similarity))
            evidence_ok   = bool(scores.get("evidence_support",  True))
            llm_rejection = scores.get("rejection_reason")

            rejection: list[str] = []

            if relevance < _MIN_RELEVANCE_SCORE:
                rejection.append(
                    f"LLM relevance {relevance:.2f} below threshold {_MIN_RELEVANCE_SCORE}"
                )
            if not evidence_ok:
                rejection.append(
                    llm_rejection or "LLM: evidence does not support query claims"
                )

            if rejection:
                key = cid or chunk.doc_title
                rejection_reasons.setdefault(key, []).extend(rejection)
                continue

            # Composite score: 50% similarity + 25% relevance + 25% authority
            composite = round(
                0.50 * chunk.similarity +
                0.25 * relevance +
                0.25 * chunk.authority_score,
                4,
            )

            verified.append(VerifiedCitation(
                chunk_id=cid,
                document_id=chunk.document_id,
                doc_title=chunk.doc_title,
                ministry=chunk.ministry,
                gazette_number=chunk.gazette_number,
                doc_type=chunk.doc_type,
                publication_date=chunk.publication_date,
                page_number=chunk.page_number,
                section=chunk.section,
                clause=chunk.clause,
                content=chunk.content,
                similarity=chunk.similarity,
                relevance_score=relevance,
                authority_score=chunk.authority_score,
                composite_score=composite,
                pdf_url=_resolve_pdf_url(chunk),
                is_trusted_source=authenticity_map.get(cid, False),
                citation_ref=_build_citation_ref(chunk),
            ))

        # ------------------------------------------------------------------
        # Step 6 — Final ranking + cap
        # ------------------------------------------------------------------
        verified.sort(key=lambda c: c.composite_score, reverse=True)
        verified = verified[:_MAX_VERIFIED_CHUNKS]

        rejected_count = len(chunks) - len(verified)
        all_trusted    = all(c.is_trusted_source for c in verified)

        notes.append(
            f"Verification complete: {len(verified)} verified, "
            f"{rejected_count} rejected, all_trusted={all_trusted}"
        )

        return VerificationResult(
            query=query,
            intent=intent_str,
            verified_citations=verified,
            rejected_count=rejected_count,
            rejection_reasons=rejection_reasons,
            all_trusted=all_trusted,
            verification_notes=notes,
        )

    # ------------------------------------------------------------------
    # Convenience: run retrieval + verification in one call
    # ------------------------------------------------------------------

    @classmethod
    def verify_from_query(
        cls,
        query:             str,
        user_profile:      Optional[dict[str, Any]] = None,
        metadata_filters:  Optional[dict[str, Any]] = None,
        explicit_ministry: Optional[str]             = None,
    ) -> VerificationResult:
        """
        Convenience wrapper that runs the full pipeline:
        QueryRouter → RetrievalAgent → VerificationAgent

        Returns a VerificationResult ready for the synthesis agent.
        """
        from retrieval_agent import RetrievalAgent
        from query_router import QueryRouter

        router   = QueryRouter()
        decision = router.route(query)
        decision.raw["original_query"] = query

        retrieval_result = RetrievalAgent.retrieve(
            routing_decision=decision,
            user_profile=user_profile,
            metadata_filters=metadata_filters,
            explicit_ministry=explicit_ministry,
        )

        return cls.verify(
            retrieval_result=retrieval_result,
            query=query,
            intent=decision.intent,
        )
