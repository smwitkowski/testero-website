"""Offline OpenRouter/CLI contract parity through native DSPy LM parsing.

Only ``litellm_completion`` is mocked. The compact fixture separates recorded
marker/usage excerpts from synthetic strict-type and higher-cap regressions.
No test demonstrates live model recovery or makes a provider/model call.
"""
import copy
import importlib
import json
from pathlib import Path
from unittest.mock import Mock

import dspy
from dspy.utils import DummyLM
from litellm import ModelResponse
import pytest

from shared import decision_planner as decisions
from shared import llm_generator as generator
from shared import openrouter_writer as writer
from shared.cli_models import _codex_response_schema, output_model, parse_output
from shared.evidence import check_evidence
from shared.llm_limits import MaxTokensTruncation


MODEL = "openrouter/offline/writer"
REPLAY = json.loads((Path(__file__).parent / "fixtures/openrouter_writer_replay.json").read_text())
SCOPE = {"objective_id": "4.1:1", "domain_prompt": "Select managed online prediction.",
         "cert_id": "machine-learning-engineer"}


@pytest.fixture(autouse=True)
def offline_writer_configuration(monkeypatch):
    # Never inherit real model capability settings or credentials in this suite.
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV, "{}")
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-placeholder-not-a-credential")


def structured(monkeypatch):
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV,
                       json.dumps({MODEL: ["structured_outputs"]}))


def markers(output):
    return DummyLM([output])(messages=[{"role": "user", "content": "offline"}])[0]


def native(monkeypatch, output, *, finish_reason="stop", usage=None,
           native_finish_reason=None):
    completion = output if isinstance(output, str) else markers(output)
    choice = {"index": 0, "finish_reason": finish_reason,
              "message": {"role": "assistant", "content": completion}}
    if native_finish_reason is not None:
        choice["native_finish_reason"] = native_finish_reason
    response = ModelResponse(model="offline", choices=[choice], usage=usage or {
        "prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2})
    transport = Mock(return_value=response)
    monkeypatch.setattr(importlib.import_module("dspy.clients.lm"),
                        "litellm_completion", transport)
    # The real LM constructor, forward path, warning hook and adapters still run.
    original_factory = generator._generation_lm
    instances = []
    def factory(model, max_tokens=32000):
        lm = original_factory(model, max_tokens=max_tokens)
        instances.append(lm)
        return lm
    spy = Mock(side_effect=factory)
    monkeypatch.setattr(generator, "_generation_lm", spy)
    return transport, spy, instances


def request(transport):
    call = transport.call_args
    return call.kwargs.get("request", call.args[0] if call.args else None)


def question():
    return copy.deepcopy(REPLAY["synthetic_question"])


def with_receipts():
    return {**question(), "evidence": copy.deepcopy(REPLAY["synthetic_receipts"])}


def question_inputs():
    return {"domain_context": "Select managed online prediction.",
            "documentation_context": "Vertex AI serves deployed model predictions online.",
            "difficulty": "MEDIUM", "exam_subsection": "", "gap_analysis_guidance": ""}


def plan():
    return {"objective_id": SCOPE["objective_id"],
            "engineering_decision": "Choose online prediction hosting",
            "business_consequence": "Keep predictions available",
            "existing_system": "A deployed model", "decisive_constraints": ["Reduce upkeep"],
            "best_action": "Deploy a managed endpoint", "mistakes": [
                {"action": "Host an object", "scenario_reason": "Does not run inference"},
                {"action": "Run batch SQL", "scenario_reason": "Does not serve online requests"},
                {"action": "Use dashboards", "scenario_reason": "Does not serve predictions"}]}


def sources():
    import hashlib
    receipt = REPLAY["synthetic_receipts"][0]
    return [{"url": receipt["url"], "requested_url": receipt["url"],
             "text": receipt["quote"], "retrieved_at": "2026-10-05T00:00:00Z",
             "text_sha256": hashlib.sha256(receipt["quote"].encode()).hexdigest()}]


def proof():
    return {"supported": True, "uniquely_best": True, "scenario_reasons_supported": True,
            "no_feature_gotchas": True, "reason": "Explicit synthetic supported fixture.",
            "reasons": [{**row, "scenario_reason": "Synthetic scenario reason."}
                        for row in copy.deepcopy(REPLAY["synthetic_receipts"])]}


@pytest.mark.parametrize("parameter", ["structured_outputs", "response_format"])
@pytest.mark.parametrize("configured_model", [MODEL, MODEL.removeprefix("openrouter/")])
def test_capability_map_supports_both_model_id_spellings(monkeypatch, parameter, configured_model):
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV, json.dumps({configured_model: [parameter]}))
    assert writer.supports_structured_output(MODEL)


@pytest.mark.parametrize("configured", [{}, {"offline/writer": ["temperature"]},
                                        {"other/model": ["response_format"]}])
def test_unknown_or_unsupported_model_uses_chat_without_discovery(monkeypatch, configured):
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV, json.dumps(configured))
    transport, _, _ = native(monkeypatch, with_receipts())
    assert not writer.supports_structured_output(MODEL)
    result = generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL)
    assert result == with_receipts()
    assert "response_format" not in request(transport)
    assert transport.call_count == 1


