"""Accepted training plan selection, context compaction and scope filtering."""
from copy import deepcopy
import json

import pytest

from scripts.optimize.exemplars import select_compact_exemplars, exemplar_hash
from shared.decision_planner import DecisionPlanSignature, planning_prompt
from shared.prompt_pack import create_pack, use_prompt_pack, writer_exemplars, writer_demos
from test_openrouter_writer_parity import plan


def row(objective="train-1", domain="D1", cert="machine-learning-engineer"):
    value = plan()
    value["objective_id"] = objective
    return {"objective_id": objective, "domain": domain,
        "scope": {"objective_id": objective, "cert_id": cert, "domain_code": domain},
        "plan": value, "proof": {"passed": True},
        "council": {"seats": ["style", "evidence", "blind_solver", "argon.blind", "argon.review"]},
        "inputs": {"documentation_context": "LARGE DOCUMENT " * 10000},
        "sources": [{"text": "LARGE SOURCE "*10000}], "outputs": {"stem": "NOT A PLAN"}}


def splits():
    return {"train": [row(f"train-{i}") for i in range(6)] + [row("other-domain", "D2")],
        "dev": [row("dev")], "test": [row("test")]}


def test_compact_train_only_same_domain_diverse_objectives():
    data = splits()
    original = deepcopy(data)
    selected = select_compact_exemplars(data, domain="D1", cert_id="machine-learning-engineer",
        exclude_objective_ids=["train-0"])
    assert len(selected) == 3
    assert len({r["objective_id"] for r in selected}) == 3
    assert all(r["objective_id"] not in {"dev", "test", "train-0"} for r in selected)
    assert all(set(r) == {"domain", "cert_id", "objective_id", "plan"} for r in selected)
    assert len(json.dumps(selected)) < 8000
    assert "LARGE DOCUMENT" not in json.dumps(selected)
    assert "LARGE SOURCE" not in json.dumps(selected)
    assert "NOT A PLAN" not in json.dumps(selected)
    assert selected == select_compact_exemplars(data, domain="D1", cert_id="machine-learning-engineer", exclude_objective_ids=["train-0"])
    assert data == original
    assert exemplar_hash(selected) == exemplar_hash(deepcopy(selected))
    assert select_compact_exemplars(data, domain="missing") == []


def test_invalid_or_nonaccepted_and_protected_rows_never_selected():
    data = splits()
    data["train"][0]["proof"]["passed"] = False
    data["train"][1]["council"]["seats"].pop()
    data["train"][2]["cohort"] = "gold"
    data["train"][3]["is_canary"] = True
    data["train"][4]["plan"]["objective_id"] = "changed"
    data["train"][5]["scope"]["cert_id"] = "other"
    assert select_compact_exemplars(data, domain="D1", cert_id="machine-learning-engineer") == []
    with pytest.raises(ValueError):
        select_compact_exemplars(data["train"], domain="D1")
    with pytest.raises(ValueError):
        select_compact_exemplars(splits(), domain="D1", limit=4)
    data = splits()
    data["test"].append(data["train"][0])
    with pytest.raises(ValueError, match="objective-disjoint"):
        select_compact_exemplars(data, domain="D1")


def test_rendering_never_uses_current_objective_or_cross_domain_or_dspy_demo():
    selected = select_compact_exemplars(splits(), domain="D1", limit=3)
    pack = create_pack(stage="plan", signature=DecisionPlanSignature, exemplars=selected,
        policy={}, source_run="test", scores={})
    scope = {"objective_id": selected[0]["objective_id"], "cert_id": "machine-learning-engineer",
        "domain_code": "D1", "domain_prompt": "Scope", "doccheck_policy": "v6"}
    with use_prompt_pack(pack):
        assert len(writer_exemplars(scope)) == 2
        sig, _ = planning_prompt(scope)
        assert "Accepted same-domain plans" in sig.instructions
        assert json.dumps(selected[0]["plan"], sort_keys=True, separators=(",", ":")) not in sig.instructions
        assert writer_demos(DecisionPlanSignature) == []
        assert writer_exemplars({**scope, "domain_code": "D2"}) == []
        assert writer_exemplars({**scope, "cert_id": "other"}) == []
    baseline, _ = planning_prompt(scope)
    assert "Accepted same-domain plans" not in baseline.instructions


def test_multi_domain_bank_renders_at_most_three_per_domain():
    data = splits()
    data["train"].extend(row(f"D2-{i}", "D2") for i in range(5))
    bank = [*select_compact_exemplars(data, domain="D1"),
            *select_compact_exemplars(data, domain="D2")]
    assert len(bank) == 6
    pack = create_pack(stage="plan", signature=DecisionPlanSignature, exemplars=bank,
        policy={}, source_run="test", scores={})
    with use_prompt_pack(pack):
        assert len(writer_exemplars({"domain_code": "D1", "cert_id": "machine-learning-engineer"})) == 3
        assert len(writer_exemplars({"domain_code": "D2", "cert_id": "machine-learning-engineer"})) == 3
    with pytest.raises(ValueError, match="At most three"):
        create_pack(stage="plan", signature=DecisionPlanSignature,
            exemplars=[*bank, {"domain": "D1", "cert_id": "machine-learning-engineer",
                "objective_id": "extra", "plan": {**plan(), "objective_id": "extra"}}],
            policy={}, source_run="test", scores={})
