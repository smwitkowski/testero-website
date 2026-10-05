"""Offline contract tests: no generation, web clients, credentials or live LLMs."""

import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

# Direct pytest and ``python -m pytest`` both work from content-pipeline.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared import quality_gate as gate
from shared.model_policy import OPENROUTER_JUDGE_MODEL
from dspy.utils import DummyLM

REAL_DSPY_PREDICT = gate.dspy.Predict


@pytest.fixture(autouse=True)
def no_live_lm(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Live LM/environment access is forbidden in offline tests")
    monkeypatch.setattr(gate.dspy, "LM", forbidden)
    monkeypatch.setattr(gate.dspy, "Predict", forbidden)
    monkeypatch.setattr(gate.os.environ, "get", forbidden)


@pytest.fixture
def question():
    return {
        "stem": "A team needs managed online ML predictions. Which service fits?",
        "correct_answer": "Vertex AI online prediction",
        "distractor_1": "Cloud Storage object hosting",
        "distractor_2": "BigQuery batch SQL queries",
        "distractor_3": "Cloud Monitoring metric dashboards",
        "correct_explanation": "Vertex AI serves deployed model predictions online.",
        "distractor_1_explanation": "Object hosting does not run model inference.",
        "distractor_2_explanation": "Batch SQL is not the requested online endpoint.",
        "distractor_3_explanation": "Metric dashboards do not serve model predictions.",
    }


def output(**changes):
    values = {
        "verdict": "PASS", "score": 0.9,
        "reason": "Documentation supports one online prediction answer.",
        **{name: True for name in gate.ACCURACY_CHECKS},
    }
    values.update(changes)
    return SimpleNamespace(**values)


def judge(question, prediction=None, **kwargs):
    predictor = Mock(return_value=prediction if prediction is not None else output())
    result = gate.judge_question(
        question, "Managed ML model serving", documentation_context="Vertex AI documentation: online predictions serve deployed models.",
        predictor=predictor, **kwargs,
    )
    return result, predictor


def test_pass_and_exact_inputs(question):
    question["review_notes"] = "Do not send old notes to the judge"
    verdict, predictor = judge(question, model="openrouter/example/model")
    assert verdict == gate.JudgeVerdict(True, 0.9, output().reason, "openrouter/example/model")
    inputs = predictor.call_args.kwargs
    assert inputs["question_data"] == {key: question[key] for key in gate.QUESTION_FIELDS}
    assert "review_notes" not in inputs["question_data"]
    assert inputs["domain_context"] == "Managed ML model serving"
    assert "Vertex AI documentation" in inputs["documentation_context"]
    assert gate.is_judge_passed(verdict.to_review_notes())


@pytest.mark.parametrize("score,passed", [(0, False), (0.799999, False), (0.8, True), (1, True)])
def test_fixed_threshold(question, score, passed):
    verdict, _ = judge(question, output(score=score))
    assert verdict.passed is passed
    assert verdict.score == score


@pytest.mark.parametrize("check", gate.ACCURACY_CHECKS)
def test_each_accuracy_check_is_mandatory(question, check):
    verdict, _ = judge(question, output(**{check: False}, score=1.0))
    assert verdict.passed is False
    assert check in verdict.reason
    assert not gate.is_judge_passed(verdict.to_review_notes())


@pytest.mark.parametrize("status", ["FAIL", "UNCERTAIN"])
def test_nonpass_fails_even_with_high_score(question, status):
    verdict, _ = judge(question, output(verdict=status, score=1.0))
    assert not verdict.passed
    if status == "UNCERTAIN":
        assert "Uncertain" in verdict.reason


@pytest.mark.parametrize("changes", [
    {"verdict": "pass"}, {"verdict": "MAYBE"}, {"verdict": True},
    {"score": "0.9"}, {"score": True}, {"score": None},
    {"score": float("nan")}, {"score": float("inf")}, {"score": -0.01}, {"score": 1.01},
    {"correct_answer_accurate": "true"}, {"distractors_incorrect": 1},
    {"reason": " "}, {"reason": None}, {"reason": 1},
])
def test_malformed_output_fails_closed(question, changes):
    verdict, _ = judge(question, output(**changes))
    assert not verdict.passed
    assert verdict.score == 0.0


@pytest.mark.parametrize("field", ["verdict", "score", "reason", *gate.ACCURACY_CHECKS])
def test_missing_output_field_fails_closed(question, field):
    prediction = output()
    delattr(prediction, field)
    verdict, _ = judge(question, prediction)
    assert not verdict.passed
    assert verdict.score == 0.0


def test_exception_fails_closed_without_leaking_secrets(question):
    predictor = Mock(side_effect=RuntimeError("secret-key-and-request-payload"))
    verdict = gate.judge_question(question, "ML", documentation_context="Docs", predictor=predictor)
    assert not verdict.passed
    assert verdict.score == 0.0
    assert "secret" not in verdict.reason


@pytest.mark.parametrize("context,docs", [("ML", ""), ("ML", " "), ("ML", None), ("", "Docs"), (None, "Docs")])
def test_missing_evidence_or_scope_never_calls_predictor(question, context, docs):
    predictor = Mock()
    verdict = gate.judge_question(question, context, documentation_context=docs, predictor=predictor)
    assert not verdict.passed
    predictor.assert_not_called()


@pytest.mark.parametrize("field", gate.QUESTION_FIELDS)
def test_missing_question_field_never_calls_predictor(question, field):
    del question[field]
    verdict, predictor = judge(question)
    assert not verdict.passed
    predictor.assert_not_called()


@pytest.mark.parametrize("question_data", [None, [], "stem"])
def test_invalid_question_never_calls_predictor(question_data):
    verdict, predictor = judge(question_data)
    assert not verdict.passed
    predictor.assert_not_called()


def test_duplicate_options_never_calls_predictor(question):
    question["distractor_1"] = "  VERTEX AI online   prediction "
    verdict, predictor = judge(question)
    assert not verdict.passed
    predictor.assert_not_called()


def test_reason_is_short_single_line(question):
    verdict, _ = judge(question, output(reason="Specific supporting fact.\n" * 40))
    assert verdict.passed
    assert len(verdict.reason) == gate.MAX_REASON_LENGTH
    assert "\n" not in verdict.reason


def test_notes_envelope_is_exact():
    verdict = gate.JudgeVerdict(True, 0.8, "Supported by docs", gate.DEFAULT_JUDGE_MODEL)
    assert json.loads(verdict.to_review_notes()) == {
        "content_pipeline_judge": {"version": 1, "passed": True, "score": 0.8,
                                   "reason": "Supported by docs", "model": gate.DEFAULT_JUDGE_MODEL}
    }


@pytest.mark.parametrize("notes", [None, "", "PASS", "null", "[]", "{}", "true", "{invalid", {"passed": True}])
def test_legacy_and_invalid_notes_never_pass(notes):
    assert not gate.is_judge_passed(notes)


@pytest.mark.parametrize("changes", [
    {"version": 0}, {"version": 2}, {"version": True}, {"version": "1"},
    {"passed": False}, {"passed": "true"}, {"passed": 1},
    {"score": 0.79}, {"score": 1.1}, {"score": float("nan")},
    {"score": float("inf")}, {"score": "0.9"}, {"score": True},
    {"reason": ""}, {"reason": None}, {"reason": "x" * 301},
    {"model": ""}, {"model": None},
])
def test_review_notes_strict_fields(changes):
    data = {"version": 1, "passed": True, "score": 0.9, "reason": "Grounded", "model": "model"}
    data.update(changes)
    assert not gate.is_judge_passed(json.dumps({gate.REVIEW_NOTES_SOURCE: data}))


@pytest.mark.parametrize("field", ["version", "passed", "score", "reason", "model"])
def test_incomplete_notes_do_not_pass(field):
    data = json.loads(gate.JudgeVerdict(True, 0.9, "Grounded", "model").to_review_notes())
    del data[gate.REVIEW_NOTES_SOURCE][field]
    assert not gate.is_judge_passed(json.dumps(data))


def test_duplicate_json_keys_do_not_pass():
    notes = '{"content_pipeline_judge":{"version":1,"passed":false,"passed":true,"score":0.9,"reason":"Grounded","model":"model"}}'
    assert not gate.is_judge_passed(notes)


@pytest.mark.parametrize("changes", [{"passed": "true"}, {"score": float("nan")}, {"score": 0.7}, {"reason": ""}, {"model": ""}])
def test_invalid_verdict_cannot_be_serialized(changes):
    data = {"passed": True, "score": 0.9, "reason": "Grounded", "model": "model"}
    data.update(changes)
    with pytest.raises(ValueError, match="Invalid quality judge verdict"):
        gate.JudgeVerdict(**data)


def test_production_path_uses_typed_signature_and_per_call_lm(question, monkeypatch):
    lm = object()
    make_lm = Mock(return_value=lm)
    predictor = Mock(return_value=output())
    make_predictor = Mock(return_value=predictor)
    monkeypatch.setattr(gate.os.environ, "get", lambda key: "offline-fake-credential")
    monkeypatch.setattr(gate.dspy, "LM", make_lm)
    monkeypatch.setattr(gate.dspy, "Predict", make_predictor)
    verdict = gate.judge_question(question, "ML", documentation_context="Docs", model="openrouter/test/model")
    assert verdict.passed
    make_predictor.assert_called_once_with(gate.QuestionQualitySignature)
    assert make_lm.call_args.kwargs["model"] == "openrouter/test/model"
    assert make_lm.call_args.kwargs["temperature"] == 0.0
    assert predictor.call_args.kwargs["lm"] is lm
    assert "config" not in predictor.call_args.kwargs


def test_missing_credentials_fail_closed_without_lm(question, monkeypatch):
    monkeypatch.setattr(gate.os.environ, "get", lambda key: None)
    verdict = gate.judge_question(question, "ML", documentation_context="Docs", model=OPENROUTER_JUDGE_MODEL)
    assert verdict == gate.JudgeVerdict(False, 0.0, "Judge credentials unavailable", OPENROUTER_JUDGE_MODEL)


def test_real_dspy_adapter_with_offline_lm(question, monkeypatch):
    """Exercise real typed parsing and direct lm= selection, not just a mock."""
    lm = DummyLM([vars(output())])
    monkeypatch.setattr(gate.os.environ, "get", lambda key, default=None: "offline-fake-credential" if key == "OPENROUTER_API_KEY" else default)
    monkeypatch.setattr(gate.dspy, "LM", lambda **kwargs: lm)
    monkeypatch.setattr(gate.dspy, "Predict", REAL_DSPY_PREDICT)
    verdict = gate.judge_question(question, "ML", documentation_context="Vertex AI documentation", model=OPENROUTER_JUDGE_MODEL)
    assert verdict.passed
    assert verdict.score == 0.9
    assert len(lm.history) == 1
