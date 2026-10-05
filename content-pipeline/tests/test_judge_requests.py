"""Offline request runner tests: no CLI processes, model calls or DB access."""
from concurrent.futures import ThreadPoolExecutor
import json
from threading import Barrier, Event, Lock

from click.testing import CliRunner
import pytest

from scripts import judge_requests as runner
from shared import cli_models as cli
from shared.quality_gate import ACCURACY_CHECKS, QuestionQualitySignature


def verdict(**changes):
    return {"verdict": "PASS", "score": 0.9, "reason": "Frozen evidence supports every check",
            **{name: True for name in ACCURACY_CHECKS}, **changes}


def request(ident="candidate-1", **changes):
    return {"candidate_id": ident, "objective_id": "cert:standard:1.1:1",
            "judge_prompt": "  Exact exported prompt\nDo not rewrite. 雲  ",
            "verdict_schema": cli.output_model(QuestionQualitySignature).model_json_schema(),
            "trimming": {"enabled": True, "windows": [[2, 8]]}, **changes}


@pytest.fixture
def dirs(tmp_path):
    requests, results = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    return requests, results


def save_request(directory, ident="candidate-1", **changes):
    payload = request(ident, **changes)
    (directory / (ident + ".json")).write_text(json.dumps(payload, ensure_ascii=False))
    return payload


def fake_backend(monkeypatch, function):
    monkeypatch.setattr(cli, "run_claude_request", function)


@pytest.mark.parametrize("judgment", ["PASS", "FAIL", "UNCERTAIN"])
def test_exact_prompt_schema_raw_keys_and_valid_negative_verdicts(monkeypatch, dirs, judgment):
    requests, results = dirs
    expected = save_request(requests)
    raw = verdict(verdict=judgment, score=1, business_context=judgment == "PASS")
    calls = []
    def fake(model, prompt, schema):
        calls.append(model)
        assert prompt == expected["judge_prompt"]
        assert schema == expected["verdict_schema"]
        return raw
    fake_backend(monkeypatch, fake)
    summary = runner.run_requests(requests, results, judge_model="claude/claude-sonnet-5-5")
    stored = json.loads((results / "candidate-1.json").read_text())
    assert stored == raw and set(stored) == set(QuestionQualitySignature.output_fields)
    assert type(stored["score"]) is int  # Save raw output, not parser-coerced floats.
    assert summary.completed == 1 and summary.failed == summary.remaining == 0
    assert calls == ["claude/claude-sonnet-5-5"]
    assert runner.run_requests(requests, results).skipped == 1
    assert len(calls) == 1


@pytest.mark.parametrize("existing", ["human-authored JSON", "{malformed", ""])
def test_skip_any_existing_verdict_before_reading_request(monkeypatch, dirs, existing):
    requests, results = dirs
    save_request(requests)
    (requests / "candidate-1.json").write_text("bad request")
    results.mkdir()
    destination = results / "candidate-1.json"
    destination.write_text(existing)
    fake_backend(monkeypatch, lambda *a: pytest.fail("Must not call backend"))
    assert runner.run_requests(requests, results).skipped == 1
    assert destination.read_text() == existing


@pytest.mark.parametrize("failure", [cli.CLIUsageLimitError, cli.CLIAuthError, cli.CLITimeoutError,
                                    cli.CLISchemaError, cli.CLIExitError, RuntimeError])
def test_safe_failure_classes_no_retry_and_resumable_success(monkeypatch, dirs, failure, capsys):
    requests, results = dirs
    save_request(requests)
    calls = []
    def fail(*args):
        calls.append(args)
        raise failure("SECRET environment/prompt/raw stderr")
    fake_backend(monkeypatch, fail)
    summary = runner.run_requests(requests, results)
    assert summary.failed == 1 and len(calls) == 1
    assert not (results / "candidate-1.json").exists()
    record = json.loads((results / ".failures/candidate-1.json").read_text())
    assert set(record) == {"candidate_id", "error_class", "message", "judge_model", "ts"}
    assert record["candidate_id"] == "candidate-1" and record["judge_model"] == "claude"
    assert record["error_class"] == ("RequestRunnerError" if failure is RuntimeError else failure.__name__)
    assert "SECRET" not in json.dumps(record) + capsys.readouterr().out
    fake_backend(monkeypatch, lambda *a: verdict())
    assert runner.run_requests(requests, results).completed == 1
    assert not (results / ".failures/candidate-1.json").exists()


