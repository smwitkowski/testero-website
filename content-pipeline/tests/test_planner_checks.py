"""Offline opt-in planning checks; the running generation defaults stay frozen."""
from copy import deepcopy
import json
from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts import pipeline_nightly as nightly
from scripts import run_domain_batch as batch
from shared.product_freshness import (
    QUESTION_TEXT_FIELDS, freshness_findings,
    plan_freshness_findings, plan_freshness_feedback,
)
from shared.yield_planning import existing_scenarios
from test_decision_first_v4 import decision, pipeline, proof


IMAGEN = "imagen-3.0-capability-001"


def blocking(plan):
    return [hit for hit in plan_freshness_findings(plan) if hit["blocking"]]


def test_planner_lifecycle_entries_do_not_change_learner_gate_or_v6_names():
    from shared.doccheck_names import current_name_instructions
    question = {field: "Current wording" for field in QUESTION_TEXT_FIELDS}
    question["correct_answer"] = "Use " + IMAGEN
    assert freshness_findings(question) == []
    assert IMAGEN not in current_name_instructions()
    hit = blocking({**decision(), "best_action": "Use " + IMAGEN})
    assert len(hit) == 1 and hit[0]["status"] == "retired"
    assert hit[0]["lifecycle_date"] == "2026-06-30"
    assert hit[0]["as_of"] == "2026-10-14"
    assert hit[0]["source"].startswith("https://docs.cloud.google.com/")


@pytest.mark.parametrize("product", [IMAGEN, "Vertex AI Vision"])
def test_retired_existing_system_and_mistake_are_context_not_destinations(product):
    plan = decision()
    plan["existing_system"] = "The existing application uses " + product
    plan["mistakes"][0]["action"] = "Keep the legacy " + product
    hits = plan_freshness_findings(plan)
    assert {hit["field"] for hit in hits} == {"existing_system", "mistakes[0].action"}
    assert not any(hit["blocking"] for hit in hits)


@pytest.mark.parametrize("action", [
    "Migrate from {old} to gemini-2.5-flash-image",
    "Move images from {old} to a supported model",
    "Replace {old} with a supported model",
    "Stop using {old} and adopt a supported model",
])
def test_retired_explicit_migration_source_is_allowed(action):
    assert blocking({**decision(), "best_action": action.format(old=IMAGEN)}) == []


@pytest.mark.parametrize("action", [
    "Use {old}", "Migrate to {old}", "Migrate from {old} to {old}",
    "Keep {old} for the masked image editing endpoint",
])
def test_retired_recommended_destinations_are_blocking(action):
    hits = blocking({**decision(), "best_action": action.format(old=IMAGEN)})
    assert len(hits) == 1
    assert "2026-06-30" in plan_freshness_feedback(hits)


@pytest.mark.parametrize("field", ["existing_system", "best_action", "mistakes"])
def test_old_names_are_scanned_in_all_plan_fields(field):
    plan = decision()
    if field == "mistakes":
        plan[field][1]["action"] = "Use Vertex AI Pipelines"
    else:
        plan[field] = "Use Vertex AI Pipelines"
    hits = blocking(plan)
    assert len(hits) == 1 and hits[0]["status"] == "renamed"
    assert "Agent Platform Pipelines" in plan_freshness_feedback(hits)


def test_lifecycle_boundary_url_and_deprecation_classifications():
    assert blocking({**decision(), "best_action": "Use " + IMAGEN + "0"}) == []
    assert blocking({**decision(), "best_action": "See https://example.com/" + IMAGEN}) == []
    hits = plan_freshness_findings({**decision(), "best_action": "Use Optimized online serving"})
    assert len(hits) == 1 and hits[0]["status"] == "deprecated" and not hits[0]["blocking"]
    assert hits[0]["retirement_date"] == "2027-02-17"


def test_lint_feedback_is_bounded():
    hit = blocking({**decision(), "best_action": "Use " + IMAGEN})[0]
    assert len(plan_freshness_feedback([hit] * 100)) <= 2400


def _stale(name="Stale endpoint"):
    return {**decision(name), "best_action": "Use " + IMAGEN}


