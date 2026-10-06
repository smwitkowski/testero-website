"""Natural question-line variants retain the final-question-mark gate offline."""
import pytest
from shared.cert_context import QUESTION_LINES
from shared.validator import validate_question
from test_generation_gate import QUESTION


@pytest.mark.parametrize("line",list(dict.fromkeys(QUESTION_LINES)))
def test_natural_question_lines_pass_existing_question_mark_gate(line):
    original=QUESTION["stem"]
    # Only this synthetic fixture's final question changes; no real text is edited.
    stem=original[:original.rfind("Which solution should you choose?")]+line
    result=validate_question({**QUESTION,"stem":stem})
    assert result.is_valid,result.errors
    assert result.stem_metrics["has_action_question"]


def test_variant_without_final_question_mark_is_rejected():
    stem=QUESTION["stem"][:QUESTION["stem"].rfind("Which solution should you choose?")]+"Which approach should you use"
    result=validate_question({**QUESTION,"stem":stem})
    assert not result.is_valid
    assert not result.stem_metrics["has_action_question"]
