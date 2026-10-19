"""Offline replay of the actual policy-5 prelaunch request through the real CLI path.

Only the request is a round-5 capture. Positive outputs are explicitly synthetic.
The unmodified real Claude envelope is historical QuestionQuality output, not a
successful policy-5 capture; replay must reject it after the mocked transport.
"""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import Mock

import pytest

from scripts import judge_requests as runner
from shared import argon_gate as argon, cli_models as cli
from shared.distractor_evidence import evidence_policy
from shared.external_judge import canonical_sha256
from shared.gates import (aggregate_gate_verdict, blind_choice_map, evaluate_gate,
                          gate_signatures)


FIXTURES = Path(__file__).parent / "fixtures" / "cli_models"
REQUEST = FIXTURES / "round5-style-preflight-request.json"
PROVENANCE = FIXTURES / "round5-style-preflight-provenance.json"
HISTORICAL = FIXTURES / "judge-exported-output.json"
REQUEST_SHA256 = "19338bb946f4b24396a62d6dbeb96bd3fba6a15a05dedf8468d40ea1281225eb"
HISTORICAL_SHA256 = "94d3bdc059c89a7147ba7913c756194002b68f10232b7c129abeee44a006a0de"
NEW_CHECKS = {
    "style": ("moment_explains_discovery", "moment_fits_want", "no_unique_want_echo"),
    "evidence": ("industry_realism", "distractor_industry_losing_premises"),
}
CHECK_CASES = [(gate, field) for gate, fields in NEW_CHECKS.items() for field in fields]


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    """Install a process tripwire before every test, including preflight failures."""
    def forbidden(*args, **kwargs):
        pytest.fail("Offline replay must not start processes, models, retrieval or databases")

    monkeypatch.setattr(cli.subprocess, "run", forbidden)
    monkeypatch.setattr(cli, "CLI_TEMP_ROOT", tmp_path / "cli")
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr(cli, "run_signature", forbidden)
    monkeypatch.setattr(argon, "run_argon", forbidden)
    monkeypatch.setattr("shared.doc_search.search_objective_docs", forbidden)
    monkeypatch.setattr("supabase.create_client", forbidden)
    # Keep the production allowlist, transport, envelope parser and validator real.
    before = {path: path.read_bytes() for path in (REQUEST, PROVENANCE, HISTORICAL)}
    yield
    assert {path: path.read_bytes() for path in before} == before


@pytest.fixture
def captured_request():
    raw = REQUEST.read_bytes()
    metadata = json.loads(PROVENANCE.read_text())
    assert hashlib.sha256(raw).hexdigest() == REQUEST_SHA256 == metadata["request_sha256"]
    assert len(raw.decode("utf-8")) == 140753
    request = json.loads(raw)
    assert request["candidate_id"] == metadata["candidate_id"]
    assert request["variant_policy_version"] == 5
    assert request["variant_mode"] == 1
    assert metadata["failure_receipt"]["sub_call"] == "claude.style"
    assert metadata["failure_receipt"]["request_sha256"] == REQUEST_SHA256
    assert "before Claude launch" in metadata["diagnosis"]
    assert "No raw output exists" in metadata["diagnosis"]
    return request


def captured_question(request):
    """Decode the request's explicit question field as the real runner does."""
    prompt = request["gates"]["evidence"]["judge_prompt"].split("\n\nUSER:\n", 1)[-1]
    return json.JSONDecoder().raw_decode(prompt.split("[[ ## question_data ## ]]", 1)[1].lstrip())[0]


def synthetic_output(schema, *, choice="A"):
    """Create typed test data from the schema, never claim it is model evidence."""
    result = {}
    false_checks = {"generic_validation_key", "ambiguous_answers", "other_defensible_option"}
    for name, field in schema["properties"].items():
        if field["type"] == "boolean":
            result[name] = name not in false_checks
        elif name == "verdict":
            assert "PASS" in field["enum"]
            result[name] = "PASS"
        elif name == "choice":
            assert choice in field["enum"]
            result[name] = choice
        elif field["type"] == "number":
            result[name] = 0.95
        elif field["type"] == "string":
            result[name] = "Synthetic offline transport replay; no quality claim."
        elif field["type"] == "array":
            result[name] = []
        else:
            raise AssertionError(f"Unhandled synthetic schema field: {name}")
    assert set(result) == set(schema["required"])
    return result


