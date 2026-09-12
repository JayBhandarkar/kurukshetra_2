"""
test_retrieval_agent.py
-----------------------
Unit + integration tests for the Pramaan Retrieval Agent.

Run with:
    cd src/backend_ai
    python -m pytest test_retrieval_agent.py -v
    # or run directly:
    python test_retrieval_agent.py
"""

import os
import sys
import json
import unittest
from unittest.mock import MagicMock, patch

# Ensure the backend_ai directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from retrieval_agent import (
    RetrievalAgent,
    OptimisedQuery,
    RetrievedChunk,
    RetrievalResult,
    _apply_metadata_filters,
    _authority_score,
    _composite_score,
    _recency_boost,
    _map_chunk,
    _parse_optimised_query,
    DOMAIN_MINISTRY_MAP,
)
from query_router import QueryIntent, RoutingDecision


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_routing_decision(
    intent: QueryIntent = QueryIntent.QUESTION_ANSWERING,
    ministry: str | None = None,
    document_name: str | None = None,
    provision: str | None = None,
) -> RoutingDecision:
    return RoutingDecision(
        intent=intent,
        secondary_intents=[],
        primary_agent="rag_qa_agent",
        additional_agents=[],
        action_plan=["rag_qa_agent"],
        parameters={
            "ministry": ministry,
            "document_name": document_name,
            "provision_or_policy": provision,
            "date_or_period": None,
            "documents_to_compare": [],
        },
        confidence=0.95,
        reasoning="Test routing decision",
        raw={"original_query": document_name or provision or "test query"},
    )


def _make_raw_chunk(
    idx: int = 1,
    ministry: str = "Ministry of Finance",
    similarity: float = 0.85,
    doc_type: str = "Notification",
    pub_date: str = "2024-03-15",
) -> dict:
    return {
        "id": f"chunk-{idx}",
        "document_id": f"doc-{idx}",
        "doc_title": f"Test Notification {idx}",
        "ministry": ministry,
        "gazette_number": f"F.No.{idx}/2024",
        "doc_type": doc_type,
        "publication_date": pub_date,
        "financial_year": "2024-25",
        "page_number": idx,
        "section": f"Section {idx}",
        "clause": f"Clause {idx}.1",
        "content": f"This is statutory content {idx} about tax compliance and regulatory norms.",
        "similarity": similarity,
    }


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------

class TestScoringHelpers(unittest.TestCase):

    def test_authority_score_known_ministry(self):
        score = _authority_score("Reserve Bank of India")
        self.assertGreaterEqual(score, 0.90)

    def test_authority_score_unknown_ministry(self):
        score = _authority_score("Some Unknown Body XYZ")
        self.assertEqual(score, 0.80)  # default

    def test_authority_score_case_insensitive(self):
        score_lower = _authority_score("parliament of india")
        score_upper = _authority_score("Parliament of India")
        self.assertEqual(score_lower, score_upper)

    def test_composite_score_weights(self):
        # 60% similarity + 30% authority + 10% recency
        score = _composite_score(1.0, 1.0, 1.0)
        self.assertAlmostEqual(score, 1.0, places=3)

    def test_composite_score_partial(self):
        score = _composite_score(0.8, 0.9, 0.5)
        expected = round(0.60 * 0.8 + 0.30 * 0.9 + 0.10 * 0.5, 4)
        self.assertAlmostEqual(score, expected, places=4)

    def test_recency_boost_current_year(self):
        from datetime import datetime
        current = str(datetime.now().year)
        self.assertEqual(_recency_boost(current), 1.0)

    def test_recency_boost_old_document(self):
        self.assertLessEqual(_recency_boost("2010"), 0.3)

    def test_recency_boost_none(self):
        self.assertEqual(_recency_boost(None), 0.0)

    def test_recency_boost_iso_date(self):
        boost = _recency_boost("2024-01-15")
        self.assertGreater(boost, 0.0)


