"""Offline v6 distractor discovery; no real search, network, or model calls."""
import hashlib
from copy import deepcopy
from unittest.mock import Mock

import pytest

from shared import doc_search as docs
from shared.doc_context_budget import build_documentation_context, quote_in_context
from shared.evidence import check_evidence


OBJECTIVE = "Select a managed online model serving approach"
SERVICES = ["Agent Platform", "Cloud Storage"]
PLAN = {
    "engineering_decision": "Choose an online prediction serving approach",
    "existing_system": "A model with HTTPS prediction clients",
    "best_action": "Deploy the model to an Agent Platform endpoint",
    "decisive_constraints": ["Managed online prediction", "No cluster administration"],
    "mistakes": [
        {"action": "Serve the model with a Cloud Run service",
         "scenario_reason": "Cloud Run cannot serve any prediction requests"},
        {"action": "Deploy a model serving container on GKE",
         "scenario_reason": "GKE does not support model serving containers"},
        {"action": "Use BigQuery ML ML.PREDICT for batch predictions",
         "scenario_reason": "BigQuery ML has no prediction capability"},
    ],
}
ACTIONS = [PLAN["best_action"], *[row["action"] for row in PLAN["mistakes"]]]
QUOTES = [
    "Agent Platform endpoints serve online prediction requests.",
    "Cloud Run services run containers and respond to HTTPS requests.",
    "GKE runs containerized workloads on Kubernetes clusters.",
    "BigQuery ML ML.PREDICT performs predictions with SQL.",
]
BASE = "https://docs.cloud.google.com/test/"


def source(url, text="Synthetic fetched documentation."):
    return {"requested_url": url, "url": url, "text": text,
            "retrieved_at": "2026-10-25T00:00:00+00:00",
            "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest()}


def legacy_targets():
    overview = "\n".join([
        "Engineering decision: " + PLAN["engineering_decision"],
        "Existing system: " + PLAN["existing_system"],
        "Choose between approaches: " + " versus ".join(ACTIONS),
        "Official overview comparison architecture when to choose guidance",
        "Objective scope: " + OBJECTIVE,
    ])
    reasons = [" ".join(PLAN["decisive_constraints"]),
               *[row["scenario_reason"] for row in PLAN["mistakes"]]]
    return [(overview, SERVICES, 5)] + [
        ("Engineering decision: Verify this option's named Google Cloud products and capabilities."
         + "\nPlanned action: " + action + "\nTradeoff to verify: " + reason
         + "\nOfficial overview capability limitations support lifecycle documentation", [], 2)
        for action, reason in zip(ACTIONS, reasons)
    ]


@pytest.mark.parametrize("policy", [None, "v5"])
def test_default_and_explicit_v5_keep_exact_query_bytes_and_sources(monkeypatch, policy):
    discover = Mock(return_value=[BASE + "shared"])
    fetched = source(BASE + "shared")
    monkeypatch.setattr(docs, "_discover_urls", discover)
    fetch = Mock(return_value=fetched)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    kwargs = {} if policy is None else {"doccheck_policy": policy}
    result = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, **kwargs)
    assert [call.args for call in discover.call_args_list] == legacy_targets()
    assert result == [{**fetched, "discovery_kind": "option", "discovery_options": list("ABCD")}]
    fetch.assert_called_once_with(BASE + "shared")


@pytest.mark.parametrize("policy", [None, "", "V6", "v7", 6, []])
@pytest.mark.parametrize("plan", [None, PLAN])
def test_unknown_policy_fails_before_discovery(monkeypatch, policy, plan):
    discover = Mock(side_effect=AssertionError("No discovery for invalid policy"))
    monkeypatch.setattr(docs, "_discover_urls", discover)
    with pytest.raises(docs.DocumentationError, match="policy must be v5 or v6"):
        docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=plan, doccheck_policy=policy)
    discover.assert_not_called()


@pytest.mark.parametrize("policy", ["v5", "v6"])
def test_policy_without_plan_keeps_original_objective_search(monkeypatch, policy):
    discover = Mock(return_value=[BASE + "overview"])
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", lambda url: source(url))
    assert docs.search_objective_docs(OBJECTIVE, SERVICES, doccheck_policy=policy) == [source(BASE + "overview")]
    discover.assert_called_once_with(OBJECTIVE, SERVICES, 5)


def positive_backends(monkeypatch, *, long_text=False):
    calls = []
    pages = {BASE + "overview": source(BASE + "overview", "General serving overview.")}
    for label, quote in zip("ABCD", QUOTES):
        text = (("Unrelated background. " * 3000) + quote + (" More background." * 3000)
                if long_text else quote)
        pages[BASE + label] = source(BASE + label, text)

    def discover(text, services, limit):
        calls.append((text, services, limit))
        if limit == 5:
            return [BASE + "overview"]
        assert services == []  # Do not bias alternatives toward main-topic services.
        index = next(i for i, action in enumerate(ACTIONS) if "Planned action: " + action in text)
        if index:
            assert "positive documented behavior" in text
            assert "capabilities supported use cases how it works" in text
            assert "Tradeoff to verify:" not in text
            assert all(row["scenario_reason"] not in text for row in PLAN["mistakes"])
        return [BASE + "ABCD"[index]]

    monkeypatch.setattr(docs, "_discover_urls", discover)
    fetch = Mock(side_effect=lambda url: deepcopy(pages[url]))
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    return calls, fetch, pages


