"""Offline rules-v4 decision ordering, veto, scope and authoring contracts."""
from collections import Counter
from copy import deepcopy
import json
from pathlib import Path

from click.testing import CliRunner
import pytest
from pydantic import ValidationError

from scripts import generate_pmle_questions as generate
from shared.cert_context import DEFAULT_CERT, plan_questions
from shared.cli_models import output_model
from shared.decision_planner import (
    DecisionPlan, DecisionPlanSignature, DecisionProofSignature,
    plan_decision, verify_decision, writer_decision_context, DecisionVetoError,
)
from shared.doc_search import decision_discovery_text, _discovery_query
from shared.question_style import (
    FOUNDER_EXEMPLARS, FOUNDER_EXEMPLAR_IDS, LEGACY_FOUNDER_EXEMPLARS,
    LEGACY_STYLE_INSTRUCTIONS_V3, STYLE_INSTRUCTIONS, STYLE_RULES,
)
from test_external_generation import QUESTION, OBJECTIVE, source, receipts


def decision(name="Choose managed serving for the delivery application"):
    return {
        "objective_id": OBJECTIVE, "engineering_decision": name,
        "business_consequence": "Customers can obtain current delivery updates",
        "existing_system": "The team already maintains HTTP application code",
        "decisive_constraints": ["Keep infrastructure management low"],
        "best_action": "Run the existing HTTP application on Cloud Run",
        "mistakes": [
            {"action": "Use BigQuery batch processing", "scenario_reason": "Offline execution does not run the HTTP handler"},
            {"action": "Use Cloud Storage object storage", "scenario_reason": "Stored objects do not execute application code"},
            {"action": "Use Compute Engine virtual machines", "scenario_reason": "The team maintains infrastructure unnecessarily"},
        ],
    }


def proof(supported=True):
    return {"supported": supported, "uniquely_best": supported,
            "scenario_reasons_supported": supported, "no_feature_gotchas": supported,
            "reason": "Official overview supports the decision" if supported else "Unsupported first decision: replace it, do not add an exception",
            "reasons": [{**row, "scenario_reason": "Synthetic scenario-specific comparison"} for row in receipts()] if supported else []}


def scope():
    return plan_questions(DEFAULT_CERT, 1, objective_ids=[OBJECTIVE])[0]


def test_typed_plan_has_required_decision_fields_and_no_documentation_input():
    assert set(DecisionPlan.model_fields) == {
        "objective_id", "engineering_decision", "business_consequence", "existing_system",
        "decisive_constraints", "best_action", "mistakes"}
    assert set(DecisionPlanSignature.input_fields) == {"objective_scope", "difficulty", "replacement_feedback"}
    assert output_model(DecisionPlanSignature).model_json_schema()["additionalProperties"] is False
    for constraints, mistakes in [([], 3), (["one", "two", "three"], 3), (["one"], 2), (["one"], 4)]:
        data = decision()
        data["decisive_constraints"] = constraints
        data["mistakes"] = data["mistakes"][:1] * mistakes
        with pytest.raises(ValidationError):
            DecisionPlan.model_validate(data)


def test_plan_cannot_change_objective_or_repeat_alternatives():
    good = decision()
    assert plan_decision(scope(), model="codex", predictor=lambda **kw: {"plan": good}) == good
    wrong = {**good, "objective_id": "outside-scope"}
    with pytest.raises(ValueError, match="objective"):
        plan_decision(scope(), model="codex", predictor=lambda **kw: {"plan": wrong})
    repeated = deepcopy(good)
    repeated["mistakes"][0]["action"] = good["best_action"]
    with pytest.raises(ValueError, match="distinct"):
        plan_decision(scope(), model="codex", predictor=lambda **kw: {"plan": repeated})


@pytest.mark.parametrize("field", ["supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas"])
def test_any_veto_check_blocks_writer_even_with_receipts(field):
    value = proof()
    value[field] = False
    checked = verify_decision(scope(), decision(), [source()], model="codex", predictor=lambda **kw: value)
    assert checked["passed"] is False
    with pytest.raises(DecisionVetoError):
        writer_decision_context(scope(), decision(), checked)


