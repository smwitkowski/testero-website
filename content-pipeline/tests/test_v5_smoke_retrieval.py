"""Recorded decision plans replay with synthetic official fetches; no live calls."""
import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest
from shared import doc_search as docs
from shared.batch_report import key_position_report, format_key_position_report
from shared.decision_planner import verify_decision, DecisionPlanSignature, DecisionProofSignature
from scripts import generate_pmle_questions as generate
from test_three_gates_v4 import v4
from test_external_ingest import case

FIXTURE = json.loads((Path(__file__).parent / "fixtures/v5-smoke-decision-veto.json").read_text())
ATTEMPTS = [attempt for row in FIXTURE["candidates"] for attempt in row["attempts"]]


def source(url, text):
    return {"requested_url": url, "url": url, "text": text,
            "retrieved_at": "2026-10-13T00:00:00+00:00",
            "text_sha256": hashlib.sha256(text.encode()).hexdigest()}


@pytest.mark.parametrize("attempt", ATTEMPTS)
def test_smoke_plan_fetches_each_option_before_proof(monkeypatch, attempt):
    plan = attempt["plan"]
    targets = [(plan["best_action"], " ".join(plan["decisive_constraints"]))]
    targets += [(row["action"], row["scenario_reason"]) for row in plan["mistakes"]]
    base_url = "https://docs.cloud.google.com/test/objective"
    pages = {base_url: source(base_url, "Synthetic objective page; no alternative support.")}
    calls = []
    def discover(text, services, limit):
        calls.append((text, services, limit))
        if limit == 5:
            return [base_url]
        action, reason = targets[len(calls) - 2]
        assert action in text and reason in text
        assert not services  # No main-topic service bias in the focused queries.
        url = "https://docs.cloud.google.com/test/option-" + str(len(calls) - 2)
        pages[url] = source(url, "Synthetic retrieval coverage only: " + action)
        return [url]
    monkeypatch.setattr(docs, "_discover_urls", discover)
    fetch = Mock(side_effect=lambda url: pages[url])
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    retrieved = docs.search_objective_docs("Serving objective", ["Agent Platform"], decision_plan=plan)
    assert [row[2] for row in calls] == [5, 2, 2, 2, 2]
    assert len(retrieved) == 5
    captured = []
    def veto(**inputs):
        captured.append(inputs["fetched_documentation"])
        return {"supported": False, "uniquely_best": False,
                "scenario_reasons_supported": False, "no_feature_gotchas": True,
                "reason": attempt["proof_reason"], "reasons": []}
    proof = verify_decision({"domain_prompt": "Serving objective"}, plan, retrieved, model="codex", predictor=veto)
    assert all(action in captured[0] for action, _ in targets)
    # More fetched text must not override the recorded substantive veto.
    assert not proof["passed"] and proof["reason"] == attempt["proof_reason"]


def test_option_fetch_bound_dedup_and_run_cache(monkeypatch):
    plan = ATTEMPTS[0]["plan"]
    calls = []
    fetch = Mock(side_effect=lambda url: source(url, "Synthetic official fact."))
    def discover(text, services, limit):
        calls.append(limit)
        # Deliberately oversized backend response cannot enlarge the fetch bound.
        return [f"https://docs.cloud.google.com/test/{len(calls)}/{i}" for i in range(20)]
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    cache = docs.DocumentationCache()
    first = docs.search_objective_docs("Objective", [], cache=cache, decision_plan=plan)
    second = docs.search_objective_docs("Objective", [], cache=cache, decision_plan=plan)
    assert calls == [5, 2, 2, 2, 2]
    assert fetch.call_count == len(first) == 13 and first == second
    assert docs.documentation_context(first)
    shared_url = "https://docs.cloud.google.com/test/shared"
    monkeypatch.setattr(docs, "_discover_urls", lambda *args: [shared_url, shared_url])
    fetch.reset_mock()
    assert len(docs.search_objective_docs("Objective", [], decision_plan=plan)) == 1
    fetch.assert_called_once_with(shared_url)


def test_unofficial_option_url_is_not_fetched(monkeypatch):
    calls = 0
    def discover(*args):
        nonlocal calls
        calls += 1
        return [] if calls == 1 else ["https://example.com/not-official"]
    fetch = Mock()
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    with pytest.raises(docs.DocumentationError):
        docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"])
    fetch.assert_not_called()


def test_missing_option_docs_do_not_invent_receipts(monkeypatch):
    url = "https://docs.cloud.google.com/test/base"
    monkeypatch.setattr(docs, "_discover_urls", lambda text, services, limit: [url] if limit == 5 else [])
    monkeypatch.setattr(docs, "_fetch_documentation", lambda url: source(url, "Synthetic main-topic fact."))
    fetched = docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"])
    assert fetched == [source(url, "Synthetic main-topic fact.")]
    raw = {"supported": True, "uniquely_best": True, "scenario_reasons_supported": True,
           "no_feature_gotchas": True, "reason": "Synthetic attempted unsupported PASS",
           "reasons": [{"option_label": label, "url": url, "quote": "Missing capability quote",
                        "scenario_reason": "Unsupported reason"} for label in "ABCD"]}
    proof = verify_decision({"domain_prompt": "Objective"}, ATTEMPTS[0]["plan"], fetched, model="codex", predictor=lambda **kw: raw)
    assert not proof["passed"] and not proof["mechanical_check"]["passed"]


