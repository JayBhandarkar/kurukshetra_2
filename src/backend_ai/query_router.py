"""
query_router.py
---------------
Pramaan Query Routing Agent — OpenAI Structured Output

Acts as the first decision-making layer of the retrieval pipeline.
Responsibilities:
  1. Understand user intent
  2. Classify the query into one of 5 intent categories
  3. Extract structured parameters (document, ministry, dates, etc.)
  4. Select and return the appropriate downstream agent
  5. Handle multi-step / composite queries with an ordered action plan

Dependencies: openai (already in requirements.txt), python-dotenv
No LangChain required.
"""

import os
import json
from enum import Enum
from typing import Optional
from dataclasses import dataclass, field

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ---------------------------------------------------------------------------
# Intent categories
# ---------------------------------------------------------------------------

class QueryIntent(str, Enum):
    QUESTION_ANSWERING = "question_answering"   # General clause / fact lookup
    SUMMARIZATION      = "summarization"         # Summarise a document
    COMPARISON         = "comparison"            # Compare two docs / versions
    PROVISION_SEARCH   = "provision_search"      # Find a specific rule / provision
    LATEST_INFO        = "latest_info"           # Most-current / in-force version


# Agent registry — maps intent → agent identifier
AGENT_REGISTRY: dict[QueryIntent, str] = {
    QueryIntent.QUESTION_ANSWERING : "rag_qa_agent",
    QueryIntent.SUMMARIZATION      : "summarization_agent",
    QueryIntent.COMPARISON         : "comparison_agent",
    QueryIntent.PROVISION_SEARCH   : "provision_search_agent",
    QueryIntent.LATEST_INFO        : "latest_info_agent",
}

# ---------------------------------------------------------------------------
# JSON schema for OpenAI structured output (response_format)
# ---------------------------------------------------------------------------

ROUTER_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": [i.value for i in QueryIntent],
            "description": "Primary intent of the query."
        },
        "secondary_intents": {
            "type": "array",
            "items": {"type": "string", "enum": [i.value for i in QueryIntent]},
            "description": "Additional intents for composite queries (max 2)."
        },
        "document_name": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "description": "Specific document title or gazette/circular number mentioned."
        },
        "ministry": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "description": "Government ministry or department referenced."
        },
        "date_or_period": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "description": "Date, year, or fiscal period referenced (e.g. '2024-25')."
        },
        "documents_to_compare": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Two document identifiers when intent is 'comparison'."
        },
        "provision_or_policy": {
            "anyOf": [{"type": "string"}, {"type": "null"}],
            "description": "Specific provision, rule, clause number, or policy name."
        },
        "action_plan": {
            "type": "array",
            "items": {"type": "string"},
            "description": (
                "Ordered list of agent names to call. Use values from: "
                "rag_qa_agent, summarization_agent, comparison_agent, "
                "provision_search_agent, latest_info_agent."
            )
        },
        "confidence": {
            "type": "number",
            "description": "Routing confidence score between 0.0 and 1.0."
        },
        "reasoning": {
            "type": "string",
            "description": "One-sentence explanation of the routing decision."
        }
    },
    "required": [
        "intent",
        "secondary_intents",
        "document_name",
        "ministry",
        "date_or_period",
        "documents_to_compare",
        "provision_or_policy",
        "action_plan",
        "confidence",
        "reasoning"
    ],
    "additionalProperties": False
}

SYSTEM_PROMPT = """\
You are the Query Routing Agent for Pramaan, a sovereign Indian government
document intelligence platform.

Your job is to analyse the user's query and return a structured routing
decision.  You must:

1. Identify the PRIMARY intent from this fixed list:
   - question_answering  : The user wants a factual answer from a gazette/circular.
   - summarization       : The user wants a summary of a document.
   - comparison          : The user wants to compare two documents or versions.
   - provision_search    : The user wants to find a specific rule, clause, or provision.
   - latest_info         : The user wants the most current / in-force version of a policy.

2. Identify any SECONDARY intents if the query needs more than one agent (max 2).

3. Extract every available parameter:
   - document_name        (gazette title, notification number, circular ID)
   - ministry             (e.g. "Ministry of Finance", "MeitY", "CBDT")
   - date_or_period       (year, fiscal year, specific date — e.g. "FY 2024-25")
   - documents_to_compare (for comparison intent — list exactly two identifiers)
   - provision_or_policy  (rule name, section number, policy name)
   Set any parameter to null if not mentioned.

4. Build an action_plan: an ordered list of agent names to call.
   Valid agent names: rag_qa_agent, summarization_agent, comparison_agent,
   provision_search_agent, latest_info_agent.

5. Assign a confidence score (0.0–1.0) and provide a one-sentence reasoning.
"""