@pytest.mark.parametrize("configured", ["not-json", "[]", "null", '{"offline/writer":true}',
                                        '{"offline/writer":[1]}'])
def test_invalid_capability_map_fails_before_transport(monkeypatch, configured):
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV, configured)
    transport, factory, _ = native(monkeypatch, with_receipts())
    with pytest.raises(ValueError, match="configuration"):
        generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL)
    factory.assert_not_called()
    transport.assert_not_called()


@pytest.mark.parametrize("signature,output,inputs", [
    (generator.PmleQuestionSignature, question(), question_inputs()),
    (generator.QuestionWithEvidenceSignature, with_receipts(), question_inputs()),
    (decisions.DecisionPlanSignature, {"plan": plan()},
     {"objective_scope": "Scope", "difficulty": "MEDIUM", "replacement_feedback": "", "existing_scenarios": "[]"}),
    (decisions.DecisionProofSignature, proof(),
     {"objective_scope": "Scope", "proposed_plan": "{}", "fetched_documentation": "Docs"}),
])
def test_json_is_one_call_with_exact_cli_schema(monkeypatch, signature, output, inputs):
    structured(monkeypatch)
    def forbidden(*args, **kwargs):
        raise AssertionError("No capability discovery or JSONAdapter retry is allowed")
    import litellm
    monkeypatch.setattr(litellm, "get_supported_openai_params", forbidden)
    monkeypatch.setattr(dspy.JSONAdapter, "__call__", forbidden)
    transport, factory, instances = native(monkeypatch, json.dumps(output))
    with dspy.context(disable_history=True):
        result = generator._predict_writer(signature, inputs, MODEL)
    assert result == parse_output(json.dumps(output), signature) == output
    response_format = request(transport)["response_format"]
    assert response_format == {"type": "json_schema", "json_schema": {
        "name": "writer_output", "strict": True,
        "schema": _codex_response_schema(output_model(signature).model_json_schema())}}
    assert request(transport)["max_tokens"] == 32000
    assert transport.call_args.kwargs["num_retries"] == 0
    factory.assert_called_once_with(MODEL, max_tokens=32000)
    assert transport.call_count == 1
    assert instances[0].history == []


@pytest.mark.parametrize("completion", [
    '```json\n{"stem":"private-answer"}\n```',
    '{"stem":"private-answer","stem":"duplicate"}',
    '{"stem":NaN}', '{"stem":Infinity}', '{"stem":"private-answer",}',
    '[{"stem":"private-answer"}]', '[[ ## stem ## ]]\nprivate-answer',
])
def test_json_rejects_nonexact_json_once_and_keeps_values_private(monkeypatch, completion):
    structured(monkeypatch)
    transport, _, _ = native(monkeypatch, completion)
    with pytest.raises(generator.GenerationOutputError) as caught:
        generator._predict_writer(generator.PmleQuestionSignature, question_inputs(), MODEL)
    error = caught.value
    assert error.raw_response is None
    assert "raw_response" not in error.diagnostics
    assert error.diagnostics["validation_errors"]
    assert "private-answer" not in json.dumps(error.diagnostics)
    assert "private-answer" not in str(error)
    assert transport.call_count == 1