@pytest.mark.parametrize("mutation", ["quote", "url", "missing", "mistyped", "reason"])
def test_proof_fail_closed_for_inexact_quote_unfetched_url_missing_or_mistyped_fields(mutation):
    value = proof()
    if mutation == "quote":
        value["reasons"][0]["quote"] = "unsupported passage"
    elif mutation == "url":
        value["reasons"][0]["url"] = "https://docs.cloud.google.com/other"
    elif mutation == "missing":
        del value["uniquely_best"]
    elif mutation == "mistyped":
        value["supported"] = "true"
    else:
        value["reason"] = ""
    if mutation in {"missing", "mistyped"}:
        with pytest.raises(ValidationError):
            verify_decision(scope(), decision(), [source()], model="codex", predictor=lambda **kw: value)
    else:
        checked = verify_decision(scope(), decision(), [source()], model="codex", predictor=lambda **kw: value)
        assert checked["passed"] is False


def test_section_allocation_and_even_key_ranks_retain_existing_hints():
    plan = plan_questions(DEFAULT_CERT, 30, section_allocation=[4, 5, 6, 6, 5, 4], seed=42)
    assert Counter(p["subsection"].split(".")[0] for p in plan) == dict(zip("123456", [4, 5, 6, 6, 5, 4]))
    ranks = Counter(p["key_length_rank"] for p in plan)
    assert max(ranks.values()) - min(ranks.values()) <= 1
    assert ranks[4] / len(plan) <= .35
    assert all(f"Key length rank hint: {p['key_length_rank']}" in p["domain_prompt"] for p in plan)
    assert all("two-word key lead limit" in p["domain_prompt"] for p in plan)
    assert all(p["opening_style"] and p["question_line"] and p["scenario_moment"] for p in plan)
    assert plan == plan_questions(DEFAULT_CERT, 30, section_allocation=[4, 5, 6, 6, 5, 4], seed=42)


@pytest.mark.parametrize("kwargs", [
    {"section_allocation": [4,5,6,6,5,3]}, {"section_allocation": [30]},
    {"section_allocation": [True,5,6,6,5,7]},
    {"section_allocation": [4,5,6,6,5,4], "objective_ids": [OBJECTIVE]},
])
def test_bad_or_conflicting_section_allocations_fail_before_calls(kwargs):
    with pytest.raises(ValueError):
        plan_questions(DEFAULT_CERT, 30, **kwargs)


def test_retrieval_query_tests_planned_approaches_and_prefers_overviews():
    query = _discovery_query(decision_discovery_text("Guide objective (e.g., a fine detail)", decision()), ["Cloud Run"])
    assert "Engineering decision:" in query and "Choose between approaches:" in query
    assert "overview comparison architecture when to choose" in query
    assert all(m["action"] in query for m in decision()["mistakes"])
    assert "marked answer" not in query.lower()


def test_current_exemplars_approved_only_and_legacy_style_frozen():
    assert FOUNDER_EXEMPLAR_IDS == (3, 9, 11, 17, 18)
    assert len(FOUNDER_EXEMPLARS) == 5
    assert all(old not in STYLE_INSTRUCTIONS for old in LEGACY_FOUNDER_EXEMPLARS)
    assert all(old in LEGACY_STYLE_INSTRUCTIONS_V3 for old in LEGACY_FOUNDER_EXEMPLARS)
    assert "Agent Platform short names only" in STYLE_RULES
    assert "one clear task" in STYLE_RULES and "feature gotchas" in STYLE_RULES


@pytest.fixture
def pipeline(monkeypatch, tmp_path):
    events = []
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "database_client", lambda: pytest.fail("DB forbidden"))
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: pytest.fail("inline judge forbidden"))
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: events.append("plan") or decision())
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: events.append("retrieval") or [source()])
    def verified(*a, **kw):
        events.append("proof")
        return {**proof(), "passed": True, "mechanical_check": {"passed": True, "errors": []}}
    monkeypatch.setattr(generate, "verify_decision", verified)
    def writer(context, docs, **kw):
        events.append("writer")
        assert "Verified decision plan" in context and decision()["best_action"] in context
        assert "Key length rank hint:" in context
        return QUESTION.copy()
    monkeypatch.setattr(generate, "generate_question", writer)
    monkeypatch.setattr(generate, "cite_question", lambda *a, **kw: events.append("citation") or {"evidence": receipts()})
    def invoke(*flags):
        return CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
            "--n-questions", "1", "--objective", OBJECTIVE, "--artifact", str(tmp_path / "batch.json"), *flags])
    return events, tmp_path, invoke