@pytest.mark.parametrize("mutation", ["id", "empty_prompt", "missing_style", "missing_field", "extra", "schema_type"])
def test_invalid_requests_fail_before_backend(monkeypatch, dirs, mutation):
    requests, results = dirs
    data = request()
    if mutation == "id": data["candidate_id"] = "different-candidate"
    if mutation == "empty_prompt": data["judge_prompt"] = "   "
    if mutation == "missing_style":
        data["verdict_schema"]["properties"].pop("constraints_as_wants")
        data["verdict_schema"]["required"].remove("constraints_as_wants")
    if mutation == "missing_field": data.pop("trimming")
    if mutation == "extra": data["unexpected"] = True
    if mutation == "schema_type": data["verdict_schema"]["additionalProperties"] = 0
    (requests / "candidate-1.json").write_text(json.dumps(data))
    fake_backend(monkeypatch, lambda *a: pytest.fail("Invalid requests must not call backend"))
    assert runner.run_requests(requests, results).failed == 1
    record = json.loads((results / ".failures/candidate-1.json").read_text())
    assert record["candidate_id"] == "candidate-1" and record["error_class"] == "RequestValidationError"
    assert not (results / "different-candidate.json").exists()


@pytest.mark.parametrize("payload", ['{"candidate_id":"candidate-1","candidate_id":"other"}',
                                   '{"score":NaN}', 'not JSON'])
def test_strict_json(monkeypatch, dirs, payload):
    requests, results = dirs
    (requests / "candidate-1.json").write_text(payload)
    fake_backend(monkeypatch, lambda *a: pytest.fail("No backend call"))
    assert runner.run_requests(requests, results).failed == 1


def test_request_character_bound_is_exact(monkeypatch, dirs):
    requests, results = dirs
    data = request(judge_prompt="x")
    text = json.dumps(data, ensure_ascii=False)
    data["judge_prompt"] += "x" * (runner.REQUEST_CHARACTER_LIMIT - len(text))
    assert len(json.dumps(data, ensure_ascii=False)) == runner.REQUEST_CHARACTER_LIMIT
    (requests / "candidate-1.json").write_text(json.dumps(data, ensure_ascii=False))
    fake_backend(monkeypatch, lambda *a: verdict())
    assert runner.run_requests(requests, results).completed == 1
    (results / "candidate-1.json").unlink()
    data["judge_prompt"] += "x"
    (requests / "candidate-1.json").write_text(json.dumps(data, ensure_ascii=False))
    fake_backend(monkeypatch, lambda *a: pytest.fail("Oversized request must not call backend"))
    assert runner.run_requests(requests, results).failed == 1


@pytest.mark.parametrize("name", [".hidden", "bad.name", "bad name", "évil"])
def test_unsafe_filenames_never_become_undefined_ids(monkeypatch, dirs, name):
    requests, results = dirs
    (requests / (name + ".json")).write_text(json.dumps(request()))
    fake_backend(monkeypatch, lambda *a: pytest.fail("Unsafe filename must not call backend"))
    with pytest.raises(Exception, match="safe candidate IDs"):
        runner.run_requests(requests, results)
    assert not list(results.glob("*.json"))


@pytest.mark.parametrize("where", ["request", "requests_dir", "verdicts_dir", "failures", "lock"])
def test_symlink_inputs_and_output_infrastructure_rejected(monkeypatch, dirs, tmp_path, where):
    requests, results = dirs
    data = save_request(requests)
    results.mkdir()
    target = tmp_path / "target"
    if where == "request":
        target.write_text(json.dumps(data))
        (requests / "candidate-1.json").unlink()
        (requests / "candidate-1.json").symlink_to(target)
    elif where == "requests_dir":
        target.symlink_to(requests, target_is_directory=True)
        requests = target
    elif where == "verdicts_dir":
        target.symlink_to(results, target_is_directory=True)
        results = target
    elif where == "failures":
        target.mkdir()
        (results / ".failures").symlink_to(target, target_is_directory=True)
    else:
        target.write_text("lock target")
        (results / ".judge-requests.lock").symlink_to(target)
    fake_backend(monkeypatch, lambda *a: pytest.fail("Symlinks must not call backend"))
    if where == "request":
        assert runner.run_requests(requests, results).failed == 1
    else:
        with pytest.raises(Exception): runner.run_requests(requests, results)


def test_existing_dangling_verdict_symlink_is_skipped(monkeypatch, dirs, tmp_path):
    requests, results = dirs
    save_request(requests)
    results.mkdir()
    destination = results / "candidate-1.json"
    destination.symlink_to(tmp_path / "missing")
    fake_backend(monkeypatch, lambda *a: pytest.fail("Any existing verdict path must be skipped"))
    assert runner.run_requests(requests, results).skipped == 1 and destination.is_symlink()


