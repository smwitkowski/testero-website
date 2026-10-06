"""Offline native DSPy parsing with simulated provider token-limit metadata.

Finish reasons were not recorded in the live audit artifact. These tests simulate
metadata, not a recovered live verdict, and never turn truncated data into PASS.
"""
import hashlib
import json
from pathlib import Path
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
from shared.evidence import check_evidence
from shared.llm_limits import MaxTokensTruncation, TRUNCATION_REASON, reject_token_limit


@pytest.fixture
def question():
    return {
        "stem": "A team needs managed online predictions. Which service fits?",
        "correct_answer": "Vertex AI online prediction",
        "distractor_1": "Cloud Storage object hosting",
        "distractor_2": "BigQuery batch SQL queries",
        "distractor_3": "Cloud Monitoring metric dashboards",
        "correct_explanation": "Vertex AI serves deployed model predictions online.",
        "distractor_1_explanation": "Object hosting does not run model inference.",
        "distractor_2_explanation": "Batch SQL is not an online endpoint.",
        "distractor_3_explanation": "Metric dashboards do not serve predictions.",
    }


@pytest.fixture
def sources():
    text = "Vertex AI serves online predictions for deployed models."
    url = "https://docs.cloud.google.com/vertex-ai/docs/predictions/overview"
    return [{"url": url, "requested_url": url, "text": text,
             "retrieved_at": "2026-10-05T00:00:00Z",
             "text_sha256": hashlib.sha256(text.encode()).hexdigest()}]


def receipts(sources):
    return [{"option_label": label, "url": sources[0]["url"], "quote": sources[0]["text"]}
            for label in "ABCD"]


def judge_output():
    return {"verdict": "PASS", "score": 0.9, "reason": "Documented online predictions.",
            **{name: True for name in gate.ACCURACY_CHECKS}}