class TestMapChunk(unittest.TestCase):

    def test_basic_mapping(self):
        raw = _make_raw_chunk(idx=1, ministry="Ministry of Finance", similarity=0.80)
        chunk = _map_chunk(raw)
        self.assertEqual(chunk.id, "chunk-1")
        self.assertEqual(chunk.ministry, "Ministry of Finance")
        self.assertAlmostEqual(chunk.similarity, 0.80)
        self.assertGreater(chunk.composite_score, 0.0)

    def test_composite_score_is_computed(self):
        raw = _make_raw_chunk(similarity=0.90)
        chunk = _map_chunk(raw)
        self.assertGreater(chunk.composite_score, 0.0)
        self.assertLessEqual(chunk.composite_score, 1.0)

    def test_missing_optional_fields(self):
        raw = {
            "id": "x",
            "document_id": "d",
            "similarity": 0.7,
            "content": "Some text",
        }
        chunk = _map_chunk(raw)
        self.assertEqual(chunk.ministry, "Government of India")
        self.assertEqual(chunk.page_number, 1)
        self.assertIsNone(chunk.publication_date)


class TestMetadataFilter(unittest.TestCase):

    def _chunks(self):
        return [
            _map_chunk(_make_raw_chunk(idx=1, doc_type="Notification",  pub_date="2024-06-01")),
            _map_chunk(_make_raw_chunk(idx=2, doc_type="Circular",      pub_date="2021-03-10")),
            _map_chunk(_make_raw_chunk(idx=3, doc_type="Gazette",       pub_date="2023-11-20")),
        ]

    def test_filter_by_doc_type(self):
        chunks = self._chunks()
        filtered = _apply_metadata_filters(chunks, {"doc_type": "notification"})
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].doc_type, "Notification")

    def test_filter_by_date_from(self):
        chunks = self._chunks()
        filtered = _apply_metadata_filters(chunks, {"date_from": 2023})
        titles = [c.publication_date for c in filtered]
        self.assertTrue(all(int(d[:4]) >= 2023 for d in titles))

    def test_filter_by_date_range(self):
        chunks = self._chunks()
        filtered = _apply_metadata_filters(chunks, {"date_from": 2023, "date_to": 2023})
        self.assertEqual(len(filtered), 1)

    def test_empty_filter_returns_all(self):
        chunks = self._chunks()
        self.assertEqual(len(_apply_metadata_filters(chunks, {})), 3)

    def test_no_match_returns_original(self):
        """If all chunks fail the filter, return original set (avoid empty results)."""
        chunks = self._chunks()
        result = _apply_metadata_filters(chunks, {"doc_type": "NonExistentType"})
        self.assertEqual(len(result), 3)


class TestParseOptimisedQuery(unittest.TestCase):

    def test_valid_json(self):
        raw = json.dumps({
            "search_text": "TDS rate FY 2024-25",
            "keywords": ["TDS", "income tax"],
            "act_names": ["Income Tax Act 1961"],
            "section_numbers": ["Section 194C"],
            "policy_names": [],
            "date_references": ["FY 2024-25"],
            "ministry_hint": "Central Board of Direct Taxes (CBDT)",
        })
        oq = _parse_optimised_query(raw, "What is TDS rate?")
        self.assertEqual(oq.search_text, "TDS rate FY 2024-25")
        self.assertIn("TDS", oq.keywords)
        self.assertEqual(oq.ministry_hint, "Central Board of Direct Taxes (CBDT)")

    def test_invalid_json_falls_back(self):
        oq = _parse_optimised_query("NOT VALID JSON {{", "original query")
        self.assertEqual(oq.search_text, "original query")
        self.assertEqual(oq.keywords, [])

    def test_markdown_fenced_json(self):
        raw = "```json\n" + json.dumps({
            "search_text": "SEBI disclosure norms",
            "keywords": ["SEBI"],
            "act_names": [],
            "section_numbers": [],
            "policy_names": [],
            "date_references": [],
            "ministry_hint": None,
        }) + "\n```"
        oq = _parse_optimised_query(raw, "SEBI norms")
        self.assertEqual(oq.search_text, "SEBI disclosure norms")


