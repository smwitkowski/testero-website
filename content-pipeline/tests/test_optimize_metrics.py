"""Offline regression tests for frozen optimization judges."""
import dspy
import pytest

from scripts.optimize.metrics import PROOF_FLAGS, make_plan_metric as _make_plan_metric, make_draft_metric, proof_feedback
from scripts.optimize.plan_critic import CRITIC_CHECKS, calibration_report
from shared.gates import gate_signatures
from shared.quality_gate import QUESTION_FIELDS



def passing_critic(scope, plan):
    return {**dict.fromkeys(CRITIC_CHECKS, True), "verdict": "PASS", "failing_options": [],
            "reason": "Plausible approaches, meaningful product hinge"}


def make_plan_metric(**kwargs):
    records = [{"objective_id": str(i), "scope": {}, "plan": {}, "council_outcome": i % 2 == 0} for i in range(200)]
    calibration = calibration_report(records, [row["council_outcome"] for row in records])
    return _make_plan_metric(critic=passing_critic, critic_calibration=calibration, **kwargs)


def proof(**changes):
    return {**dict.fromkeys(PROOF_FLAGS, True), "passed": True, "reason": "Supported decision",
            "mechanical_check": {"passed": True, "errors": []}, **changes}


def test_plan_metric_production_default_is_writer_and_has_gepa_feedback():
    seen = []
    def verifier(scope, plan, sources, **kwargs):
        seen.append((scope, plan, sources, kwargs))
        return proof(uniquely_best=False, passed=False, reason="Second defensible option")
    metric = make_plan_metric(writer_model="codex", verifier=verifier)
    gold = dspy.Example(scope={"objective_id": "x"}, sources=[{"text": "frozen"}])
    pred = dspy.Prediction(plan={"objective_id": "x"})
    result = metric(gold, pred, None, "planner", None)
    assert isinstance(result, dspy.Prediction)
    assert result.score <= .15
    assert "Second defensible option" in result.feedback
    assert seen[0][3] == {"model": "codex", "reasoning_effort": "medium", "stable_prefix": True, "temperature": 0.0}


def test_plan_checker_override_and_no_recorded_proof_substitution():
    seen = []
    metric = make_plan_metric(writer_model="codex", checker_model="claude", verifier=lambda *a, **kw: seen.append(kw) or proof())
    assert metric({"scope": {"objective_id": "x"}, "sources": [1], "proof": proof()}, {"plan": {"objective_id": "x"}}).score == 1
    assert seen[0]["model"] == "claude"
    assert metric({"scope": {}, "proof": proof()}, {"plan": {}}).score == 0
    assert len(seen) == 1


def test_proof_mechanical_and_malformed_vetoes_never_score_one():
    assert proof_feedback(proof(passed=False, mechanical_check={"errors": ["quote absent"]})).score <= .15
    assert "quote absent" in proof_feedback(proof(passed=False, mechanical_check={"errors": ["quote absent"]})).feedback
    assert proof_feedback(proof(supported="true")).score == 0
    assert proof_feedback(proof(reason="")).score == 0


def test_plan_budget_or_transport_failure_propagates():
    class Stop(BaseException):
        pass
    def verifier(*a, **kw):
        raise Stop()
    metric = make_plan_metric(writer_model="codex", verifier=verifier)
    with pytest.raises(Stop):
        metric({"scope": {"objective_id": "x"}, "sources": [1]}, {"plan": {"objective_id": "x"}})


def question():
    return dict.fromkeys(QUESTION_FIELDS, "Question field") | {"correct_answer": "Action A", "distractor_1": "Action B", "distractor_2": "Action C", "distractor_3": "Action D"}


def recorded_gate(signature, **changes):
    return {**{key: True for key, field in signature.output_fields.items() if field.annotation is bool},
            "verdict": "PASS", "score": .95, "reason": "Credible engineering decision", **changes}


def test_draft_uses_frozen_claude_style_with_learner_only_inputs():
    calls = []
    def runner(model, signature, inputs):
        calls.append((model, signature.instructions, inputs))
        return recorded_gate(signature)
    signature = gate_signatures()["style"]
    before = signature.instructions
    result = make_draft_metric(runner=runner)({"scope": {}}, question(), pred_name="writer")
    assert result.score == .95
    assert "Credible engineering decision" in result.feedback
    assert calls[0][0] == "claude"
    assert calls[0][1] == before == signature.instructions
    assert set(calls[0][2]) == {"stem", "options", "style_reference"}
    assert "correct_answer" not in calls[0][2]


def test_draft_required_false_check_or_uncertain_never_receives_passing_score():
    for changes in ({"decision_level": False}, {"verdict": "UNCERTAIN"}):
        result = make_draft_metric(runner=lambda m, s, i: recorded_gate(s, **changes))({}, question())
        assert result.score < .8


def test_draft_optional_evidence_runs_unchanged_second_critic():
    calls = []
    def runner(model, signature, inputs):
        calls.append(signature.instructions)
        return recorded_gate(signature)
    pred = question() | {"evidence": [{"option_label": "A", "quote": "fact"}]}
    metric = make_draft_metric(include_evidence=True, runner=runner)
    assert metric({"inputs": {"documentation_context": "Frozen docs"}}, pred).score == .95
    assert calls == [gate_signatures()[name].instructions for name in ("style", "evidence")]
    assert metric({}, question()).score == 0


def test_optional_evidence_failure_cannot_be_averaged_into_a_pass():
    def runner(model, signature, inputs):
        return recorded_gate(signature, **({"correct_answer_accurate": False} if "option_evidence" in signature.input_fields else {}))
    metric = make_draft_metric(include_evidence=True, runner=runner)
    pred = question() | {"evidence": [{"option_label": "A", "quote": "fact"}]}
    assert metric({"inputs": {"documentation_context": "Frozen"}}, pred).score < .8
    assert metric({"inputs": {"documentation_context": "Frozen"}, "option_evidence": [1]}, question()).score == 0


def test_draft_refuses_other_judge_and_missing_candidate():
    with pytest.raises(ValueError):
        make_draft_metric(judge_model="codex")
    assert make_draft_metric(runner=lambda *a: pytest.fail("no calls"))({}, {}).score == 0
