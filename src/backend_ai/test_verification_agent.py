"""
test_verification_agent.py
--------------------------
Unit + integration tests for the Pramaan Verification Agent.

Run with:
    cd src/backend_ai
    python -m pytest test_verification_agent.py -v
"""

import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))

from verification_agent import (
    VerificationAgent,
    VerificationResult,
    VerifiedCitation,
    _is_trusted_domain,
    _is_trusted_ministry,
    _build_citation_ref,
    _dedup_chunks,
    _resolve_pdf_url,
    _MIN_RELEVANCE_SCORE,
    _MIN_SIMILARITY,
)
from retrieval_agent import RetrievedChunk, RetrievalResult, OptimisedQuery
from query_router import QueryIntent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chunk(
    idx: int = 1,
    similarity: float = 0.85,
    ministry: str = "Ministry of Finance",
    content: str = None,
    doc_type: str = "Notification",
    gazette_number: str = "F.No.1/2024",
) -> RetrievedChunk:
    return RetrievedChunk(
        id=f"chunk-{idx}",
        document_id=f"doc-{idx}",
        doc_title=f"Test Gazette Notification {idx}",
        ministry=ministry,
        gazette_number=gazette_number,
        doc_type=doc_type,
        publication_date="2024-03-15",
        financial_year="2024-25",
        page_number=idx,
        section=f"Section {idx}",
        clause=f"Clause {idx}.1",
        content=content or (
            f"This is statutory content {idx} about tax compliance and regulatory norms "
            "under the Income Tax Act 1961 as amended by Finance Act 2024."
        ),
        similarity=similarity,
        authority_score=0.93,
        composite_score=0.88,
    )


def _make_retrieval_result(chunks: list[RetrievedChunk]) -> RetrievalResult:
    return RetrievalResult(
        query="TDS rates contractor payments",
        optimised_query=OptimisedQuery(
            original="TDS rates",
            search_text="TDS rates contractor payments",
            keywords=["TDS", "contractor"],
            act_names=["Income Tax Act"],
            section_numbers=["194C"],
            policy_names=[],
            date_references=["FY 2024-25"],
            ministry_hint="Ministry of Finance",
        ),
        chunks=chunks,
        search_mode="DOMAIN_FUNNEL_PRIORITIZED",
        domain_applied="Banking, Finance & Tax",
        ministries_searched=["Ministry of Finance"],
        filters_applied={},
        total_found=len(chunks),
        processing_notes=[],
    )


def _llm_pass(chunks):
    """Return passing LLM scores for all chunks."""
    return [
        {
            "chunk_id": c.id,
            "relevance_score": 0.90,
            "evidence_support": True,
            "rejection_reason": None,
        }
        for c in chunks
    ]


def _llm_fail(chunks):
    """Return failing LLM scores for all chunks."""
    return [
        {
            "chunk_id": c.id,
            "relevance_score": 0.30,
            "evidence_support": False,
            "rejection_reason": "Not relevant to the query",
        }
        for c in chunks
    ]


# ---------------------------------------------------------------------------
# Unit tests — helpers
# ---------------------------------------------------------------------------

class TestTrustedDomain(unittest.TestCase):

    def test_egazette_trusted(self):
        self.assertTrue(_is_trusted_domain("https://egazette.gov.in/doc.pdf"))

    def test_rbi_trusted(self):
        self.assertTrue(_is_trusted_domain("https://rbi.org.in/circular.pdf"))

    def test_gov_in_trusted(self):
        self.assertTrue(_is_trusted_domain("https://somemin.gov.in/notification.pdf"))

    def test_unknown_domain_not_trusted(self):
        self.assertFalse(_is_trusted_domain("https://random-blog.com/doc.pdf"))

    def test_empty_url_not_trusted(self):
        self.assertFalse(_is_trusted_domain(""))

    def test_none_url_not_trusted(self):
        self.assertFalse(_is_trusted_domain(None))


class TestTrustedMinistry(unittest.TestCase):

    def test_ministry_of_finance(self):
        self.assertTrue(_is_trusted_ministry("Ministry of Finance"))

    def test_rbi(self):
        self.assertTrue(_is_trusted_ministry("Reserve Bank of India"))

    def test_parliament(self):
        self.assertTrue(_is_trusted_ministry("Parliament of India"))

    def test_unknown_body(self):
        self.assertFalse(_is_trusted_ministry("Random Private Company Ltd"))

    def test_case_insensitive(self):
        self.assertTrue(_is_trusted_ministry("MINISTRY OF EDUCATION"))


