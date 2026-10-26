"""Offline selective-repair and whole-proof replay contracts."""
from copy import deepcopy
import json

import pytest

from scripts import generate_pmle_questions as generate
from shared.doccheck_repair import failing_distractors, repair_feedback, validate_repair
from test_decision_first_v4 import decision, proof, pipeline


def veto(labels=("C",)):
    return {**proof(False), "uniquely_best": True, "failing_options": list(labels),
            "passed": False, "mechanical_check": {"passed": False, "errors": []}}


@pytest.mark.parametrize("labels", [("B",), ("C",), ("D",), ("B", "D")])
def test_only_flagged_options_may_change(labels):
    original = decision()
    proposed = deepcopy(original)
    for label in labels:
        proposed["mistakes"]["BCD".index(label)] = {"action": "New " + label,
                                                        "scenario_reason": "New reason " + label}
    assert failing_distractors(veto(labels)) == sorted(labels)
    assert validate_repair(original, proposed, labels) == proposed
    assert original == decision()
    feedback = json.loads(repair_feedback(original, labels, []))
    assert feedback["repair_options"] == list(labels)
    assert "fresh full proof" in feedback["instruction"]


@pytest.mark.parametrize("change", ["best_action", "existing_system", "decisive_constraints", "engineering_decision", "passing_option"])
def test_changes_outside_flagged_option_fail_closed(change):
    original = decision()
    proposed = deepcopy(original)
    if change == "passing_option":
        proposed["mistakes"][0]["scenario_reason"] += " changed"
    elif change == "decisive_constraints":
        proposed[change].append("new exception")
    else:
        proposed[change] += " changed"
    with pytest.raises(ValueError, match="frozen"):
        validate_repair(original, proposed, ["C"])


@pytest.mark.parametrize("mutation", [
    {"failing_options": []}, {"failing_options": ["A"]}, {"failing_options": ["E"]},
    {"failing_options": ["B", "B"]}, {"failing_options": "C"},
    {"uniquely_best": False}, {"mechanical_check": {"errors": ["Expected exactly A-D"]}},
    {"mechanical_check": {"errors": ["Option A: unsupported"]}},
])
def test_key_global_malformed_and_unparseable_failures_replace_all(mutation):
    assert failing_distractors({**veto(), **mutation}) is None


def test_explicit_option_prose_fallback_without_structured_field():
    value = veto()
    value.pop("failing_options")
    value["reason"] = "Option C has an unsupported losing reason"
    assert failing_distractors(value) == ["C"]
    value["reason"] = "Unsupported claim without an option label"
    assert failing_distractors(value) is None


def test_surgical_attempt_preserves_key_and_passing_options_and_rechecks_full_plan(pipeline, monkeypatch):
    events, path, invoke = pipeline
    original = decision()
    repaired = deepcopy(original)
    repaired["mistakes"][1]["scenario_reason"] = "Stored objects provide durable storage; keep an HTTP application runtime"
    planned, verified = [], []
    def planner(*args, **kwargs):
        feedback = kwargs["replacement_feedback"]
        planned.append(feedback)
        if len(planned) == 2:
            assert json.loads(feedback)["repair_options"] == ["C"]
            return deepcopy(repaired)
        return deepcopy(original)
    def verifier(scope, plan, *args, **kwargs):
        verified.append(deepcopy(plan))
        return veto() if len(verified) == 1 else {**proof(), "failing_options": [], "passed": True,
                                               "mechanical_check": {"passed": True, "errors": []}}
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "verify_decision", verifier)
    result = invoke("--doccheck-policy", "v6")
    assert result.exit_code == 0, result.output
    assert verified == [original, repaired]
    saved = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert saved["decision_attempts"][1]["repair_options"] == ["C"]
    assert saved["decision_plan"]["best_action"] == original["best_action"]
    assert saved["decision_attempt_count"] == 2
    assert saved["awaiting_external_judge"] is True


@pytest.mark.parametrize("labels", [["A"], []])
def test_key_or_unparseable_veto_uses_full_replacement(pipeline, monkeypatch, labels):
    _, path, invoke = pipeline
    calls = []
    def planner(*args, **kwargs):
        calls.append(kwargs["replacement_feedback"])
        return decision("first" if len(calls) == 1 else "replacement")
    outcomes = iter([veto(labels), {**proof(), "failing_options": [], "passed": True,
                                 "mechanical_check": {"passed": True, "errors": []}}])
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: next(outcomes))
    result = invoke("--doccheck-policy", "v6")
    assert result.exit_code == 0, result.output
    assert "Replace the engineering decision" in calls[1]
    assert "repair_options" not in json.loads(calls[1])


def test_surgical_planner_prompt_overrides_full_replacement_only_for_v6():
    from shared.decision_planner import planning_prompt
    from test_decision_first_v4 import scope
    signature, _ = planning_prompt({**scope(), "doccheck_policy": "v6"}, repair_options=["C"])
    assert "OPTION-LOCAL REPAIR" in signature.instructions
    assert "full-replacement rule does not apply" in signature.instructions
    with pytest.raises(ValueError, match="requires doccheck v6"):
        planning_prompt(scope(), repair_options=["C"])
