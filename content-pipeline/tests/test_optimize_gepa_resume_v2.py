"""Native installed GEPA interrupt/resume with durable metric admission and pack export."""
from copy import deepcopy
import hashlib
import json
import re

import dspy
import pytest
from gepa.core.state import GEPAState

from scripts.optimize.budget import MetricLimiter
from scripts.optimize.components import (components_for_predictors, encode_plan_components,
                                         make_proposal_fn)
from scripts.optimize.run_optimizer import PlanProgram, compile_program, to_example
from shared import cli_models, llm_generator
from shared.decision_planner import DecisionPlanSignature, planning_prompt
from shared.prompt_pack import create_pack, load_pack, save_pack


def fixture_row():
    objective = "machine-learning-engineer:standard:1.1:1"
    scope = {"objective_id": objective, "cert_id": "machine-learning-engineer",
             "domain_code": "D1", "domain_prompt": "Choose a managed model-serving approach.",
             "doccheck_policy": "v6"}
    plan = {"objective_id": objective, "engineering_decision": "Choose an execution boundary.",
        "business_consequence": "Reduce operational work for an existing fraud service.",
        "existing_system": "A fraud model receives requests from a transaction service.",
        "decisive_constraints": ["Minimize operational work"],
        "best_action": "Deploy the model to a managed prediction endpoint.",
        "mistakes": [{"action": "Build and operate a custom serving cluster.",
                      "scenario_reason": "The team would own cluster operations."},
                     {"action": "Schedule daily batch scoring jobs.",
                      "scenario_reason": "The workflow scores requests as they arrive."},
                     {"action": "Run training jobs for every incoming request.",
                      "scenario_reason": "Training changes model parameters rather than serving predictions."}]}
    text = "A managed prediction endpoint serves predictions from deployed models."
    source = {"url": "https://cloud.google.com/vertex-ai/docs/predictions/overview",
        "requested_url": "https://cloud.google.com/vertex-ai/docs/predictions/overview",
        "retrieved_at": "2026-10-20T00:00:00Z", "text": text,
        "text_sha256": hashlib.sha256(text.encode()).hexdigest()}
    _, inputs = planning_prompt(scope)
    return {"objective_id": objective, "domain": "D1", "scope": scope,
            "inputs": inputs, "outputs": {"plan": plan}, "sources": [source]}