def synthetic_envelope(output, *, fallback=None):
    return json.dumps({"type": "result", "subtype": "success", "is_error": False,
                       "structured_output": output,
                       "result": json.dumps(fallback) if fallback is not None else
                       "Not a verdict: the structured output alone is authoritative."})


def mock_transport(monkeypatch, gates, stdout_by_gate):
    """Replace only subprocess.run; match the exact frozen prompt and schema."""
    calls = []

    def run(command, **kwargs):
        assert Path(command[0]).name == "claude"
        assert command[command.index("--output-format") + 1] == "json"
        assert command[command.index("--tools") + 1] == ""
        assert "--safe-mode" in command and "--no-session-persistence" in command
        name = next(name for name, gate in gates.items()
                    if gate["judge_prompt"] == kwargs["input"])
        assert kwargs["input"] == gates[name]["judge_prompt"]
        assert command[command.index("--json-schema") + 1] == json.dumps(gates[name]["verdict_schema"])
        assert kwargs["text"] is True and kwargs["capture_output"] is True
        assert kwargs["check"] is False
        assert list(Path(kwargs["cwd"]).iterdir()) == []
        calls.append(name)
        return CompletedProcess(command, 0, stdout_by_gate[name], "")

    monkeypatch.setattr(cli.subprocess, "run", run)
    return calls


def replay_gate(request, name):
    gate = request["gates"][name]
    return cli.run_claude_request("claude", gate["judge_prompt"], gate["verdict_schema"])


@pytest.mark.parametrize("name", ["style", "evidence", "blind_solver"])
def test_actual_request_reaches_real_transport_with_exact_prompt_and_schema(
        monkeypatch, captured_request, name):
    request = captured_request
    signatures = gate_signatures(5, variant_policy_version=5)
    for gate_name, fields in NEW_CHECKS.items():
        schema = request["gates"][gate_name]["verdict_schema"]
        assert set(fields) <= set(schema["required"])
        assert all(schema["properties"][field]["type"] == "boolean" for field in fields)
    gate = request["gates"][name]
    assert gate["verdict_schema"] == cli.output_model(signatures[name]).model_json_schema()
    question = captured_question(request)
    choice = next(label for label, canonical in blind_choice_map(question).items() if canonical == "A")
    output = synthetic_output(gate["verdict_schema"], choice=choice)
    calls = mock_transport(monkeypatch, request["gates"], {name: synthetic_envelope(output)})
    assert replay_gate(request, name) == output
    assert calls == [name]
    assert evaluate_gate(name, output, question, variant=True, variant_policy_version=5,
                         style_policy=request.get("style_policy"))[0]
    if name == "style":
        assert output["generic_validation_key"] is False


@pytest.mark.parametrize("name", ["style", "evidence"])
def test_unmodified_real_historical_envelope_fails_closed_after_transport(
        monkeypatch, captured_request, name):
    historical = HISTORICAL.read_bytes()
    assert hashlib.sha256(historical).hexdigest() == HISTORICAL_SHA256
    envelope = json.loads(historical)
    assert envelope["type"] == "result" and envelope["subtype"] == "success"
    assert envelope["is_error"] is False
    assert len(envelope["structured_output"]) == 13
    assert set(NEW_CHECKS[name]).isdisjoint(envelope["structured_output"])
    calls = mock_transport(monkeypatch, captured_request["gates"], {name: historical.decode("utf-8")})
    # This is the output validator's error, NOT the allowlist's preflight error.
    with pytest.raises(cli.CLISchemaError, match="^CLI structured output does not match the schema$"):
        replay_gate(captured_request, name)
    assert calls == [name]
    assert HISTORICAL.read_bytes() == historical


