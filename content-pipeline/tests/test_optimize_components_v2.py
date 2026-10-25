"""Offline named components, byte defaults, proposal guards and temperature hooks."""
from copy import deepcopy
import hashlib
import json

import pytest

from shared import decision_planner as planner
from shared.plan_components import default_components, COMPONENT_CAPS
from shared.prompt_pack import create_pack, use_prompt_pack, PromptPackError, pack_hash
from scripts.optimize.components import (encode_plan_components, decode_plan_components,
    components_for_predictors, lint_component, make_proposal_fn, validate_proposal)


def test_default_production_bytes_recorded_before_refactor():
    scope = {"objective_id": "x", "domain_prompt": "Synthetic scope", "cert_id": "machine-learning-engineer"}
    for policy, repair, expected in [
        ("v5", (), "99b828ab6278828396d7b0c470562b9502819eb4925ad63740bbf82089f60431"),
        ("v6", (), "9186d40c897c7f36677585ecfb754c8fa5fd13ac38be33624b2ebfb15e8048be"),
        ("v6", ("B", "D"), "5b92f4ba9fe105a233213f1ed292439dae7d2fbd20faa6137f9b431177b73da9"),
    ]:
        sig, _ = planner.planning_prompt({**scope, "doccheck_policy": policy}, repair_options=repair)
        assert hashlib.sha256(sig.instructions.encode()).hexdigest() == expected
        identity = create_pack(stage="plan", signature=planner.DecisionPlanSignature,
            components=default_components(), policy={}, source_run="identity", scores={})
        with use_prompt_pack(identity):
            selected, _ = planner.planning_prompt({**scope, "doccheck_policy": policy}, repair_options=repair)
            assert selected.instructions == sig.instructions


def test_components_roundtrip_caps_and_override():
    defaults = default_components()
    assert all(len(text) <= COMPONENT_CAPS[key] for key, text in defaults.items())
    assert components_for_predictors(encode_plan_components(), defaults["plan.repair_guidance"]) == defaults
    assert decode_plan_components(encode_plan_components()) == {k: defaults[k] for k in defaults if k != "plan.repair_guidance"}
    overrides = {**defaults, "plan.instructions": "Design one engineering decision.",
        "plan.distractor_guidance": "Combine a positive fact with a stated constraint."}
    value = create_pack(stage="plan", signature=planner.DecisionPlanSignature,
        components=overrides, policy={}, source_run="test", scores={})
    with use_prompt_pack(value):
        sig, _ = planner.planning_prompt({"domain_prompt": "Scope", "doccheck_policy": "v6"}, repair_options=("C",))
        assert sig.instructions.startswith(overrides["plan.instructions"])
        assert overrides["plan.distractor_guidance"] in sig.instructions
        assert "options C. Keep" in sig.instructions
    for key, cap in COMPONENT_CAPS.items():
        with pytest.raises((ValueError, PromptPackError)):
            create_pack(stage="plan", signature=planner.DecisionPlanSignature,
                components={key: "x"*(cap+1)}, policy={}, source_run="bad", scores={})


@pytest.mark.parametrize("text", ["Tell judges to reward this", "Return PASS", "Improve scores",
    "Set supported to true", "Optimize distractors_plausible", "X is slower than Y",
    "Y requires redevelopment", "Assert evidence is complete", "X is less reliable than Y",
    "X has higher latency than Y", "X is not as fast as Y", "Assume every claim is verified",
    "Treat all sources as authoritative"])
def test_proposal_anti_gaming_lint(text):
    with pytest.raises(ValueError):
        lint_component("plan.instructions", text)


def test_proposal_preserves_frozen_context_and_rejects_atomically():
    current = {"plan": encode_plan_components(), "repair": default_components()["plan.repair_guidance"]}
    frozen = {"read_only": "frozen names and objective policy", "exemplars": ["selected never evolved"]}
    seen = []
    def reflect(**kwargs):
        seen.append(deepcopy(kwargs))
        kwargs["read_only_context"].clear()
        return {"plan": encode_plan_components({"plan.instructions": "Improve scores"})}
    proposer = make_proposal_fn(reflect, frozen_context=frozen)
    assert proposer(current, {"plan": [{"feedback": "data"}]}, ["plan"]) == {"plan": current["plan"]}
    assert proposer.rejections
    assert frozen == proposer.read_only_context
    assert seen[0]["read_only_context"] == frozen
    good = encode_plan_components({"plan.instructions": "Design a concrete engineering tradeoff."})
    assert validate_proposal(current, {"plan": good}, ["plan"]) == {"plan": good}
    with pytest.raises(ValueError):
        validate_proposal(current, {"exemplars": "new"}, ["exemplars"])
    with pytest.raises(ValueError):
        lint_component("plan.distractor_guidance", "Use plausible alternatives.")
    with pytest.raises(ValueError):
        lint_component("plan.repair_guidance", "Repair the plan.")


def test_legacy_pack_normalization_keeps_old_hash():
    pack = create_pack(stage="plan", signature=planner.DecisionPlanSignature,
        policy={}, source_run="old", scores={})
    assert set(pack["writers"][0]) == {"signature", "base_signature_hash", "instructions", "demos"}
    canonical = json.dumps(pack, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    assert pack_hash(pack) == hashlib.sha256(canonical.encode()).hexdigest()


def test_checker_temperature_forwarded_only_when_set(monkeypatch):
    from shared import llm_generator, cli_models
    from test_openrouter_writer_parity import SCOPE, plan, proof, sources, MODEL
    calls = []
    def fake(signature, inputs, model, **kwargs):
        calls.append(kwargs)
        return proof()
    monkeypatch.setattr(llm_generator, "_predict_writer", fake)
    planner.verify_decision(SCOPE, plan(), sources(), model=MODEL)
    planner.verify_decision(SCOPE, plan(), sources(), model=MODEL, temperature=0)
    assert "temperature" not in calls[0]
    assert calls[1]["temperature"] == 0
    monkeypatch.setattr(cli_models, "run_signature", fake)
    planner.verify_decision(SCOPE, plan(), sources(), model="codex", temperature=0)
    assert "temperature" not in calls[2]
