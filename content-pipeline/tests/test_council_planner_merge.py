"""Both merged CLI/config feature sets coexist; all work stays offline."""
from datetime import datetime, timezone
import json
import sys

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts import pipeline_nightly as nightly
from scripts import run_domain_batch as batch
from shared import prompt_pack
from test_ab_control_pack import packs


def test_codex_generation_freezes_planner_flags_and_both_ab_packs(tmp_path, monkeypatch):
    (control_path, challenger_path), (control, _) = packs(tmp_path)
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    artifact = tmp_path / "combined.json"
    result = CliRunner().invoke(generate.main, [
        "--n-questions", "2", "--model", "codex", "--judge-model", "external", "--argon-gate",
        "--second-seat-transport", "codex", "--plan-freshness-lint", "--scenario-hint-cap",
        "--prompt-pack", str(challenger_path), "--ab-control-pack", str(control_path),
        "--ab-interleaved", "--ab-experiment", "combined", "--plan-only", "--artifact", str(artifact)])
    assert result.exit_code == 0, result.output
    payload = json.loads(artifact.read_text())
    assert payload["second_seat_transport"] == "codex"
    assert payload["plan_freshness_lint"] is payload["scenario_hint_cap"] is True
    assert payload["ab_control_pack"]["sha256"] == prompt_pack.pack_hash(control)
    assert payload["ab_experiment"]["control_sha256"] == payload["ab_control_pack"]["sha256"]


def test_batch_and_nightly_keep_planner_flags_generation_only_with_codex(tmp_path, monkeypatch):
    (control_path, challenger_path), _ = packs(tmp_path)
    options = dict(second_seat_transport="codex", plan_freshness_lint=True, scenario_hint_cap=True,
                   prompt_pack=challenger_path, ab_control_pack=control_path,
                   ab_interleaved=True, ab_experiment="combined")
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    _, _, commands = batch.batch_commands("1.", "combined", "machine-learning-engineer", 2, 1, **options)
    generation, judge, ingest = commands
    for flag in ("--second-seat-transport", "--plan-freshness-lint", "--scenario-hint-cap", "--ab-control-pack"):
        assert flag in generation
    assert judge[judge.index("--second-seat-transport") + 1] == "codex"
    assert "--full-gate-sample" in judge
    for command in (judge, ingest):
        assert all(flag not in command for flag in ("--plan-freshness-lint", "--scenario-hint-cap", "--ab-control-pack"))
    commands = nightly.commands_for_batch(
        {"cert": "machine-learning-engineer", "section": "1.", "count": 2}, "combined",
        state_dir=tmp_path, tools=tmp_path, **options)
    generation, publish = [command for _, command in commands]
    assert all(flag in generation for flag in ("--second-seat-transport", "--plan-freshness-lint",
                                               "--scenario-hint-cap", "--ab-control-pack"))
    assert "--health-state" in publish
    assert all(flag not in publish for flag in ("--plan-freshness-lint", "--scenario-hint-cap", "--ab-control-pack"))


def test_nightly_json_propagates_both_feature_sets_without_external_work(tmp_path):
    now = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
    config = {"calls_root": str(tmp_path / "calls"), "health_artifacts": ["accepted.json"],
              "gold_artifacts": ["gold.json"], "batches": 1, "count": 2,
              "second_seat_transport": "codex", "plan_freshness_lint": True, "scenario_hint_cap": True,
              "prompt_pack": "challenger.json", "ab_control_pack": "control.json",
              "ab_interleaved": True, "ab_experiment": "combined"}
    report = nightly.nightly(config, coverage={"complete": True, "captured_at": now.isoformat(), "questions": []},
                             tools=tmp_path / "tools", state_dir=tmp_path / "state", now=now,
                             execute=lambda *_a, **_k: pytest.fail("Offline preview must not execute"))
    generation = next(command for name, command in report["commands"] if name == "generate-judge-ingest")
    assert generation[generation.index("--second-seat-transport") + 1] == "codex"
    assert generation[generation.index("--ab-control-pack") + 1] == "control.json"
    assert "--plan-freshness-lint" in generation and "--scenario-hint-cap" in generation
    assert not (tmp_path / "state").exists()


def test_nightly_cli_can_override_all_merged_keys_together(tmp_path, monkeypatch):
    config_path, coverage = tmp_path / "config.json", tmp_path / "coverage.json"
    config_path.write_text(json.dumps({"second_seat_transport": "openrouter", "plan_freshness_lint": False,
                                       "scenario_hint_cap": False, "ab_control_pack": "old.json"}))
    coverage.write_text("{}")
    captured = []
    monkeypatch.setattr(nightly, "nightly", lambda config, **_: captured.append(config) or {"status": "planned"})
    monkeypatch.setattr(sys, "argv", ["pipeline_nightly", "--config", str(config_path), "--coverage", str(coverage),
                                     "--tools-dir", str(tmp_path), "--state-dir", str(tmp_path),
                                     "--second-seat-transport", "codex", "--plan-freshness-lint",
                                     "--scenario-hint-cap", "--ab-control-pack", "new.json", "--print"])
    assert nightly.main() == 0
    assert captured[0]["second_seat_transport"] == "codex"
    assert captured[0]["plan_freshness_lint"] is captured[0]["scenario_hint_cap"] is True
    assert captured[0]["ab_control_pack"] == "new.json"
