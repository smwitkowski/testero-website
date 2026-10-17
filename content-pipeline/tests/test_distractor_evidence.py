"""Offline frozen-mode isolation, threading, and fail-closed ingest tests."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest
from click.testing import CliRunner

from shared.distractor_evidence import evidence_policy, validate_policy, verdict_with_policy
from shared.decision_planner import verify_decision, DecisionProofSignature, ConsistentDecisionProofSignature
from shared.gates import gate_signatures, GATE_SIGNATURES, ConsistentEvidenceReviewerSignature, aggregate_gate_verdict
from shared import cli_models
from shared.external_judge import build_request, candidate_question, validate_decision_provenance
from shared.option_order import canonical_evidence
from shared.quality_gate import QuestionQualitySignature, judge_three_gates
from scripts import ingest_external_verdicts as ingest, judge_requests as runner, generate_pmle_questions as generate
from test_decision_first_v4 import pipeline, decision, proof, scope
from test_external_generation import source, QUESTION
from test_external_ingest import case, save_input, saved, invoke
from test_three_gates_v4 import v4, bundle
from test_pipeline_v5 import prepare_v5


@pytest.mark.parametrize("policy", [{"version": True, "mode": "strict"}, {"version": 2, "mode": "strict"},
                                    {"version": 1, "mode": "loose"}, {"version": 1, "mode": "strict", "x": 1}, None])
def test_invalid_policy_fails_closed(policy):
    with pytest.raises(ValueError): validate_policy(policy)


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_decision_signature_mode_and_receipts_still_required(monkeypatch, mode):
    from shared import decision_planner as planner
    selected = []
    def predict(signature, inputs, model, effort):
        selected.append(signature)
        return proof()
    monkeypatch.setattr(planner, "_predict", predict)
    frozen = evidence_policy(mode)
    checked = verify_decision({**scope(), "distractor_evidence": frozen}, decision(), [source()], model="codex")
    assert checked["passed"] and checked["distractor_evidence"] == frozen
    assert selected == [ConsistentDecisionProofSignature if mode == "consistent" else DecisionProofSignature]
    unsupported = proof(); unsupported["reasons"][0]["quote"] = "missing key claim"
    checked = verify_decision({**scope(), "distractor_evidence": frozen}, decision(), [source()], model="codex", predictor=lambda **_: unsupported)
    assert not checked["passed"]
    unsupported = proof(); unsupported["scenario_reasons_supported"] = False
    checked = verify_decision({**scope(), "distractor_evidence": frozen}, decision(), [source()], model="codex", predictor=lambda **_: unsupported)
    assert not checked["passed"]


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_generation_freezes_mode_everywhere(pipeline, monkeypatch, mode):
    _, path, _ = pipeline
    def verifier(scope, plan, docs, **kw):
        assert scope["distractor_evidence"] == evidence_policy(mode)
        return verify_decision(scope, plan, docs, model="codex", predictor=lambda **_: proof())
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external", "--n-questions", "1",
        "--objective", decision()["objective_id"], "--artifact", str(path / "batch.json"), "--distractor-evidence", mode])
    assert result.exit_code == 0, result.output
    payload = json.loads((path / "batch.json").read_text())
    entry, scope_row = payload["candidates"][0], payload["plan"][0]
    request = json.loads((path / entry["external_judge_request"]["path"]).read_text())
    for row in (payload, entry, scope_row, entry["decision_proof"], request):
        assert row["distractor_evidence"] == evidence_policy(mode)
    validate_decision_provenance(scope_row, entry)


def freeze_case(case, mode):
    prepare_v5(case)
    payload = case[2]; entry = payload["candidates"][0]; scope_row = payload["plan"][0]
    policy = evidence_policy(mode)
    for row in (payload, scope_row, entry, entry["decision_proof"], scope_row["decision_proof"]):
        row["distractor_evidence"] = deepcopy(policy)
    request = build_request(entry["candidate_id"], scope_row, candidate_question(entry), entry["sources"], canonical_evidence(entry))
    case[6].write_text(json.dumps(request))
    entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    raw = verdict_with_policy(bundle(candidate_question(entry)), policy)
    (case[1] / case[6].name).write_text(json.dumps(raw))
    save_input(case)
    return request, raw


def test_only_evidence_prompt_changes_blind_style_and_argon_exact(v4):
    case, _, _ = v4
    strict, _ = freeze_case(case, "strict")
    consistent, _ = freeze_case(case, "consistent")
    assert strict["gates"]["blind_solver"] == consistent["gates"]["blind_solver"]
    assert strict["gates"]["style"] == consistent["gates"]["style"]
    assert strict["gates"]["evidence"] != consistent["gates"]["evidence"]
    entry = case[2]["candidates"][0]; scope_row = case[2]["plan"][0]
    strict_scope = {**scope_row, "distractor_evidence": evidence_policy("strict")}
    a = build_request(entry["candidate_id"], strict_scope, candidate_question(entry), entry["sources"], canonical_evidence(entry), argon_gate=True)
    b = build_request(entry["candidate_id"], scope_row, candidate_question(entry), entry["sources"], canonical_evidence(entry), argon_gate=True)
    assert a["argon"] == b["argon"]
    assert gate_signatures(distractor_evidence=evidence_policy("strict")) == GATE_SIGNATURES


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_runner_records_mode_and_ingest_accepts_only_matching_envelope(v4, monkeypatch, mode):
    case, _, _ = v4
    request, raw = freeze_case(case, mode)
    destination = case[0].parent / "mode-verdicts"
    def fake(model, prompt, schema):
        name = next(k for k,v in request["gates"].items() if v["verdict_schema"] == schema)
        return raw[name]
    monkeypatch.setattr(cli_models, "run_claude_request", fake)
    summary = runner.run_requests(case[6].parent, destination, parallel=1)
    assert summary.completed == 1 and not summary.failed
    assert json.loads((destination / case[6].name).read_text()) == raw
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(destination), "--dry-run"])
    assert result.exit_code == 0, result.output
    assert saved(case)["candidates"][0]["grounding"]["distractor_evidence"] == evidence_policy(mode)
    case[4].assert_not_called()


@pytest.mark.parametrize("target", ["candidate", "plan", "proof", "verdict", "request", "batch"])
def test_mixed_mode_refused_before_any_database_access(v4, target):
    case, _, _ = v4
    request, raw = freeze_case(case, "consistent")
    payload = case[2]; entry = payload["candidates"][0]
    other = evidence_policy("strict")
    if target == "candidate": entry["distractor_evidence"] = other
    elif target == "plan": payload["plan"][0]["distractor_evidence"] = other
    elif target == "proof": entry["decision_proof"]["distractor_evidence"] = other
    elif target == "verdict":
        raw["distractor_evidence"] = other
        (case[1] / case[6].name).write_text(json.dumps(raw))
    elif target == "request":
        request["distractor_evidence"] = other
        case[6].write_text(json.dumps(request))
        entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    else: payload["distractor_evidence"] = other
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 1, result.output
    case[4].assert_not_called()


def test_runner_rejects_prompt_from_other_mode(v4):
    case, _, _ = v4
    request, _ = freeze_case(case, "consistent")
    request["distractor_evidence"] = evidence_policy("strict")
    case[6].write_text(json.dumps(request))
    with pytest.raises(runner.RequestValidationError, match="schema|prompt"):
        runner._read_request(case[6], case[6].stem, cli_models.output_model(QuestionQualitySignature).model_json_schema())


def test_inline_and_transport_select_consistent_signature(monkeypatch):
    signatures = gate_signatures(distractor_evidence=evidence_policy("consistent"))
    raw = bundle(QUESTION); seen = []
    def fake(model, signature, inputs):
        seen.append(signature)
        return raw[next(k for k,v in signatures.items() if v == signature)]
    monkeypatch.setattr(cli_models, "run_signature", fake)
    result = judge_three_gates(QUESTION, "scope", documentation_context="docs", model="claude", generator_model="codex",
        option_evidence=[{"quote": "receipt"}], distractor_evidence=evidence_policy("consistent"))
    assert result.passed and ConsistentEvidenceReviewerSignature in seen
    assert result.gate_results["distractor_evidence"] == evidence_policy("consistent")
    monkeypatch.setattr(cli_models, "_run_cli", lambda model,prompt,schema,signature,**kw: signature)
    schema = cli_models.output_model(ConsistentEvidenceReviewerSignature).model_json_schema()
    assert cli_models.run_claude_request("claude", "frozen", schema) == ConsistentEvidenceReviewerSignature


@pytest.mark.parametrize("check", ["correct_answer_accurate", "distractors_incorrect", "explanations_accurate", "evidence_supported", "no_credible_second_answer", "supported_decision_hinge"])
def test_consistent_does_not_waive_factual_or_unique_answer_failure(check):
    policy = evidence_policy("consistent")
    raw = bundle(QUESTION); raw["evidence"][check] = False
    assert not aggregate_gate_verdict(QUESTION, verdict_with_policy(raw,policy), distractor_evidence=policy).passed


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_repair_export_and_ingest_preserve_mode(v4, monkeypatch, mode):
    from scripts import repair_candidates as repair, export_judge_requests as exporter
    from shared.external_judge import validate_candidate_records
    from test_repair_candidates import REVISED
    from test_external_generation import receipts
    case, _, _ = v4
    request, raw = freeze_case(case, mode)
    raw["style"]["verdict"] = "FAIL"
    raw["style"]["distractors_need_knowledge"] = False
    (case[1] / case[6].name).write_text(json.dumps(raw))
    monkeypatch.setattr(cli_models, "run_signature", lambda *a, **kw: deepcopy(REVISED))
    monkeypatch.setattr(repair, "cite_question", lambda *a, **kw: {"evidence": receipts()})
    result = CliRunner().invoke(repair.main, ["--artifact", str(case[0]), "--verdicts", str(case[1])])
    assert result.exit_code == 0, result.output
    payload = saved(case)
    assert len(payload["candidates"]) == 2
    validate_candidate_records(payload)
    child = payload["candidates"][1]
    assert child["distractor_evidence"] == evidence_policy(mode)
    child_path = case[0].parent / child["external_judge_request"]["path"]
    assert json.loads(child_path.read_text())["distractor_evidence"] == evidence_policy(mode)
    result = CliRunner().invoke(exporter.main, ["--artifact", str(case[0]), "--force"])
    assert result.exit_code == 0, result.output
    payload["candidates"][1]["distractor_evidence"] = evidence_policy("strict" if mode == "consistent" else "consistent")
    case[0].write_text(json.dumps(payload))
    before = case[0].read_bytes()
    result = invoke(case)
    assert result.exit_code == 1 and case[0].read_bytes() == before
    case[4].assert_not_called()


def test_both_generation_entrypoints_have_strict_default():
    from scripts import generate_all_domains
    result = CliRunner().invoke(generate.main, ["--help"])
    assert result.exit_code == 0 and "--distractor-evidence" in result.output
    option = next(p for p in generate.main.params if p.name == "distractor_evidence")
    assert option.default == "strict"
    from unittest.mock import Mock
    forwarding = Mock(return_value="forwarded")
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(generate, "main", forwarding)
        assert generate_all_domains.main(["--distractor-evidence", "consistent"]) == "forwarded"
    forwarding.assert_called_once_with(["--distractor-evidence", "consistent"])


@pytest.mark.parametrize("target", ["batch", "candidate", "plan", "proof", "verdict"])
def test_boolean_policy_version_never_counts_as_integer(v4, target):
    case, _, _ = v4
    request, raw = freeze_case(case, "consistent")
    payload = case[2]
    if target == "verdict":
        raw["distractor_evidence"]["version"] = True
        (case[1] / case[6].name).write_text(json.dumps(raw))
    else:
        row = {"batch": payload, "candidate": payload["candidates"][0],
               "plan": payload["plan"][0], "proof": payload["candidates"][0]["decision_proof"]}[target]
        row["distractor_evidence"]["version"] = True
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 1, result.output
    case[4].assert_not_called()


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_mode_with_argon_keeps_argon_veto(v4, mode):
    from shared.argon_gate import build_argon_request, MODEL
    from shared.external_judge import canonical_sha256
    case, _, _ = v4
    request, raw = freeze_case(case, mode)
    entry = case[2]["candidates"][0]; scope_row = case[2]["plan"][0]
    question = candidate_question(entry)
    argon_request = build_argon_request(question, scope_row, "docs", canonical_evidence(entry), review_only=True)
    argon_raw = {"model":MODEL, "version":2, "request_sha256":canonical_sha256(argon_request),
        "review":{"verdict":"PASS", "key_correct":True, "other_defensible_option":False, "issues":[], "fix":"No changes needed"}}
    raw["argon"] = argon_raw
    result = ingest._external_decision(question, scope_row, entry["sources"], canonical_evidence(entry), raw, "codex",
        gate_version=2, argon_request=argon_request, rules_version=5)
    assert result.passed
    argon_raw["review"]["verdict"] = "REJECT"
    argon_raw["review"]["key_correct"] = False
    result = ingest._external_decision(question, scope_row, entry["sources"], canonical_evidence(entry), raw, "codex",
        gate_version=2, argon_request=argon_request, rules_version=5)
    assert not result.passed
