import json
from concurrent.futures import ThreadPoolExecutor
from shared.call_logging import call_context, model_call, cli_usage, usage_fields


def test_unknown_and_claude():
    assert all(value is None for value in cli_usage("bad", provider="claude").values())
    usage = cli_usage(json.dumps({"usage": {"input_tokens": 10, "output_tokens": 2,
                                         "cache_read_input_tokens": 7}}), provider="claude")
    assert usage["input_tokens"] == 10
    assert usage["cached_input_tokens"] == 7
    assert usage["reasoning_tokens"] is None


def test_codex_official_documentation_sample():
    from pathlib import Path
    text = (Path(__file__).parent / "fixtures/codex-exec-docs.jsonl").read_text()
    result = cli_usage(text, provider="codex")
    assert result["input_tokens"] == 24763
    assert result["cached_input_tokens"] == 24448
    assert result["output_tokens"] == 122
    assert result["reasoning_tokens"] == 0


def test_codex_synthetic_event_fixture():
    # Synthetic event shape, not a recorded CLI capture or live validation.
    text = '\n'.join(json.dumps(row) for row in [
        {"type": "thread.started", "thread_id": "redacted"},
        {"type": "turn.completed", "usage": {"input_tokens": 80, "cached_input_tokens": 32,
                                               "output_tokens": 11}}])
    result = cli_usage(text, provider="codex")
    assert result["input_tokens"] == 80
    assert result["cached_input_tokens"] == 32
    assert result["output_tokens"] == 11
    assert result["reasoning_tokens"] is None


def test_context_failure_and_concurrency(tmp_path):
    path = tmp_path / "calls.jsonl"
    def run(index):
        with call_context(stage="generate", candidate_id=str(index), index=index, calls_path=path):
            try:
                with model_call("fixture") as usage:
                    usage["input_tokens"] = index
                    if index == 2:
                        raise ValueError("secret must not be logged")
            except ValueError:
                pass
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(run, range(6)))
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(rows) == 6
    assert {row["candidate_id"] for row in rows} == set(map(str, range(6)))
    failed = next(row for row in rows if row["index"] == 2)
    assert failed["ok"] is False and failed["error_class"] == "ValueError"
    assert "secret" not in path.read_text()
    assert all(row["output_tokens"] is None for row in rows)


def test_openrouter_usage():
    usage = usage_fields({"prompt_tokens": 23, "completion_tokens": 4,
                          "prompt_tokens_details": {"cached_tokens": 9}}, provider="openrouter")
    assert usage["input_tokens"] == 23
    assert usage["cached_input_tokens"] == 9
    assert usage["reasoning_tokens"] is None


def test_native_forward_usage_and_restore(tmp_path):
    from shared.call_logging import log_lm_calls
    class LM:
        def _check_truncation(self, response):
            pass
        def forward(self):
            self._check_truncation({"usage": {"prompt_tokens": 17, "completion_tokens": 3}})
            return "payload"
    lm = LM()
    path = tmp_path / "calls.jsonl"
    with call_context(stage="argon_review", calls_path=path), log_lm_calls(lm, "fixture"):
        assert lm.forward() == "payload"
        assert lm.forward() == "payload"
    assert "forward" not in lm.__dict__ and "_check_truncation" not in lm.__dict__
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(rows) == 2
    assert all(row["input_tokens"] == 17 and row["output_tokens"] == 3 for row in rows)


import pytest