def test_generation_order_plan_retrieval_veto_writer_citation_then_frozen_request(pipeline):
    events, path, invoke = pipeline
    result = invoke()
    assert result.exit_code == 0, result.output
    assert events == ["plan", "retrieval", "proof", "writer", "citation"]
    artifact = json.loads((path / "batch.json").read_text())
    assert artifact["rules_version"] == 4 and artifact["external_judge_version"] == 2
    entry = artifact["candidates"][0]
    assert entry["decision_plan"] == artifact["plan"][0]["decision_plan"]
    assert entry["decision_objective"] == {"objective_id": OBJECTIVE, "objective_text": artifact["plan"][0]["objective_text"]}
    assert entry["decision_proof"]["passed"] is True
    assert entry["mechanical_check"]["passed"] is True
    assert entry["accepted"] is False and entry["awaiting_external_judge"] is True


def test_unsupported_decision_replaced_once_without_padding_then_written(pipeline, monkeypatch):
    events, path, invoke = pipeline
    decisions = [decision("Unsupported serving decision"), decision()]
    def planner(*a, **kw):
        events.append("plan")
        if len(decisions) == 1:
            assert "Unsupported serving decision" in kw["replacement_feedback"]
            assert "Replace the engineering decision" in kw["replacement_feedback"]
        return decisions.pop(0)
    monkeypatch.setattr(generate, "plan_decision", planner)
    proofs = [False, True]
    def verifier(*a, **kw):
        events.append("proof")
        supported = proofs.pop(0)
        return {**proof(supported), "passed": supported, "mechanical_check": {"passed": supported, "errors": []}}
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = invoke()
    assert result.exit_code == 0, result.output
    assert events == ["plan", "retrieval", "proof", "plan", "retrieval", "proof", "writer", "citation"]
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert len(entry["decision_attempts"]) == 2
    assert entry["decision_plan"]["decisive_constraints"] == decision()["decisive_constraints"]
    assert entry["stem"] == QUESTION["stem"]


@pytest.mark.parametrize("repeat_decision", [False, True])
def test_repeated_or_second_unsupported_decision_discarded_before_writer(pipeline, monkeypatch, repeat_decision):
    events, path, invoke = pipeline
    calls = []
    def planner(*a, **kw):
        events.append("plan")
        calls.append(1)
        return decision("Unsupported" if repeat_decision else "Unsupported " + str(len(calls)))
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: events.append("proof") or {
        **proof(False), "passed": False, "mechanical_check": {"passed": False, "errors": []}})
    result = invoke()
    assert result.exit_code != 0
    assert len(calls) == 2
    assert "writer" not in events and "citation" not in events
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert not entry["accepted"] and "external_judge_request" not in entry


@pytest.mark.parametrize("passed", [True, False])
def test_inline_raw_gate_bundle_and_decision_provenance_retained(pipeline, monkeypatch, passed):
    from shared.gates import aggregate_gate_verdict
    from test_three_gates_v4 import bundle
    events, path, invoke = pipeline
    raw = bundle(QUESTION)
    if not passed:
        raw["evidence"]["evidence_supported"] = False
        raw["evidence"]["verdict"] = "FAIL"
    judged = aggregate_gate_verdict(QUESTION, raw, model="claude")
    assert judged.passed is passed
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: events.append("three_gates") or judged)
    result = invoke("--judge-model", "claude", "--dry-run")
    assert result.exit_code == (0 if passed else 1), result.output
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert entry["accepted"] is passed
    assert entry["gate_verdicts"] == raw
    assert entry["grounding"]["gate_verdicts"] == raw
    assert entry["grounding"]["gate_version"] == entry["grounding"]["rules_version"] == 4
    assert entry["grounding"]["decision_plan"] == entry["decision_plan"]
    assert entry["grounding"]["decision_proof"]["passed"] is True
    assert entry["grounding"]["key_length_rank"] == 1
    assert events == ["plan", "retrieval", "proof", "writer", "citation", "three_gates"]
