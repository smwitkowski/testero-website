"""Offline claim navigation and candidate-bounded verifier escalation contracts."""
from copy import deepcopy
import json

from shared.call_logging import model_call
from shared.decision_planner import (
    DecisionProofSignature, evidence_missing_veto, verification_prompt, verify_decision,
)
from shared.doc_claims import claim_queries, plan_claims
from shared.doc_retrieval import RetrievalSession, plan_queries
from test_decision_first_v4 import decision, scope, proof, pipeline
from test_doc_retrieval_experiment import page
from test_external_generation import source


def checked(supported=False, reason="Missing evidence for the proposed capability"):
    return {**proof(supported), "reason": reason, "passed": supported,
            "mechanical_check": {"passed": supported, "errors": []}}


def test_claims_cover_every_action_constraint_and_reason_with_clause_context():
    plan = decision()
    plan["best_action"] += " because it serves HTTP; Keep the existing handler."
    plan["decisive_constraints"].append("Retain application code while reducing maintenance")
    claims = plan_claims(plan)
    expected = {"best_action": plan["best_action"], **{
        f"decisive_constraints.{i}": text for i, text in enumerate(plan["decisive_constraints"])}}
    for label, mistake in zip("BCD", plan["mistakes"]):
        expected.update({f"{label}.{field}": mistake[field] for field in ("action", "scenario_reason")})
    assert {claim["field"] for claim in claims} == set(expected)
    assert len({claim["id"] for claim in claims}) == len(claims)
    for claim in claims:
        assert claim["text"] in expected[claim["field"]] == claim["context"]
        action = plan["best_action"] if claim["option_label"] == "A" else plan["mistakes"]["BCD".index(claim["option_label"])]["action"]
        assert claim["action"] == action
    best = [c["text"] for c in claims if c["field"] == "best_action"]
    assert len(best) == 3
    assert "it serves HTTP;" in best


def test_claim_queries_dedupe_and_retrieval_preserves_original_spans():
    plan = decision()
    plan["decisive_constraints"] = [plan["best_action"], plan["best_action"]]
    queries = plan_queries(scope(), plan, "claims")
    assert len(queries) == len(set(queries))
    for claim in plan_claims(plan):
        variants = claim_queries(claim)
        assert variants[0] == claim["text"]
        assert len(variants) == len(set(variants))
        assert variants[0] in queries
    value = page(("Cloud Run HTTP application. Mixed CASE Ω original spacing. " * 200))
    frozen = deepcopy(value)
    retrieved = RetrievalSession().prepare(scope(), plan, [value, deepcopy(value)])
    assert value == frozen
    assert retrieved["sources"] == [value]
    assert retrieved["chunks"]
    assert len({chunk.id for chunk in retrieved["chunks"]}) == len(retrieved["chunks"])
    for chunk in retrieved["chunks"]:
        assert chunk.text == value["text"][chunk.start:chunk.end]
        assert chunk.source_sha256 == value["text_sha256"]


def test_lexical_claim_matches_are_not_asserted_as_support():
    plan = decision()
    plan["mistakes"][0]["scenario_reason"] = "Cloud Run guarantees perpetual free unlimited serving"
    retrieved = RetrievalSession().prepare(scope(), plan, [source()])
    row = next(row for row in retrieved["claims"] if row["claim"]["field"] == "B.scenario_reason")
    assert row["chunk_ids"]  # Shared product words are navigation, not semantic proof.
    assert set(row) == {"claim", "chunk_ids"}
    signature, inputs = verification_prompt(scope(), plan, [source()], retrieval=retrieved)
    assert "NOT proof of support" in inputs["proposed_plan"]
    assert "judge every claim" in inputs["proposed_plan"]
    result = verify_decision(scope(), plan, [source()], model="codex", retrieval=retrieved,
                             predictor=lambda **kw: proof(False))
    assert result["supported"] is False and result["passed"] is False