@pytest.mark.parametrize("provider", ["claude", "codex"])
@pytest.mark.parametrize("failed", [False, True])
def test_cli_transport_usage_and_failure(monkeypatch, tmp_path, provider, failed):
    from subprocess import CompletedProcess
    import dspy
    from shared import cli_models as cli
    class Output(dspy.Signature):
        answer: str = dspy.OutputField()
    path = tmp_path / "calls.jsonl"
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path / "requests")
    def fake(command, **kwargs):
        if provider == "codex":
            assert "--json" in command
            from pathlib import Path
            Path(command[command.index("-o") + 1]).write_text('{"answer":"unchanged"}')
            stdout = json.dumps({"type":"turn.completed", "usage":{"input_tokens":13,"output_tokens":7}})
        else:
            stdout = json.dumps({"type":"result", "subtype":"success", "is_error":False,
                                 "structured_output":{"answer":"unchanged"},
                                 "usage":{"input_tokens":13,"output_tokens":7}})
        return CompletedProcess(command, 1 if failed else 0, stdout, "")
    monkeypatch.setattr(cli.subprocess, "run", fake)
    with call_context(stage="fixture", calls_path=path):
        if failed:
            with pytest.raises(cli.CLIExitError):
                cli._run_cli(provider, "fixture", cli.output_model(Output).model_json_schema(), Output, timeout=1)
        else:
            assert cli._run_cli(provider, "fixture", cli.output_model(Output).model_json_schema(), Output, timeout=1) == {"answer":"unchanged"}
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(rows) == 1
    assert rows[0]["input_tokens"] == 13 and rows[0]["output_tokens"] == 7
    assert rows[0]["ok"] is (not failed)
    assert rows[0]["error_class"] == ("CLIExitError" if failed else None)


def test_actual_dspy_lm_native_hook(monkeypatch, tmp_path):
    import dspy
    import litellm
    from shared.call_logging import log_lm_calls
    def fake(**kwargs):
        return litellm.ModelResponse(model="fixture", choices=[{"index":0,
            "message":{"role":"assistant", "content":"unchanged"}, "finish_reason":"stop"}],
            usage={"prompt_tokens":19,"completion_tokens":5,"total_tokens":24})
    monkeypatch.setattr(litellm, "completion", fake)
    lm = dspy.LM("openai/fixture", api_key="offline-fixture", cache=False, num_retries=0)
    path = tmp_path / "calls.jsonl"
    with call_context(stage="native", calls_path=path), log_lm_calls(lm, "fixture"):
        assert lm(prompt="offline fixture") == ["unchanged"]
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert len(rows) == 1
    assert rows[0]["input_tokens"] == 19 and rows[0]["output_tokens"] == 5


@pytest.mark.parametrize("code,kind", [("invalid_json_schema", "CLISchemaError"),
    ("unsupported_model", "CodexModelRejectedError"), ("rate_limit_exceeded", "CLIUsageLimitError"),
    ("authentication_error", "CLIAuthError")])
def test_codex_json_error_events(monkeypatch, tmp_path, code, kind):
    import dspy
    from subprocess import CompletedProcess
    from shared import cli_models as cli
    class Output(dspy.Signature):
        answer: str = dspy.OutputField()
    error = {"code": code, "message": code}
    if code == "unsupported_model":
        error.update(model=cli.DEFAULT_CODEX_MODEL, message=f"Model '{cli.DEFAULT_CODEX_MODEL}' is not supported")
        monkeypatch.setattr(cli.Path, "home", lambda: tmp_path)
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path / "requests")
    monkeypatch.setattr(cli.subprocess, "run", lambda command, **kwargs:
        CompletedProcess(command, 1, json.dumps({"type":"turn.failed", "error":error}), ""))
    path = tmp_path / "calls.jsonl"
    with call_context(calls_path=path), pytest.raises(getattr(cli, kind)):
        cli._run_cli("codex", "fixture", cli.output_model(Output).model_json_schema(), Output, timeout=1)
    records = [json.loads(line) for line in path.read_text().splitlines()]
    # Throttling (429) is retried with backoff; each attempt is logged, then the batch stops.
    expected = "CLIRateLimitError" if code == "rate_limit_exceeded" else kind
    assert len(records) == (3 if code == "rate_limit_exceeded" else 1)
    record = records[-1]
    assert record["ok"] is False and record["error_class"] == expected
    assert record["input_tokens"] is None
