"""Offline coordinator coverage for the explicitly selected second-seat transport."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

import pytest

from scripts import pipeline_nightly as nightly
from shared import council_configuration as configuration

NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)


def config(tmp_path):
    return {"calls_root": str(tmp_path / "calls"), "health_artifacts": ["accepted.json"],
            "gold_artifacts": ["gold.json"]}


def snapshot():
    return {"complete": True, "captured_at": NOW.isoformat(), "questions": []}


def test_explicit_openrouter_command_plan_matches_absent_setting(tmp_path):
    args = dict(coverage=snapshot(), tools=tmp_path / "tools", state_dir=tmp_path / "state", now=NOW)
    absent = nightly.nightly(config(tmp_path), **args)
    explicit = nightly.nightly({**config(tmp_path), "second_seat_transport": "openrouter"}, **args)
    assert absent["commands"] == explicit["commands"]
    assert not any("--second-seat-transport" in command for _, command in absent["commands"])


def test_codex_plan_selects_every_model_phase_and_local_health_state(tmp_path):
    tools = tmp_path / "tools"
    result = nightly.nightly({**config(tmp_path), "second_seat_transport": "codex"},
                             coverage=snapshot(), tools=tools, state_dir=tmp_path / "state", now=NOW,
                             execute=lambda *_a, **_k: pytest.fail("Offline print cannot execute"))
    for name, command in result["commands"]:
        if name == "publish":
            assert command[command.index("--health-state") + 1] == str(tools / "council-health.json")
            assert command[command.index("--health-pause") + 1] == str(tools / "PIPELINE_PAUSED")
        else:
            assert command[command.index("--second-seat-transport") + 1] == "codex"
    assert not (tmp_path / "state").exists()


def test_codex_preflight_needs_no_openrouter_key_but_keeps_subscription_probes():
    injected = {key: "fixture" for key in nightly.REQUIRED_KEYS if key != "OPENROUTER_API_KEY"}
    seen = []
    nightly.preflight(environ=injected, second_seat_transport="codex", execute=lambda c: seen.append(c) or 0)
    assert len(seen) == 4
    assert seen[1] == ["codex", "login", "status"]
    with pytest.raises(ValueError, match="incomplete"):
        nightly.preflight(environ=injected, execute=lambda _: pytest.fail("Missing key must stop before probes"))


@pytest.mark.parametrize("transport", [None, "gemini", "CODEX", ""])
def test_invalid_transport_fails_before_external_work(tmp_path, transport):
    with pytest.raises(ValueError):
        nightly.nightly({**config(tmp_path), "second_seat_transport": transport}, coverage=snapshot(),
                        tools=tmp_path / "tools", state_dir=tmp_path / "state", now=NOW,
                        execute=lambda *_a, **_k: pytest.fail("Invalid config must not execute"))
    assert not (tmp_path / "state").exists()


def test_codex_readiness_is_required_after_monitors_before_generation(tmp_path, monkeypatch):
    value = {**config(tmp_path), "second_seat_transport": "codex"}
    tools = tmp_path / "tools"
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: snapshot())
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    ready_checks, seen = [], []
    def not_ready(**kwargs):
        ready_checks.append(kwargs)
        raise ValueError("Codex council health is not established")
    monkeypatch.setattr(configuration, "require_ready", not_ready)
    def execute(command, output=None):
        seen.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete": True, "pages": []}))
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=tmp_path / "state", now=NOW,
                             live=True, execute=execute, client=object())
    assert result["status"] == "checkpointed_stop"
    assert len(ready_checks) == 1
    assert ready_checks[0] == {"state": tools / "council-health.json", "pause": tools / "PIPELINE_PAUSED",
                               "second_seat_transport": "codex"}
    assert len([command for command in seen if "scripts.council_health" in command]) == 6
    assert not any("scripts.run_domain_batch" in c or "scripts.publish_batch" in c for c in seen)


def test_cli_can_override_config_without_mutating_config_file(tmp_path, monkeypatch, capsys):
    config_path, coverage_path = tmp_path / "config.json", tmp_path / "coverage.json"
    original = {**config(tmp_path), "second_seat_transport": "openrouter"}
    config_path.write_text(json.dumps(original))
    coverage_path.write_text(json.dumps(snapshot()))
    captured = []
    monkeypatch.setattr(nightly, "nightly", lambda config, **kwargs: captured.append(config) or {"status": "planned"})
    monkeypatch.setattr(sys, "argv", ["pipeline_nightly", "--config", str(config_path), "--coverage", str(coverage_path),
                                     "--tools-dir", str(tmp_path / "tools"), "--state-dir", str(tmp_path / "state"),
                                     "--second-seat-transport", "codex", "--print"])
    assert nightly.main() == 0
    assert captured[0]["second_seat_transport"] == "codex"
    assert json.loads(config_path.read_text()) == original
    assert json.loads(capsys.readouterr().out)["status"] == "planned"
