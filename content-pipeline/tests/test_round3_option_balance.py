"""Offline regressions from actual round3 generated candidates, not official samples."""

import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.validator import option_length_metrics, validate_question

FIXTURES = json.loads(
    (Path(__file__).parent / "fixtures" / "round3_option_balance.json").read_text()
)
QUESTION_FIELDS = {
    "stem", "correct_answer", "distractor_1", "distractor_2", "distractor_3",
    "correct_explanation", "distractor_1_explanation", "distractor_2_explanation",
    "distractor_3_explanation",
}


@pytest.mark.parametrize("candidate", FIXTURES, ids=lambda candidate: f"round3-{candidate['index']}")
def test_fixture_contains_only_question_fields_and_provenance(candidate):
    assert set(candidate) == QUESTION_FIELDS | {
        "index", "candidate_id", "artifact_sha256", "source",
    }
    assert candidate["source"] == "round3 actual generated candidate, not official sample"
    assert re.fullmatch(r"[0-9a-f]{64}", candidate["artifact_sha256"])
    assert candidate["candidate_id"]


@pytest.mark.parametrize("index, counts, valid, unique_longest, lead", [
    (1, [34, 21, 22, 17], False, True, 12),
    (4, [22, 17, 17, 23], True, False, -1),
    (9, [33, 25, 31, 28], True, True, 2),
    (33, [27, 22, 24, 23], False, True, 3),
])
def test_actual_round3_options_use_new_gate(index, counts, valid, unique_longest, lead):
    candidate = next(candidate for candidate in FIXTURES if candidate["index"] == index)
    question = {field: candidate[field] for field in QUESTION_FIELDS}
    metrics = option_length_metrics(question)
    assert metrics["word_counts"] == counts
    assert metrics["key_is_longest"] is unique_longest
    assert metrics["key_lead_words"] == lead
    result = validate_question(question)
    assert result.is_valid is valid, result.errors
    assert [metric["word_count"] for metric in result.option_metrics] == counts
    assert [metric["ratio"] for metric in result.option_metrics] == pytest.approx(metrics["ratios"])
    if valid:
        assert result.errors == []
    else:
        assert any("uniquely longest" in error for error in result.errors)
    if index == 1:
        assert any("four-option mean" in error for error in result.errors)
    if index == 33:
        assert all(metrics["within_bounds"])
        assert len(result.errors) == 1