def test_zero_candidates_reports_unavailable_and_preserves_real_failure(monkeypatch, tmp_path):
    row = FIXTURE["candidates"][0]
    # A third attempt now exists; replay the first vetoed plan so no invented support
    # or iterator exhaustion can replace the real fail-closed decision rejection.
    plans = iter([*(attempt["plan"] for attempt in row["attempts"]), row["attempts"][0]["plan"]])
    reasons = iter(attempt["proof_reason"] for attempt in row["attempts"])
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: next(plans))
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [source("https://docs.cloud.google.com/test/base", "Synthetic fact")])
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: {"passed": False, "reason": next(reasons), "mechanical_check": {"passed": False, "errors": []}})
    writer = Mock(side_effect=AssertionError("Veto must prevent writing"))
    monkeypatch.setattr(generate, "generate_question", writer)
    monkeypatch.setattr(generate, "database_client", Mock(side_effect=AssertionError("No DB")))
    artifact = tmp_path / "batch.json"
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--n-questions", "1", "--objective", row["attempts"][0]["plan"]["objective_id"], "--argon-gate", "--artifact", str(artifact)])
    assert result.exit_code == 1
    assert "Key positions: not available" in result.output
    assert "Key-position batch report failed" not in result.output
    assert "Some candidates failed before external judgment" in result.output
    saved = json.loads(artifact.read_text())
    assert saved["key_position_report"]["passed"] is None
    assert saved["candidates"][0]["failure_stage"] == "decision_veto"
    assert saved["candidates"][0]["error_class"] == "DecisionVetoError"
    writer.assert_not_called()
    report = key_position_report([])
    assert report["passed"] is None and "not available" in format_key_position_report(report)


def test_recorded_expired_container_veto_remains_content_constraint():
    reason = ATTEMPTS[3]["proof_reason"]
    assert "past its patch and support date" in reason
    assert "deprecated or unsupported serving containers" in DecisionPlanSignature.instructions
    assert "Availability alone does not prove current support" in DecisionProofSignature.instructions


@pytest.mark.parametrize("overview_empty,all_empty", [(True, False), (True, True)])
def test_empty_overview_can_be_rescued_but_empty_union_fails(monkeypatch, overview_empty, all_empty):
    url = "https://docs.cloud.google.com/test/option"
    monkeypatch.setattr(docs, "_discover_urls", lambda text, services, limit: [] if limit == 5 or all_empty else [url])
    fetch = Mock(side_effect=lambda url: source(url, "Synthetic option fact."))
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    if all_empty:
        with pytest.raises(docs.DocumentationError, match="No official documentation"):
            docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"])
        fetch.assert_not_called()
    else:
        assert docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"]) == [source(url, "Synthetic option fact.")]
        fetch.assert_called_once_with(url)


@pytest.mark.parametrize("conflict", [False, True])
def test_cross_option_aliases_and_cached_failures(monkeypatch, conflict):
    base = "https://docs.cloud.google.com/test/"
    responses = iter([[base + "failed"], [base + "failed", base + "one"], [base + "two"], [], []])
    monkeypatch.setattr(docs, "_discover_urls", lambda *a: next(responses))
    def fetch_url(url):
        if url.endswith("failed"):
            raise TimeoutError("Offline failed document")
        fetched = source(base + "final", "Conflicting fact." if conflict and url.endswith("two") else "Synthetic shared fact.")
        return {**fetched, "requested_url": url}
    fetch = Mock(side_effect=fetch_url)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    if conflict:
        with pytest.raises(docs.DocumentationError, match="Conflicting text"):
            docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"])
    else:
        assert len(docs.search_objective_docs("Objective", [], decision_plan=ATTEMPTS[0]["plan"])) == 1
    assert [call.args[0] for call in fetch.call_args_list] == [base + "failed", base + "one", base + "two"]


def test_tiny_batch_is_informational_but_invalid_key_is_not():
    for n in (1, 9):
        report = key_position_report([{"options": [{}], "key": "B"}] * n)
        assert report["passed"] is True and report["enforced"] is False
        assert "informational" in format_key_position_report(report)
    report = key_position_report([{"options": [{}], "key": "B"}] * 10)
    assert report["passed"] is False and report["enforced"] is True
    assert "FAIL" in format_key_position_report(report)
    assert key_position_report([{"options": [{}], "key": "invalid"}])["passed"] is False


