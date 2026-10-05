"""Offline query-focus tests; Exa discovery is always a fake client."""
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from shared import doc_search as docs


ROLLOUT_OBJECTIVE = (
    "Implementing model rollout strategies (e.g., A /B testing and canary deployments) "
    "to compare model versions"
)
BROAD_SERVICES = ["Agent Platform", "Cloud Run", "GKE", "Cloud Storage"]


@pytest.fixture
def exa_search(monkeypatch):
    search = Mock(return_value=SimpleNamespace(results=[]))
    client = Mock(return_value=SimpleNamespace(search=search))
    monkeypatch.setenv("EXA_API_KEY", "offline-test-only")
    monkeypatch.setitem(sys.modules, "exa_py", SimpleNamespace(Exa=client))
    return search


def test_rollout_examples_and_comparison_focus_the_actual_discovery_query(exa_search):
    assert docs._discover_urls(ROLLOUT_OBJECTIVE, BROAD_SERVICES, 5) == []
    assert exa_search.call_args.kwargs == {
        "query": "Google Cloud A/B testing and canary deployments "
                 "Implementing model rollout strategies to compare model versions",
        "type": "neural", "num_results": 5,
        "include_domains": ["docs.cloud.google.com"],
    }
    query = exa_search.call_args.kwargs["query"]
    assert "A /B" not in query and "e.g." not in query
    assert not any(service in query for service in BROAD_SERVICES)


@pytest.mark.parametrize("objective,expected", [
    ("Tuning parameters (e.g., learning rate and batch size) to improve accuracy",
     "Google Cloud learning rate and batch size Tuning parameters to improve accuracy"),
    ("Protecting data (for example, snapshots and replication) against loss",
     "Google Cloud snapshots and replication Protecting data against loss"),
    ("Configuring compute (E.G. autoscaling) and storage (e.g., retention policies)",
     "Google Cloud autoscaling retention policies Configuring compute and storage"),
])
def test_example_focus_is_general_and_keeps_objective_context(exa_search, objective, expected):
    docs._discover_urls(objective, BROAD_SERVICES, 3)
    assert exa_search.call_args.kwargs["query"] == expected
    assert exa_search.call_args.kwargs["num_results"] == 3


@pytest.mark.parametrize("objective,services", [
    ("Select an analytical query tool", ["BigQuery", "Cloud Storage"]),
    ("Configure storage (regional or multi-regional)", ["Cloud Storage"]),
    ("Compare versions (e.g., )", ["Agent Platform"]),
    ("Compare versions (e.g.,)", ["Agent Platform"]),
    ("Objective without examples", []),
    ("Marked answer: Use BigQuery ML MATRIX_FACTORIZATION\n"
     "Question stem: Which model supports recommendations?\n"
     "Key services: BigQuery ML\n"
     "Secondary exam scope hint (not the retrieval target): Choosing a model",
     ["BigQuery ML"]),
])
def test_no_examples_preserves_existing_question_and_objective_queries(exa_search, objective, services):
    docs._discover_urls(objective, services, 5)
    assert exa_search.call_args.kwargs["query"] == " ".join([
        "Google Cloud", objective, ", ".join(services),
    ])


def test_example_focus_does_not_bypass_official_url_checks(exa_search):
    approved = "https://docs.cloud.google.com/test/discovered"
    exa_search.return_value = SimpleNamespace(results=[
        SimpleNamespace(url="https://example.com/unapproved"),
        SimpleNamespace(url="https://cloud.google.com/not-discovery-host"),
        SimpleNamespace(url=approved),
        SimpleNamespace(url=approved),
    ])
    assert docs._discover_urls(ROLLOUT_OBJECTIVE, BROAD_SERVICES, 5) == [approved]


def test_empty_discovery_with_examples_still_fails_closed(exa_search, monkeypatch):
    fetch = Mock(side_effect=AssertionError("No guessed URLs or fetching"))
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    with pytest.raises(docs.DocumentationError, match="No official documentation"):
        docs.search_objective_docs(ROLLOUT_OBJECTIVE, BROAD_SERVICES)
    fetch.assert_not_called()


def test_question_first_query_keeps_examples_in_secondary_hint(exa_search):
    from shared.bank_grounding import question_retrieval

    question = {
        "stem": "Which BigQuery ML model supports collaborative recommendations?",
        "correct_answer": "Use BigQuery ML MATRIX_FACTORIZATION",
    }
    retrieval = question_retrieval(question, ROLLOUT_OBJECTIVE)
    query, services = retrieval["query"], retrieval["key_services"]
    assert query.startswith("Marked answer: " + question["correct_answer"])
    assert query.endswith("Secondary exam scope hint (not the retrieval target): " + ROLLOUT_OBJECTIVE)
    docs._discover_urls(query, services, 5)
    assert exa_search.call_args.kwargs["query"] == " ".join([
        "Google Cloud", query, ", ".join(services),
    ])
