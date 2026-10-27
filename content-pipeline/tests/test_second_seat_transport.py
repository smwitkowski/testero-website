"""Offline second-seat transport, frozen request and mocked CLI contracts."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
from threading import Event
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import judge_requests as runner, publish_batch as publisher
from shared import argon_gate as argon, cli_models as cli, nightly_budget
from shared.external_judge import (
    BLIND_ARGON_POLICY, build_request, canonical_sha256, require_publishable_request,
)
from test_external_generation import QUESTION, OBJECTIVE, receipts, source
from test_three_gates_v4 import bundle


def frozen(transport="codex", ident="candidate-1"):
    scope = {"objective_id": OBJECTIVE, "domain_prompt": "Frozen scope",
             "cert_id": "machine-learning-engineer"}
    request = build_request(ident, scope, QUESTION, [source()], receipts(),
        argon_gate=True, execution_policy=BLIND_ARGON_POLICY,
        second_seat_transport=transport)
    return scope, request


def outputs():
    return {**bundle(QUESTION), "review": {"verdict": "PASS", "key_correct": True,
        "other_defensible_option": False, "issues": [], "fix": "No changes needed"}}


def mocked_cli(monkeypatch, tmp_path, request, *, codex_error=None):
    """Mock only process execution; exercise the actual CLI schema and controls."""
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path / "cli")
    monkeypatch.setattr(cli, "CODEX_PACE_FILE", tmp_path / "pace")
    monkeypatch.setattr(cli, "CODEX_MIN_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(cli, "CODEX_RATE_BACKOFF_SECONDS", (0,))
    values = outputs()
    by_prompt = {gate["judge_prompt"]: values[name] for name, gate in request["gates"].items()}
    by_prompt.update({gate["judge_prompt"]: values["blind_solver" if name == "blind" else name]
                     for name, gate in request["argon"]["calls"].items()})
    calls = []
    def run(command, *, input, **kwargs):
        assert input in by_prompt  # No regenerated prompt, prefix or suffix.
        assert kwargs["check"] is False
        provider = "codex" if command[0] == "codex" else "claude"
        calls.append((provider, input))
        raw = by_prompt[input]
        if provider == "codex":
            assert command[command.index("-m") + 1] == "gpt-6.1-sol"
            schema = json.loads(Path(command[command.index("--output-schema") + 1]).read_text())
            expected = next(gate["verdict_schema"] for gate in request["argon"]["calls"].values()
                            if gate["judge_prompt"] == input)
            assert schema == cli._codex_response_schema(expected)
            if codex_error:
                return SimpleNamespace(returncode=1, stdout=json.dumps({"type": "error",
                    "error": {"message": codex_error}}), stderr="")
            Path(command[command.index("-o") + 1]).write_text(json.dumps(raw))
            return SimpleNamespace(returncode=0, stdout="", stderr="")
        assert json.loads(command[command.index("--json-schema") + 1]) == next(
            gate["verdict_schema"] for gate in request["gates"].values() if gate["judge_prompt"] == input)
        envelope = {"type": "result", "subtype": "success", "is_error": False,
                    "structured_output": raw}
        return SimpleNamespace(returncode=0, stdout=json.dumps(envelope), stderr="")
    monkeypatch.setattr(cli.subprocess, "run", run)
    return calls


def save(tmp_path, request):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir(exist_ok=True)
    (requests / (request["candidate_id"] + ".json")).write_text(json.dumps(request))
    return requests, verdicts


@pytest.mark.parametrize("transport,model", [("openrouter", argon.MODEL), ("codex", argon.CODEX_MODEL)])
def test_strict_transport_model_mapping(transport, model):
    assert argon.model_for_transport(transport) == model
    assert argon.transport_for_model(model) == transport
    assert argon.model_for_transport() == argon.MODEL


@pytest.mark.parametrize("value", [None, True, "", "CODEX", "claude", "codex/gpt-other", [], {}])
def test_unknown_transport_and_model_never_fallback(value):
    with pytest.raises(ValueError): argon.model_for_transport(value)
    with pytest.raises(ValueError): argon.transport_for_model(value)


@pytest.mark.parametrize("version", [1, 2, 3])
def test_frozen_request_switch_changes_only_model(version):
    args = (QUESTION, {"domain_prompt": "scope"}, "Frozen docs", receipts())
    default = argon.build_argon_request(*args, version=version, review_only=version == 2)
    explicit = argon.build_argon_request(*args, version=version, review_only=version == 2,
                                       second_seat_transport="openrouter")
    codex = argon.build_argon_request(*args, version=version, review_only=version == 2,
                                    second_seat_transport="codex")
    assert default == explicit
    assert codex == {**default, "model": argon.CODEX_MODEL}
    _, openrouter = frozen("openrouter")
    _, switched = frozen()
    assert switched == {**openrouter, "argon": {**openrouter["argon"], "model": argon.CODEX_MODEL}}
    require_publishable_request(switched)


def test_codex_cli_full_request_verdict_and_publication(monkeypatch, tmp_path):
    scope, request = frozen()
    requests, verdicts = save(tmp_path, request)
    calls = mocked_cli(monkeypatch, tmp_path, request)
    reserve = Mock(side_effect=AssertionError("Codex must not reserve paid budget"))
    monkeypatch.setattr(nightly_budget, "reserve_model", reserve)
    result = CliRunner().invoke(runner.main, ["--requests", str(requests), "--verdicts", str(verdicts),
        "--argon-gate", "--second-seat-transport", "codex", "--parallel", "1"])
    assert result.exit_code == 0, result.output
    raw = json.loads((verdicts / "candidate-1.json").read_text())
    assert [provider for provider, _ in calls] == ["claude"] * 3 + ["codex"] * 2
    assert raw["argon"]["model"] == argon.CODEX_MODEL
    assert raw["argon"]["request_sha256"] == canonical_sha256(request["argon"])
    assert argon.evaluate_argon(QUESTION, raw["argon"], request["argon"])[0]
    assert publisher.publication_errors(QUESTION, scope, request, raw) == []
    reserve.assert_not_called()
    assert (tmp_path / "pace").is_file()


@pytest.mark.parametrize("declared,setting", [("codex", "openrouter"), ("openrouter", "codex")])
@pytest.mark.parametrize("resumed", [False, True])
def test_request_setting_mismatch_before_calls_or_resume_skip(monkeypatch, tmp_path, declared, setting, resumed):
    _, request = frozen(declared)
    requests, verdicts = save(tmp_path, request)
    if resumed:
        verdicts.mkdir()
        (verdicts / "candidate-1.json").write_text("existing verdict")
    monkeypatch.setattr(cli.subprocess, "run", Mock(side_effect=AssertionError("No CLI call")))
    monkeypatch.setattr(argon, "run_call", Mock(side_effect=AssertionError("No paid call")))
    summary = runner.run_requests(requests, verdicts, parallel=1, argon_gate=True,
                                  second_seat_transport=setting)
    assert summary.failed == 1 and summary.completed == summary.skipped == 0
    record = json.loads((verdicts / ".failures/candidate-1.json").read_text())
    assert record["error_class"] == "RequestValidationError"
    cli.subprocess.run.assert_not_called()
    argon.run_call.assert_not_called()
    if resumed: assert (verdicts / "candidate-1.json").read_text() == "existing verdict"


def test_verdict_model_must_match_its_own_request(monkeypatch, tmp_path):
    scope, request = frozen()
    mocked_cli(monkeypatch, tmp_path, request)
    second = argon.run_argon(request["argon"])
    raw = {**bundle(QUESTION), "argon": second}
    assert publisher.publication_errors(QUESTION, scope, request, raw) == []
    second["model"] = argon.MODEL
    with pytest.raises(cli.CLISchemaError, match="provenance"):
        argon.evaluate_argon(QUESTION, second, request["argon"])
    assert publisher.publication_errors(QUESTION, scope, request, raw)
    # Even matching the claimed model cannot reuse a different request hash.
    other = deepcopy(request["argon"])
    other["model"] = argon.MODEL
    with pytest.raises(cli.CLISchemaError, match="provenance"):
        argon.evaluate_argon(QUESTION, second, other)


@pytest.mark.parametrize("error", ["usage_limit_reached", "rate_limit_exceeded"])
def test_codex_limit_stops_remaining_candidates_without_review_or_budget(monkeypatch, tmp_path, error):
    _, request = frozen()
    requests, verdicts = save(tmp_path, request)
    for number in range(2, 5):
        extra = {**request, "candidate_id": f"candidate-{number}"}
        (requests / (extra["candidate_id"] + ".json")).write_text(json.dumps(extra))
    calls = mocked_cli(monkeypatch, tmp_path, request, codex_error=error)
    reserve = Mock(side_effect=AssertionError("No paid reservation"))
    monkeypatch.setattr(nightly_budget, "reserve_model", reserve)
    summary = runner.run_requests(requests, verdicts, parallel=1, argon_gate=True,
                                  second_seat_transport="codex")
    assert summary.usage_stopped and summary.failed == 1 and summary.remaining == 3
    assert not list(verdicts.glob("candidate-*.json"))
    record = json.loads((verdicts / ".failures/candidate-1.json").read_text())
    assert record["error_class"] == "CLIUsageLimitError" and record["sub_call"] == "argon.blind"
    assert [provider for provider, _ in calls] == ["claude"] * 3 + ["codex"] * (2 if "rate" in error else 1)
    assert all(prompt == request["argon"]["calls"]["blind"]["judge_prompt"]
               for provider, prompt in calls if provider == "codex")
    reserve.assert_not_called()


@pytest.mark.parametrize("bad", [None, "", "  ", 1])
def test_frozen_prompt_option_is_explicit_and_validated(monkeypatch, bad):
    never = Mock(side_effect=AssertionError("No CLI call"))
    monkeypatch.setattr(cli, "_run_cli", never)
    if bad is None:
        with pytest.raises(ValueError, match="combined"):
            cli.run_signature(argon.CODEX_MODEL, argon.ArgonReviewSignature,
                              {"input": "data"}, frozen_prompt="frozen")
    else:
        with pytest.raises(cli.CLISchemaError):
            cli.run_signature(argon.CODEX_MODEL, argon.ArgonReviewSignature, {}, frozen_prompt=bad)
    never.assert_not_called()


@pytest.mark.parametrize("waiting_stage", ["argon.blind", "claude.blind_solver"])
def test_parallel_usage_stop_refuses_new_codex_seats_and_partial_verdicts(monkeypatch, tmp_path, waiting_stage):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    claude_outputs = {}
    second_outputs = outputs()
    for ident in ("candidate-a", "candidate-b"):
        _, request = frozen(ident=ident)
        for name, gate in request["gates"].items():
            gate["judge_prompt"] = ident + " " + gate["judge_prompt"]
            claude_outputs[gate["judge_prompt"]] = (ident, name, second_outputs[name])
        for name, gate in request["argon"]["calls"].items():
            gate["judge_prompt"] = ident + " " + name
        (requests / (ident + ".json")).write_text(json.dumps(request))

    sibling_waiting, usage_published = Event(), Event()
    second_calls, bundles = [], []
    real_publish, real_bundle = runner._publish, argon.run_argon

    def publish(path, payload, **kwargs):
        if payload.get("error_class") == "CLIUsageLimitError":
            usage_published.set()  # The shared stop must already be latched.
        return real_publish(path, payload, **kwargs)

    def claude(model, prompt, schema):
        ident, name, raw = claude_outputs[prompt]
        if ident == "candidate-b" and waiting_stage == "claude." + name:
            sibling_waiting.set()
            assert usage_published.wait(timeout=5)
        return deepcopy(raw)

    def second(name, gate, *, model):
        assert model == argon.CODEX_MODEL
        ident = gate["judge_prompt"].split()[0]
        second_calls.append((ident, name))
        if ident == "candidate-a" and name == "blind":
            assert sibling_waiting.wait(timeout=5)
            raise cli.CLIUsageLimitError("Subscription exhausted")
        if ident == "candidate-b" and waiting_stage == "argon." + name:
            sibling_waiting.set()
            assert usage_published.wait(timeout=5)
        return deepcopy(second_outputs["blind_solver" if name == "blind" else name])

    def bundle(request, **kwargs):
        ident = request["calls"]["blind"]["judge_prompt"].split()[0]
        bundles.append(ident)
        return real_bundle(request, **kwargs)

    monkeypatch.setattr(runner, "_publish", publish)
    monkeypatch.setattr(cli, "run_claude_request", claude)
    monkeypatch.setattr(argon, "run_call", second)
    monkeypatch.setattr(argon, "run_argon", bundle)
    summary = runner.run_requests(requests, verdicts, parallel=2, argon_gate=True,
                                  second_seat_transport="codex", full_gate_sample=1)
    assert summary.usage_stopped and summary.failed == 1 and summary.remaining == 1
    assert summary.completed == summary.skipped == 0
    assert not list(verdicts.glob("candidate-*.json"))
    assert not (verdicts / ".failures/candidate-b.json").exists()
    assert ("candidate-b", "review") not in second_calls
    if waiting_stage == "claude.blind_solver":
        assert bundles == ["candidate-a"]  # Stop before entering the bundle.
        assert second_calls == [("candidate-a", "blind")]
    else:
        assert sorted(second_calls) == [("candidate-a", "blind"), ("candidate-b", "blind")]


def test_codex_usage_stop_latches_before_bundle_error_unwinds(monkeypatch, tmp_path):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    expected = outputs()
    claude_by_prompt = {}
    for ident in ("candidate-a", "candidate-b"):
        _, request = frozen(ident=ident)
        for name, gate in request["gates"].items():
            claude_by_prompt[gate["judge_prompt"]] = expected[name]
        for name, gate in request["argon"]["calls"].items():
            gate["judge_prompt"] = ident + " " + name
        (requests / (ident + ".json")).write_text(json.dumps(request))
    sibling_blind, error_unwound, sibling_refused = Event(), Event(), Event()
    real_bundle = argon.run_argon
    calls = []

    def second(name, gate, *, model):
        ident = gate["judge_prompt"].split()[0]
        calls.append((ident, name))
        if ident == "candidate-a":
            assert sibling_blind.wait(timeout=5)
            raise cli.CLIUsageLimitError("Subscription exhausted")
        assert name == "blind"  # Review must never be admitted.
        sibling_blind.set()
        assert error_unwound.wait(timeout=5)
        return deepcopy(expected["blind_solver"])

    def bundle(request, **kwargs):
        try:
            return real_bundle(request, **kwargs)
        except argon.ArgonCallError:
            # Hold A before runner.execute can catch its error or publish a
            # failure. B must already see the stop at the call boundary.
            error_unwound.set()
            assert sibling_refused.wait(timeout=5)
            raise
        except argon.ArgonNotAttempted:
            sibling_refused.set()
            raise

    monkeypatch.setattr(cli, "run_claude_request", lambda model, prompt, schema: deepcopy(claude_by_prompt[prompt]))
    monkeypatch.setattr(argon, "run_call", second)
    monkeypatch.setattr(argon, "run_argon", bundle)
    summary = runner.run_requests(requests, verdicts, parallel=2, argon_gate=True,
                                  second_seat_transport="codex", full_gate_sample=1)
    assert sibling_refused.is_set()
    assert summary.usage_stopped and summary.failed == summary.remaining == 1
    assert summary.completed == 0
    assert sorted(calls) == [("candidate-a", "blind"), ("candidate-b", "blind")]
    assert not list(verdicts.glob("candidate-*.json"))
    assert not (verdicts / ".failures/candidate-b.json").exists()