@pytest.mark.parametrize("path,value,error_type", [
    (["stem"], 123, "string_type"),
    (["evidence"], "private-answer", "list_type"),
    (["evidence", 0, "quote"], 123, "string_type"),
    (["evidence", 0, "url"], False, "string_type"),
    (["evidence", 0, "option_label"], 123, "string_type"),
])
def test_json_strict_validation_paths_are_synthetic_and_private(monkeypatch, path, value, error_type):
    assert "Synthetic regression only" in REPLAY["provenance"]["validation_paths"]
    output = with_receipts()
    target = output
    for part in path[:-1]:
        target = target[part]
    target[path[-1]] = value
    structured(monkeypatch)
    transport, _, _ = native(monkeypatch, json.dumps(output))
    with pytest.raises(generator.GenerationOutputError) as caught:
        generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL)
    error = caught.value
    assert error.diagnostics["validation_errors"] == [{"path": path, "type": error_type}]
    assert error.raw_response is None
    assert "raw_response" not in error.diagnostics
    assert "private-answer" not in json.dumps(error.diagnostics)
    assert "private-answer" not in str(error)
    assert transport.call_count == 1


def test_missing_and_extra_fields_have_safe_paths(monkeypatch):
    output = with_receipts()
    del output["correct_answer"]
    output["private_answer"] = "PRIVATE ANSWER VALUE"
    structured(monkeypatch)
    transport, _, _ = native(monkeypatch, json.dumps(output))
    with pytest.raises(generator.GenerationOutputError) as caught:
        generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL)
    assert caught.value.diagnostics["validation_errors"] == [
        {"path": ["correct_answer"], "type": "missing"},
        {"path": ["<extra>"], "type": "extra_forbidden"}]
    serialized = json.dumps(caught.value.diagnostics)
    assert "private_answer" not in serialized and "PRIVATE ANSWER VALUE" not in serialized
    assert caught.value.raw_response is None and transport.call_count == 1


def test_real_marker_slip_replays_as_veto_not_a_fabricated_pass(monkeypatch):
    case = REPLAY["recorded_marker_slip"]
    assert case["raw_response"].endswith("[[ ## completed ##]]")
    transport, _, _ = native(monkeypatch, case["raw_response"], **case["diagnostics"])
    with dspy.context(disable_history=True):
        result = decisions.verify_decision(SCOPE, plan(), sources(), model=MODEL)
    assert result["supported"] is False and result["passed"] is False
    assert result["reasons"] == []
    assert "not directly supported" in result["reason"]
    assert "response_format" not in request(transport)
    assert transport.call_count == 1


@pytest.mark.parametrize("include_evidence", [False, True])
@pytest.mark.parametrize("cap", [None, 48000])
@pytest.mark.parametrize("protocol", ["chat", "json"])
def test_public_generation_budget_and_native_fallback_receipts(monkeypatch, include_evidence, cap, protocol):
    output = with_receipts() if include_evidence else question()
    if protocol == "json":
        structured(monkeypatch)
        completion = json.dumps(output)
    else:
        if not include_evidence:
            output = {"reasoning": "Synthetic reasoning", **output}
        # Flexible markers use the existing base normalizer, not a retry.
        completion = markers(output).replace("[[ ##", "[[##").replace("## ]]", "##]]")
    transport, factory, _ = native(monkeypatch, completion)
    options = {} if cap is None else {"max_tokens": cap}
    with dspy.context(disable_history=True):
        result = generator.generate_question("Scope", "Docs", MODEL,
                                             include_evidence=include_evidence, **options)
    assert result == (with_receipts() if include_evidence else question())
    if include_evidence:
        # A real base OptionEvidence instance is not a StrictOptionEvidence.
        # Successful native replay proves strict validation received plain data.
        assert check_evidence(result["evidence"], sources())["passed"]
        assert all(isinstance(row, dict) for row in result["evidence"])
    assert request(transport)["max_tokens"] == (32000 if cap is None else cap)
    factory.assert_called_once_with(MODEL, max_tokens=32000 if cap is None else cap)
    assert transport.call_count == 1


