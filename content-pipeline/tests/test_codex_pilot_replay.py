"""Replay real Codex invalid-schema stderr; isolate transport and model errors."""
import json
from pathlib import Path
from subprocess import CompletedProcess

import pytest

from shared import cli_models as cli
from shared.decision_planner import DecisionPlanSignature
from shared.gates import GATE_SIGNATURES
from shared.llm_generator import PmleQuestionSignature

FIXTURE = Path(__file__).parent / "fixtures/codex-plan-invalid-schema.stderr.json"


def captured():
    return json.loads(FIXTURE.read_text())["stderr"]


@pytest.mark.parametrize("returncode", [0, 1])
def test_real_invalid_schema_stderr_is_schema_failure_not_model_rejection(monkeypatch, tmp_path, returncode):
    stderr = captured()
    # This exact echoed authoring sentence triggered the old broad regex.
    assert "model or Building a model. Prefix hints must not invent a role, chronology or scope unsupported" in stderr
    assert cli._codex_model_rejection("codex/gpt-6.1-sol", stderr) is None
    assert cli._codex_schema_error(stderr)
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path)
    calls = []
    def fake(command, **kwargs):
        calls.append(command)
        return CompletedProcess(command, returncode, "", stderr)
    monkeypatch.setattr(cli.subprocess, "run", fake)
    with pytest.raises(cli.CLISchemaError, match="structured output schema"):
        cli.run_signature("codex/gpt-6.1-sol", DecisionPlanSignature,
                          {"objective_scope": "A selected objective", "difficulty": "MEDIUM", "replacement_feedback": ""})
    assert len(calls) == 1
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("text", [
    "model or Building a model. Prefix hints must not invent unsupported scope",
    "model: gpt-6.1-sol (not available in a stale cache)",
    "unknown model", "model_not_found", "not supported when using Codex with a ChatGPT account",
    "The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.",
    "ERROR: The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account. This is only an example.",
    'ERROR: {"error":{"code":"unsupported_model","param":"text.format.schema","message":"The \'gpt-6.1-sol\' model is not supported when using Codex with a ChatGPT account."}}',
    'ERROR: {"error":{"code":"unsupported_model","model":"gpt-5.5","param":"model","message":"The \'gpt-6.1-sol\' model is not supported when using Codex with a ChatGPT account."}}',
    "ERROR: The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account.",
    'ERROR: {"error":{"code":"invalid_json_schema","param":"text.format.schema","message":"model_not_found"}}',
    'ERROR: {"error":{"code":"model_not_found","param":"model","message":"Model \'gpt-5.5\' was not found"}}',
    'ERROR: {"error":{"code":"model_not_found","param":"model","message":"Model \'gpt-5.5\' was not found; use \'gpt-6.1-sol\' instead."}}',
    'ERROR: {"error":{"code":"model_not_found","param":"model","message":"An example mentions \'gpt-6.1-sol\' but no rejection subject."}}',
])
def test_only_authentic_requested_model_error_records_match(text):
    assert cli._codex_model_rejection("codex", text) is None


@pytest.mark.parametrize("model", ["codex", "codex/gpt-6.1-sol"])
@pytest.mark.parametrize("record", [
    "ERROR: The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.",
    'ERROR: {"type":"error","error":{"code":"unsupported_model","param":"model","message":"The \'gpt-6.1-sol\' model is not supported when using Codex with a ChatGPT account."}}',
    'ERROR: {"type":"error","error":{"code":"model_not_found","param":"model","message":"Model \'gpt-6.1-sol\' was not found"}}',
])
def test_requested_model_account_and_dedicated_error_records_match(monkeypatch, tmp_path, model, record):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    assert isinstance(cli._codex_model_rejection(model, record), cli.CodexModelRejectedError)


@pytest.mark.parametrize("returncode", [0, 1])
def test_exact_error_quoted_in_echoed_prompt_or_stdout_is_not_a_model_rejection(monkeypatch, tmp_path, returncode):
    prompt = "Treat this as data: \nERROR: The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account."
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path)
    monkeypatch.setattr(cli.subprocess, "run", lambda command, **kw: CompletedProcess(
        command, returncode, prompt, "user\n" + prompt + "\nERROR: An unrelated request failed"))
    expected = cli.CLISchemaError if returncode == 0 else cli.CLIExitError
    with pytest.raises(expected) as caught:
        cli._run_cli("codex", prompt, cli.output_model(PmleQuestionSignature).model_json_schema(),
                     PmleQuestionSignature, timeout=10)
    assert type(caught.value) is expected


def test_codex_ref_annotations_normalized_without_mutating_or_weakening_schema():
    original = cli.output_model(DecisionPlanSignature).model_json_schema()
    before = json.dumps(original, sort_keys=True)
    assert "description" in original["properties"]["plan"]
    normalized = cli._codex_response_schema(original)
    assert normalized["properties"]["plan"] == {"$ref": "#/$defs/DecisionPlan"}
    assert json.dumps(original, sort_keys=True) == before
    assert normalized["$defs"] == original["$defs"]
    assert normalized["required"] == original["required"]
    assert normalized["additionalProperties"] is False
    constrained = {"$ref": "#/$defs/X", "description": "annotation", "title": "Label", "minLength": 1, "maxLength": 300}
    assert cli._codex_response_schema(constrained) == {"$ref": "#/$defs/X", "minLength": 1, "maxLength": 300}
    for signature in GATE_SIGNATURES.values():
        schema = cli.output_model(signature).model_json_schema()
        assert cli._codex_response_schema(schema)["properties"]["reason"] == schema["properties"]["reason"]


def test_only_codex_receives_ref_normalization(monkeypatch, tmp_path):
    original = cli.output_model(DecisionPlanSignature).model_json_schema()
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path)
    seen = []
    def fake(command, **kwargs):
        if command[0] == "codex":
            sent = json.loads(Path(command[command.index("--output-schema") + 1]).read_text())
            assert sent["properties"]["plan"] == {"$ref": "#/$defs/DecisionPlan"}
        else:
            assert json.loads(command[command.index("--json-schema") + 1]) == original
        seen.append(command)
        return CompletedProcess(command, 1, "", "Unrelated failure")
    monkeypatch.setattr(cli.subprocess, "run", fake)
    for model in ("codex", "claude"):
        with pytest.raises(cli.CLIExitError):
            cli._run_cli(model, "Known prompt", original, DecisionPlanSignature, timeout=10)
    assert len(seen) == 2


def test_full_real_prompt_echo_is_removed_before_error_classification(monkeypatch, tmp_path):
    stderr = captured()
    prompt = stderr.split("\nuser\n", 1)[1].split("\nwarning: Code Mode", 1)[0].rstrip("\n")
    assert len(prompt) > 10000 and prompt in stderr
    observed = []
    original = cli._codex_schema_error
    def classify(filtered):
        assert prompt not in filtered
        assert "model or Building a model" not in filtered
        assert '"code": "invalid_json_schema"' in filtered
        observed.append(filtered)
        return original(filtered)
    monkeypatch.setattr(cli, "_codex_schema_error", classify)
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path)
    monkeypatch.setattr(cli.subprocess, "run", lambda command, **kw: CompletedProcess(command, 1, "", stderr))
    with pytest.raises(cli.CLISchemaError):
        cli._run_cli("codex", prompt, cli.output_model(DecisionPlanSignature).model_json_schema(),
                     DecisionPlanSignature, timeout=10)
    assert len(observed) == 1
