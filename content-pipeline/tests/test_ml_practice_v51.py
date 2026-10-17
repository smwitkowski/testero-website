"""Offline rules-v5.1 replay: recorded b18 style, synthetic isolation mutations."""
from copy import deepcopy
import json
from pathlib import Path
import pytest

from shared.objective_style import style_policy, validate_style_policy, allows_ml_practice
from shared.gates import evaluate_gate, STYLE_CHECKS
from shared.batch_report import ml_practice_report, template_diversity_report
from shared.external_judge import build_request, candidate_question
from scripts import ingest_external_verdicts as ingest, judge_requests
from test_pipeline_v5 import prepare_v5
from test_three_gates_v4 import v4
from test_decision_first_v4 import pipeline
from test_external_ingest import case, save_input, saved, invoke
from shared.cli_models import CLISchemaError

ROWS = json.loads((Path(__file__).parent / "fixtures/ml-practice-b18.json").read_text())["candidates"]
EXCLUDED = "machine-learning-engineer:standard:5.1:2"
# The founder-delegated review (D-034) narrowed the list to 9 ML-practice objectives;
# b18 row 0 (5.2:2, CI/CD with Cloud Build) is product-specific and no longer allowed.
ALLOWED = "machine-learning-engineer:standard:5.1:1"


def test_b18_style_only_failure_passes_only_reviewed_objective():
    row = ROWS[0]
    assert row["style"]["verdict"] == "FAIL" and row["style"]["score"] == .55
    assert evaluate_gate("style", row["style"], {}, style_policy=style_policy(ALLOWED))[0]
    assert not evaluate_gate("style", row["style"], {}, style_policy=style_policy(row["objective_id"]))[0]
    assert not evaluate_gate("style", row["style"], {})[0]
    assert not evaluate_gate("style", row["style"], {}, style_policy=style_policy(EXCLUDED))[0]


@pytest.mark.parametrize("check", [name for name in STYLE_CHECKS if name not in
                                 {"product_knowledge_hinge", "cloud_specific_alternative"}])
def test_each_nonrelaxed_check_still_blocks(check):
    row = deepcopy(ROWS[0]); row["style"][check] = False
    assert not evaluate_gate("style", row["style"], {}, style_policy=style_policy(ALLOWED))[0]


def test_b18_real_nonrelaxed_failure_stays_failed():
    row = ROWS[1]
    assert row["style"]["distractors_plausible"] is False
    assert not evaluate_gate("style", row["style"], {}, style_policy=style_policy(row["objective_id"]))[0]
    raw = deepcopy(ROWS[0]["style"]); raw["verdict"] = "UNCERTAIN"
    assert not evaluate_gate("style", raw, {}, style_policy=style_policy(ALLOWED))[0]


def test_all_three_checks_relaxed_without_waiving_schema():
    row = ROWS[0]; raw = deepcopy(row["style"])
    raw.update(product_knowledge_hinge=False, cloud_specific_alternative=False, generic_validation_key=True)
    assert evaluate_gate("style", raw, {}, style_policy=style_policy(ALLOWED))[0]
    del raw["product_knowledge_hinge"]
    with pytest.raises(CLISchemaError): evaluate_gate("style", raw, {}, style_policy=style_policy(ALLOWED))


def test_allowlist_exact_guide_scope_and_default_off():
    cert = json.loads((Path(__file__).parents[1] / "certs/machine-learning-engineer.json").read_text())
    config = json.loads((Path(__file__).parents[1] / "certs/ml-practice-objectives.json").read_text())
    guide = cert["guides"][0]
    registry = {o["id"]: o["text"] for s in guide["sections"] for sub in s["subsections"] for o in sub["objectives"]}
    assert config["guide_sha256"] == guide["normalized_text_sha256"]
    assert len(config["objectives"]) == 9
    assert all(registry[ident] == row["text"] for ident, row in config["objectives"].items())
    assert not allows_ml_practice(style_policy("unknown"))
    assert not allows_ml_practice(style_policy("cloud-engineer:standard:5.1:1"))
    forged = style_policy(EXCLUDED); forged["allowance"] = "general_ml_mlops"
    with pytest.raises(ValueError): validate_style_policy(forged, EXCLUDED)


def test_report_counts_judged_allowances_not_planned_or_failed_prejudge():
    a, b = deepcopy(ROWS[0]), ROWS[1]
    a["objective_id"] = ALLOWED
    rows = [{"objective_id": a["objective_id"], "style_policy": style_policy(a["objective_id"]), "external_verdict": {"style": a["style"]}},
            {"objective_id": b["objective_id"], "style_policy": style_policy(b["objective_id"]), "gate_verdicts": {"style": b["style"]}},
            {"objective_id": EXCLUDED, "style_policy": style_policy(EXCLUDED), "external_verdict": {"style": a["style"]}},
            {"objective_id": a["objective_id"], "style_policy": style_policy(a["objective_id"])}]
    report = ml_practice_report(rows)
    assert report["judged_count"] == 3 and report["allowance_judged_count"] == 2
    assert report["by_objective"] == {a["objective_id"]: 1, b["objective_id"]: 1}
    rows[0]["judge_verdict"] = {"passed": True}
    assert template_diversity_report(rows)["count"] == 0
    assert template_diversity_report(rows)["passed"]
    rows[2]["judge_verdict"] = {"passed": True}
    assert not template_diversity_report(rows)["passed"]  # Allowed rows cannot dilute the remaining cap.