# ---------------------------------------------------------------------------
# RoutingDecision dataclass
# ---------------------------------------------------------------------------

@dataclass
class RoutingDecision:
    """Parsed, enriched routing decision returned to the caller."""
    intent: QueryIntent
    secondary_intents: list[QueryIntent]
    primary_agent: str
    additional_agents: list[str]
    action_plan: list[str]
    parameters: dict
    confidence: float
    reasoning: str
    raw: dict = field(default_factory=dict)

    def summary(self) -> str:
        """Human-readable one-line summary."""
        return (
            f"[{self.intent.value}] → {self.primary_agent} "
            f"(confidence: {self.confidence:.0%})"
        )


# ---------------------------------------------------------------------------
# QueryRouter
# ---------------------------------------------------------------------------

class QueryRouter:
    """
    OpenAI-powered query routing agent using structured JSON output.

    Usage:
        router = QueryRouter()
        decision = router.route("What are the TDS rates for FY 2024-25?")
        print(decision.intent, decision.primary_agent)
    """

    def __init__(self, model: str = "gpt-4o-mini", temperature: float = 0.0):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set in environment / .env")

        self._client = OpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def route(self, query: str) -> RoutingDecision:
        """
        Route a user query and return a RoutingDecision.

        Args:
            query: The raw user query string.

        Returns:
            RoutingDecision dataclass with intent, agents, parameters, etc.

        Raises:
            ValueError: If query is empty.
            EnvironmentError: If OPENAI_API_KEY is missing.
        """
        if not query or not query.strip():
            raise ValueError("Query must be a non-empty string.")

        response = self._client.chat.completions.create(
            model=self._model,
            temperature=self._temperature,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "routing_decision",
                    "strict": True,
                    "schema": ROUTER_JSON_SCHEMA,
                }
            },
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": query.strip()},
            ],
        )

        raw: dict = json.loads(response.choices[0].message.content)
        return self._build_decision(raw)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_decision(self, raw: dict) -> RoutingDecision:
        # Resolve primary intent (fall back to QUESTION_ANSWERING on unknown)
        try:
            intent = QueryIntent(raw.get("intent", "question_answering"))
        except ValueError:
            intent = QueryIntent.QUESTION_ANSWERING

        # Resolve secondary intents
        secondary_intents: list[QueryIntent] = []
        for si in raw.get("secondary_intents", []):
            try:
                secondary_intents.append(QueryIntent(si))
            except ValueError:
                pass

        primary_agent   = AGENT_REGISTRY.get(intent, "rag_qa_agent")
        additional_agents = [AGENT_REGISTRY.get(si, "rag_qa_agent") for si in secondary_intents]

        # Use LLM-provided action plan or derive from intents
        action_plan: list[str] = raw.get("action_plan") or (
            [primary_agent] + additional_agents
        )

        parameters = {
            "document_name":        raw.get("document_name"),
            "ministry":             raw.get("ministry"),
            "date_or_period":       raw.get("date_or_period"),
            "documents_to_compare": raw.get("documents_to_compare", []),
            "provision_or_policy":  raw.get("provision_or_policy"),
        }

        return RoutingDecision(
            intent=intent,
            secondary_intents=secondary_intents,
            primary_agent=primary_agent,
            additional_agents=additional_agents,
            action_plan=action_plan,
            parameters=parameters,
            confidence=float(raw.get("confidence", 0.0)),
            reasoning=raw.get("reasoning", ""),
            raw=raw,
        )