class TestRanking(unittest.TestCase):

    def test_sorted_by_composite_score(self):
        chunks = [
            _map_chunk(_make_raw_chunk(idx=1, similarity=0.70)),
            _map_chunk(_make_raw_chunk(idx=2, similarity=0.95)),
            _map_chunk(_make_raw_chunk(idx=3, similarity=0.80)),
        ]
        ranked = RetrievalAgent._rank(chunks)
        scores = [c.composite_score for c in ranked]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_deduplication(self):
        """Chunks with identical content should be deduplicated."""
        raw = _make_raw_chunk(idx=1)
        raw2 = {**raw, "id": "chunk-99"}  # same content, different id
        chunks = [_map_chunk(raw), _map_chunk(raw2)]
        ranked = RetrievalAgent._rank(chunks)
        self.assertEqual(len(ranked), 1)


class TestDomainMinistryMap(unittest.TestCase):

    def test_all_domains_have_ministries(self):
        for domain, ministries in DOMAIN_MINISTRY_MAP.items():
            self.assertGreater(len(ministries), 0, f"{domain} has no ministries")

    def test_known_domain_present(self):
        self.assertIn("Banking, Finance & Tax", DOMAIN_MINISTRY_MAP)
        self.assertIn("Education & Research", DOMAIN_MINISTRY_MAP)


# ---------------------------------------------------------------------------
# Integration-style tests (mock Supabase + OpenAI)
# ---------------------------------------------------------------------------

