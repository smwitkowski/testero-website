"""Offline style regressions; founder stems are voice examples, not answer keys."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from shared.llm_generator import PmleQuestionSignature, QuestionCorrectionSignature, FactualCorrectionSignature
from shared.question_style import (FOUNDER_EXEMPLARS, STYLE_RULES, STYLE_INSTRUCTIONS,
                                   LEGACY_STYLE_INSTRUCTIONS_V3, LEGACY_FOUNDER_EXEMPLARS)
from shared import quality_gate as gate
from shared.validator import validate_question

FIXTURE = json.loads((Path(__file__).parent / "fixtures/testero_style_stems.json").read_text())


def question(stem):
    # Synthetic options/rationales exercise schema only, not factual correctness.
    return dict(stem=stem, correct_answer="Deploy the existing managed service.",
                distractor_1="Build a custom server for the application.",
                distractor_2="Move the workload to a batch job.",
                distractor_3="Remove the model from the application.",
                correct_explanation="The managed service meets the stated goal without maintaining a custom server.",
                distractor_1_explanation="A custom server fails the requirement for minimal maintenance.",
                distractor_2_explanation="A batch job fails the requirement for online requests.",
                distractor_3_explanation="Removing the model fails the requirement to keep predictions available.")


@pytest.mark.parametrize("signature", [PmleQuestionSignature, QuestionCorrectionSignature, FactualCorrectionSignature])
def test_all_rules_and_five_exact_founder_exemplars_reach_all_signatures(signature):
    assert STYLE_INSTRUCTIONS in signature.instructions
    assert len(FOUNDER_EXEMPLARS) == 5
    assert all(stem in signature.instructions for stem in FOUNDER_EXEMPLARS)
    assert all(f"S{n} " in STYLE_RULES for n in range(1, 9))
    assert all(f"O{n} " in STYLE_RULES for n in range(1, 4))


def test_historical_quality_signature_keeps_frozen_v3_style_not_current_exemplars():
    assert LEGACY_STYLE_INSTRUCTIONS_V3 in gate.QuestionQualitySignature.instructions
    assert all(stem in gate.QuestionQualitySignature.instructions for stem in LEGACY_FOUNDER_EXEMPLARS)
    assert STYLE_INSTRUCTIONS not in gate.QuestionQualitySignature.instructions


@pytest.mark.parametrize("stem", FOUNDER_EXEMPLARS, ids=["features", "sql_tuning", "efficient_tuning", "prototypes", "fraud_explainability"])
def test_five_founder_rewrites_pass_validator(stem):
    result = validate_question(question(stem))
    assert result.is_valid, result.errors
    assert result.style_score == 1.0


@pytest.mark.parametrize("case", FIXTURE["rejected_stems"], ids=lambda case: case["id"][:8])
def test_actual_founder_rejected_stems_fail_validator(case):
    result = validate_question(question(case["stem"]))
    assert not result.is_valid
    expected = "documentation/specification" if case["id"].startswith("5ebd2b7d") else "requirements checklist"
    assert any(expected in error for error in result.errors)


@pytest.mark.parametrize("words,valid", [(39, False), (40, True), (130, True), (131, False)])
def test_hard_word_count_boundaries(words, valid):
    stem = " ".join(["You"] + ["context"] * (words - 6) + ["What", "should", "you", "do", "now?"])
    result = validate_question(question(stem))
    assert result.is_valid is valid
    assert any("between 40 and 130" in error for error in result.errors) is not valid


@pytest.mark.parametrize("phrase", ["must satisfy the following requirements:", "Stakeholders have established the following technical requirements:", "the following technical and interpretability requirements:", "documented", "documentation", "supported specifications", "supported platform specifications", "per best practices"])
def test_exact_narrow_doc_and_checklist_patterns_reject(phrase):
    stem = FOUNDER_EXEMPLARS[0].replace("What should you do?", phrase + " What should you do?")
    assert not validate_question(question(stem)).is_valid


@pytest.mark.parametrize("phrase", ["Company policy requires private inference.", "The service supports CSV requests.", "The requirements changed after a security incident.", "Your team follows best practices for access control.", "A documented incident affected the service."])
def test_narrow_patterns_avoid_generic_words_but_documented_is_always_blocked(phrase):
    stem = FOUNDER_EXEMPLARS[0].replace("What should you do?", phrase + " What should you do?")
    result = validate_question(question(stem))
    assert result.is_valid is ("documented" not in phrase)


@pytest.mark.parametrize("check", gate.STYLE_CHECKS)
@pytest.mark.parametrize("value", [False, None, "true", 1, "missing"])
def test_each_style_check_is_boolean_mandatory_even_at_perfect_factual_score(check, value):
    fields = dict(verdict="PASS", score=1.0, reason="Synthetic schema test, not a real factual judgment.",
                  **{name: True for name in gate.ACCURACY_CHECKS})
    if value == "missing":
        del fields[check]
    else:
        fields[check] = value
    verdict = gate.judge_question(question(FOUNDER_EXEMPLARS[0]), "Synthetic scope", documentation_context="Synthetic evidence", predictor=lambda **kwargs: SimpleNamespace(**fields))
    assert not verdict.passed


def test_old_all_true_accuracy_output_missing_new_checks_fails_closed():
    fields = dict(verdict="PASS", score=1.0, reason="Legacy seven-check output.",
                  **{name: True for name in gate.ACCURACY_CHECKS if name not in gate.STYLE_CHECKS})
    verdict = gate.judge_question(question(FOUNDER_EXEMPLARS[0]), "Synthetic scope", documentation_context="Synthetic evidence", predictor=lambda **kwargs: SimpleNamespace(**fields))
    assert not verdict.passed and verdict.score == 0