class TestBuildCitationRef(unittest.TestCase):

    def test_full_citation(self):
        chunk = _make_chunk(idx=1)
        ref = _build_citation_ref(chunk)
        self.assertIn("Test Gazette Notification 1", ref)
        self.assertIn("Page 1", ref)
        self.assertIn("Section 1", ref)
        self.assertIn("Clause 1.1", ref)

    def test_missing_clause(self):
        chunk = _make_chunk(idx=2)
        chunk.clause = ""
        ref = _build_citation_ref(chunk)
        self.assertNotIn("·· ", ref)  # no empty segments

    def test_gazette_number_included(self):
        chunk = _make_chunk(gazette_number="F.No.275/2024")
        ref = _build_citation_ref(chunk)
        self.assertIn("F.No.275/2024", ref)


class TestDeduplication(unittest.TestCase):

    def test_identical_content_deduped(self):
        c1 = _make_chunk(1, content="Identical statutory content for testing purposes here.")
        c2 = _make_chunk(2, content="Identical statutory content for testing purposes here.")
        result = _dedup_chunks([c1, c2])
        self.assertEqual(len(result), 1)

    def test_different_content_kept(self):
        c1 = _make_chunk(1, content="Content about TDS rates under Section 194C.")
        c2 = _make_chunk(2, content="Content about KYC norms under RBI Master Direction.")
        result = _dedup_chunks([c1, c2])
        self.assertEqual(len(result), 2)

    def test_empty_input(self):
        self.assertEqual(_dedup_chunks([]), [])


class TestResolvePdfUrl(unittest.TestCase):

    def test_gazette_number_fallback(self):
        chunk = _make_chunk(gazette_number="F.No.275/2024")
        url = _resolve_pdf_url(chunk)
        self.assertIn("egazette.gov.in", url)

    def test_no_gazette_number_fallback(self):
        chunk = _make_chunk(gazette_number="")
        url = _resolve_pdf_url(chunk)
        self.assertEqual(url, "https://egazette.gov.in")


# ---------------------------------------------------------------------------
# Unit tests — VerificationAgent logic
# ---------------------------------------------------------------------------

class TestPreFilter(unittest.TestCase):

    @patch("verification_agent._llm_verify_chunks")
    def test_low_similarity_rejected(self, mock_llm):
        chunk = _make_chunk(similarity=0.30)  # below _MIN_SIMILARITY
        mock_llm.return_value = _llm_pass([])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        self.assertEqual(len(result.verified_citations), 0)
        self.assertGreater(result.rejected_count, 0)

    @patch("verification_agent._llm_verify_chunks")
    def test_short_content_rejected(self, mock_llm):
        chunk = _make_chunk(content="Too short.")
        mock_llm.return_value = _llm_pass([])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        self.assertEqual(len(result.verified_citations), 0)

    @patch("verification_agent._llm_verify_chunks")
    def test_good_chunk_passes_prefilter(self, mock_llm):
        chunk = _make_chunk(similarity=0.80)
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates contractor",
        )
        self.assertEqual(len(result.verified_citations), 1)


class TestSourceAuthenticity(unittest.TestCase):

    @patch("verification_agent._llm_verify_chunks")
    def test_trusted_ministry_flagged_correctly(self, mock_llm):
        chunk = _make_chunk(ministry="Ministry of Finance")
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        if result.verified_citations:
            self.assertTrue(result.verified_citations[0].is_trusted_source)

    @patch("verification_agent._resolve_pdf_url")
    @patch("verification_agent._llm_verify_chunks")
    def test_untrusted_ministry_flagged(self, mock_llm, mock_resolve):
        # Provide a non-gov URL so domain check also fails
        mock_resolve.return_value = "https://random-blog.com/doc.pdf"
        chunk = _make_chunk(ministry="Unknown Private Blog Inc")
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        if result.verified_citations:
            self.assertFalse(result.verified_citations[0].is_trusted_source)


