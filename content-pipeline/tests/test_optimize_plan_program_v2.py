"""Offline production Codex plan/repair integration and capped pack export."""
from copy import deepcopy

import dspy
import pytest

from scripts.optimize import run_optimizer as opt
from scripts.optimize.components import decode_plan_components, encode_plan_components
from shared.plan_components import default_components
from test_optimize_runner import plan_row


def record():
    row = plan_row("machine-learning-engineer:standard:1.1:1")
    row["scope"].update(cert_id="machine-learning-engineer", domain_code="1", doccheck_policy="v6")
    return row


def test_plan_program_exposes_only_two_predictors_and_default_components(monkeypatch):
    from shared import cli_models
    row = record()
    monkeypatch.setattr(cli_models, "run_signature", lambda *a, **k: row["outputs"])
    checks = []
    def check(scope, plan, sources):
        checks.append((scope, plan, sources))
        return {"passed": True}
    program = opt.PlanProgram("codex", rows=[row], checker=check)
    assert [name for name, _ in program.named_predictors()] == ["plan", "repair"]
    result = program(**row["inputs"])
    assert result.plan == row["outputs"]["plan"] and len(checks) == 1
    assert decode_plan_components(program.plan.signature.instructions) == {
        key: value for key, value in default_components().items() if key != "plan.repair_guidance"}
    assert "documented POSITIVE fact" in program.plan.effective_signature().instructions


def test_repair_only_after_isolated_veto_preserves_frozen_plan(monkeypatch):
    from shared import cli_models
    row = record()
    original = row["outputs"]["plan"]
    repaired = deepcopy(original)
    repaired["mistakes"][1] = {"action": "Use managed alternative", "scenario_reason": "Positive fact plus stated constraint"}
    calls = []
    def generate(model, signature, inputs, **kwargs):
        calls.append((signature, inputs))
        return {"plan": original if len(calls) == 1 else repaired}
    monkeypatch.setattr(cli_models, "run_signature", generate)
    veto = {"passed": False, "uniquely_best": True, "failing_options": ["C"],
            "reason": "Option C behavior lacks support", "mechanical_check": {"passed": True, "errors": []}}
    program = opt.PlanProgram("codex", rows=[row], checker=lambda *a: veto)
    assert program(**row["inputs"]).plan == repaired
    assert len(calls) == 2
    assert "OPTION-LOCAL REPAIR" in calls[1][0].instructions
    assert "options C" in calls[1][0].instructions
    assert '"frozen_plan"' in calls[1][1]["replacement_feedback"]


@pytest.mark.parametrize("veto", [
    {"passed": True},
    {"passed": False, "uniquely_best": False, "failing_options": ["B"]},
    {"passed": False, "uniquely_best": True, "failing_options": ["A", "B"]},
    {"passed": False, "uniquely_best": True, "failing_options": []},
])
def test_global_key_or_passing_proof_does_not_activate_local_repair(monkeypatch, veto):
    from shared import cli_models
    row = record()
    calls = []
    def generate(*a, **k):
        calls.append(1)
        return row["outputs"]
    monkeypatch.setattr(cli_models, "run_signature", generate)
    program = opt.PlanProgram("codex", rows=[row], checker=lambda *a: veto)
    program(**row["inputs"])
    assert len(calls) == 1


def test_repair_cannot_change_key_or_other_options(monkeypatch):
    from shared import cli_models
    row = record()
    changed = deepcopy(row["outputs"]["plan"])
    changed["best_action"] = "Illegally change key"
    results = iter([row["outputs"], {"plan": changed}])
    monkeypatch.setattr(cli_models, "run_signature", lambda *a, **k: next(results))
    veto = {"passed": False, "uniquely_best": True, "failing_options": ["B"]}
    program = opt.PlanProgram("codex", rows=[row], checker=lambda *a: veto)
    with pytest.raises(ValueError, match="frozen"):
        program(**row["inputs"])


def test_unbound_inputs_and_ambiguous_objective_bindings_fail_closed():
    row = record()
    program = opt.PlanProgram("codex", rows=[row], checker=lambda *a: {})
    with pytest.raises(ValueError, match="immutable"):
        program(**{**row["inputs"], "objective_scope": "unknown"})
    other = {**row, "objective_id": "different"}
    with pytest.raises(ValueError, match="ambiguously"):
        opt.PlanProgram("codex", rows=[row, other], checker=lambda *a: {})


def test_defaults_match_production_effective_signature(monkeypatch):
    from shared.decision_planner import planning_prompt
    row = record()
    program = opt.PlanProgram("codex", rows=[row], checker=lambda *a: {"passed": True})
    program.plan.component_values = default_components()
    program.plan.runtime_scope = row["scope"]
    expected, _ = planning_prompt(row["scope"], stable_prefix=True)
    assert program.plan.effective_signature().instructions == expected.instructions
    assert tuple(program.plan.effective_signature().input_fields) == tuple(expected.input_fields)


def test_full_draft_demonstrations_are_explicitly_retired(tmp_path):
    with pytest.raises(SystemExit, match="Full draft demonstrations are retired"):
        opt.main(["--stage", "draft", "--method", "bootstrap", "--dataset-dir", str(tmp_path),
                  "--output", str(tmp_path/"pack.json"), "--budget-usd", "1", "--prices", "unused"])


def test_initial_and_repaired_actions_must_be_distinct():
    plan = record()["outputs"]["plan"]
    opt.validate_distinct_plan_actions(plan)
    plan["mistakes"][0]["action"] = plan["best_action"].upper()
    with pytest.raises(ValueError, match="distinct"):
        opt.validate_distinct_plan_actions(plan)
