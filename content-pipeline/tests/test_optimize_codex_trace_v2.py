"""Real installed GEPA trace/reflection path with mocked subscription Codex calls."""
from copy import deepcopy
import json

import dspy

from scripts.optimize.components import encode_plan_components, make_proposal_fn
from scripts.optimize.run_optimizer import PlanProgram, compile_program, to_example
from shared import cli_models, llm_generator
from shared.decision_planner import DecisionPlanSignature, planning_prompt
from test_openrouter_writer_parity import SCOPE, plan, proof, sources


def test_real_gepa_codex_traces_plan_and_repair_offline(monkeypatch, tmp_path):
    """Exercise GEPA bootstrap_trace_data and make_reflective_dataset, not a shim."""
    scope = {**SCOPE, "cert_id": "machine-learning-engineer", "domain_code": "D1",
             "doccheck_policy": "v6"}
    baseline = plan()
    baseline["objective_id"] = scope["objective_id"]
    _, inputs = planning_prompt(scope)
    row = {"scope": scope, "objective_id": scope["objective_id"], "domain": "D1",
           "inputs": inputs, "outputs": {"plan": baseline}, "sources": sources()}
    codex_calls = []
    def fake_codex(model, signature, values, **kwargs):
        assert model == "codex"
        assert signature.output_fields.keys() == DecisionPlanSignature.output_fields.keys()
        result = deepcopy(baseline)
        if values["replacement_feedback"]:
            feedback = json.loads(values["replacement_feedback"])
            assert feedback["repair_options"] == ["B"]
            result = deepcopy(feedback["frozen_plan"])
            result["mistakes"][0]["scenario_reason"] = "Uses the documented mechanism at the wrong execution boundary."
            codex_calls.append("repair")
        else:
            codex_calls.append("plan")
        return {"plan": result}
    def no_live(*args, **kwargs):
        raise AssertionError("Offline trace test must never create a provider LM")
    monkeypatch.setattr(cli_models, "run_signature", fake_codex)
    monkeypatch.setattr(llm_generator, "_generation_lm", no_live)
    def checker(selected_scope, proposed, selected_sources):
        assert selected_scope["objective_id"] == proposed["objective_id"]
        assert selected_sources
        return {**proof(), "passed": False, "uniquely_best": True,
                "failing_options": ["B"], "reason": "Only B needs a new losing reason."}
    program = PlanProgram("codex", rows=[row], checker=checker,
                          cert_id=scope["cert_id"], doccheck_policy="v6")
    example = to_example(row, DecisionPlanSignature)
    reflected = []
    def reflect(**request):
        assert request["read_only_context"] == {"read_only": True, "exemplars": []}
        selected = request["components_to_update"]
        for name in selected:
            records = request["feedback"].get(name, [])
            assert records, f"No actual predictor trace reached reflection for {name}"
            assert "Generated Outputs" in records[0] and "Inputs" in records[0]
        reflected.extend(selected)
        count = len(reflected)
        return {name: encode_plan_components({"plan.instructions":
                    f"Design a concrete engineering choice. Prefer clear tradeoffs. Revision {count}."})
                if name == "plan" else
                f"Repair only actions and losing reasons for options {{repair_options}}. "
                f"Preserve every other byte of the supplied plan. Revision {count}."
                for name in selected}
    proposer = make_proposal_fn(reflect, frozen_context={"read_only": True, "exemplars": []})
    metric_calls = []
    def metric(gold, prediction, trace=None, pred_name=None, pred_trace=None):
        metric_calls.append(pred_name)
        assert prediction.plan["objective_id"] == scope["objective_id"]
        return dspy.Prediction(score=0.4, feedback="Retain scenario and vary the engineering alternative.")
    # A native adapter needs enough rounds to visit both round_robin predictors.
    # Every transport is mocked and the proposer is an injected local callback.
    optimized = compile_program(program, method="gepa", trainset=[example], devset=[example],
        metric=metric, max_metric_calls=24, minibatch_size=1, seed=7,
        log_dir=str(tmp_path / "gepa"), instruction_proposer=proposer)
    assert {name for name, _ in optimized.named_predictors()} == {"plan", "repair"}
    assert set(codex_calls) == {"plan", "repair"}
    assert set(reflected) == {"plan", "repair"}
    assert {name for name in metric_calls if name is not None} == {"plan", "repair"}
    assert not proposer.rejections
