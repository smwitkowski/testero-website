"""Clarified policy and actual unchanged round-4 verdict replays, offline only."""
import json
from pathlib import Path
import pytest
from shared.cli_models import parse_output,output_model
from shared.llm_generator import PmleQuestionSignature
from shared.quality_gate import QuestionQualitySignature,LEGACY_ROUND4_QUALITY_SIGNATURE
from shared.question_style import STYLE_INSTRUCTIONS

FIXTURE=json.loads((Path(__file__).parent/"fixtures/round4_repair_failures.json").read_text())


def test_clarification_does_not_remove_any_required_verdict_field():
    current=output_model(QuestionQualitySignature)
    old=output_model(LEGACY_ROUND4_QUALITY_SIGNATURE)
    assert set(current.model_fields)==set(old.model_fields)
    assert len(current.model_fields)==14
    assert current.model_fields["distractors_need_knowledge"].is_required()
    assert "Failing a stated want is" in QuestionQualitySignature.instructions
    assert "literal stem fact or prohibition" in QuestionQualitySignature.instructions
    assert "custom prediction routines provide the server" in QuestionQualitySignature.instructions
    assert STYLE_INSTRUCTIONS in QuestionQualitySignature.instructions


def test_generator_self_check_and_same_want_are_explicit():
    text=PmleQuestionSignature.instructions
    assert "self-check all three distractors individually" in text
    assert "At most two wants or policies" in text
    assert "Different distractors may fail the same want" in text
    assert 'Remove any "without X"' in text
    assert "never a literal stem contradiction" in PmleQuestionSignature.output_fields["distractor_1"].json_schema_extra["desc"]
    for field in ("distractor_2","distractor_3"):
        assert "same" in PmleQuestionSignature.output_fields[field].json_schema_extra["desc"]


def test_round4_aggregate_is_a_real_saved_measurement():
    measured=FIXTURE["aggregate"]
    assert measured["pass"]==12
    assert measured["eligible_repair"]==27
    assert measured["false_counts"]["distractors_need_knowledge"]==31
    assert measured["false_counts"]["constraints_as_wants"]==10