def test_native_gepa_resume_preserves_best_and_metric_state_then_exports_pack(monkeypatch, tmp_path):
    row = fixture_row()
    state_path, log_dir = tmp_path / "metric-state.json", tmp_path / "gepa"
    limit = 24
    cli_calls, checked = [], []
    def fake_codex(model, signature, inputs, **kwargs):
        assert model == "codex"
        match = re.search(r"Revision (\d+)", signature.instructions)
        revision = int(match[1]) if match else 0
        proposed = deepcopy(row["outputs"]["plan"])
        proposed["best_action"] += f" Revision {revision}."
        cli_calls.append(revision)
        return {"plan": proposed}
    def no_live(*args, **kwargs):
        raise AssertionError("Native resume regression must not call a provider")
    monkeypatch.setattr(cli_models, "run_signature", fake_codex)
    monkeypatch.setattr(llm_generator, "_generation_lm", no_live)
    def check(scope, proposed, sources):
        assert scope["objective_id"] == proposed["objective_id"]
        assert sources == row["sources"]
        checked.append(proposed["best_action"])
        return {"passed": True, "supported": True, "uniquely_best": True,
                "scenario_reasons_supported": True, "no_feature_gotchas": True,
                "failing_options": [], "reason": "Offline fixture checker accepted all four actions.",
                "reasons": [{"option_label": label, "url": sources[0]["url"],
                    "quote": sources[0]["text"], "scenario_reason": "Fixture behavior."} for label in "ABCD"],
                "mechanical_check": {"passed": True, "errors": []}}
    def program():
        return PlanProgram("codex", rows=[row], checker=check,
            cert_id=row["scope"]["cert_id"], doccheck_policy="v6")
    example = to_example(row, DecisionPlanSignature)
    judge_calls = []
    def judge(gold, pred, trace=None, pred_name=None, pred_trace=None):
        revision = int(re.search(r"Revision (\d+)", pred.plan["best_action"])[1])
        judge_calls.append(revision)
        return dspy.Prediction(score=.1 + .1*min(revision, 7), feedback="Improve the concrete approach.")
    metric = MetricLimiter(judge, limit, cache=True, state_path=state_path)
    next_revision = 0
    should_interrupt = True
    proposal_inputs = []
    def reflect(**request):
        nonlocal next_revision
        assert request["components_to_update"] == ["plan"]
        proposal_inputs.append(deepcopy(request["current_components"]))
        next_revision += 1
        # Candidate 1 has already been accepted and native state saved before
        # this second nonempty reflection. KeyboardInterrupt escapes native
        # Exception catches, as a stopped coordinator run would.
        if should_interrupt and next_revision == 2:
            raise KeyboardInterrupt("offline intentional stop")
        return {"plan": encode_plan_components({"plan.instructions":
            f"Design one concrete managed-serving decision. Revision {next_revision}."})}
    proposer = make_proposal_fn(reflect, frozen_context={"read_only": True})
    with pytest.raises(KeyboardInterrupt, match="intentional stop"):
        compile_program(program(), method="gepa", trainset=[example], devset=[example],
            metric=metric, max_metric_calls=limit, minibatch_size=1, seed=13,
            log_dir=str(log_dir), instruction_proposer=proposer)
    assert (log_dir / "gepa_state.bin").is_file()
    native_before = GEPAState.load(str(log_dir))
    candidates_before = deepcopy(native_before.program_candidates)
    assert len(candidates_before) >= 2
    seed_before = candidates_before[0]
    best_before = max(range(len(candidates_before)), key=lambda i: native_before.program_full_scores_val_set[i])
    assert "Revision 1" in candidates_before[best_before]["plan"]
    accounting_before = json.loads(state_path.read_text())
    assert accounting_before["calls"] == len(judge_calls) >= 2
    assert accounting_before["cache"]
    admitted_before = accounting_before["calls"]
    native_calls_before = native_before.total_num_evals
    resumed = MetricLimiter(judge, limit, cache=True, state_path=state_path, resume=True)
    assert resumed.calls == admitted_before
    assert resumed.cache_hits == accounting_before["cache_hits"]
    should_interrupt = False
    proposals_before_resume = len(proposal_inputs)
    optimized = compile_program(program(), method="gepa", trainset=[example], devset=[example],
        metric=resumed, max_metric_calls=limit, minibatch_size=1, seed=13,
        log_dir=str(log_dir), instruction_proposer=proposer)
    native_after = GEPAState.load(str(log_dir))
    assert native_after.program_candidates[:len(candidates_before)] == candidates_before
    assert native_after.program_candidates[0] == seed_before
    assert native_after.total_num_evals >= native_calls_before
    assert "Revision 1" in proposal_inputs[proposals_before_resume]["plan"]
    assert resumed.calls >= admitted_before
    assert resumed.calls == len(judge_calls) <= limit
    assert json.loads(state_path.read_text())["calls"] == resumed.calls
    best_after = max(range(len(native_after.program_candidates)), key=lambda i: native_after.program_full_scores_val_set[i])
    assert native_after.program_full_scores_val_set[best_after] >= native_before.program_full_scores_val_set[best_before]
    assert optimized.plan.signature.instructions == native_after.program_candidates[best_after]["plan"]
    output = tmp_path / "resumed-pack.json"
    pack = create_pack(stage="plan", signature=DecisionPlanSignature,
        components=components_for_predictors(optimized.plan.signature.instructions,
                                            optimized.repair.signature.instructions),
        exemplars=[], policy={"doccheck_policy": "v6"}, source_run=str(log_dir),
        scores={"metric_calls": float(resumed.calls)})
    save_pack(pack, output)
    assert load_pack(output) == pack
    assert pack["scores"]["metric_calls"] >= admitted_before
    assert not proposer.rejections
    assert cli_calls and checked