@pytest.mark.parametrize("parallel", [1, 3, 4])
def test_bounded_incremental_concurrency(monkeypatch, dirs, parallel):
    requests, results = dirs
    for index in range(12): save_request(requests, f"candidate-{index:02}")
    barrier = Barrier(parallel)
    mutex = Lock()
    active = maximum = count = 0
    def fake(*args):
        nonlocal active, maximum, count
        with mutex:
            active += 1
            count += 1
            maximum = max(maximum, active)
        barrier.wait(timeout=5)
        with mutex: active -= 1
        return verdict()
    fake_backend(monkeypatch, fake)
    summary = runner.run_requests(requests, results, parallel=parallel)
    assert summary.completed == count == 12 and maximum == parallel


@pytest.mark.parametrize("parallel", [1, 3, 4])
def test_usage_stops_submitting_with_at_most_initial_parallel_calls(monkeypatch, dirs, parallel):
    requests, results = dirs
    for index in range(45): save_request(requests, f"candidate-{index:02}")
    barrier = Barrier(parallel)
    usage_recorded = Event()
    calls = []
    mutex = Lock()
    original_publish = runner._publish
    def publish(path, payload, **kwargs):
        if payload.get("error_class") == "CLIUsageLimitError": usage_recorded.set()
        return original_publish(path, payload, **kwargs)
    monkeypatch.setattr(runner, "_publish", publish)
    def fake(*args):
        with mutex:
            calls.append(args)
            number = len(calls)
        barrier.wait(timeout=5)
        if number == 1: raise cli.CLIUsageLimitError("SECRET usage stderr")
        assert usage_recorded.wait(timeout=5)
        return verdict()
    fake_backend(monkeypatch, fake)
    summary = runner.run_requests(requests, results, parallel=parallel)
    assert summary.usage_stopped and summary.failed == 1
    assert len(calls) == parallel and summary.completed == parallel - 1
    assert summary.remaining == 45 - parallel


@pytest.mark.parametrize("human_kind", ["file", "symlink"])
def test_manual_verdict_created_during_call_is_never_overwritten(monkeypatch, dirs, tmp_path, human_kind):
    requests, results = dirs
    save_request(requests)
    destination = results / "candidate-1.json"
    def fake(*args):
        if human_kind == "file": destination.write_text("human verdict")
        else:
            target = tmp_path / "human.json"
            target.write_text("human verdict")
            destination.symlink_to(target)
        return verdict()
    fake_backend(monkeypatch, fake)
    summary = runner.run_requests(requests, results)
    assert summary.skipped == 1 and destination.read_text() == "human verdict"
    assert not list(results.glob(".judge-*.tmp"))


def test_batch_lock_prevents_second_runner_call(monkeypatch, dirs):
    requests, results = dirs
    save_request(requests)
    entered, release = Event(), Event()
    calls = []
    def fake(*args):
        calls.append(args)
        entered.set()
        assert release.wait(timeout=5)
        return verdict()
    fake_backend(monkeypatch, fake)
    with ThreadPoolExecutor(max_workers=1) as executor:
        first = executor.submit(runner.run_requests, requests, results)
        try:
            assert entered.wait(timeout=5)
            with pytest.raises(Exception, match="already locked"):
                runner.run_requests(requests, results)
        finally:
            release.set()
        assert first.result(timeout=5).completed == 1
    assert len(calls) == 1


@pytest.mark.parametrize("raw", [{"verdict": "FAIL"}, verdict(extra="wrapper"),
                                 verdict(score="0.9"), verdict(score=float("nan")), []])
def test_invalid_backend_output_has_failure_only(monkeypatch, dirs, raw):
    requests, results = dirs
    save_request(requests)
    fake_backend(monkeypatch, lambda *a: raw)
    assert runner.run_requests(requests, results).failed == 1
    assert not (results / "candidate-1.json").exists()
    assert json.loads((results / ".failures/candidate-1.json").read_text())["error_class"] == "CLISchemaError"


@pytest.mark.parametrize("model", ["codex", "openrouter/anthropic/claude", "claude/", "claude/a/b",
                                   "claude/claude-opus-5", "claude/claude-sonnet-4-5"])
def test_claude_selectors_only(monkeypatch, dirs, model):
    requests, results = dirs
    fake_backend(monkeypatch, lambda *a: pytest.fail("Invalid selector"))
    with pytest.raises(Exception, match="Only claude"):
        runner.run_requests(requests, results, judge_model=model)


