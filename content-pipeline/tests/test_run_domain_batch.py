"""Offline runner contracts; commands are inspected, never executed."""
import pytest

from scripts import run_domain_batch as batch


@pytest.mark.parametrize("plan_only", [False, True])
def test_coordinator_commands_enable_safe_optimizations_only(monkeypatch, tmp_path, plan_only):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    _, export, commands = batch.batch_commands(
        "1.", "safe-defaults", "cloud-engineer", 4, 2, plan_only=plan_only,
    )
    generate = commands[0]
    assert "--doc-cache" in generate
    assert "--verify-stable-prefix" in generate
    assert "--no-doc-cache" not in generate
    assert "--no-verify-stable-prefix" not in generate
    assert all("--verify-retrieval" not in command for command in commands)
    assert ("--plan-only" in generate) is plan_only
    assert ("--existing-questions" in generate) is not plan_only
    if not plan_only:
        assert generate[generate.index("--existing-questions") + 1] == str(export)
        assert len(commands) == 3
    else:
        assert len(commands) == 1