@pytest.mark.parametrize("operation", ["plan", "verify"])
@pytest.mark.parametrize("cap", [None, 48000])
def test_public_decision_apis_use_shared_writer_and_budget(monkeypatch, operation, cap):
    output = {"plan": plan()} if operation == "plan" else proof()
    transport, factory, _ = native(monkeypatch, output)
    options = {} if cap is None else {"max_tokens": cap}
    if operation == "plan":
        assert decisions.plan_decision(SCOPE, model=MODEL, **options) == plan()
    else:
        result = decisions.verify_decision(SCOPE, plan(), sources(), model=MODEL, **options)
        assert result["passed"] is True and result["reasons"] == output["reasons"]
    factory.assert_called_once_with(MODEL, max_tokens=32000 if cap is None else cap)
    assert request(transport)["max_tokens"] == (32000 if cap is None else cap)
    assert transport.call_count == 1


def test_old_cap_recorded_reasoning_limit_remains_terminal(monkeypatch):
    case = REPLAY["recorded_token_limit"]
    assert case["error_class"] == "MaxTokensTruncation"
    assert case["diagnostics"]["usage"]["completion_tokens_details"]["reasoning_tokens"] == 7685
    # No real completion survived this artifact. A valid synthetic body proves
    # native length metadata remains terminal even if every field can parse.
    transport, factory, instances = native(monkeypatch, with_receipts(), **case["diagnostics"])
    with dspy.context(disable_history=True), pytest.raises(MaxTokensTruncation) as caught:
        generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL,
                                  max_tokens=case["max_tokens"])
    assert caught.value.diagnostics["finish_reason"] == "length"
    assert caught.value.diagnostics["usage"] == case["diagnostics"]["usage"]
    factory.assert_called_once_with(MODEL, max_tokens=8000)
    assert request(transport)["max_tokens"] == 8000
    assert transport.call_count == 1 and instances[0].history == []


@pytest.mark.parametrize("finish_reason,native_reason", [("length", None), ("stop", "MAX_TOKENS")])
def test_higher_cap_does_not_bypass_token_limit_guard(monkeypatch, finish_reason, native_reason):
    transport, _, _ = native(monkeypatch, with_receipts(), finish_reason=finish_reason,
                             native_finish_reason=native_reason)
    with pytest.raises(MaxTokensTruncation):
        generator._predict_writer(generator.QuestionWithEvidenceSignature, question_inputs(), MODEL)
    assert request(transport)["max_tokens"] == 32000
    assert transport.call_count == 1


def test_synthetic_success_at_higher_cap_is_not_live_recovery(monkeypatch):
    assert "not a recovered live completion" in REPLAY["provenance"]["higher_cap_success"]
    structured(monkeypatch)
    transport, factory, _ = native(monkeypatch, json.dumps(with_receipts()), usage={
        "prompt_tokens": 3813, "completion_tokens": 10000, "total_tokens": 13813,
        "completion_tokens_details": {"reasoning_tokens": 7685}})
    result = generator.generate_question_with_evidence("Scope", "Docs", MODEL)
    assert result == with_receipts()
    factory.assert_called_once_with(MODEL, max_tokens=32000)
    assert transport.call_count == 1


@pytest.mark.parametrize("cap", [0, -1, 3.5, True, "32000"])
def test_bad_budget_fails_without_transport(monkeypatch, cap):
    transport, _, _ = native(monkeypatch, question())
    with pytest.raises(ValueError, match="positive integer"):
        generator._predict_writer(generator.PmleQuestionSignature, question_inputs(), MODEL, max_tokens=cap)
    transport.assert_not_called()


@pytest.mark.parametrize("protocol", ["chat", "json"])
@pytest.mark.parametrize("signature,output,inputs,path,error_type", [
    (decisions.DecisionProofSignature, {**proof(), "supported": "private-answer"},
     {"objective_scope": "Scope", "proposed_plan": "{}", "fetched_documentation": "Docs"},
     ["supported"], "bool_type"),
    (decisions.DecisionPlanSignature,
     {"plan": {**plan(), "mistakes": [{"action": 123, "scenario_reason": "private-answer"},
                                      *plan()["mistakes"][1:]]}},
     {"objective_scope": "Scope", "difficulty": "MEDIUM", "replacement_feedback": "", "existing_scenarios": "[]"},
     ["plan", "mistakes", 0, "action"], "string_type"),
    (generator.QuestionWithEvidenceSignature,
     {**with_receipts(), "evidence": [{**REPLAY["synthetic_receipts"][0], "quote": 123}]},
     question_inputs(), ["evidence", 0, "quote"], "string_type"),
])
def test_both_adapters_validate_nested_types_without_raw_answer_leaks(
        monkeypatch, protocol, signature, output, inputs, path, error_type):
    if protocol == "json":
        structured(monkeypatch)
    completion = json.dumps(output) if protocol == "json" else markers(output)
    transport, _, _ = native(monkeypatch, completion)
    with pytest.raises(generator.GenerationOutputError) as caught:
        generator._predict_writer(signature, inputs, MODEL)
    assert caught.value.diagnostics["validation_errors"] == [{"path": path, "type": error_type}]
    assert caught.value.raw_response is None
    assert "raw_response" not in caught.value.diagnostics
    assert "private-answer" not in json.dumps(caught.value.diagnostics)
    assert transport.call_count == 1
    assert transport.call_args.kwargs["num_retries"] == 0


