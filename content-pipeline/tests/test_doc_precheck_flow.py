"""Offline CLI coverage for the opt-in documentation eligibility precheck."""
from copy import deepcopy
import json
from unittest.mock import Mock

from scripts import generate_pmle_questions as generate
from test_decision_first_v4 import pipeline, decision, proof
from test_external_generation import source


def artifact(path):
    return json.loads((path / "batch.json").read_text())


def verifier(events):
    def verify(scope, plan, sources, *, model, reasoning_effort):
        events.append("proof")
        assert model == "codex" and reasoning_effort == "medium"
        assert set(plan) == set(decision())
        return {**proof(), "passed": True,
                "mechanical_check": {"passed": True, "errors": []}}
    return Mock(side_effect=verify)


def experimental(monkeypatch, events, outcomes):
    outcomes = iter(outcomes)
    calls = []
    commitments = [{"url": "https://docs.cloud.google.com/run/docs/overview", "anchor": "missing-section"}]
    original = [source()]
    supplemented = [*original, source("Complete supplementary documentation", "https://docs.cloud.google.com/run/docs/container-contract")]
    def plan(scope, **kwargs):
        events.append("plan_commitments")
        calls.append(kwargs)
        return {"plan": decision(f"Distinct decision {len(calls)}"), "commitments": commitments}
    def fetch(received, cache, sources):
        events.append("fetch_commitments")
        assert received == commitments
        assert sources == original
        return supplemented, []
    def check(plan, received, sources):
        events.append("precheck")
        assert received == commitments and sources == supplemented
        passed = next(outcomes)
        return {"passed": passed, "reasons": [] if passed else ["Missing anchor: missing-section"]}
    monkeypatch.setattr(generate, "plan_decision_with_commitments", plan)
    monkeypatch.setattr(generate, "fetch_commitment_sources", fetch)
    monkeypatch.setattr(generate, "check_doc_commitments", check)
    return calls, commitments, original, supplemented


def test_default_off_preserves_baseline_calls(pipeline, monkeypatch):
    events, path, invoke = pipeline
    for name in ("plan_decision_with_commitments", "fetch_commitment_sources", "check_doc_commitments"):
        monkeypatch.setattr(generate, name, Mock(side_effect=AssertionError("Opt-in helper called by default")))
    planner = Mock(side_effect=lambda scope, **kw: events.append("plan") or decision())
    verify = verifier(events)
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "verify_decision", verify)
    result = invoke()
    assert result.exit_code == 0, result.output
    assert events == ["plan", "retrieval", "proof", "writer", "citation"]
    assert set(planner.call_args.kwargs) == {"model", "difficulty", "replacement_feedback", "existing_scenarios", "reasoning_effort"}
    assert len(verify.call_args.args) == 3
    assert verify.call_args.args[1:] == (decision(), [source()])
    assert verify.call_args.kwargs == {"model": "codex", "reasoning_effort": "medium"}
    payload = artifact(path)
    assert payload["planner_doc_precheck"] == {"version": 1, "enabled": False, "shadow": False}
    assert "doc_precheck" not in payload["candidates"][0]["decision_attempts"][0]


def test_failed_anchor_replans_without_fake_proof_then_full_verification(pipeline, monkeypatch):
    events, path, invoke = pipeline
    calls, commitments, original, supplemented = experimental(monkeypatch, events, [False, True])
    frozen = deepcopy(original)
    verify = verifier(events)
    monkeypatch.setattr(generate, "verify_decision", verify)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code == 0, result.output
    assert events == ["plan_commitments", "retrieval", "fetch_commitments", "precheck",
                      "plan_commitments", "retrieval", "fetch_commitments", "precheck", "proof", "writer", "citation"]
    assert "precheck" in calls[1]["replacement_feedback"].lower()
    assert "missing-section" in calls[1]["replacement_feedback"]
    payload = artifact(path)
    assert payload["planner_doc_precheck"] == {"version": 1, "enabled": True, "shadow": False}
    entry = payload["candidates"][0]
    first, second = entry["decision_attempts"]
    assert entry["decision_attempt_count"] == 2
    assert "proof" not in first
    assert first["verification_skipped"] == "doc_precheck"
    assert first["doc_commitments"] == commitments
    assert first["doc_precheck"] == {"passed": False, "reasons": ["Missing anchor: missing-section"], "fetch_errors": [], "shadow": False}
    assert second["proof"]["passed"] is True
    assert verify.call_count == 1
    assert verify.call_args.args[1:] == (second["plan"], supplemented)
    assert verify.call_args.kwargs == {"model": "codex", "reasoning_effort": "medium"}
    assert original == frozen
    assert entry["sources"] == second["sources"] == supplemented
    assert supplemented[0] == frozen[0]