def test_opt_in_lint_replans_before_retrieval_and_keeps_doc_scope_frozen(pipeline, monkeypatch):
    events, path, invoke = pipeline
    decisions = iter([_stale(), decision()])
    feedback = []
    def planner(scope, **kwargs):
        events.append("plan")
        feedback.append(kwargs["replacement_feedback"])
        assert IMAGEN not in scope["domain_prompt"]
        return next(decisions)
    monkeypatch.setattr(generate, "plan_decision", planner)
    result = invoke("--plan-freshness-lint")
    assert result.exit_code == 0, result.output
    assert events == ["plan", "plan", "retrieval", "proof", "writer", "citation"]
    assert feedback[0] == "" and IMAGEN in feedback[1]
    payload = json.loads((path / "batch.json").read_text())
    assert payload["plan_freshness_lint"] is True
    attempts = payload["candidates"][0]["decision_attempts"]
    assert len(attempts) == 2
    assert attempts[0]["plan_freshness_check"]["passed"] is False
    assert "proof" not in attempts[0] and "sources" not in attempts[0]
    assert attempts[1]["proof"]["passed"] is True


def test_lint_off_does_not_call_new_helper_or_add_artifact_fields(pipeline, monkeypatch):
    from shared import product_freshness
    monkeypatch.setattr(product_freshness, "plan_freshness_findings", lambda *a, **k: pytest.fail("Default lint changed"))
    events, path, invoke = pipeline
    result = invoke()
    assert result.exit_code == 0, result.output
    payload = json.loads((path / "batch.json").read_text())
    assert "plan_freshness_lint" not in payload and "scenario_hint_cap" not in payload
    assert "plan_freshness_check" not in payload["candidates"][0]["decision_attempts"][0]
    assert events == ["plan", "retrieval", "proof", "writer", "citation"]


def test_lint_cannot_exceed_three_attempts_or_fetch_docs_when_all_stale(pipeline, monkeypatch):
    events, path, invoke = pipeline
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **k: events.append("plan") or _stale())
    result = invoke("--plan-freshness-lint", "--continue-quality-rejections")
    assert result.exit_code == 0, result.output
    assert events == ["plan", "plan", "plan"]
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert entry["failure_stage"] == "decision_veto"
    assert entry["error_class"] == "DecisionVetoError"
    assert "system_retries" not in entry
    assert "external_judge_request" not in entry
    assert "exhausted decision attempts" in entry["reason"]


def test_lint_and_doc_veto_share_same_attempt_budget(pipeline, monkeypatch):
    events, path, invoke = pipeline
    plans = iter([_stale(), decision("Unsupported current action"), _stale("Another stale decision")])
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **k: events.append("plan") or next(plans))
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **k: events.append("proof") or {
        **proof(False), "passed": False, "mechanical_check": {"passed": False, "errors": []}})
    result = invoke("--plan-freshness-lint")
    assert result.exit_code == 1
    assert events == ["plan", "plan", "retrieval", "proof", "plan"]
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert len(entry["decision_veto_reasons"]) == 1  # Only actual doc-check proofs.


def hint_scope():
    return {"objective_id": "selected", "objective_context": "Training models and serving predictions with BigQuery",
            "objective_text": "Fine-tuning Gemini models using BigQuery", "services": ["BigQuery", "Feature Store"]}


def hint(index, text, objective=None):
    return {"id": str(index), "stem": text + " " + str(index), "key": "Choose a supported approach",
            **({"objective_id": objective} if objective else {})}


def test_scenario_hint_cap_is_opt_in_and_uses_exact_objective_not_subsection():
    scope = hint_scope()
    bank = [hint(i, "BigQuery") for i in range(2)]  # One objective token is insufficient.
    bank += [hint(i + 2, "Feature Store predictions") for i in range(2)]
    bank += [hint(i + 4, "Gemini BigQuery models") for i in range(8)]
    assert len(existing_scenarios(scope, bank, [])) == 12
    rows = existing_scenarios(scope, bank, [], scenario_hint_cap=True)
    assert len(rows) == 3
    assert all(row["attribution"] == "unmapped_export_hint" and "Gemini BigQuery" in row["stem_summary"] for row in rows)


def test_scenario_hint_cap_keeps_exact_and_batch_history_and_deduplicates_before_cap():
    scope = hint_scope()
    bank = [hint(i, "Mapped scenario", "selected") for i in range(6)]
    bank += [hint(20, "Gemini BigQuery models")] * 5
    bank += [hint(i, "Gemini BigQuery models") for i in range(21, 25)]
    plan = {**decision(), "objective_id": "selected"}
    rows = existing_scenarios(scope, bank, [], [plan], scenario_hint_cap=True)
    assert len(rows) == 10
    assert sum(row["attribution"] == "unmapped_export_hint" for row in rows) == 3
    assert rows[0]["stem_summary"] == plan["existing_system"]
    assert sum(row["attribution"] == "selected_objective" for row in rows) == 7


