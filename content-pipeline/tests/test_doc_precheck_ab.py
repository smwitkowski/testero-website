"""Offline command manifests never execute unless coordinator explicitly opts in."""
import json
from pathlib import Path
import pytest
from click.testing import CliRunner
from scripts import run_doc_precheck_ab as runner


def test_comparison_commands_keep_baseline_off_and_shadow_unblocked(monkeypatch, tmp_path):
    import shared.near_duplicates
    monkeypatch.setattr(shared.near_duplicates, "load_export", lambda *a, **kw: {"questions": []})
    monkeypatch.setattr(runner, "PIPELINE", tmp_path)
    directory, commands = runner.comparison_commands(tmp_path / "bank.json", "fresh")
    assert "--planner-doc-precheck" not in commands["baseline"]
    assert "--planner-doc-precheck" in commands["shadow"]
    assert "--doc-precheck-shadow" in commands["shadow"]
    assert "--doc-precheck-shadow" not in commands["treatment"]
    assert all("--judge-model" in value and "external" in value and "--argon-gate" in value for value in commands.values())
    assert not directory.exists()
    directory.mkdir(parents=True)
    with pytest.raises(ValueError, match="fresh tag"):
        runner.comparison_commands(tmp_path / "bank.json", "fresh")


def test_dry_manifest_never_runs_services(monkeypatch, tmp_path):
    bank = tmp_path / "bank.json"
    bank.write_text("[]")
    monkeypatch.setattr(runner, "comparison_commands", lambda *a: (tmp_path / "absent", {"baseline": ["forbidden"]}))
    monkeypatch.setattr(runner.subprocess, "run", lambda *a, **kw: pytest.fail("execution forbidden"))
    result = CliRunner().invoke(runner.main, ["--bank", str(bank), "--tag", "safe"])
    assert result.exit_code == 0
    assert json.loads(result.output)["execute"] is False
    assert not (tmp_path / "absent").exists()