@pytest.mark.parametrize("parallel", [0, 5, -1, True, 3.0])
def test_parallel_range(monkeypatch, dirs, parallel):
    requests, results = dirs
    with pytest.raises(Exception, match="integer from 1 to 4"):
        runner.run_requests(requests, results, parallel=parallel)


def test_cli_defaults_limits_summary_and_nonzero_failures(monkeypatch, dirs):
    requests, results = dirs
    calls = []
    def fake_run(requests, verdicts, **kwargs):
        calls.append(kwargs)
        return runner.Summary(failed=1, usage_stopped=True)
    monkeypatch.setattr(runner, "run_requests", fake_run)
    command = ["--requests", str(requests), "--verdicts", str(results)]
    invocation = CliRunner().invoke(runner.main, command)
    assert invocation.exit_code == 1
    assert calls == [{"judge_model": "claude", "parallel": 3}]
    assert CliRunner().invoke(runner.main, command + ["--parallel", "5"]).exit_code == 2
    assert CliRunner().invoke(runner.main, ["--help"]).exit_code == 0


def test_usage_cli_exit_and_summary(monkeypatch, dirs):
    requests, results = dirs
    save_request(requests)
    def fake(*args): raise cli.CLIUsageLimitError("SECRET")
    fake_backend(monkeypatch, fake)
    invocation = CliRunner().invoke(runner.main, ["--requests", str(requests), "--verdicts", str(results)])
    assert invocation.exit_code == 1
    assert "completed=0 skipped=0 failed=1 remaining=0 usage-stopped=true" in invocation.output
    assert "candidate-1: CLIUsageLimitError" in invocation.output and "SECRET" not in invocation.output


def test_auth_failure_does_not_stop_batch_or_retry(monkeypatch, dirs):
    requests, results = dirs
    for index in range(7): save_request(requests, f"candidate-{index}")
    calls = []
    def fake(*args):
        calls.append(args)
        raise cli.CLIAuthError("SECRET login details")
    fake_backend(monkeypatch, fake)
    summary = runner.run_requests(requests, results, parallel=3)
    assert len(calls) == summary.failed == 7
    assert summary.remaining == 0 and not summary.usage_stopped
    assert len(list((results / ".failures").glob("*.json"))) == 7
    assert not list(results.glob("candidate-*.json"))


def test_failure_publication_does_not_follow_existing_symlink(monkeypatch, dirs, tmp_path):
    requests, results = dirs
    save_request(requests)
    failures = results / ".failures"
    failures.mkdir(parents=True)
    untouched = tmp_path / "untouched.json"
    untouched.write_text("human notes")
    record_path = failures / "candidate-1.json"
    record_path.symlink_to(untouched)
    def fake(*args): raise cli.CLITimeoutError("SECRET")
    fake_backend(monkeypatch, fake)
    assert runner.run_requests(requests, results).failed == 1
    assert not record_path.is_symlink()
    assert json.loads(record_path.read_text())["error_class"] == "CLITimeoutError"
    assert untouched.read_text() == "human notes"


def test_usage_latch_blocks_worker_still_reading_request(monkeypatch, dirs):
    requests, results = dirs
    save_request(requests, "candidate-0", judge_prompt="A")
    save_request(requests, "candidate-1", judge_prompt="B")
    reading_b, release_b, usage_latched = Event(), Event(), Event()
    original_read = runner._read_request
    original_publish = runner._publish
    calls = []

    def blocked_read(path, *args):
        if path.stem == "candidate-1":
            reading_b.set()
            assert release_b.wait(timeout=5)
        return original_read(path, *args)

    def published_usage(path, payload, **kwargs):
        if payload.get("error_class") == "CLIUsageLimitError":
            usage_latched.set()  # Failure publication is after the stop latch.
        return original_publish(path, payload, **kwargs)

    def fake(model, prompt, schema):
        calls.append(prompt)
        assert prompt == "A", "Worker B must not call after the usage stop"
        assert reading_b.wait(timeout=5)
        raise cli.CLIUsageLimitError("SECRET")

    monkeypatch.setattr(runner, "_read_request", blocked_read)
    monkeypatch.setattr(runner, "_publish", published_usage)
    fake_backend(monkeypatch, fake)
    with ThreadPoolExecutor(max_workers=1) as executor:
        batch = executor.submit(runner.run_requests, requests, results, parallel=2)
        try:
            assert usage_latched.wait(timeout=5)
        finally:
            release_b.set()
        summary = batch.result(timeout=5)
    assert calls == ["A"]
    assert summary.usage_stopped and summary.failed == 1
    assert summary.completed == summary.skipped == 0 and summary.remaining == 1
    assert not (results / "candidate-1.json").exists()
    assert not (results / ".failures/candidate-1.json").exists()
