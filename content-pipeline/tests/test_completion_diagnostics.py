"""Offline failure diagnostics at the native LM and strict adapter boundaries."""

import importlib
import json
from types import SimpleNamespace
from unittest.mock import Mock

import dspy
from dspy.utils import DummyLM
from litellm import ModelResponse
from openai import LengthFinishReasonError
import pytest

from shared import llm_generator as generator
from shared import quality_gate as gate
from shared.model_policy import OPENROUTER_JUDGE_MODEL
from shared.completion_diagnostics import CompletionDiagnostics, MAX_RAW_RESPONSE, _safe_completion
from shared.llm_limits import MaxTokensTruncation, reject_token_limit


@pytest.fixture
def question():
    return {name: name + " documented question text" for name in generator.QUESTION_FIELDS}


def rubric(**updates):
    return {"verdict": "PASS", "score": 0.9, "reason": "Supported by supplied docs.",
            **{name: True for name in gate.ACCURACY_CHECKS}, **updates}


def install_native(monkeypatch, output, *, finish_reason="stop", native_finish_reason=None):
    completion = output if isinstance(output, str) else DummyLM([output])(
        messages=[{"role": "user", "content": "offline"}])[0]
    choice = {"index": 0, "finish_reason": finish_reason,
              "message": {"role": "assistant", "content": completion}}
    if native_finish_reason is not None:
        choice["native_finish_reason"] = native_finish_reason
    response = ModelResponse(model="offline", choices=[choice],
                             usage={"prompt_tokens": 7, "completion_tokens": 11, "total_tokens": 18})
    transport = Mock(return_value=response)
    lm_module = importlib.import_module("dspy.clients.lm")
    monkeypatch.setattr(lm_module, "litellm_completion", transport)
    lm = dspy.LM("openrouter/offline", max_tokens=8000, temperature=0.0, cache=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-placeholder")
    monkeypatch.setattr(gate.dspy, "LM", lambda **kwargs: lm)
    return lm, transport, completion


@pytest.mark.parametrize("updates", [
    {"verdict": "FAIL"}, {"verdict": "UNCERTAIN", "evidence_supported": False},
    {"score": 0.79}, {"distractors_incorrect": False},
])
def test_native_judge_failure_keeps_complete_actual_completion(monkeypatch, question, updates):
    lm, transport, completion = install_native(monkeypatch, rubric(**updates))
    with dspy.context(disable_history=True):
        verdict = gate.judge_question(question, "Objective", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert not verdict.passed
    assert verdict.diagnostics == {"raw_response": completion, "finish_reason": "stop",
                                   "usage": {"prompt_tokens": 7, "completion_tokens": 11, "total_tokens": 18}}
    assert "diagnostics" not in verdict.to_review_notes()
    assert "error_class" not in verdict.to_review_notes()
    assert transport.call_count == 1 and lm.history == []


@pytest.mark.parametrize("output", [{"verdict": "PASS"}, rubric(score=float("nan")), rubric(verdict="UNKNOWN")])
def test_native_invalid_judge_output_has_actual_completion_no_retry(monkeypatch, question, output):
    lm, transport, completion = install_native(monkeypatch, output, native_finish_reason="STOP")
    with dspy.context(disable_history=True):
        verdict = gate.judge_question(question, "Objective", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert not verdict.passed and verdict.score == 0
    assert verdict.diagnostics["raw_response"] == completion
    assert verdict.diagnostics["finish_reason"] == "stop"
    assert verdict.diagnostics["native_finish_reason"] == "STOP"
    assert transport.call_count == 1 and lm.history == []


def test_judge_does_not_normalize_glued_markers(monkeypatch, question):
    completion = DummyLM([rubric()])(messages=[{"role": "user", "content": "offline"}])[0]
    completion = completion.replace("PASS\n\n[[ ## score ## ]]", "PASS[[ ## score ## ]]")
    lm, transport, actual = install_native(monkeypatch, completion)
    verdict = gate.judge_question(question, "Objective", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert not verdict.passed and verdict.diagnostics["raw_response"] == actual
    assert transport.call_count == 1


def test_successful_native_judge_has_no_diagnostic_or_db_change(monkeypatch, question):
    lm, transport, completion = install_native(monkeypatch, rubric())
    verdict = gate.judge_question(question, "Objective", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert verdict == gate.JudgeVerdict(True, 0.9, "Supported by supplied docs.", OPENROUTER_JUDGE_MODEL)
    assert verdict.diagnostics is None
    assert json.loads(verdict.to_review_notes()) == {gate.REVIEW_NOTES_SOURCE: {
        "version": 1, "passed": True, "score": 0.9, "reason": "Supported by supplied docs.",
        "model": OPENROUTER_JUDGE_MODEL}}
    assert transport.call_count == 1


def test_question_parse_error_has_native_metadata_and_redacted_actual_completion(monkeypatch):
    body = "Actual completion\nAuthorization: Bearer fake-secret\nCookie: fake-cookie\n" + "x" * 23_000
    lm, transport, completion = install_native(monkeypatch, body, native_finish_reason="STOP")
    with dspy.context(disable_history=True), pytest.raises(generator.GenerationOutputError) as caught:
        generator.generate_question("Objective", "Docs")
    diagnostics = caught.value.diagnostics
    assert caught.value.raw_response == diagnostics["raw_response"]
    assert "Actual completion" in diagnostics["raw_response"]
    assert "fake-secret" not in str(diagnostics) and "fake-cookie" not in str(diagnostics)
    assert len(diagnostics["raw_response"]) == MAX_RAW_RESPONSE
    assert diagnostics["raw_response"].endswith("[TRUNCATED]")
    assert diagnostics["finish_reason"] == "stop" and diagnostics["native_finish_reason"] == "STOP"
    assert diagnostics["usage"]["total_tokens"] == 18
    assert transport.call_count == 1 and lm.history == []


def test_question_token_limit_stays_terminal_with_actual_completion(monkeypatch):
    output = {**{name: name + " text" for name in generator.QUESTION_FIELDS}, "reasoning": "Reason"}
    lm, transport, completion = install_native(monkeypatch, output, finish_reason="length")
    with pytest.raises(MaxTokensTruncation) as caught:
        generator.generate_question("Objective", "Docs")
    assert caught.value.diagnostics["raw_response"] == completion
    assert caught.value.diagnostics["finish_reason"] == "length"
    assert transport.call_count == 1


@pytest.mark.parametrize("value", [True, False, -1, float("nan"), float("inf"), -float("inf"), "12", None])
def test_metadata_ignores_invalid_numeric_usage_and_credential_finish_reason(value):
    capture = CompletionDiagnostics()
    capture.observe_native({"choices": [{"finish_reason": "Authorization: Bearer fake-secret",
                                         "native_finish_reason": "unrecognized_reason"}],
                            "usage": {"prompt_tokens": value, "completion_tokens": 2,
                                      "total_tokens": 2.5, "input_tokens": 0, "output_tokens": 1,
                                      "provider_body": "secret", "headers": {"Authorization": "secret"}}})
    assert capture.failure() == {"usage": {"completion_tokens": 2, "total_tokens": 2.5,
                                         "input_tokens": 0, "output_tokens": 1}}


def test_native_capture_never_reads_unapproved_fields_or_values():
    class Allowlisted:
        def __init__(self, values):
            self.values = values
        def __getattr__(self, name):
            if name not in self.values:
                raise AssertionError("Unapproved field: " + name)
            return self.values[name]
    usage = Allowlisted(dict(prompt_tokens=1, completion_tokens=2, total_tokens=3,
                             input_tokens=None, output_tokens=None, completion_tokens_details=None))
    choice = Allowlisted(dict(finish_reason="stop", native_finish_reason="STOP"))
    response = Allowlisted(dict(choices=[choice], usage=usage))
    capture = CompletionDiagnostics()
    capture.observe_native(response)
    assert capture.failure() == {"finish_reason": "stop", "native_finish_reason": "STOP",
                                 "usage": {"prompt_tokens": 1, "completion_tokens": 2, "total_tokens": 3}}


def test_native_typed_truncation_before_parse_keeps_only_redacted_completion():
    class LM:
        def _check_truncation(self, response):
            raise LengthFinishReasonError(completion=SimpleNamespace(usage=None))
    capture = CompletionDiagnostics()
    response = {"choices": [{"finish_reason": "length", "native_finish_reason": "MAX_TOKENS",
                             "message": {"content": "Actual partial output\npassword=fake-secret"}}],
                "usage": {"total_tokens": 2}, "provider_body": "PRIVATE", "headers": "PRIVATE"}
    lm = LM()
    with pytest.raises(MaxTokensTruncation) as caught:
        with reject_token_limit(lm, capture=capture):
            lm._check_truncation(response)
    assert caught.value.diagnostics["raw_response"] == "Actual partial output\n[REDACTED CREDENTIAL/HEADER]"
    assert "fake-secret" not in str(caught.value.diagnostics) and "PRIVATE" not in str(caught.value.diagnostics)
    assert "_check_truncation" not in lm.__dict__


def test_injected_judge_predictor_does_not_fabricate_actual_lm_diagnostics(question):
    for result in [SimpleNamespace(**rubric(verdict="FAIL")), SimpleNamespace(verdict="UNKNOWN")]:
        verdict = gate.judge_question(question, "Objective", documentation_context="Docs", predictor=Mock(return_value=result))
        assert not verdict.passed and verdict.diagnostics is None


def test_redaction_preserves_full_completion_below_cap_and_tail():
    body = "Actual first field\n" + "x" * 6000 + "\nActual final field\napi_key=fake-secret\nBearer fake-inline"
    raw = _safe_completion(body)
    assert "Actual final field" in raw and "fake-secret" not in raw and "fake-inline" not in raw
    assert "[TRUNCATED]" not in raw and len(raw) > 6000


def test_generator_instructions_require_grounded_explanations_decisive_constraints_and_exact_scope():
    instructions = generator.PmleQuestionSignature.instructions
    assert "Every technical claim in all four explanations" in instructions
    assert "one decisive constraint explicitly stated in the stem" in instructions
    assert "exact target registry objective, not a neighboring objective" in instructions
    assert "4.1:4" in instructions and "A/B testing or a canary" in instructions
    assert "rolling" in instructions and "alone does not test model-version comparison" in instructions


@pytest.mark.parametrize("kind", ["citation", "judge"])
def test_native_limit_completion_survives_sdk_error_before_parse(monkeypatch, question, kind):
    body = "Actual native partial completion\nAuthorization: Bearer fake-secret\n" + "x" * 5000
    lm, transport, completion = install_native(monkeypatch, body, finish_reason="length")
    lm._process_completion = Mock(side_effect=ValueError("PRIVATE SDK body fake-secret"))
    with dspy.context(disable_history=True):
        if kind == "judge":
            verdict = gate.judge_question(question, "Objective", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
            diagnostics = verdict.diagnostics
            assert verdict.error_class == "MaxTokensTruncation"
        else:
            monkeypatch.setattr(generator, "_generation_lm", Mock(return_value=lm))
            result = generator.cite_question(question, [{"url": "https://docs.cloud.google.com/test", "text": "Docs"}], "offline")
            diagnostics = result["diagnostics"]
            assert result["error_class"] == "MaxTokensTruncation"
    assert "Actual native partial completion" in diagnostics["raw_response"]
    assert len(diagnostics["raw_response"]) > 5000
    assert "fake-secret" not in str(diagnostics) and "PRIVATE" not in str(diagnostics)
    assert diagnostics["finish_reason"] == "length"
    assert transport.call_count == 1 and lm.history == []


def test_finite_integer_usage_does_not_overflow_diagnostics():
    capture = CompletionDiagnostics()
    capture.observe_native({"choices": [{"finish_reason": "stop"}],
                            "usage": {"prompt_tokens": 10 ** 1000, "completion_tokens": 2}})
    assert capture.failure() == {"finish_reason": "stop",
                                 "usage": {"prompt_tokens": 10 ** 1000, "completion_tokens": 2}}


@pytest.mark.parametrize("reasoning", [6000, 0, True, -1, float("nan"), float("inf"), "6000", None])
def test_reasoning_token_counter_is_allowlisted_without_hidden_text(reasoning):
    capture = CompletionDiagnostics()
    capture.observe_native({"choices": [{"finish_reason": "length"}], "usage": {
        "completion_tokens": 7996, "completion_tokens_details": {
            "reasoning_tokens": reasoning, "reasoning_content": "PRIVATE", "headers": "PRIVATE"}}})
    expected = {"completion_tokens": 7996}
    if type(reasoning) is int and reasoning >= 0:
        expected["completion_tokens_details"] = {"reasoning_tokens": reasoning}
    assert capture.failure() == {"finish_reason": "length", "usage": expected}
    assert "PRIVATE" not in str(capture.failure())


def test_generation_budget_is_16000_but_citation_default_unchanged(monkeypatch):
    output = {name: name + " text" for name in generator.QUESTION_FIELDS}
    lm = DummyLM([{**output, "reasoning": "Short"}])
    factory = Mock(return_value=lm)
    monkeypatch.setattr(generator, "_generation_lm", factory)
    assert generator.generate_question("Objective", "Docs", model="offline/model") == output
    factory.assert_called_once_with("offline/model", max_tokens=16000)
    assert generator.cite_question.__kwdefaults__["max_tokens"] == 8000