class TestLLMVerification(unittest.TestCase):

    @patch("verification_agent._llm_verify_chunks")
    def test_low_relevance_rejected(self, mock_llm):
        chunk = _make_chunk(similarity=0.80)
        mock_llm.return_value = [{
            "chunk_id": "chunk-1",
            "relevance_score": 0.30,
            "evidence_support": True,
            "rejection_reason": "Not related to query",
        }]
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        self.assertEqual(len(result.verified_citations), 0)
        self.assertIn("chunk-1", result.rejection_reasons)

    @patch("verification_agent._llm_verify_chunks")
    def test_no_evidence_support_rejected(self, mock_llm):
        chunk = _make_chunk(similarity=0.80)
        mock_llm.return_value = [{
            "chunk_id": "chunk-1",
            "relevance_score": 0.80,
            "evidence_support": False,
            "rejection_reason": "Does not support the claim",
        }]
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        self.assertEqual(len(result.verified_citations), 0)

    @patch("verification_agent._llm_verify_chunks")
    def test_passing_chunk_produces_citation(self, mock_llm):
        chunk = _make_chunk(similarity=0.85)
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates contractor",
        )
        self.assertEqual(len(result.verified_citations), 1)
        citation = result.verified_citations[0]
        self.assertIsInstance(citation, VerifiedCitation)
        self.assertGreater(citation.composite_score, 0.0)
        self.assertIn("Page", citation.citation_ref)
        self.assertTrue(citation.pdf_url.startswith("http"))


class TestCitationOutput(unittest.TestCase):

    @patch("verification_agent._llm_verify_chunks")
    def test_citation_fields_complete(self, mock_llm):
        chunk = _make_chunk(idx=3, similarity=0.90, gazette_number="F.No.99/2024")
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS deduction",
        )
        self.assertEqual(len(result.verified_citations), 1)
        c = result.verified_citations[0]
        self.assertEqual(c.doc_title, "Test Gazette Notification 3")
        self.assertEqual(c.page_number, 3)
        self.assertEqual(c.gazette_number, "F.No.99/2024")
        self.assertIsNotNone(c.content)
        self.assertIsNotNone(c.citation_ref)
        self.assertIsNotNone(c.pdf_url)

    @patch("verification_agent._llm_verify_chunks")
    def test_results_capped_at_five(self, mock_llm):
        chunks = [_make_chunk(i, similarity=0.85) for i in range(1, 10)]
        mock_llm.return_value = _llm_pass(chunks)
        result = VerificationAgent.verify(
            _make_retrieval_result(chunks),
            query="TDS rates",
        )
        self.assertLessEqual(len(result.verified_citations), 5)

    @patch("verification_agent._llm_verify_chunks")
    def test_sorted_by_composite_score(self, mock_llm):
        chunks = [
            _make_chunk(1, similarity=0.70),
            _make_chunk(2, similarity=0.95),
            _make_chunk(3, similarity=0.80),
        ]
        mock_llm.return_value = _llm_pass(chunks)
        result = VerificationAgent.verify(
            _make_retrieval_result(chunks),
            query="TDS rates",
        )
        scores = [c.composite_score for c in result.verified_citations]
        self.assertEqual(scores, sorted(scores, reverse=True))

    @patch("verification_agent._llm_verify_chunks")
    def test_all_trusted_flag(self, mock_llm):
        chunks = [_make_chunk(i, ministry="Ministry of Finance") for i in range(1, 3)]
        mock_llm.return_value = _llm_pass(chunks)
        result = VerificationAgent.verify(
            _make_retrieval_result(chunks),
            query="TDS rates",
        )
        self.assertTrue(result.all_trusted)

    @patch("verification_agent._llm_verify_chunks")
    def test_empty_retrieval_returns_empty_verification(self, mock_llm):
        mock_llm.return_value = []
        result = VerificationAgent.verify(
            _make_retrieval_result([]),
            query="TDS rates",
        )
        self.assertEqual(len(result.verified_citations), 0)
        self.assertEqual(result.rejected_count, 0)


class TestVerificationNotes(unittest.TestCase):

    @patch("verification_agent._llm_verify_chunks")
    def test_notes_populated(self, mock_llm):
        chunk = _make_chunk(similarity=0.80)
        mock_llm.return_value = _llm_pass([chunk])
        result = VerificationAgent.verify(
            _make_retrieval_result([chunk]),
            query="TDS rates",
        )
        self.assertGreater(len(result.verification_notes), 0)
        self.assertTrue(any("Received" in n for n in result.verification_notes))
        self.assertTrue(any("Verification complete" in n for n in result.verification_notes))


# ---------------------------------------------------------------------------
# Run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("Running Pramaan Verification Agent Tests")
    print("=" * 60)
    loader = unittest.TestLoader()
    suite  = unittest.TestSuite()
    for cls in [
        TestTrustedDomain,
        TestTrustedMinistry,
        TestBuildCitationRef,
        TestDeduplication,
        TestResolvePdfUrl,
        TestPreFilter,
        TestSourceAuthenticity,
        TestLLMVerification,
        TestCitationOutput,
        TestVerificationNotes,
    ]:
        suite.addTests(loader.loadTestsFromTestCase(cls))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