def native_lm(monkeypatch, output, finish_reason="stop", native_finish_reason=None):
    # DummyLM formats an actual native ChatAdapter completion. Only the native
    # LM transport boundary is stubbed; LM.forward/warning hook/parser are real.
    completion = output if isinstance(output, str) else DummyLM([output])(
        messages=[{"role": "user", "content": "offline"}])[0]
    choice = {"index": 0, "finish_reason": finish_reason,
              "message": {"role": "assistant", "content": completion}}
    if native_finish_reason is not None:
        choice["native_finish_reason"] = native_finish_reason
    response = ModelResponse(model="offline", choices=[choice],
                             usage={"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2})
    transport = Mock(return_value=response)
    import importlib
    lm_module = importlib.import_module("dspy.clients.lm")
    monkeypatch.setattr(lm_module, "litellm_completion", transport)
    lm = dspy.LM("openrouter/offline", max_tokens=8000, temperature=0.7, cache=False)
    return lm, transport


@pytest.mark.parametrize("reason,native_reason", [
    ("length", None), ("max_tokens", None), ("stop", "max_tokens"),
    ("stop", "MAX_TOKENS"), ("LENGTH", None),
])
def test_valid_receipts_rejected_on_token_limit(monkeypatch, question, sources, reason, native_reason):
    evidence = receipts(sources)
    assert check_evidence(evidence, sources)["passed"]
    lm, transport = native_lm(monkeypatch, {"evidence": evidence}, reason, native_reason)
    factory = Mock(return_value=lm)
    monkeypatch.setattr(generator, "_generation_lm", factory)
    with dspy.context(disable_history=True):
        result = generator.cite_question(question, sources, "openrouter/offline", max_tokens=16000)
    assert {key: result[key] for key in ("evidence", "parse_failure", "error_class")} == {
        "evidence": None, "parse_failure": TRUNCATION_REASON, "error_class": "MaxTokensTruncation"}
    assert result["diagnostics"]["raw_response"] == result["raw_response"]
    assert result["diagnostics"]["finish_reason"] == ("length" if reason == "max_tokens" else reason)
    factory.assert_called_once_with("openrouter/offline", max_tokens=16000)
    assert transport.call_count == 1
    assert lm.history == []  # Detection does not depend on SDK history.
    assert "[[ ## evidence ## ]]" in result["raw_response"]


def test_untruncated_receipts_keep_existing_shape(monkeypatch, question, sources):
    evidence = receipts(sources)
    lm, transport = native_lm(monkeypatch, {"evidence": evidence})
    monkeypatch.setattr(generator, "_generation_lm", Mock(return_value=lm))
    assert generator.cite_question(question, sources, "openrouter/offline") == {"evidence": evidence}
    assert transport.call_count == 1


@pytest.mark.parametrize("output", [judge_output(), {"verdict": "PASS"}])
def test_judge_token_limit_fails_even_for_valid_high_score(monkeypatch, question, output):
    lm, transport = native_lm(monkeypatch, output, "length")
    factory = Mock(return_value=lm)
    monkeypatch.setattr(gate.dspy, "LM", factory)
    monkeypatch.setattr(gate.os.environ, "get", lambda key, default=None: "offline-placeholder" if key == "OPENROUTER_API_KEY" else default)
    with dspy.context(disable_history=True):
        verdict = gate.judge_question(question, "ML", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL, max_tokens=4000)
    assert not verdict.passed and verdict.score == 0.0
    assert verdict.reason == TRUNCATION_REASON and verdict.error_class == "MaxTokensTruncation"
    assert verdict.diagnostics["finish_reason"] == "length"
    assert "[[ ## verdict ## ]]" in verdict.diagnostics["raw_response"]
    assert not gate.is_judge_passed(verdict.to_review_notes())
    assert set(json.loads(verdict.to_review_notes())[gate.REVIEW_NOTES_SOURCE]) == {
        "version", "passed", "score", "reason", "model"}
    assert transport.call_count == 1  # No hidden JSON retry or PASS recovery.
    assert factory.call_args.kwargs["max_tokens"] == 4000
    assert lm.history == []


def test_untruncated_native_judge_keeps_policy_and_shape(monkeypatch, question):
    lm, transport = native_lm(monkeypatch, judge_output())
    factory = Mock(return_value=lm)
    monkeypatch.setattr(gate.dspy, "LM", factory)
    monkeypatch.setattr(gate.os.environ, "get", lambda key, default=None: "offline-placeholder" if key == "OPENROUTER_API_KEY" else default)
    verdict = gate.judge_question(question, "ML", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert verdict.passed and verdict.error_class is None
    assert gate.is_judge_passed(verdict.to_review_notes())
    assert factory.call_args.kwargs["max_tokens"] == 2000
    assert transport.call_count == 1


def test_warning_only_truncation_precedes_successful_citation_parse(monkeypatch, question, sources, caplog):
    lm, transport = native_lm(monkeypatch, {"evidence": receipts(sources)}, "length")
    monkeypatch.setattr(generator, "_generation_lm", Mock(return_value=lm))
    with dspy.context(disable_history=True):
        result = generator.cite_question(question, sources, model="openrouter/offline")
    assert result["error_class"] == "MaxTokensTruncation" and result["evidence"] is None
    assert "truncated due to exceeding max_tokens" in caplog.text
    assert transport.call_count == 1


@pytest.mark.parametrize("exception_kind", ["typed", "untyped"])
def test_judge_provider_exception_never_reads_body(question, exception_kind):
    if exception_kind == "typed":
        error = LengthFinishReasonError(completion=SimpleNamespace(usage=None))
    else:
        error = RuntimeError("max_tokens PRIVATE Authorization: Bearer secret")
    verdict = gate.judge_question(question, "ML", documentation_context="Docs",
                                  predictor=Mock(side_effect=error))
    assert not verdict.passed and verdict.score == 0.0
    assert verdict.error_class == ("MaxTokensTruncation" if exception_kind == "typed" else None)
    assert "PRIVATE" not in verdict.to_review_notes() and "secret" not in verdict.to_review_notes()


def test_typed_provider_citation_exception_is_safe(monkeypatch, question, sources):
    error = LengthFinishReasonError(completion=SimpleNamespace(usage=None))
    monkeypatch.setattr(generator, "_generation_lm", Mock(return_value=DummyLM([])))
    monkeypatch.setattr(generator.dspy, "Predict", Mock(return_value=Mock(side_effect=error)))
    assert generator.cite_question(question, sources, "offline") == {
        "evidence": None, "parse_failure": TRUNCATION_REASON, "error_class": "MaxTokensTruncation"}


def test_guard_reads_only_finish_reasons_and_restores_hook():
    class Choice:
        finish_reason = "length"
        @property
        def message(self):
            raise AssertionError("Never inspect completion or transport fields")
    class LM:
        def _check_truncation(self, response):
            pass
    lm = LM()
    with pytest.raises(MaxTokensTruncation):
        with reject_token_limit(lm):
            lm._check_truncation({"choices": [Choice()]})
    assert "_check_truncation" not in lm.__dict__


def test_error_class_can_never_coexist_with_pass():
    with pytest.raises(ValueError, match="Invalid quality judge verdict"):
        gate.JudgeVerdict(True, 1.0, "Supported", "offline", error_class="MaxTokensTruncation")


def test_recorded_partial_live_completion_with_simulated_length_metadata(monkeypatch):
    fixture = json.loads((Path(__file__).parent / "fixtures" / "bank_audit_live_replay.json").read_text())
    assert "not recorded" in fixture["provenance"]["truncation_metadata"]
    case = next(case["recorded"] for case in fixture["cases"]
                if case["question_id"].startswith("bc566ee0"))
    # Real partial completion, but length metadata is explicitly simulated.
    # Never replace missing live receipts/rubric fields with synthetic PASS data.
    partial = next(attempt["raw_response"] for attempt in case["citation_attempts"]
                   if attempt.get("raw_response"))
    lm, transport = native_lm(monkeypatch, partial, "length")
    monkeypatch.setattr(generator, "_generation_lm", Mock(return_value=lm))
    with dspy.context(disable_history=True):
        result = generator.cite_question(case["question"], case["sources"], "openrouter/offline")
    assert result["evidence"] is None and result["parse_failure"] == TRUNCATION_REASON
    assert result["error_class"] == "MaxTokensTruncation"
    assert result["diagnostics"]["raw_response"] == partial
    assert transport.call_count == 1
    assert lm.history == []
