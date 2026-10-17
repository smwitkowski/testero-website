"""Offline budget, early duplicate, and interrupted-plan policy contracts."""
import json
import math
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate
from shared.cert_context import DEFAULT_CERT, plan_questions
from shared.near_duplicates import check_plan_near_duplicate, THRESHOLD
from shared.objective_style import style_policy


@pytest.mark.parametrize("target,yield_rate", [(1, .29), (12, .29), (15, .5)])
def test_target_budget_is_ceiling_and_mutually_exclusive(target, yield_rate):
    assert generate.candidate_budget(None, target, yield_rate) == math.ceil(target / yield_rate)
    assert generate.candidate_budget() == 10
    with pytest.raises(ValueError, match="alternatives"):
        generate.candidate_budget(12, target, yield_rate)


@pytest.mark.parametrize("rate", [0, -1, 1.1, float("nan"), float("inf")])
def test_invalid_yield_rejected(rate):
    with pytest.raises(ValueError):
        generate.candidate_budget(None, 12, rate)


def decision(scope):
    return {"objective_id": scope["objective_id"], "engineering_decision": "Choose a managed deployment",
            "existing_system": "Retail inventory forecasts run on virtual machines",
            "business_consequence": "Stock forecasts arrive before stores open",
            "decisive_constraints": ["Reduce maintenance"],
            "best_action": "Run scheduled batch predictions with managed jobs", "mistakes": []}


def test_plan_duplicate_skips_every_retrieval_and_writer_call(monkeypatch, tmp_path):
    scope = plan_questions(DEFAULT_CERT, 1)[0]
    plan = decision(scope)
    scenario = " ".join([plan["existing_system"], plan["business_consequence"], *plan["decisive_constraints"]])
    bank = tmp_path / "bank.json"
    bank.write_text(json.dumps([{"id": "existing", "status": "ACTIVE", "stem": scenario,
        "key": "A", "options": [{"label": "A", "text": plan["best_action"]}]}]))
    check = check_plan_near_duplicate(plan, [{"id": "existing", "stem": scenario, "key": plan["best_action"]}])
    assert check["passed"] is False and check["threshold"] == THRESHOLD
    assert check["matches"][0]["score"] == 1
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: plan)
    services = [Mock(side_effect=AssertionError("Must not run after duplicate plan")) for _ in range(4)]
    for name, service in zip(["search_objective_docs", "verify_decision", "generate_question", "cite_question"], services):
        monkeypatch.setattr(generate, name, service)
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--n-questions", "1", "--objective", scope["objective_id"], "--existing-questions", str(bank),
        "--artifact", str(tmp_path / "batch.json")])
    assert result.exit_code == 1
    entry = json.loads((tmp_path / "batch.json").read_text())["candidates"][0]
    assert entry["failure_stage"] == entry["reason"] == "near_duplicate_plan"
    assert not entry["accepted"] and "sources" not in entry
    for service in services:
        service.assert_not_called()


def test_every_scope_has_frozen_policy_even_when_batch_stops_before_admission(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    from shared.cli_models import CLIUsageLimitError
    monkeypatch.setattr(generate, "plan_decision", Mock(side_effect=CLIUsageLimitError("Safe stop")))
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--n-questions", "5", "--parallel", "1", "--artifact", str(tmp_path / "stopped.json")])
    assert result.exit_code == 1
    artifact = json.loads((tmp_path / "stopped.json").read_text())
    assert len(artifact["candidates"]) == 1
    assert len(artifact["plan"]) == 5
    for scope in artifact["plan"]:
        assert scope["style_policy"] == style_policy(scope["objective_id"])


def test_target_accepted_cli_sizes_the_plan(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    from shared.cli_models import CLIUsageLimitError
    monkeypatch.setattr(generate, "plan_decision", Mock(side_effect=CLIUsageLimitError("Safe stop")))
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--target-accepted", "4", "--expected-yield", "0.5", "--parallel", "1",
        "--artifact", str(tmp_path / "target.json")])
    assert result.exit_code == 1
    artifact = json.loads((tmp_path / "target.json").read_text())
    assert artifact["planned_count"] == len(artifact["plan"]) == 8
    assert artifact["target_accepted"] == 4 and artifact["expected_yield"] == .5
    conflict = CliRunner().invoke(generate.main, ["--target-accepted", "4", "--n-questions", "12"])
    assert conflict.exit_code == 1 and "alternatives" in conflict.output