@pytest.mark.parametrize("protocol", ["chat", "json"])
def test_provider_failure_does_not_retry_or_expose_provider_text(monkeypatch, protocol):
    if protocol == "json":
        structured(monkeypatch)
    transport, _, _ = native(monkeypatch, question())
    transport.side_effect = RuntimeError("private-answer Authorization: Bearer private-credential")
    with pytest.raises(RuntimeError, match="Question generation request failed") as caught:
        generator._predict_writer(generator.PmleQuestionSignature, question_inputs(), MODEL)
    assert "private-answer" not in str(caught.value)
    assert "private-credential" not in str(caught.value)
    assert transport.call_count == 1
    assert transport.call_args.kwargs["num_retries"] == 0


def test_native_validation_diagnostics_reach_candidate_artifact(monkeypatch, tmp_path):
    """Keep the real writer failure and candidate serializer, stub other stages."""
    from click.testing import CliRunner
    from scripts import generate_pmle_questions as generate

    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    database = Mock()
    judge = Mock()
    cite = Mock()
    monkeypatch.setattr(generate, "database_client", database)
    monkeypatch.setattr(generate, "judge_three_gates", judge)
    monkeypatch.setattr(generate, "cite_question", cite)
    monkeypatch.setattr(generate, "search_objective_docs", Mock(return_value=sources()))
    monkeypatch.setattr(generate, "plan_decision", lambda scope, **kwargs:
                        {**plan(), "objective_id": scope["objective_id"]})
    monkeypatch.setattr(generate, "check_plan_near_duplicate", lambda *args, **kwargs: {"passed": True})
    monkeypatch.setattr(generate, "verify_decision", lambda *args, **kwargs:
                        {**proof(), "passed": True, "mechanical_check": {"passed": True, "errors": []}})
    monkeypatch.setattr(generate, "writer_decision_context", lambda *args: "Scope")
    monkeypatch.setattr(generate, "writer_documentation_context", lambda *args, **kwargs: "Docs")
    monkeypatch.setenv(writer.MODEL_PARAMETERS_ENV,
                       json.dumps({generate.DEFAULT_GENERATOR_MODEL: ["structured_outputs"]}))
    invalid = with_receipts()
    invalid["stem"] = "PRIVATE ANSWER CONTENT"
    invalid["evidence"][0]["quote"] = 123
    transport, _, _ = native(monkeypatch, json.dumps(invalid))
    # Do not stub generate_question or manufacture GenerationOutputError: the
    # mocked native provider response must create the actual validation failure.
    artifact = tmp_path / "pilot.json"
    outcome = CliRunner().invoke(generate.main, ["--n-questions", "1", "--dry-run",
                                               "--artifact", str(artifact)])
    assert outcome.exit_code == 1, outcome.output
    payload_text = artifact.read_text()
    payload = json.loads(payload_text)
    assert len(payload["candidates"]) == 1
    candidate = payload["candidates"][0]
    assert candidate["accepted"] is False
    assert candidate["error_class"] == "GenerationOutputError"
    assert candidate["diagnostics"]["validation_errors"] == [
        {"path": ["evidence", 0, "quote"], "type": "string_type"}]
    assert "raw_response" not in candidate
    assert "raw_response" not in candidate["diagnostics"]
    assert "PRIVATE ANSWER CONTENT" not in payload_text + outcome.output
    database.assert_not_called()
    judge.assert_not_called()
    cite.assert_not_called()
    assert transport.call_count == 1
    assert transport.call_args.kwargs["num_retries"] == 0