class TestRetrievalAgentIntegration(unittest.TestCase):

    def _mock_embedding(self):
        return [0.01] * 1536

    def _mock_supabase_rows(self):
        return [_make_raw_chunk(i, similarity=0.9 - i * 0.05) for i in range(1, 4)]

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_retrieve_domain_funnel(self, mock_openai, mock_embed, mock_pgvector):
        """Tier 1b domain funnel returns results without triggering global fallback."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "TDS deduction FY 2024-25",
                "keywords": ["TDS"],
                "act_names": ["Income Tax Act"],
                "section_numbers": ["194C"],
                "policy_names": [],
                "date_references": ["FY 2024-25"],
                "ministry_hint": None,
            })))]
        )
        mock_pgvector.return_value = self._mock_supabase_rows()

        decision = _make_routing_decision(
            intent=QueryIntent.QUESTION_ANSWERING,
            provision="TDS deduction rates",
        )
        result = RetrievalAgent.retrieve(
            routing_decision=decision,
            user_profile={"primary_domain": "Banking, Finance & Tax"},
        )

        self.assertIsInstance(result, RetrievalResult)
        self.assertGreater(len(result.chunks), 0)
        self.assertIn("Banking, Finance & Tax", result.domain_applied)

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_retrieve_explicit_ministry(self, mock_openai, mock_embed, mock_pgvector):
        """Explicit ministry filter is applied in Tier 1a."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "SEBI disclosure",
                "keywords": ["SEBI"],
                "act_names": [],
                "section_numbers": [],
                "policy_names": [],
                "date_references": [],
                "ministry_hint": None,
            })))]
        )
        mock_pgvector.return_value = self._mock_supabase_rows()

        decision = _make_routing_decision(intent=QueryIntent.PROVISION_SEARCH)
        result = RetrievalAgent.retrieve(
            routing_decision=decision,
            explicit_ministry="Securities and Exchange Board of India (SEBI)",
        )

        self.assertIn("EXPLICIT_MINISTRY_SCOPED", result.search_mode)

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_global_fallback_triggered(self, mock_openai, mock_embed, mock_pgvector):
        """Global fallback triggers when domain search returns fewer than _MIN_CHUNKS_PASS."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "obscure policy no results",
                "keywords": [],
                "act_names": [],
                "section_numbers": [],
                "policy_names": [],
                "date_references": [],
                "ministry_hint": None,
            })))]
        )
        # First 3 calls (domain funnel) return nothing; 4th call (global) returns rows
        mock_pgvector.side_effect = [
            [],
            [],
            [],
            self._mock_supabase_rows(),
        ]

        decision = _make_routing_decision(intent=QueryIntent.QUESTION_ANSWERING)
        result = RetrievalAgent.retrieve(
            routing_decision=decision,
            user_profile={"primary_domain": "Banking, Finance & Tax"},
        )

        self.assertIn("GLOBAL", result.search_mode)
        self.assertGreater(len(result.chunks), 0)

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_metadata_filter_applied(self, mock_openai, mock_embed, mock_pgvector):
        """Metadata filters reduce results appropriately."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "circular",
                "keywords": [],
                "act_names": [],
                "section_numbers": [],
                "policy_names": [],
                "date_references": [],
                "ministry_hint": None,
            })))]
        )
        rows = [
            _make_raw_chunk(1, doc_type="Notification", pub_date="2024-01-01"),
            _make_raw_chunk(2, doc_type="Circular",     pub_date="2021-06-01"),
        ]
        mock_pgvector.return_value = rows

        decision = _make_routing_decision()
        result = RetrievalAgent.retrieve(
            routing_decision=decision,
            metadata_filters={"date_from": 2023},
        )

        for chunk in result.chunks:
            if chunk.publication_date:
                self.assertGreaterEqual(int(chunk.publication_date[:4]), 2023)

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_result_capped_at_six(self, mock_openai, mock_embed, mock_pgvector):
        """Result is capped at 6 chunks regardless of how many are retrieved."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "test",
                "keywords": [],
                "act_names": [],
                "section_numbers": [],
                "policy_names": [],
                "date_references": [],
                "ministry_hint": None,
            })))]
        )
        mock_pgvector.return_value = [_make_raw_chunk(i) for i in range(1, 12)]

        decision = _make_routing_decision()
        result = RetrievalAgent.retrieve(routing_decision=decision)
        self.assertLessEqual(len(result.chunks), 6)

    @patch("retrieval_agent._pgvector_search")
    @patch("retrieval_agent._embed")
    @patch("retrieval_agent._openai_client")
    def test_retrieve_from_query_convenience(self, mock_openai, mock_embed, mock_pgvector):
        """retrieve_from_query() runs QueryRouter internally and returns a result."""
        mock_embed.return_value = self._mock_embedding()
        mock_openai.chat.completions.create.return_value = MagicMock(
            choices=[MagicMock(message=MagicMock(content=json.dumps({
                "search_text": "TDS rate",
                "keywords": ["TDS"],
                "act_names": [],
                "section_numbers": [],
                "policy_names": [],
                "date_references": [],
                "ministry_hint": None,
            })))]
        )
        mock_pgvector.return_value = self._mock_supabase_rows()

        with patch("query_router.QueryRouter") as MockRouter:
            mock_router_instance = MagicMock()
            MockRouter.return_value = mock_router_instance
            mock_router_instance.route.return_value = _make_routing_decision(
                provision="TDS rate"
            )
            mock_router_instance.route.return_value.raw["original_query"] = "TDS rate"

            result = RetrievalAgent.retrieve_from_query(
                query="What is TDS rate for FY 2024-25?",
                user_profile={"primary_domain": "Banking, Finance & Tax"},
            )

        self.assertIsInstance(result, RetrievalResult)
        self.assertIsInstance(result.optimised_query, OptimisedQuery)


# ---------------------------------------------------------------------------
# Quick smoke test (runs without pytest if executed directly)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("Running Pramaan Retrieval Agent Tests")
    print("=" * 60)
    loader = unittest.TestLoader()
    suite  = unittest.TestSuite()
    for cls in [
        TestScoringHelpers,
        TestMapChunk,
        TestMetadataFilter,
        TestParseOptimisedQuery,
        TestRanking,
        TestDomainMinistryMap,
        TestRetrievalAgentIntegration,
    ]:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
