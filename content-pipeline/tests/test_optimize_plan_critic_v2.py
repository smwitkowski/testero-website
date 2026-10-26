"""Calibrated off-council plan critic contracts. All model calls are fakes."""
from copy import deepcopy
import json
from unittest.mock import Mock

import pytest

from scripts.optimize.plan_critic import (CRITIC_CHECKS, DEFAULT_CRITIC,
    CriticCalibrationError, PlanCriticSignature, balanced_accuracy, calibration_report,
    critic_contract_sha256, frozen_critic_reference, make_plan_critic,
    normalize_critic_model, parse_critic, validate_calibration)
from scripts.optimize.calibrate_critic import calibrate_critic, load_calibration_records, main
from scripts.optimize.corpus import digest
from scripts.optimize.metrics import PROOF_FLAGS, make_plan_metric, proof_feedback


def raw_critic(**changes):
    return {**dict.fromkeys(CRITIC_CHECKS, True), "verdict": "PASS", "failing_options": [],
            "reason": "Distinct plausible actions; B fails due to a known product tradeoff.", **changes}


def records(count=200):
    return [{"objective_id": "train-" + str(i), "scope": {"domain_prompt": "Scope " + str(i)},
             "plan": {"objective_id": "train-" + str(i)}, "council_outcome": i % 2 == 0}
            for i in range(count)]


def calibration():
    rows = records()
    return calibration_report(rows, [row["council_outcome"] for row in rows])


def proof(**changes):
    return {**dict.fromkeys(PROOF_FLAGS, True), "passed": True, "reason": "Supported capability",
            "mechanical_check": {"passed": True, "errors": []}, **changes}


def test_balanced_accuracy_equal_weight_for_imbalanced_classes():
    stats = balanced_accuracy([True] * 90 + [False] * 10, [True] * 100)
    assert stats["balanced_accuracy"] == .5
    assert stats["sensitivity"] == 1
    assert stats["specificity"] == 0
    assert stats["confusion_matrix"] == {"tp": 90, "tn": 0, "fp": 10, "fn": 0}
    for labels, preds in (([True], [True]), ([True, False], [1, False]), ([True, False], [])):
        with pytest.raises(ValueError):
            balanced_accuracy(labels, preds)


def test_calibration_admission_binds_model_rules_outcomes_count_and_fixture_mode():
    good = calibration()
    assert validate_calibration(good, DEFAULT_CRITIC) == good
    for mutate in (lambda r: r.update(critic_model="openrouter/openai/different"),
                   lambda r: r.update(critic_contract_sha256="0" * 64),
                   lambda r: r.update(balanced_accuracy=1.1),
                   lambda r: r.update(mode="offline-fixture"),
                   lambda r: r["predictions"][0].update(critic_passed=False)):
        bad = deepcopy(good)
        mutate(bad)
        bad["sha256"] = digest({k: v for k, v in bad.items() if k != "sha256"})
        with pytest.raises(CriticCalibrationError):
            validate_calibration(bad, DEFAULT_CRITIC)
    for report in (None, .9, calibration_report(records(20), [r["council_outcome"] for r in records(20)]),
                   calibration_report(records(), [True] * 200),
                   calibration_report(records(), [r["council_outcome"] for r in records()], fixture=True)):
        with pytest.raises(CriticCalibrationError):
            make_plan_critic(calibration=report, runner=lambda *args: pytest.fail("Refuse before calls"))


def test_point_75_boundary_and_just_below_refusal():
    rows = records()
    labels = [row["council_outcome"] for row in rows]
    predictions = labels[:150] + [not v for v in labels[150:]]
    report = calibration_report(rows, predictions)
    assert report["balanced_accuracy"] == .75
    validate_calibration(report, DEFAULT_CRITIC)
    predictions[0] = not predictions[0]
    with pytest.raises(CriticCalibrationError):
        validate_calibration(calibration_report(rows, predictions), DEFAULT_CRITIC)


@pytest.mark.parametrize("model", ["claude", "codex", "openrouter/anthropic/claude-sonnet", "google/gemini-4-argon", "vendor/claude-alias"])
def test_council_family_never_trains_critic(model):
    with pytest.raises(ValueError):
        normalize_critic_model(model)


def test_frozen_critic_uses_verbatim_style_rules_examples_and_argon_contract():
    from shared.question_style import STYLE_RULES, FOUNDER_EXEMPLARS
    from shared.argon_gate import ArgonReviewSignature
    reference = frozen_critic_reference()
    assert STYLE_RULES in reference
    assert all(stem in reference for stem in FOUNDER_EXEMPLARS)
    assert ArgonReviewSignature.instructions in reference
    assert "O3 Wrong options" in reference and "S13 Prefer decisions" in reference
    assert len(critic_contract_sha256()) == 64