def test_frozen_request_only_style_changes_argon_evidence_and_blind_unchanged(v4):
    case, _, _ = v4
    original, _ = prepare_v5(case, argon=True)
    scope = deepcopy(case[2]["plan"][0])
    scope["objective_id"] = ALLOWED
    scope["style_policy"] = style_policy(scope["objective_id"])
    entry = case[2]["candidates"][0]
    from shared.option_order import canonical_evidence
    request = build_request(entry["candidate_id"], scope, candidate_question(entry), entry["sources"], canonical_evidence(entry), argon_gate=True)
    assert request["gates"]["blind_solver"] == original["gates"]["blind_solver"]
    assert request["gates"]["evidence"] == original["gates"]["evidence"]
    assert request["argon"] == original["argon"]
    assert request["style_policy"] == scope["style_policy"]
    assert request["gates"]["style"]["judge_prompt"] != original["gates"]["style"]["judge_prompt"]
    case[6].write_text(json.dumps(request))
    from shared.cli_models import output_model
    from shared.quality_gate import QuestionQualitySignature
    assert judge_requests._read_request(case[6], entry["candidate_id"], output_model(QuestionQualitySignature).model_json_schema())["style_policy"] == scope["style_policy"]


def test_ingest_frozen_policy_provenance_report_and_tampering(v4):
    case, _, _ = v4
    prepare_v5(case)
    payload = case[2]; scope = payload["plan"][0]; entry = payload["candidates"][0]
    payload["style_policy_version"] = "5.1"
    policy = style_policy(scope["objective_id"])
    scope["style_policy"] = entry["style_policy"] = policy
    from shared.option_order import canonical_evidence
    from shared.external_judge import canonical_sha256
    import hashlib
    request = build_request(entry["candidate_id"], scope, candidate_question(entry), entry["sources"], canonical_evidence(entry))
    case[6].write_text(json.dumps(request)); entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 0, result.output
    completed = saved(case)
    assert completed["ml_practice_report"]["allowance_judged_count"] == int(allows_ml_practice(policy))
    # Changing or removing candidate provenance cannot enable a waiver on replay.
    entry["style_policy"] = style_policy(EXCLUDED)
    with pytest.raises(ValueError): ingest._scope(payload, entry)


def test_allowance_planning_writer_guidance_and_unmodified_veto_scope():
    from shared.decision_planner import plan_decision, writer_decision_context, verify_decision
    from test_decision_first_v4 import decision, proof
    plan = decision(); plan["objective_id"] = ALLOWED
    scope = {"objective_id": plan["objective_id"], "domain_prompt": "scope", "style_policy": style_policy(plan["objective_id"])}
    seen = {}
    def planner(**inputs):
        seen.update(inputs)
        return {"plan": plan}
    assert plan_decision(scope, model="codex", predictor=planner) == plan
    from shared.objective_style import policy_instructions
    assert seen["objective_scope"] == "scope" + policy_instructions(scope["style_policy"])
    checked = proof(); checked["passed"] = True
    assert policy_instructions(scope["style_policy"]) in writer_decision_context(scope, plan, checked)
    from test_external_generation import source
    def veto(**inputs):
        assert inputs["objective_scope"] == "scope"
        return proof()
    assert verify_decision(scope, plan, [source()], model="codex", predictor=veto)["passed"]


def test_low_score_and_fail_without_relaxed_violation_still_block():
    raw = deepcopy(ROWS[0]["style"])
    raw.update(product_knowledge_hinge=True, cloud_specific_alternative=True, generic_validation_key=False)
    assert not evaluate_gate("style", raw, {}, style_policy=style_policy(ALLOWED))[0]


@pytest.mark.parametrize("failing_gate", [None, "blind_solver", "evidence"])
def test_external_allowance_never_overrides_other_gates(failing_gate):
    from test_three_gates_v4 import bundle
    from test_external_generation import QUESTION
    raw = bundle(QUESTION); raw["style"] = deepcopy(ROWS[0]["style"])
    if failing_gate is not None:
        raw[failing_gate]["verdict"] = "FAIL"
    scope = {"style_policy": style_policy(ALLOWED)}
    decision = ingest._external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5)
    assert decision.passed is (failing_gate is None)
    assert decision.gate_results == raw
    if failing_gate is None:
        assert decision.score == .9 and decision.gate_results["style"]["score"] == .55


def test_judge_report_policy_provenance_in_generated_allowed_candidate(pipeline, monkeypatch):
    events, path, invoke_pipeline = pipeline
    from click.testing import CliRunner
    from scripts import generate_pmle_questions as generate
    from test_decision_first_v4 import decision
    monkeypatch.setattr(generate, "plan_decision", lambda scope, **kw: {**decision(), "objective_id": scope["objective_id"]})
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--n-questions", "1", "--objective", ALLOWED, "--artifact", str(path / "batch.json")])
    assert result.exit_code == 0, result.output
    payload = json.loads((path / "batch.json").read_text())
    scope = payload["plan"][0]; entry = payload["candidates"][0]
    assert entry["style_policy"] == scope["style_policy"] == style_policy(ALLOWED)
    assert payload["style_policy_version"] == "5.1"
    assert payload["ml_practice_report"]["allowance_judged_count"] == 0  # Awaiting is not judged.
