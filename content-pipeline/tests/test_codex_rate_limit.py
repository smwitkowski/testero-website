import json
import subprocess
import time

import pytest

from shared import cli_models
from shared.cli_models import CLIUsageLimitError


class Done(Exception):
    pass


@pytest.fixture
def fast(monkeypatch, tmp_path):
    monkeypatch.setattr(cli_models, "CODEX_RATE_BACKOFF_SECONDS", (0.0, 0.0))
    monkeypatch.setattr(cli_models, "CODEX_MIN_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(cli_models, "CODEX_PACE_FILE", tmp_path / "pace")
    sleeps = []
    monkeypatch.setattr(cli_models.time, "sleep", lambda s: sleeps.append(s))
    return sleeps


def fake_runs(monkeypatch, stderrs):
    """Each call fails with the next stderr; None means success (raise Done to stop before parsing)."""
    calls = []

    def run(command, **kwargs):
        calls.append(command)
        text = stderrs[len(calls) - 1]
        if text is None:
            raise Done()
        return subprocess.CompletedProcess(command, 1, stdout="", stderr=text)
    monkeypatch.setattr(cli_models.subprocess, "run", run)
    return calls


def call():
    from shared.quality_gate import QuestionQualitySignature
    schema = cli_models.output_model(QuestionQualitySignature).model_json_schema()
    return cli_models._run_cli("codex", "prompt", schema, QuestionQualitySignature, timeout=5)


def test_429_is_retried_then_succeeds(monkeypatch, fast):
    calls = fake_runs(monkeypatch, ["ERROR: exceeded retry limit, last status: 429 Too Many Requests", None])
    with pytest.raises(Done):
        call()
    assert len(calls) == 2 and fast == [0.0]


def test_persistent_429_stops_only_after_full_backoff(monkeypatch, fast):
    calls = fake_runs(monkeypatch, ["429 Too Many Requests"] * 3)
    with pytest.raises(CLIUsageLimitError, match="after backoff"):
        call()
    assert len(calls) == 3


def test_real_usage_limit_stops_immediately(monkeypatch, fast):
    calls = fake_runs(monkeypatch, ['ERROR: {"type": "usage_limit_reached"}'])
    with pytest.raises(CLIUsageLimitError, match="usage limit reached"):
        call()
    assert len(calls) == 1 and fast == []


def test_claude_is_not_retried(monkeypatch, fast):
    calls = fake_runs(monkeypatch, ["429 Too Many Requests"])
    from shared.quality_gate import QuestionQualitySignature
    schema = cli_models.output_model(QuestionQualitySignature).model_json_schema()
    with pytest.raises(cli_models.CLIModelError):
        cli_models._run_cli("claude", "prompt", schema, QuestionQualitySignature, timeout=5)
    assert len(calls) == 1


def test_pacing_spaces_call_starts(monkeypatch, tmp_path):
    monkeypatch.setattr(cli_models, "CODEX_PACE_FILE", tmp_path / "pace")
    monkeypatch.setattr(cli_models, "CODEX_MIN_INTERVAL_SECONDS", 3.0)
    sleeps = []
    monkeypatch.setattr(cli_models.time, "sleep", lambda s: sleeps.append(s))
    cli_models._pace_codex()
    cli_models._pace_codex()
    assert len(sleeps) == 1 and 2.5 < sleeps[0] <= 3.0
