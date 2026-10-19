"""Offline variant-only style veto; original v5.1 replay stays unchanged."""
from copy import deepcopy

import pytest

from shared.gates import aggregate_gate_verdict, evaluate_gate
from shared.objective_style import style_policy
from test_generation_gate import QUESTION
from test_three_gates_v4 import bundle


ALLOWED = "machine-learning-engineer:standard:5.1:1"


def waived_style(*, verdict="FAIL", score=.55):
    style = bundle()["style"]
    style.update(verdict=verdict, score=score,
                 product_knowledge_hinge=False, cloud_specific_alternative=False,
                 generic_validation_key=True)
    return style


@pytest.mark.parametrize("score", [.55, .9])
def test_variant_style_fail_is_a_veto_even_when_only_waived_checks_fail(score):
    raw = waived_style(score=score)
    frozen = deepcopy(raw)
    policy = style_policy(ALLOWED)
    assert not evaluate_gate("style", raw, QUESTION, style_policy=policy, variant=True)[0]
    # The new opt-in must not change historical original/replay behavior.
    assert evaluate_gate("style", raw, QUESTION, style_policy=policy)[0]
    assert evaluate_gate("style", raw, QUESTION, style_policy=policy, variant=False)[0]
    assert raw == frozen


@pytest.mark.parametrize("verdict, score, required, expected", [
    ("PASS", .9, True, True),
    ("UNCERTAIN", .9, True, False),
    ("PASS", .9, False, False),
    ("FAIL", .9, False, False),
])
def test_variant_allowance_preserves_required_checks_and_uncertainty(verdict, score, required, expected):
    raw = waived_style(verdict=verdict, score=score)
    raw["distractors_plausible"] = required
    assert evaluate_gate("style", raw, QUESTION, style_policy=style_policy(ALLOWED), variant=True)[0] is expected


@pytest.mark.parametrize("score", [.55, .9])
def test_aggregate_forwards_variant_veto_without_changing_raw_or_originals(score):
    raw = bundle()
    raw["style"] = waived_style(score=score)
    frozen = deepcopy(raw)
    policy = style_policy(ALLOWED)
    variant = aggregate_gate_verdict(QUESTION, raw, style_policy=policy, variant=True)
    original = aggregate_gate_verdict(QUESTION, raw, style_policy=policy)
    assert not variant.passed
    assert "style:" in variant.reason
    assert variant.score == min(.9, score)
    assert original.passed and original.score == .9
    assert variant.gate_results == original.gate_results == raw == frozen


def test_short_circuit_aggregate_forwards_variant_style_veto():
    raw = {"style": waived_style(),
           **{name: {"status": "skipped", "reason": "prior_gate_failed", "gate": "style"}
              for name in ("evidence", "blind_solver")}}
    frozen = deepcopy(raw)
    result = aggregate_gate_verdict(QUESTION, raw, style_policy=style_policy(ALLOWED), variant=True)
    assert not result.passed and result.score == 0
    assert result.reason == "Short circuit: style"
    assert result.gate_results == raw == frozen
    # Originals still reject skips that follow a waived, effectively passing gate.
    with pytest.raises(ValueError, match="Invalid skipped gate provenance"):
        aggregate_gate_verdict(QUESTION, raw, style_policy=style_policy(ALLOWED))


@pytest.mark.parametrize("name", ["blind_solver", "evidence"])
def test_variant_flag_does_not_waive_other_gate_failures(name):
    raw = bundle()
    raw["style"] = waived_style(verdict="PASS", score=.9)
    raw[name]["verdict"] = "FAIL"
    result = aggregate_gate_verdict(QUESTION, raw, style_policy=style_policy(ALLOWED), variant=True)
    assert not result.passed and name + ":" in result.reason


@pytest.mark.parametrize("variant", [False, True])
def test_no_allowance_style_fail_still_blocks(variant):
    assert not evaluate_gate("style", waived_style(), QUESTION, variant=variant)[0]