def test_generator_wires_hint_flag_without_changing_objective_scope(pipeline, monkeypatch):
    events, path, invoke = pipeline
    observed = []
    original = generate.existing_scenarios
    def summaries(scope, *args, **kwargs):
        observed.append((deepcopy(scope), kwargs))
        return original(scope, *args, **kwargs)
    monkeypatch.setattr(generate, "existing_scenarios", summaries)
    result = invoke("--scenario-hint-cap")
    assert result.exit_code == 0, result.output
    assert observed[0][1] == {"scenario_hint_cap": True}
    assert "scenario_hint_cap" not in observed[0][0]
    assert json.loads((path / "batch.json").read_text())["scenario_hint_cap"] is True


@pytest.mark.parametrize("enabled", [False, True])
def test_batch_and_nightly_flags_are_generation_only(monkeypatch, tmp_path, enabled):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    options = {"plan_freshness_lint": enabled, "scenario_hint_cap": enabled}
    _, _, commands = batch.batch_commands("1.", "checks", "machine-learning-engineer", 2, 1, **options)
    for flag in ("--plan-freshness-lint", "--scenario-hint-cap"):
        assert (flag in commands[0]) is enabled
        assert all(flag not in command for command in commands[1:])
    commands = nightly.commands_for_batch({"cert": "machine-learning-engineer", "section": "1.", "count": 2},
        "checks", state_dir=tmp_path, tools=tmp_path, **options)
    for flag in ("--plan-freshness-lint", "--scenario-hint-cap"):
        assert (flag in commands[0][1]) is enabled
        assert flag not in commands[1][1]


@pytest.mark.parametrize("key", ["plan_freshness_lint", "scenario_hint_cap"])
@pytest.mark.parametrize("value", ["false", 1, None])
def test_nightly_config_requires_actual_booleans(tmp_path, key, value):
    with pytest.raises(ValueError, match="booleans"):
        nightly.commands_for_batch({"cert": "machine-learning-engineer", "section": "1.", "count": 2},
            "checks", state_dir=tmp_path, tools=tmp_path, **{key: value})


@pytest.mark.parametrize("flags", [[], ["--plan-freshness-lint", "--scenario-hint-cap"]])
def test_batch_cli_forwards_flags_offline_only(monkeypatch, tmp_path, flags):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.delenv("N", raising=False)
    calls = []
    monkeypatch.setattr(batch.subprocess, "run", lambda command, **kwargs: calls.append(command))
    result = CliRunner().invoke(batch.main, ["1.", "forward", "machine-learning-engineer", "--plan-only", *flags])
    assert result.exit_code == 0, result.output
    assert len(calls) == 1
    for flag in ("--plan-freshness-lint", "--scenario-hint-cap"):
        assert (flag in calls[0]) is (flag in flags)


@pytest.mark.parametrize("enabled", [False, True])
def test_nightly_reads_config_flags_and_cli_can_enable_without_external_steps(monkeypatch, tmp_path, enabled):
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"plan_freshness_lint": enabled, "scenario_hint_cap": enabled}))
    coverage = tmp_path / "coverage.json"
    coverage.write_text(json.dumps({"complete": True, "questions": []}))
    received = []
    monkeypatch.setattr(nightly, "nightly", lambda config, **kwargs: received.append(config) or {"status": "planned"})
    args = ["pipeline_nightly", "--config", str(path), "--coverage", str(coverage),
            "--tools-dir", str(tmp_path), "--state-dir", str(tmp_path), "--print"]
    monkeypatch.setattr(nightly.sys, "argv", args)
    assert nightly.main() == 0
    assert received[-1] == {"plan_freshness_lint": enabled, "scenario_hint_cap": enabled}
    monkeypatch.setattr(nightly.sys, "argv", [*args, "--plan-freshness-lint", "--scenario-hint-cap"])
    assert nightly.main() == 0
    assert received[-1] == {"plan_freshness_lint": True, "scenario_hint_cap": True}


@pytest.mark.parametrize("key", ["plan_freshness_lint", "scenario_hint_cap"])
def test_resume_rejects_changed_planning_experiment(monkeypatch, tmp_path, key):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    path = tmp_path / ".cache/generation/data-engineer-v5-saved.json"
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({"cert_id": "data-engineer", "plan": [{"objective_id": "test"}],
                                "planned_count": 1, "requested_objective_ids": []}))
    path.with_suffix(".existing.json").write_text("[]")
    with pytest.raises(ValueError, match="Planner experiment"):
        batch.batch_commands("all", "saved", "data-engineer", 1, 1, resume=path, **{key: True})
