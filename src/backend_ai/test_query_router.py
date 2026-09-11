"""
test_query_router.py
--------------------
Terminal test file for the Pramaan Query Routing Agent.

Run:
    cd src/backend_ai
    python test_query_router.py

Each test query is routed and results are printed in a structured,
colour-coded table format directly in the terminal.
"""

import json
import sys
import os
import textwrap
import time

# Make sure the backend_ai directory is on the path when running from root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from query_router import QueryRouter, QueryIntent

# ---------------------------------------------------------------------------
# ANSI colour helpers
# ---------------------------------------------------------------------------

RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[36m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
RED    = "\033[31m"
BLUE   = "\033[34m"
MAGENTA = "\033[35m"
DIM    = "\033[2m"

def c(text, colour):   return f"{colour}{text}{RESET}"
def bold(text):        return f"{BOLD}{text}{RESET}"
def header(text):      return f"\n{BOLD}{CYAN}{'=' * 72}\n  {text}\n{'=' * 72}{RESET}"
def divider():         return f"{DIM}{'-' * 72}{RESET}"

# ---------------------------------------------------------------------------
# Intent → colour map
# ---------------------------------------------------------------------------

INTENT_COLOURS = {
    QueryIntent.QUESTION_ANSWERING : GREEN,
    QueryIntent.SUMMARIZATION      : BLUE,
    QueryIntent.COMPARISON         : MAGENTA,
    QueryIntent.PROVISION_SEARCH   : YELLOW,
    QueryIntent.LATEST_INFO        : CYAN,
}

def colour_intent(intent: QueryIntent) -> str:
    col = INTENT_COLOURS.get(intent, RESET)
    return c(f"  {intent.value.upper().replace('_', ' ')}  ", f"{BOLD}{col}")

# ---------------------------------------------------------------------------
# Test queries — one per intent type + 2 composite / edge-case queries
# ---------------------------------------------------------------------------

TEST_QUERIES = [
    # ── 1. Question Answering ──────────────────────────────────────────────
    {
        "label": "Question Answering",
        "query": "What is the TDS rate for interest income under Section 194A for FY 2024-25?",
    },
    # ── 2. Summarization ──────────────────────────────────────────────────
    {
        "label": "Summarization",
        "query": "Summarise the Ministry of Education's National Education Policy notification from 2020.",
    },
    # ── 3. Comparison ────────────────────────────────────────────────────
    {
        "label": "Comparison",
        "query": (
            "Compare the PMAY-G eligibility norms between the 2022 and 2024 "
            "Ministry of Rural Development circulars."
        ),
    },
    # ── 4. Provision / Rule Search ───────────────────────────────────────
    {
        "label": "Provision Search",
        "query": "Find the penalty clause for late GST filing under the CGST Act 2017.",
    },
    # ── 5. Latest / Currently Applicable Info ────────────────────────────
    {
        "label": "Latest Info",
        "query": "What is the currently applicable repo rate as per the latest RBI monetary policy circular?",
    },
    # ── 6. Composite — comparison + latest ───────────────────────────────
    {
        "label": "Composite Query",
        "query": (
            "Compare the data localisation requirements in MeitY's 2022 and 2023 "
            "draft Digital Personal Data Protection rules, and also show the currently "
            "in-force version."
        ),
    },
    # ── 7. Ambiguous / short query (edge case) ───────────────────────────
    {
        "label": "Ambiguous / Short",
        "query": "CBDT circular on advance tax",
    },
]

# ---------------------------------------------------------------------------
# Pretty-print a single routing decision
# ---------------------------------------------------------------------------

def print_decision(idx: int, label: str, query: str, decision, elapsed: float):
    print(header(f"Test {idx}  ·  {label}"))

    # Query
    wrapped = textwrap.fill(query, width=66, subsequent_indent="    ")
    print(f"\n  {bold('Query')}   {CYAN}{wrapped}{RESET}\n")
    print(divider())

    # Intent & agent
    print(f"  {bold('Intent')}        {colour_intent(decision.intent)}")
    print(f"  {bold('Primary Agent')} {c(decision.primary_agent, GREEN)}")

    if decision.secondary_intents:
        si_str = ", ".join(i.value for i in decision.secondary_intents)
        print(f"  {bold('Secondary')}     {c(si_str, YELLOW)}")
        aa_str = ", ".join(decision.additional_agents)
        print(f"  {bold('Extra Agents')} {c(aa_str, YELLOW)}")

    # Action plan
    plan_str = "  ->  ".join(decision.action_plan)
    print(f"  {bold('Action Plan')}   {plan_str}")

    # Confidence bar
    conf = decision.confidence
    filled = int(conf * 20)
    bar = f"{'#' * filled}{'.' * (20 - filled)}"
    conf_colour = GREEN if conf >= 0.8 else YELLOW if conf >= 0.5 else RED
    print(f"  {bold('Confidence')}    {c(bar, conf_colour)}  {c(f'{conf:.0%}', conf_colour)}")

    print(divider())

    # Extracted parameters
    print(f"  {bold('Parameters')}")
    params = decision.parameters
    fields = [
        ("document_name",        "Document"),
        ("ministry",             "Ministry"),
        ("date_or_period",       "Period"),
        ("documents_to_compare", "Compare"),
        ("provision_or_policy",  "Provision"),
    ]
    any_param = False
    for key, display in fields:
        val = params.get(key)
        if val and val not in ([], None, ""):
            any_param = True
            if isinstance(val, list):
                val = "  /  ".join(val)
            print(f"    {display:<14} {c(val, CYAN)}")
    if not any_param:
        print(f"    {c('(none extracted)', DIM)}")

    print(divider())

    # Reasoning
    reasoning = textwrap.fill(decision.reasoning, width=66, subsequent_indent="    ")
    print(f"  {bold('Reasoning')}    {reasoning}")

    print(f"\n  {DIM}Latency: {elapsed:.2f}s{RESET}\n")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_tests():
    print(f"\n{BOLD}{CYAN}")
    print("  +---------------------------------------------------------+")
    print("  |   P R A M A A N   -   Query Routing Agent Test Suite   |")
    print("  +---------------------------------------------------------+")
    print(f"{RESET}")
    print(f"  {bold('Query Routing Agent')} - Terminal Test Suite")
    print(f"  Model: gpt-4o-mini  /  Tests: {len(TEST_QUERIES)}\n")

    try:
        router = QueryRouter()
    except EnvironmentError as e:
        print(f"\n{RED}{bold('ERROR:')} {e}{RESET}")
        print(f"{YELLOW}Make sure OPENAI_API_KEY is set in your .env file.{RESET}\n")
        sys.exit(1)

    passed = 0
    failed = 0
    total_time = 0.0

    for idx, test in enumerate(TEST_QUERIES, start=1):
        try:
            t0 = time.time()
            decision = router.route(test["query"])
            elapsed = time.time() - t0
            total_time += elapsed
            print_decision(idx, test["label"], test["query"], decision, elapsed)
            passed += 1
        except Exception as e:
            failed += 1
            print(header(f"Test {idx}  ·  {test['label']}  [FAILED]"))
            print(f"\n  {bold('Query')}  {CYAN}{test['query']}{RESET}")
            print(f"\n  {RED}{bold('Error:')} {e}{RESET}\n")

    # Summary
    print(f"\n{BOLD}{'=' * 72}")
    print(f"  RESULTS   {c(f'{passed} passed', GREEN)}  |  {c(f'{failed} failed', RED if failed else DIM)}  |  Avg latency: {total_time/len(TEST_QUERIES):.2f}s")
    print(f"{'=' * 72}{RESET}\n")


if __name__ == "__main__":
    run_tests()