@pytest.mark.parametrize("name,field", CHECK_CASES)
@pytest.mark.parametrize("defect", ["missing", "null", "string", "integer", "zero", "array"])
def test_every_new_check_is_required_and_strict_after_transport(
        monkeypatch, captured_request, name, field, defect):
    gate = captured_request["gates"][name]
    output = synthetic_output(gate["verdict_schema"])
    if defect == "missing":
        del output[field]
    else:
        output[field] = {"null": None, "string": "true", "integer": 1, "zero": 0, "array": []}[defect]
    fallback = synthetic_output(gate["verdict_schema"])
    calls = mock_transport(monkeypatch, captured_request["gates"],
                           {name: synthetic_envelope(output, fallback=fallback)})
    with pytest.raises(cli.CLISchemaError, match="^CLI structured output does not match the schema$"):
        replay_gate(captured_request, name)
    assert calls == [name]  # No retry, weaker-schema fallback or boolean coercion.


@pytest.mark.parametrize("name,field", CHECK_CASES)
def test_typed_false_new_checks_are_preserved_and_veto_pass(
        monkeypatch, captured_request, name, field):
    output = synthetic_output(captured_request["gates"][name]["verdict_schema"])
    output[field] = False
    calls = mock_transport(monkeypatch, captured_request["gates"], {name: synthetic_envelope(output)})
    parsed = replay_gate(captured_request, name)
    assert parsed == output and parsed[field] is False
    passed, reason = evaluate_gate(name, parsed, captured_question(captured_request),
                                   variant=True, variant_policy_version=5,
                                   style_policy=captured_request.get("style_policy"))
    assert not passed and field in reason
    assert calls == [name]


@pytest.mark.parametrize("name", ["style", "evidence", "blind_solver"])
def test_extra_output_keys_reject_without_result_fallback(monkeypatch, captured_request, name):
    output = synthetic_output(captured_request["gates"][name]["verdict_schema"])
    output["unexpected_check"] = True
    fallback = synthetic_output(captured_request["gates"][name]["verdict_schema"])
    calls = mock_transport(monkeypatch, captured_request["gates"],
                           {name: synthetic_envelope(output, fallback=fallback)})
    with pytest.raises(cli.CLISchemaError, match="^CLI structured output does not match the schema$"):
        replay_gate(captured_request, name)
    assert calls == [name]


@pytest.mark.parametrize("name", ["style", "evidence", "blind_solver"])
def test_valid_free_text_result_never_substitutes_for_missing_structured_output(
        monkeypatch, captured_request, name):
    output = synthetic_output(captured_request["gates"][name]["verdict_schema"])
    envelope = {"type": "result", "subtype": "success", "is_error": False,
                "result": json.dumps(output)}
    calls = mock_transport(monkeypatch, captured_request["gates"], {name: json.dumps(envelope)})
    with pytest.raises(cli.CLISchemaError, match="^Claude CLI omitted structured_output$"):
        replay_gate(captured_request, name)
    assert calls == [name]


@pytest.mark.parametrize("name", ["style", "evidence", "blind_solver"])
@pytest.mark.parametrize("defect", ["unknown", "extra_key", "description", "optional", "open_object"])
def test_full_schema_equality_rejects_any_schema_change_before_transport(
        monkeypatch, captured_request, name, defect):
    gate = captured_request["gates"][name]
    schema = deepcopy(gate["verdict_schema"])
    if defect == "unknown":
        schema = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}
    elif defect == "extra_key":
        schema["unexpected_metadata"] = True
    elif defect == "description":
        schema["properties"]["reason"]["description"] += " Changed rubric."
    elif defect == "optional":
        schema["required"].remove(NEW_CHECKS[name][0] if name in NEW_CHECKS else "reason")
    else:
        schema["additionalProperties"] = True
    transport = Mock(side_effect=AssertionError("Altered schemas must fail before subprocess.run"))
    monkeypatch.setattr(cli.subprocess, "run", transport)
    with pytest.raises(cli.CLISchemaError, match="supported strict gate schemas"):
        cli.run_claude_request("claude", gate["judge_prompt"], schema)
    transport.assert_not_called()