def test_critic_strict_booleans_uncertainty_and_named_option_feedback():
    raw = raw_critic(distractors_plausible=False, failing_options=["C"], verdict="REVISE")
    parsed = parse_critic(raw)
    assert parsed["passed"] is False
    assert parsed["failed_checks"] == ["distractors_plausible"]
    assert "options_distinct_approaches" in parsed["passed_checks"]
    assert not parse_critic(raw_critic(verdict="UNCERTAIN"))["passed"]
    assert not parse_critic(raw_critic(failing_options=["B"]))["passed"]
    for changes in ({"no_literal_elimination": "true"}, {"reason": ""}, {"failing_options": ["A", "A"]}):
        with pytest.raises(Exception):
            parse_critic(raw_critic(**changes))


def test_calibrate_withholds_labels_and_no_saved_council_text_enters_prompts():
    rows = records()
    seen = []
    def runner(model, signature, inputs):
        seen.append(inputs)
        assert set(inputs) == {"objective_scope", "proposed_plan", "style_reference"}
        assert "council_outcome" not in json.dumps(inputs)
        i = int(inputs["proposed_plan"]["objective_id"].split("-")[-1])
        return raw_critic(verdict="PASS" if i % 2 == 0 else "REVISE")
    report = calibrate_critic(rows, runner=runner)
    assert len(seen) == 200
    assert report["usable"] and report["balanced_accuracy"] == 1
    validate_calibration(report, DEFAULT_CRITIC)
    calls = []
    critic = make_plan_critic(calibration=report, runner=lambda m, s, i: calls.append((m, s, i)) or raw_critic())
    result = critic({"domain_prompt": "Scope"}, {"objective_id": "new"})
    assert result["passed"]
    assert result["calibration_sha256"] == report["sha256"]
    assert calls[0][0] == DEFAULT_CRITIC


def test_critic_low_temperature_and_budget_failures_propagate(monkeypatch):
    from scripts.optimize.plan_critic import run_critic
    seen = []
    monkeypatch.setattr("shared.llm_generator._predict_writer", lambda *a, **k: seen.append(k) or raw_critic())
    run_critic(DEFAULT_CRITIC, PlanCriticSignature, {})
    assert seen == [{"max_tokens": 16000, "temperature": 0.0}]
    class BudgetStop(BaseException):
        pass
    def stopped(*args):
        raise BudgetStop()
    with pytest.raises(BudgetStop):
        make_plan_critic(calibration=calibration(), runner=stopped)({"domain_prompt": "Scope"}, {})


@pytest.mark.parametrize("doc_pass,critic_pass,expected", [(True, True, 1), (True, False, .4), (False, True, .15), (False, False, .15)])
def test_aligned_score_feedback_shape_and_predictor_routing(doc_pass, critic_pass, expected):
    critic = parse_critic(raw_critic(verdict="PASS" if critic_pass else "REVISE",
                                    failing_options=[] if critic_pass else ["B"],
                                    product_knowledge_hinge=critic_pass))
    result = proof_feedback(proof(passed=doc_pass), critic, pred_name="repair")
    assert result.score == expected
    assert set(result.feedback_by_predictor) == {"plan", "repair"}
    assert result.feedback.startswith("Repair predictor:")
    assert "Passed doc checks:" in result.feedback
    assert "Passed design checks:" in result.feedback
    if not critic_pass:
        assert "product_knowledge_hinge" in result.feedback and "B" in result.feedback
    assert proof_feedback(proof()).score == .4  # No critic never silently earns 1.0.


def test_metric_requires_calibration_even_with_custom_fake_critic():
    with pytest.raises(CriticCalibrationError):
        make_plan_metric(writer_model="codex", critic=lambda *a: raw_critic(), verifier=lambda *a: proof())
    with pytest.raises(ValueError):
        make_plan_metric(writer_model="codex", checker_temperature=.7, critic_calibration=calibration())


def test_metric_trusted_checker_cache_binds_exact_plan_scope_sources_and_no_student_proofs():
    calls = []
    def verifier(scope, plan, sources, **kwargs):
        calls.append((scope, plan, sources, kwargs))
        return proof()
    metric = make_plan_metric(writer_model="codex", critic_calibration=calibration(),
                              critic=lambda *args: raw_critic(), verifier=verifier)
    scope, plan, sources = {"objective_id": "x", "domain_prompt": "scope"}, {"objective_id": "x"}, [{"text": "frozen"}]
    trusted = metric.check_plan(scope, plan, sources)
    trusted["passed"] = False  # Copies prevent an optimizer from poisoning cache.
    result = metric({"scope": scope, "sources": sources, "proof": proof(passed=False)}, {"plan": plan, "proof": proof()}, pred_name="plan")
    assert result.score == 1 and len(calls) == 1
    metric.check_plan(scope, {**plan, "extra": "changed"}, sources)
    metric.check_plan(scope, plan, [{"text": "different frozen text"}])
    metric.check_plan({**scope, "domain_prompt": "changed scope"}, plan, sources)
    assert len(calls) == 4


def test_calibration_cli_requires_approval_before_input_reads(tmp_path):
    with pytest.raises(SystemExit) as error:
        main(["--datasets", str(tmp_path / "missing"), "--out", str(tmp_path / "out.json")])
    assert error.value.code == 2