@pytest.mark.parametrize("score", [.55, .9])
def test_external_decision_forwards_variant_origin_and_preserves_originals(score):
    from scripts.ingest_external_verdicts import _external_decision
    raw = bundle()
    raw["style"] = waived_style(score=score)
    policy = style_policy(ALLOWED)
    scope = {"style_policy": policy, "variant_origin": {"parent_question_id": "parent", "ordinal": 1}}
    variant = _external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5)
    original = _external_decision(QUESTION, {"style_policy": policy}, [], [], raw, "codex", rules_version=5)
    assert not variant.passed and "style:" in variant.reason
    assert original.passed
    assert variant.gate_results == original.gate_results == raw


def test_external_decision_variant_style_failure_accepts_valid_argon_skip():
    from scripts.ingest_external_verdicts import _external_decision
    raw = {"style": waived_style(),
           **{name: {"status": "skipped", "reason": "prior_gate_failed", "gate": "style"}
              for name in ("evidence", "blind_solver")},
           "argon": {"status": "skipped", "reason": "prior_gate_failed"}}
    scope = {"style_policy": style_policy(ALLOWED), "variant_origin": {"parent_question_id": "parent", "ordinal": 1}}
    result = _external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5,
                                argon_request={"version": 2})
    assert not result.passed and result.reason == "Short circuit: style"


@pytest.mark.parametrize("variant", [False, True])
def test_runner_variant_flag_stops_waived_style_fail_before_paid_downstream_calls(tmp_path, monkeypatch, variant):
    import json
    from scripts import judge_requests as runner
    from shared import argon_gate as argon
    from shared.external_judge import canonical_sha256
    from test_judge_short_circuit import request
    row = {"question": QUESTION, "candidate_id": "candidate-a"}
    frozen = request(row, True)
    frozen.update(objective_id=ALLOWED, style_policy=style_policy(ALLOWED))
    if variant:
        frozen["variant_mode"] = 1
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    (directory / "candidate-a.json").write_text(json.dumps(frozen))
    outputs = bundle()
    outputs["style"] = waived_style()
    seen = []
    def claude(model, prompt, schema):
        name = next(name for name, gate in frozen["gates"].items() if gate["judge_prompt"] == prompt)
        seen.append(name)
        return outputs[name]
    def review(argon_request):
        seen.append("argon")
        return {"model": argon.MODEL, "version": 2,
                "request_sha256": canonical_sha256(argon_request),
                "review": {"verdict": "PASS", "key_correct": True,
                           "other_defensible_option": False, "issues": [], "fix": "No changes needed"}}
    monkeypatch.setattr(runner.cli_models, "run_claude_request", claude)
    monkeypatch.setattr(argon, "run_argon", review)
    result = runner.run_requests(directory, verdicts, argon_gate=True, parallel=1, full_gate_sample=5)
    assert result.completed == 1 and result.failed == 0
    raw = json.loads((verdicts / "candidate-a.json").read_text())
    if variant:
        assert seen == ["style"]
        assert raw["evidence"] == raw["blind_solver"] == {
            "status": "skipped", "reason": "prior_gate_failed", "gate": "style"}
        assert raw["argon"] == {"status": "skipped", "reason": "prior_gate_failed"}
    else:
        assert seen == ["style", "evidence", "blind_solver", "argon"]
        assert raw["style"]["verdict"] == "FAIL" and raw["style"]["score"] == .55


@pytest.mark.parametrize("flag", [True, 0, 2, "1", None])
def test_runner_variant_mode_requires_exact_version_integer(tmp_path, flag):
    import json
    from scripts.judge_requests import _read_request, RequestValidationError
    from shared.cli_models import output_model
    from shared.quality_gate import QuestionQualitySignature
    from test_judge_short_circuit import request
    frozen = request({"question": QUESTION, "candidate_id": "candidate-a"}, True)
    frozen["variant_mode"] = flag
    path = tmp_path / "candidate-a.json"
    path.write_text(json.dumps(frozen))
    with pytest.raises(RequestValidationError, match="Variants require rules-v5 gates and Argon"):
        _read_request(path, "candidate-a", output_model(QuestionQualitySignature).model_json_schema())