def test_three_failed_prechecks_exhaust_shared_budget_without_downstream_calls(pipeline, monkeypatch):
    events, path, invoke = pipeline
    calls, _, _, _ = experimental(monkeypatch, events, [False, False, False])
    verify = Mock(side_effect=AssertionError("Full verification must be skipped"))
    monkeypatch.setattr(generate, "verify_decision", verify)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code != 0
    assert len(calls) == 3
    assert not verify.called
    assert all(name not in events for name in ("writer", "citation", "three_gates"))
    entry = artifact(path)["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert all("proof" not in row and row["verification_skipped"] == "doc_precheck" for row in entry["decision_attempts"])
    assert not entry["accepted"] and "external_judge_request" not in entry



def test_precheck_and_semantic_veto_share_three_attempt_budget(pipeline, monkeypatch):
    events, path, invoke = pipeline
    calls, _, _, _ = experimental(monkeypatch, events, [True, False, True])
    outcomes = iter([False, True])
    def verify(scope, plan, sources, *, model, reasoning_effort):
        events.append("proof")
        passed = next(outcomes)
        return {**proof(passed), "passed": passed,
                "mechanical_check": {"passed": passed, "errors": []}}
    checked = Mock(side_effect=verify)
    monkeypatch.setattr(generate, "verify_decision", checked)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code == 0, result.output
    entry = artifact(path)["candidates"][0]
    assert len(calls) == entry["decision_attempt_count"] == 3
    assert checked.call_count == 2
    assert entry["decision_attempts"][0]["proof"]["passed"] is False
    assert "proof" not in entry["decision_attempts"][1]
    assert entry["decision_attempts"][2]["proof"]["passed"] is True
    assert "Unsupported first decision" in calls[2]["replacement_feedback"]
    assert "precheck" in calls[2]["replacement_feedback"].lower()
    assert events.count("writer") == events.count("citation") == 1



def test_malformed_commitment_schema_replans_before_any_documentation_or_verifier(pipeline, monkeypatch):
    events, path, invoke = pipeline
    calls, _, _, _ = experimental(monkeypatch, events, [True])
    valid_planner = generate.plan_decision_with_commitments
    feedback = []
    def planner(scope, **kwargs):
        feedback.append(kwargs["replacement_feedback"])
        if len(feedback) == 1:
            events.append("malformed_plan")
            raise ValueError("Missing A-D commitment rows")
        return valid_planner(scope, **kwargs)
    monkeypatch.setattr(generate, "plan_decision_with_commitments", planner)
    checked = verifier(events)
    monkeypatch.setattr(generate, "verify_decision", checked)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code == 0, result.output
    assert events == ["malformed_plan", "plan_commitments", "retrieval", "fetch_commitments", "precheck", "proof", "writer", "citation"]
    assert len(feedback) == 2 and len(calls) == checked.call_count == 1
    assert "missing/malformed documentation commitments" in feedback[1]
    assert "complete A-D page/section commitments" in feedback[1]
    entry = artifact(path)["candidates"][0]
    assert entry["decision_attempt_count"] == 2
    rejected, accepted = entry["decision_attempts"]
    assert rejected["verification_skipped"] == "doc_precheck_schema"
    assert all(key not in rejected for key in ("plan", "proof", "sources"))
    assert accepted["proof"]["passed"] is True


def test_three_malformed_commitment_schemas_exhaust_budget_without_downstream_calls(pipeline, monkeypatch):
    events, path, invoke = pipeline
    planner = Mock(side_effect=ValueError("Malformed commitment schema"))
    checked = Mock(side_effect=AssertionError("Malformed schema must skip verifier"))
    monkeypatch.setattr(generate, "plan_decision_with_commitments", planner)
    monkeypatch.setattr(generate, "verify_decision", checked)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code != 0
    assert planner.call_count == 3 and not checked.called
    assert events == []
    entry = artifact(path)["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert all(row["verification_skipped"] == "doc_precheck_schema" and
               "plan" not in row and "proof" not in row for row in entry["decision_attempts"])
    assert not entry["accepted"] and "external_judge_request" not in entry


def test_shadow_requires_planner_precheck_flag(pipeline):
    events, _, invoke = pipeline
    result = invoke("--doc-precheck-shadow")
    assert result.exit_code != 0
    assert "--doc-precheck-shadow requires --planner-doc-precheck" in result.output
    assert events == []


def test_failed_shadow_precheck_still_runs_full_verifier(pipeline, monkeypatch):
    events, path, invoke = pipeline
    calls, commitments, _, supplemented = experimental(monkeypatch, events, [False])
    verify = verifier(events)
    monkeypatch.setattr(generate, "verify_decision", verify)
    result = invoke("--planner-doc-precheck", "--doc-precheck-shadow")
    assert result.exit_code == 0, result.output
    assert len(calls) == verify.call_count == 1
    assert events == ["plan_commitments", "retrieval", "fetch_commitments", "precheck", "proof", "writer", "citation"]
    payload = artifact(path)
    assert payload["planner_doc_precheck"] == {"version": 1, "enabled": True, "shadow": True}
    attempt = payload["candidates"][0]["decision_attempts"][0]
    assert attempt["doc_commitments"] == commitments
    assert attempt["doc_precheck"]["passed"] is False
    assert attempt["doc_precheck"]["shadow"] is True
    assert attempt["proof"]["passed"] is True
    assert "verification_skipped" not in attempt
    assert verify.call_args.args[1:] == (attempt["plan"], supplemented)
    assert verify.call_args.kwargs == {"model": "codex", "reasoning_effort": "medium"}



def test_codex_schema_failure_is_bounded_replan(pipeline, monkeypatch):
    from shared.cli_models import CLISchemaError
    events, path, invoke = pipeline
    planner = Mock(side_effect=CLISchemaError("schema"))
    monkeypatch.setattr(generate, "plan_decision_with_commitments", planner)
    result = invoke("--planner-doc-precheck")
    assert result.exit_code != 0 and planner.call_count == 3
    assert all(row["verification_skipped"] == "doc_precheck_schema"
               for row in artifact(path)["candidates"][0]["decision_attempts"])


def test_empty_discovery_still_tries_committed_pages(pipeline, monkeypatch):
    events, path, invoke = pipeline
    commitments = {"anchors": []}
    monkeypatch.setattr(generate, "plan_decision_with_commitments", lambda *a, **kw: {"plan": decision(), "commitments": commitments})
    def discover(*args, **kwargs):
        assert kwargs["allow_empty"] is True
        return []
    monkeypatch.setattr(generate, "search_objective_docs", discover)
    supplement = Mock(return_value=([source()], []))
    monkeypatch.setattr(generate, "fetch_commitment_sources", supplement)
    monkeypatch.setattr(generate, "check_doc_commitments", lambda *a: {"passed": True, "reasons": []})
    result = invoke("--planner-doc-precheck")
    assert result.exit_code == 0, result.output
    assert supplement.call_args.args[-1] == []
    assert artifact(path)["candidates"][0]["decision_attempts"][0]["proof"]["passed"] is True
