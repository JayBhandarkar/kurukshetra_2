"""
agent.py
--------
Pramaan — Multi-Agent RAG Orchestrator

Full pipeline:
  1. QueryRouter        — decompose user input into sub-queries, detect intent
                          (QA, summarization, comparison, provision_search)
  2. Multi-Query Plan   — if query contains multiple independent questions,
                          each gets its own retrieval + verification pass
  3. RetrievalAgent     — per-sub-query tiered pgvector retrieval with domain funnel
  4. VerificationAgent  — relevance scoring, source auth, dedup, evidence grounding
  5. Downstream Agents  — route each verified result to the correct answer agent:
                            · QAAgent            (question_answering, provision_search, latest_info)
                            · SummarizationAgent (summarization)
                            · ComparisonAgent    (comparison)
  6. Answer Merger      — combine per-sub-query answers into a single coherent response
                          with unified citation list and processing trace
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Optional

from dotenv import load_dotenv
from openai import OpenAI

from query_router import QueryRouter, QueryIntent, RoutingDecision
from retrieval_agent import RetrievalAgent, RetrievalResult
from verification_agent import VerificationAgent, VerificationResult, VerifiedCitation

load_dotenv()

_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
_openai_client = OpenAI(api_key=_OPENAI_KEY)

# Maximum sub-queries we will process in one turn
_MAX_SUB_QUERIES = 4

# ---------------------------------------------------------------------------
# Multi-query decomposition via OpenAI
# ---------------------------------------------------------------------------

_DECOMPOSE_SYSTEM = """\
You are a query planner for Pramaan, an Indian government document intelligence system.

Analyse the user's message and decide if it contains MULTIPLE independent questions
or a single question. If multiple, split them into separate sub-queries.

Rules:
- Each sub-query must be self-contained and answerable independently.
- If the query is a single question, return exactly one sub-query with is_compound=false.
- Maximum 4 sub-queries.
- Keep sub-query text as close to the original wording as possible.
- intent_hint must be one of: question_answering, summarization, comparison, provision_search, latest_info
- Return ONLY valid JSON matching the schema. No markdown."""

_DECOMPOSE_SCHEMA = {
    "type": "object",
    "properties": {
        "is_compound": {"type": "boolean"},
        "reasoning":   {"type": "string"},
        "sub_queries": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text":        {"type": "string"},
                    "domain_hint": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                    "intent_hint": {
                        "type": "string",
                        "enum": ["question_answering", "summarization", "comparison",
                                 "provision_search", "latest_info"]
                    }
                },
                "required": ["text", "domain_hint", "intent_hint"],
                "additionalProperties": False
            }
        }
    },
    "required": ["is_compound", "reasoning", "sub_queries"],
    "additionalProperties": False
}





# ---------------------------------------------------------------------------
# Sub-query plan
# ---------------------------------------------------------------------------

@dataclass
class SubQuery:
    text:         str
    domain_hint:  Optional[str]
    intent_hint:  str
    routing:      Optional[RoutingDecision] = None
    retrieval:    Optional[RetrievalResult] = None
    verification: Optional[VerificationResult] = None
    answer:       str = ""
    citations:    list[dict] = field(default_factory=list)
    agent_used:   str = ""
    stages:       list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Downstream answer agents
# ---------------------------------------------------------------------------

_AGENT_BASE_SYSTEM = """\
You are Pramaan, a Sovereign Government Document Intelligence Assistant for India.
Your mission is to provide accurate, evidence-backed, easily readable answers to queries about Indian government gazettes, notifications, circulars, acts, and policy documents.

MANDATORY RULES:
1. Ground your answers strictly in the retrieved official government evidence provided below.
2. For every factual assertion, cite the exact source using [[cite-id]] tags corresponding to the retrieved citations (e.g. [[cite-live-1]]). Place the tag inline at the end of the relevant sentence.
3. OUTPUT FORMATTING GUIDELINES:
   - Output must be clean, natural, human-readable text.
   - Do NOT wrap your answer in JSON or markdown code-block envelopes.
   - Do NOT start with banners like "# Response". Start directly with your explanation.
   - Use clear paragraphs, bullet points (- or 1.), and **bold** keywords for readability.
   - Place citation tags [[cite-id]] smoothly inline at the end of the relevant sentence or clause.