def test_v6_discovers_wrong_option_behavior_and_preserves_provenance(monkeypatch):
    calls, fetch, pages = positive_backends(monkeypatch)
    plan_before = deepcopy(PLAN)
    result = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, doccheck_policy="v6")
    assert [call[2] for call in calls] == [5, 2, 2, 2, 2]
    assert calls[:2] == legacy_targets()[:2]  # Overview and best-action queries are unchanged.
    assert len(result) == fetch.call_count == 5
    assert result[0] == {**pages[BASE + "overview"], "discovery_kind": "overview", "discovery_options": []}
    for label, row in zip("ABCD", result[1:]):
        assert row == {**pages[BASE + label], "discovery_kind": "option", "discovery_options": [label]}
    assert PLAN == plan_before


def test_v6_keeps_thirteen_source_cap_and_run_cache(monkeypatch):
    discover = Mock(side_effect=lambda text, services, limit: [
        f"{BASE}{discover.call_count}/{i}" for i in range(20)])
    fetch = Mock(side_effect=source)
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    cache = docs.DocumentationCache()
    first = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN,
                                       cache=cache, objective_id="1.1", doccheck_policy="v6")
    expected = deepcopy(first)
    first[0]["text"] = "Caller mutation"
    first[-1]["discovery_options"].append("A")
    second = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN,
                                        cache=cache, objective_id="1.1", doccheck_policy="v6")
    assert second == expected
    assert discover.call_count == 5
    assert [call.args[2] for call in discover.call_args_list] == [5, 2, 2, 2, 2]
    assert fetch.call_count == len(second) == 13
    assert sum(row["discovery_kind"] == "overview" for row in second) == 5
    for label in "ABCD":
        assert sum(label in row["discovery_options"] for row in second) == docs.OPTION_DOCUMENT_LIMIT == 2


def test_v6_deduplicates_cross_option_urls_and_merges_labels(monkeypatch):
    url = BASE + "shared"
    monkeypatch.setattr(docs, "_discover_urls", lambda *args: [url, url])
    fetch = Mock(side_effect=source)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    result = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, doccheck_policy="v6")
    assert result == [{**source(url), "discovery_kind": "option", "discovery_options": list("ABCD")}]
    fetch.assert_called_once_with(url)


def test_shared_cache_separates_v6_wrong_option_queries_only(monkeypatch):
    discover = Mock(return_value=[BASE + "shared"])
    fetch = Mock(side_effect=source)
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    cache = docs.DocumentationCache()
    v5 = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, cache=cache)
    v6 = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, cache=cache, doccheck_policy="v6")
    assert v5 == v6
    assert discover.call_count == 8  # Five legacy targets plus three changed distractor targets.
    assert fetch.call_count == 1


def test_v6_wrong_option_docs_and_exact_receipts_fit_existing_budget(monkeypatch):
    _, _, _ = positive_backends(monkeypatch, long_text=True)
    sources = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, doccheck_policy="v6")
    before = deepcopy(sources)
    receipts = [{"option_label": label, "url": BASE + label, "quote": quote}
                for label, quote in zip("ABCD", QUOTES)]
    bundle = build_documentation_context(sources, max_chars=9000, plan=PLAN, receipts=receipts)
    assert len(bundle["context"]) <= 9000 < len(docs.documentation_context(sources))
    assert bundle["metadata"]["after_chars"] == len(bundle["context"])
    kept = {page["url"] for page in bundle["metadata"]["pages"] if not page["omitted"]}
    assert all(BASE + label in kept for label in "ABCD")
    assert all(quote_in_context(receipt, sources, bundle["metadata"]) for receipt in receipts)
    assert check_evidence(receipts, sources)["passed"]
    assert sources == before


def test_v6_still_rejects_unofficial_discovery_before_fetch(monkeypatch):
    monkeypatch.setattr(docs, "_discover_urls", lambda text, services, limit:
                        [] if limit == 5 else ["https://example.com/not-official"])
    fetch = Mock()
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    with pytest.raises(docs.DocumentationError, match="documentation URL"):
        docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, doccheck_policy="v6")
    fetch.assert_not_called()


def test_v6_missing_option_docs_do_not_create_evidence(monkeypatch):
    monkeypatch.setattr(docs, "_discover_urls", lambda text, services, limit:
                        [BASE + "overview"] if limit == 5 else [])
    monkeypatch.setattr(docs, "_fetch_documentation", source)
    result = docs.search_objective_docs(OBJECTIVE, SERVICES, decision_plan=PLAN, doccheck_policy="v6")
    assert result == [{**source(BASE + "overview"), "discovery_kind": "overview", "discovery_options": []}]
    assert not check_evidence([], result)["passed"]