def test_missing_veto_is_distinct_from_contradiction_or_pass():
    for reason in ("Missing evidence for this capability", "The supplied docs do not establish support",
                   "Capability unsupported", "Evidence is uncertain"):
        assert evidence_missing_veto(checked(reason=reason)) is True
    assert evidence_missing_veto(checked(reason="Docs explicitly contradict this capability")) is False
    assert evidence_missing_veto(checked(True, "Missing evidence")) is False
    mechanical = checked(reason="Official overview supports the decision")
    mechanical["mechanical_check"]["errors"] = ["Option A: quote absent from supplied retrieval chunks"]
    assert evidence_missing_veto(mechanical) is True
    mechanical["passed"] = True
    assert evidence_missing_veto(mechanical) is False


def test_generator_escalates_with_baseline_signature_full_sources_and_retains_both_proofs(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, path, invoke = pipeline
    calls = []
    cheap, full = checked(), checked(True)
    def verifier(selected_scope, plan, sources, **kwargs):
        calls.append(kwargs)
        assert sources == [source()]
        if len(calls) == 1:
            assert kwargs["retrieval"]["sources"] == sources
            assert kwargs["stable_prefix"] is True
            return cheap
        assert "retrieval" not in kwargs and "stable_prefix" not in kwargs
        signature, inputs = verification_prompt(selected_scope, plan, sources)
        assert signature is DecisionProofSignature
        assert source()["text"] in inputs["fetched_documentation"]
        return full
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = invoke("--verify-retrieval", "--verify-stable-prefix")
    assert result.exit_code == 0, result.output
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    attempt = entry["decision_attempts"][0]
    assert len(calls) == 2
    assert attempt["cheap_proof"] == cheap
    assert attempt["proof"] == entry["decision_proof"] == full
    assert attempt["sources"] == entry["sources"] == [source()]
    assert attempt["escalation"]["count"] == 1


def test_default_off_does_not_escalate_missing_evidence(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, path, invoke = pipeline
    calls = []
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: decision(f"Replacement {len(calls)}"))
    def verifier(*args, **kwargs):
        calls.append(kwargs)
        assert "retrieval" not in kwargs
        return checked()
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = invoke()
    assert result.exit_code == 1, result.output
    attempts = json.loads((path / "batch.json").read_text())["candidates"][0]["decision_attempts"]
    assert len(attempts) == len(calls) == 3
    assert all("cheap_proof" not in attempt and "escalation" not in attempt for attempt in attempts)
    assert "writer" not in events


def test_escalation_counter_is_candidate_wide_and_call_metadata_is_boolean(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, path, invoke = pipeline
    plans, calls = [], []
    def planner(*args, **kwargs):
        plans.append(decision(f"Replacement {len(plans)}"))
        return plans[-1]
    def verifier(*args, **kwargs):
        calls.append(kwargs)
        with model_call("offline-fixture"):
            pass
        return checked()
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = invoke("--verify-retrieval")
    assert result.exit_code == 1, result.output
    attempts = json.loads((path / "batch.json").read_text())["candidates"][0]["decision_attempts"]
    assert len(plans) == len(attempts) == 3
    assert len(calls) == 4
    assert ["retrieval" in call for call in calls] == [True, False, True, True]
    assert sum(attempt.get("escalation", {}).get("count", 0) for attempt in attempts) == 1
    assert attempts[0]["cheap_proof"] == attempts[0]["proof"] == checked()
    records = [json.loads(line) for line in (path / "batch.json.calls.jsonl").read_text().splitlines()]
    assert [row["escalation"] for row in records] == [False, True, False, False]
    assert all(type(row["escalation"]) is bool for row in records)
    assert [row["attempt"] for row in records] == [1, 1, 2, 3]
    assert [row["verify_context"] for row in records] == ["retrieved", "full", "retrieved", "retrieved"]
    assert all(row["stage"] == "verify" and row["model"] == "offline-fixture" for row in records)
    assert "writer" not in events