4. Be clear, professional, and precise. Avoid speculation or ungrounded assertions.
5. If no relevant evidence is found, say so — do not fabricate any provision."""


class QAAgent:
    """Handles: question_answering, provision_search, latest_info"""

    @classmethod
    def answer(cls, sub_query: str, context_text: str, user_role: str, primary_domain: str) -> str:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.1,
            max_tokens=700,
            messages=[
                {
                    "role": "system",
                    "content": _AGENT_BASE_SYSTEM + f"\nUser role: {user_role}. Primary domain: {primary_domain}.",
                },
                {
                    "role": "user",
                    "content": (
                        f"### RETRIEVED SOVEREIGN EVIDENCE:\n{context_text}\n\n"
                        f"### USER QUESTION:\n{sub_query}"
                    ),
                },
            ],
        )
        return resp.choices[0].message.content or ""


class SummarizationAgent:
    """Handles: summarization"""

    @classmethod
    def answer(cls, sub_query: str, context_text: str, user_role: str, primary_domain: str) -> str:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.1,
            max_tokens=700,
            messages=[
                {
                    "role": "system",
                    "content": (
                        _AGENT_BASE_SYSTEM
                        + f"\nUser role: {user_role}. Primary domain: {primary_domain}."
                        + "\nAdditional instruction: Structure the summary with bold headers — Purpose, Key Provisions, Applicable Parties, Effective Dates."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"### RETRIEVED SOVEREIGN EVIDENCE:\n{context_text}\n\n"
                        f"### SUMMARIZATION REQUEST:\n{sub_query}"
                    ),
                },
            ],
        )
        return resp.choices[0].message.content or ""


class ComparisonAgent:
    """Handles: comparison"""

    @classmethod
    def answer(cls, sub_query: str, context_text: str, user_role: str, primary_domain: str) -> str:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.1,
            max_tokens=800,
            messages=[
                {
                    "role": "system",
                    "content": (
                        _AGENT_BASE_SYSTEM
                        + f"\nUser role: {user_role}. Primary domain: {primary_domain}."
                        + "\nAdditional instruction: Structure the comparison as **Changed Provisions**, **Added Provisions**, **Removed Provisions**. For each item show Old vs New with [[cite-id]] on each."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"### RETRIEVED SOVEREIGN EVIDENCE:\n{context_text}\n\n"
                        f"### COMPARISON REQUEST:\n{sub_query}"
                    ),
                },
            ],
        )
        return resp.choices[0].message.content or ""


# Intent → agent mapping
_AGENT_MAP: dict[QueryIntent, type] = {
    QueryIntent.QUESTION_ANSWERING: QAAgent,
    QueryIntent.PROVISION_SEARCH:   QAAgent,
    QueryIntent.LATEST_INFO:        QAAgent,
    QueryIntent.SUMMARIZATION:      SummarizationAgent,
    QueryIntent.COMPARISON:         ComparisonAgent,
}


# ---------------------------------------------------------------------------
# Helper: build context_text + citations from VerificationResult
# ---------------------------------------------------------------------------

def _build_context(
    verification: VerificationResult,
    cite_offset: int = 0,
) -> tuple[str, list[dict]]:
    """
    Convert verified citations into:
      - context_text: formatted string fed to the answer agent's system prompt
      - citations:    list of dicts ready for the API response
    cite_offset ensures cite IDs are globally unique across sub-queries.
    """
    context_text = ""
    citations: list[dict] = []

    if not verification.verified_citations:
        context_text = (
            "No relevant indexed documents were found for this sub-query. "
            "Do not fabricate any statutory provisions. "
            "Tell the user no indexed source was found and suggest they upload "
            "the relevant gazette or circular."
        )
        return context_text, citations

    for idx, cit in enumerate(verification.verified_citations):
        cite_id = f"cite-live-{cite_offset + idx + 1}"
        citations.append({
            "id":            cite_id,
            "docTitle":      cit.doc_title,
            "ministry":      cit.ministry,
            "gazetteNumber": cit.gazette_number,
            "page":          cit.page_number,
            "section":       cit.section,
            "clause":        cit.clause,
            "quote":         cit.content,
            "confidence":    round(cit.composite_score, 3),
            "pdfUrl":        cit.pdf_url,
            "citationRef":   cit.citation_ref,
        })
        context_text += (
            f"[Citation Tag: [[{cite_id}]]]\n"
            f"Document: {cit.doc_title} ({cit.ministry})\n"
            f"Gazette: {cit.gazette_number} | Page: {cit.page_number} | "
            f"{cit.section} | {cit.clause}\n"
            f"Statutory Text:\n\"{cit.content}\"\n\n"
        )

    return context_text, citations


# ---------------------------------------------------------------------------
# Multi-query decomposition
# ---------------------------------------------------------------------------

def _decompose_query(user_query: str) -> list[SubQuery]:
    """
    Use GPT-4o-mini with strict JSON schema to split the user query into
    independent sub-queries. Always returns at least one SubQuery.
    """
    try:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.0,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "decompose_decision",
                    "strict": True,
                    "schema": _DECOMPOSE_SCHEMA,
                }
            },
            messages=[
                {"role": "system", "content": _DECOMPOSE_SYSTEM},
                {"role": "user",   "content": user_query.strip()},
            ],
        )
        raw = json.loads(resp.choices[0].message.content or "{}")
        sub_queries_raw = raw.get("sub_queries", [])

        if not sub_queries_raw:
            raise ValueError("Decomposer returned empty sub_queries")

        result = [
            SubQuery(
                text=sq["text"].strip(),
                domain_hint=sq.get("domain_hint"),
                intent_hint=sq.get("intent_hint", "question_answering"),
            )
            for sq in sub_queries_raw[:_MAX_SUB_QUERIES]
            if sq.get("text", "").strip()
        ]
        print(f"[Decomposer] Split into {len(result)} sub-quer{'ies' if len(result)>1 else 'y'}: "
              f"{[sq.text[:50] for sq in result]}")
        return result

    except Exception as exc:
        print(f"[Decomposer] Fallback to single query (error: {exc})")
        return [SubQuery(text=user_query, domain_hint=None, intent_hint="question_answering")]


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------

class AgenticRAGOrchestrator:
    """
    Full multi-agent RAG pipeline:

    QueryRouter → decompose → [per sub-query]:
        RetrievalAgent → VerificationAgent → QA/Summarization/Comparison Agent
    → merge answers → unified response

    Entry point:
        result = AgenticRAGOrchestrator.query(
            user_query   = "...",
            ministry_filter = None,
            user_profile = {"primary_domain": "...", "role": "..."},
        )
    """

    # Keep these static helpers for the upload pipeline (used in main.py)
    @staticmethod
    def create_embedding(text: str) -> list[float]:
        clean = text.replace("\n", " ").strip()
        res = _openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=clean,
            dimensions=1536,
        )
        return res.data[0].embedding

    @staticmethod
    def create_embeddings_batch(texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        clean_texts = [t.replace("\n", " ").strip() or " " for t in texts]
        all_embeddings: list[list[float]] = []
        for i in range(0, len(clean_texts), 100):
            batch = clean_texts[i : i + 100]
            res = _openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=batch,
                dimensions=1536,
            )
            all_embeddings.extend([item.embedding for item in res.data])
        return all_embeddings

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    @classmethod
    def query(
        cls,
        user_query: str,
        ministry_filter: Optional[str] = None,
        user_profile: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:

        clean_query    = user_query.strip()
        user_profile   = user_profile or {}
        primary_domain = user_profile.get("primary_domain", "Banking, Finance & Tax")
        user_role      = user_profile.get("role", "Legal Counsel / Advocate")

        # ------------------------------------------------------------------
        # Stage 1: Decompose into sub-queries
        # ------------------------------------------------------------------
        sub_queries = _decompose_query(clean_query)
        is_compound = len(sub_queries) > 1

        # Single query — run directly through the single-query pipeline
        if not is_compound:
            return cls._run_single_query(
                query=clean_query,
                ministry_filter=ministry_filter,
                user_profile=user_profile,
                primary_domain=primary_domain,
                user_role=user_role,
            )

        # ------------------------------------------------------------------
        # Compound query — run EACH sub-query as a fully independent
        # standalone query (same code path as a single query).
        # This guarantees each sub-query gets correct retrieval, verification,
        # and cited answer — identical to what would happen if the user asked
        # each question separately.
        # ------------------------------------------------------------------
        print(f"[Orchestrator] Compound query: {len(sub_queries)} sub-queries detected")

        sub_results: list[dict[str, Any]] = []
        for idx, sq in enumerate(sub_queries):
            print(f"[Orchestrator] Processing sub-query {idx+1}/{len(sub_queries)}: {sq.text[:60]}")
            try:
                result = cls._run_single_query(
                    query=sq.text,
                    ministry_filter=ministry_filter,
                    user_profile=user_profile,
                    primary_domain=primary_domain,
                    user_role=user_role,
                )
                sub_results.append(result)
            except Exception as exc:
                print(f"[Orchestrator] Sub-query {idx+1} failed: {exc}")
                sub_results.append({
                    "answer": "Unable to process this sub-query.",
                    "citations": [],
                    "processingStages": [],
                    "intent": "question_answering",
                    "searchMode": "UNKNOWN",
                })

        # ------------------------------------------------------------------
        # Merge: renumber all cite IDs to be globally unique, stitch answers
        # ------------------------------------------------------------------
        all_citations:  list[dict] = []
        merged_parts:   list[str]  = []
        all_stages:     list[str]  = [
            f"Query Decomposition: {len(sub_queries)} sub-queries detected"
        ]
        cite_counter = 1

        for idx, (sq, result) in enumerate(zip(sub_queries, sub_results)):
            # Renumber citations: cite-live-1 from each sub-result → globally unique IDs
            remap: dict[str, str] = {}
            renumbered_citations: list[dict] = []

            for cit in result.get("citations", []):
                old_id  = cit["id"]                      # e.g. "cite-live-1"
                new_id  = f"cite-live-{cite_counter}"
                remap[old_id] = new_id
                cite_counter += 1
                renumbered_citations.append({**cit, "id": new_id})

            all_citations.extend(renumbered_citations)

            # Patch the answer text with globally unique IDs
            answer_text = result.get("answer", "")
            for old_id, new_id in remap.items():
                answer_text = answer_text.replace(f"[[{old_id}]]", f"[[{new_id}]]")

            # Build merged section
            header = f"## {idx + 1}. {sq.text.rstrip('?').strip()}"
            merged_parts.append(f"{header}\n\n{answer_text.strip()}")

            # Collect processing stages per sub-query
            for stage in result.get("processingStages", []):
                all_stages.append(f"[Q{idx+1}] {stage}")

        all_stages.append("Evidence Validation Complete")
        final_answer = "\n\n---\n\n".join(merged_parts)

        return {
            "answer":           final_answer,
            "intent":           sub_results[0].get("intent", "question_answering") if sub_results else "question_answering",
            "searchMode":       sub_results[0].get("searchMode", "UNKNOWN") if sub_results else "UNKNOWN",
            "primaryDomain":    primary_domain,
            "citations":        all_citations,
            "processingStages": all_stages,
            "subQueries": [
                {
                    "text":      sq.text,
                    "intent":    r.get("intent", "question_answering"),
                    "agent":     r.get("agent", "QAAgent"),
                    "citations": len(r.get("citations", [])),
                }
                for sq, r in zip(sub_queries, sub_results)
            ],
            "followUps": [
                "Compare compliance deadlines with earlier circulars",
                "Which penalties apply for non-compliance?",
                "View official gazette PDF in Evidence Drawer",
            ],
        }

    # ------------------------------------------------------------------
    # Single-query pipeline (the real workhorse)
    # Called by query() for standalone queries AND for each sub-query
    # of a compound prompt — ensuring identical behaviour in both cases.
    # ------------------------------------------------------------------

    @classmethod
    def _run_single_query(
        cls,
        query: str,
        ministry_filter: Optional[str],
        user_profile: dict,
        primary_domain: str,
        user_role: str,
    ) -> dict[str, Any]:
        stages: list[str] = []

        # 1. Route — extract intent + parameters
        routing: Optional[RoutingDecision] = None
        intent = QueryIntent.QUESTION_ANSWERING
        try:
            router  = QueryRouter()
            routing = router.route(query)
            routing.raw["original_query"] = query
            intent  = routing.intent
            stages.append(f"Intent: {intent.value} (confidence {routing.confidence:.0%})")
        except Exception as exc:
            print(f"[SingleQuery] Router error: {exc}")
            routing = _make_fallback_routing(query, intent)
            routing.raw["original_query"] = query
            stages.append("Intent: question_answering (router fallback)")

        # 2. Retrieve
        try:
            retrieval = RetrievalAgent.retrieve(
                routing_decision=routing,
                user_profile=user_profile,
                explicit_ministry=(
                    ministry_filter
                    if ministry_filter and ministry_filter not in ("All", "All Ministries")
                    else None
                ),
            )
            stages.append(f"Retrieval: {retrieval.search_mode} ({retrieval.total_found} chunk(s))")
        except Exception as exc:
            print(f"[SingleQuery] Retrieval error: {exc}")
            stages.append("Retrieval: failed")
            return {
                "answer": (
                    "No indexed documents could be retrieved for this question. "
                    "Please upload the relevant gazette or circular."
                ),
                "intent":           intent.value,
                "searchMode":       "FAILED",
                "primaryDomain":    primary_domain,
                "citations":        [],
                "processingStages": stages,
                "agent":            "QAAgent",
            }

        # 3. Verify
        try:
            verification = VerificationAgent.verify(
                retrieval_result=retrieval,
                query=query,
                intent=intent,
            )
            stages.append(
                f"Verification: {len(verification.verified_citations)} verified, "
                f"{verification.rejected_count} rejected"
            )
        except Exception as exc:
            print(f"[SingleQuery] Verification error: {exc}")
            from verification_agent import VerificationResult as VR
            verification = VR(
                query=query, intent=intent.value,
                verified_citations=[], rejected_count=0,
                rejection_reasons={}, all_trusted=False,
                verification_notes=["Verification step failed"],
            )
            stages.append("Verification: failed")

        # 4. Build context + citations
        context_text, citations = _build_context(verification, cite_offset=0)

        # 5. Answer agent
        agent_cls = _AGENT_MAP.get(intent, QAAgent)
        try:
            answer = agent_cls.answer(
                sub_query=query,
                context_text=context_text,
                user_role=user_role,
                primary_domain=primary_domain,
            )
            stages.append(f"Agent: {agent_cls.__name__}")
        except Exception as exc:
            print(f"[SingleQuery] Answer agent error: {exc}")
            answer = "Unable to generate an answer for this query."
            stages.append(f"Agent: {agent_cls.__name__} (error)")

        stages.append("Evidence Validation Complete")

        return {
            "answer":           answer,
            "intent":           intent.value,
            "searchMode":       retrieval.search_mode,
            "primaryDomain":    primary_domain,
            "citations":        citations,
            "processingStages": stages,
            "agent":            agent_cls.__name__,
            "followUps": [
                "Compare compliance deadlines with earlier circulars",
                "Which penalties apply for non-compliance?",
                "View official gazette PDF in Evidence Drawer",
            ],
        }

    # ------------------------------------------------------------------
    # Merge helper — deterministic, no LLM (preserves [[cite-id]] tags)
    # ------------------------------------------------------------------

    @classmethod
    def _merge_answers(cls, sub_queries: list[SubQuery]) -> str:
        """
        Concatenate independently generated answers with markdown section headers.
        No LLM call — guarantees all [[cite-live-N]] tags are preserved exactly.
        """
        parts = []
        for i, sq in enumerate(sub_queries):
            header = f"## {i + 1}. {sq.text.rstrip('?').strip()}"
            parts.append(f"{header}\n\n{sq.answer.strip()}")
        return "\n\n---\n\n".join(parts)


# ---------------------------------------------------------------------------
# Fallback routing decision when QueryRouter fails
# ---------------------------------------------------------------------------

def _make_fallback_routing(query: str, intent: QueryIntent) -> RoutingDecision:
    """Build a minimal RoutingDecision without calling the LLM."""
    from query_router import AGENT_REGISTRY, RoutingDecision
    return RoutingDecision(
        intent=intent,
        secondary_intents=[],
        primary_agent=AGENT_REGISTRY.get(intent, "rag_qa_agent"),
        additional_agents=[],
        action_plan=[AGENT_REGISTRY.get(intent, "rag_qa_agent")],
        parameters={
            "document_name": None,
            "ministry": None,
            "date_or_period": None,
            "documents_to_compare": [],
            "provision_or_policy": None,
        },
        confidence=0.5,
        reasoning="Fallback routing — QueryRouter unavailable",
        raw={"original_query": query},
    )