def test_generated_consistent_policy5_evidence_schema_is_allowlisted(monkeypatch, captured_request):
    signature = gate_signatures(5, variant_policy_version=5,
                                distractor_evidence=evidence_policy("consistent"))["evidence"]
    assert signature.__name__ == "VariantPolicy5ConsistentEvidenceReviewerSignature"
    schema = cli.output_model(signature).model_json_schema()
    assert set(NEW_CHECKS["evidence"]) <= set(schema["required"])
    prompt = cli.signature_prompt(signature, {
        "question_data": captured_question(captured_request),
        "domain_context": "Synthetic offline scope", "documentation_context": "Synthetic offline docs",
        "option_evidence": [],
    })
    gates = {"evidence": {"judge_prompt": prompt, "verdict_schema": schema}}
    output = synthetic_output(schema)
    calls = mock_transport(monkeypatch, gates, {"evidence": synthetic_envelope(output)})
    assert cli.run_claude_request("claude", prompt, schema) == output
    assert calls == ["evidence"]


def test_real_runner_selected_actual_request_completes_four_mocked_gates_then_caches(
        monkeypatch, tmp_path, captured_request):
    request = captured_request
    ident = request["candidate_id"]
    directory, verdicts = tmp_path / "replay.judge-requests", tmp_path / "verdicts"
    directory.mkdir()
    copied_request = directory / (ident + ".json")
    copied_request.write_bytes(REQUEST.read_bytes())
    # Selection must exclude another on-disk request, even one that is invalid.
    unselected = directory / "unselected.json"
    unselected.write_text("{}")
    question = captured_question(request)
    choice = next(label for label, canonical in blind_choice_map(question).items() if canonical == "A")
    outputs = {name: synthetic_output(gate["verdict_schema"], choice=choice)
               for name, gate in request["gates"].items()}
    calls = mock_transport(monkeypatch, request["gates"],
                           {name: synthetic_envelope(output) for name, output in outputs.items()})

    def mock_argon(argon_request):
        assert argon_request == request["argon"]
        calls.append("argon")
        return {"model": argon.MODEL, "version": argon_request["version"],
                "request_sha256": canonical_sha256(argon_request),
                **{name: synthetic_output(gate["verdict_schema"], choice=choice)
                   for name, gate in argon_request["calls"].items()}}

    monkeypatch.setattr(argon, "run_argon", mock_argon)
    first = runner.run_requests(directory, verdicts, candidate_ids=(ident,), parallel=1,
                                argon_gate=True, full_gate_sample=1)
    assert (first.completed, first.skipped, first.failed, first.remaining) == (1, 0, 0, 0)
    assert not first.usage_stopped
    assert calls == ["style", "evidence", "blind_solver", "argon"]
    published_path = verdicts / (ident + ".json")
    published = json.loads(published_path.read_text())
    assert {name: published[name] for name in outputs} == outputs
    assert aggregate_gate_verdict(question, outputs, variant=True, variant_policy_version=5,
                                  style_policy=request.get("style_policy")).passed
    assert argon.evaluate_argon(question, published["argon"], request["argon"])[0]
    assert not (verdicts / "unselected.json").exists()
    assert list((verdicts / ".failures").iterdir()) == []
    call_log = tmp_path / "replay.json.calls.jsonl"
    rows = [json.loads(line) for line in call_log.read_text().splitlines()]
    assert [row["stage"] for row in rows] == ["judge_style", "judge_evidence", "judge_blind"]
    assert all(row["ok"] is True and row["candidate_id"] == ident for row in rows)
    assert all(row["input_tokens"] is None for row in rows)  # No paid usage is claimed.
    frozen_outputs = {path: path.read_bytes() for path in (published_path, call_log, copied_request, unselected)}
    calls.clear()
    second = runner.run_requests(directory, verdicts, candidate_ids=(ident,), parallel=1,
                                 argon_gate=True, full_gate_sample=1)
    assert (second.completed, second.skipped, second.failed, second.remaining) == (0, 1, 0, 0)
    assert calls == []
    assert {path: path.read_bytes() for path in frozen_outputs} == frozen_outputs
    assert copied_request.read_bytes() == REQUEST.read_bytes()