def test_recorded_smoke_argon_request_fits_without_changing_frozen_candidate(monkeypatch, tmp_path):
    from copy import deepcopy
    from shared import external_judge as external
    from shared.external_judge import candidate_question
    from shared.option_order import canonical_evidence
    from shared.evidence import check_evidence, normalize_whitespace
    from shared.argon_gate import validate_request
    replay = json.loads((Path(__file__).parent / "fixtures/v5-smoke-external-request.json").read_text())
    entry, scope = deepcopy(replay["candidate"]), deepcopy(replay["scope"])
    scope.update({k: entry[k] for k in ("decision_objective", "decision_plan", "decision_proof")})
    before = deepcopy(entry)
    question, evidence = candidate_question(entry), canonical_evidence(entry)
    assert entry["key"] == "B" and check_evidence(evidence, entry["sources"])["passed"]
    # Reproduce the old failure with the original 8000-character margin.
    monkeypatch.setattr(external, "ARGON_QUOTE_WINDOW_MARGIN", 8000)
    with pytest.raises(ValueError, match="character bound"):
        external.build_request(entry["candidate_id"], scope, question, entry["sources"], evidence, argon_gate=True)
    monkeypatch.setattr(external, "ARGON_QUOTE_WINDOW_MARGIN", 4000)
    request = external.build_request(entry["candidate_id"], scope, question, entry["sources"], evidence, argon_gate=True)
    serialized = json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    assert len(serialized) <= external.REQUEST_CHARACTER_LIMIT == 150000
    validate_request(request["argon"])
    assert set(request["gates"]) == {"blind_solver", "evidence", "style"}
    assert entry == before
    assert any(record.get("margin") == 4000 for record in request["trimming"]["sources"])
    for receipt in evidence:
        assert normalize_whitespace(receipt["quote"]) in request["gates"]["evidence"]["judge_prompt"]
        assert normalize_whitespace(receipt["quote"]) in request["argon"]["calls"]["review"]["judge_prompt"]
    # Replay through the generator too: frozen shuffled labels and local request bytes survive.
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: entry["decision_plan"])
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: entry["sources"])
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: entry["decision_proof"])
    monkeypatch.setattr(generate, "generate_question", lambda *a, **kw: question)
    monkeypatch.setattr(generate, "cite_question", lambda *a, **kw: {"evidence": evidence})
    monkeypatch.setattr(generate, "database_client", Mock(side_effect=AssertionError("No DB")))
    artifact = tmp_path / "batch.json"
    flags = ["--model", "codex", "--judge-model", "external", "--n-questions", "1",
             "--objective", scope["objective_id"], "--argon-gate", "--artifact", str(artifact)]
    result = CliRunner().invoke(generate.main, flags)
    assert result.exit_code == 0, result.output
    saved = json.loads(artifact.read_text())
    assert saved["candidates"][0]["awaiting_external_judge"] is True
    assert saved["key_position_report"]["count"] == 0
    assert saved["key_position_report"]["passed"] is None
    assert saved["all_candidate_key_position_report"]["count"] == 1
    request_file = next(artifact.with_name("batch.judge-requests").glob("*.json"))
    assert "argon" in json.loads(request_file.read_text())
    # A failed local builder exposes a bounded/redacted message, not just ValueError.
    def fail(*a, **kw):
        raise ValueError("Local request overflow Bearer secret sk-sensitive")
    monkeypatch.setattr(generate, "build_request", fail)
    flags[-1] = str(tmp_path / "failed.json")
    failed = CliRunner().invoke(generate.main, flags)
    assert failed.exit_code == 1 and "Key-position batch report failed" not in failed.output
    recorded = json.loads((tmp_path / "failed.json").read_text())["candidates"][0]
    assert recorded["failure_stage"] == "external_request" and recorded["error_class"] == "ValueError"
    assert recorded["error_message"] == "Local request overflow Bearer [REDACTED] [REDACTED KEY]"
    assert recorded["reason"] == recorded["error_message"]


def test_ingest_enforced_cap_blocks_before_database(v4, monkeypatch):
    from scripts import ingest_external_verdicts as ingest
    from test_pipeline_v5 import prepare_v5
    from test_external_ingest import invoke
    case, _, _ = v4
    prepare_v5(case)
    monkeypatch.setattr(ingest, "key_position_report", lambda rows: key_position_report(list(rows) * 10))
    result = invoke(case)
    assert result.exit_code == 1 and "batch report failed" in result.output
    case[4].assert_not_called()


def test_argon_fallback_still_fails_closed_on_request_cap(monkeypatch):
    from shared import external_judge as external
    from test_external_generation import QUESTION, receipts, source as fetched_source
    from shared.cert_context import plan_questions
    from test_external_generation import OBJECTIVE
    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[OBJECTIVE])[0]
    monkeypatch.setattr(external, "REQUEST_CHARACTER_LIMIT", 1)
    with pytest.raises(ValueError, match="character bound"):
        external.build_request("offline", scope, QUESTION, [fetched_source()], receipts(), argon_gate=True)
