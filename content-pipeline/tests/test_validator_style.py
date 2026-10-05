"""Pure, offline regression tests for the generic validator style checks."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.validator import _check_action_question, _compute_string_similarity, validate_question


@pytest.fixture
def question():
    return {
        "stem": (
            "You work for a retailer whose private application lets operators track customer orders. "
            "Auditors review those orders using a separate identity and need to trace changes to individual operators. "
            "You want each identity to have only the permissions needed for its work. "
            "Company policy does not allow shared credentials. "
            "Which combination of IAM permissions should you assign?"
        ),
        "correct_answer": "Assign a custom IAM role limited to the required read permissions.",
        "distractor_1": "Give the operator identity organization-wide owner access across all company projects.",
        "distractor_2": "Share the auditor credentials with every application operator across company projects.",
        "distractor_3": "Remove authentication from the private application entirely for all company operators.",
        "correct_explanation": (
            "A custom IAM role grants only the required permissions to the named identity. "
            "This keeps the scope narrow and preserves separate audit attribution."
        ),
        "distractor_1_explanation": "Owner access violates the least-privilege requirement by granting unrelated permissions.",
        "distractor_2_explanation": "Shared credentials fail the requirement for individual audit attribution.",
        "distractor_3_explanation": "Removing authentication does not satisfy the private-access requirement.",
    }


def test_iam_rationales_need_no_legacy_service_names(question):
    result = validate_question(question)
    assert result.is_valid, result.errors
    assert result.warnings == []
    assert result.style_score == 1.0
    assert result.explanation_score == 1.0
    assert len(result.option_metrics) == 4
    assert all(set(metric) == {"label", "is_empty", "word_count", "ratio"} for metric in result.option_metrics)


@pytest.mark.parametrize("ending", [
    "How should you assign access?",
    "Which combination of permissions meets these requirements?",
    "What permissions are needed?",
    "Select the appropriate role?",
    "What is IAM?",
    "Which identity should receive the role?  ",
])
def test_final_question_accepts_any_phrasing(question, ending):
    question["stem"] = (
        "You work for a retailer whose private application lets operators track customer orders. "
        "Auditors review those orders using a separate identity and need to trace changes to individual operators. "
        "You want each identity to have only the permissions needed for its work. "
        "Company policy does not allow shared credentials. " + ending
    )
    assert _check_action_question(question["stem"])
    assert validate_question(question).is_valid


@pytest.mark.parametrize("ending", [
    "What should you do.",
    "What should you do? Explain your answer.",
    "How should you assign access!",
    "Which combination of permissions meets the requirements",
])
def test_action_phrasing_does_not_replace_final_question_mark(question, ending):
    question["stem"] = "Your team needs scoped permissions. " + ending
    assert not _check_action_question(question["stem"])
    assert any("action question" in error for error in validate_question(question).errors)


@pytest.mark.parametrize("resource_count", [1, 10, 36])
def test_parallel_legitimate_iam_choices_below_near_duplicate_threshold(question, resource_count):
    common = "Grant the workload identity permissions on " + " ".join(
        f"resource-{index}" for index in range(resource_count)
    )
    question["correct_answer"] = common + " using roles/viewer"
    question["distractor_1"] = common + " using roles/editor"
    count = len(question["correct_answer"].split())
    question["distractor_2"] = " ".join(f"auditor-{index}" for index in range(count))
    question["distractor_3"] = " ".join(f"operator-{index}" for index in range(count))
    similarity = _compute_string_similarity(question["correct_answer"], question["distractor_1"])
    assert 0.8 <= similarity < 0.97
    assert validate_question(question).is_valid


@pytest.mark.parametrize("overlap, total, valid", [
    (80, 100, True),
    (90, 100, True),
    (96, 100, True),
    (97, 100, False),
    (98, 100, False),
    (100, 100, False),
])
def test_exact_similarity_threshold(question, overlap, total, valid):
    # Unique synthetic tokens give an exact Jaccard boundary without mocking.
    question["correct_answer"] = " ".join(f"permission-{index}" for index in range(overlap))
    question["distractor_1"] = " ".join(f"permission-{index}" for index in range(total))
    question["distractor_2"] = " ".join(f"auditor-{index}" for index in range(total))
    question["distractor_3"] = " ".join(f"operator-{index}" for index in range(total))
    assert _compute_string_similarity(question["correct_answer"], question["distractor_1"]) == overlap / total
    result = validate_question(question)
    assert result.is_valid is valid
    assert any("too similar" in error for error in result.errors) is not valid


@pytest.mark.parametrize("text", [
    "Operators oversee access and users see only the resources assigned to their identity.",
    "Use [IAM] permissions and [read only] access to keep the role narrowly scoped.",
    "The [resource_1] identifier is a term, not a numbered citation in this rationale.",
    "Auditors can see the reference policy (see the role definition) without changing it.",
    "A reference to the source identity or documentation is ordinary explanatory prose.",
])
def test_ordinary_prose_and_bracket_terms_are_not_citations(question, text):
    question["correct_explanation"] = text
    assert validate_question(question).is_valid


@pytest.mark.parametrize("field", ["correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation"])
@pytest.mark.parametrize("reference", ["https://example.invalid/iam", "http://example.invalid/iam", "www.example.invalid", "HTTPS://example.invalid", "[1]", "[123]"])
def test_urls_and_numeric_citations_fail_in_every_rationale(question, field, reference):
    question[field] += " " + reference
    result = validate_question(question)
    assert not result.is_valid
    assert any("contains references" in error for error in result.errors)


@pytest.mark.parametrize("field", ["correct_answer", "distractor_1", "distractor_2", "distractor_3"])
def test_four_nonempty_options_remain_required(question, field):
    question[field] = "  "
    result = validate_question(question)
    assert not result.is_valid
    assert any("Choice" in error and "empty" in error for error in result.errors)


def test_required_fields_remain_required(question):
    del question["distractor_3_explanation"]
    assert validate_question(question).errors == ["Missing required field: distractor_3_explanation"]


@pytest.mark.parametrize("field", ["correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation"])
def test_rationale_minimum_length_remains_required(question, field):
    question[field] = "Too short."
    assert any("too short" in error for error in validate_question(question).errors)


def test_why_wrong_reasoning_remains_a_warning(question):
    question["distractor_1_explanation"] = "This role grants broad permissions to the operator identity."
    result = validate_question(question)
    assert result.is_valid
    assert any("should explain why it's wrong" in warning for warning in result.warnings)


def test_banned_options_still_fail_without_scenario_keyword_rule(question):
    question["stem"] = "A workload runs with separate identities and permissions. Which role meets the requirements?"
    question["distractor_1"] = "All of the above"
    errors = validate_question(question).errors
    assert not any("scenario" in error for error in errors)
    assert any("banned pattern" in error for error in errors)


def _is_option_balance_error(error):
    """Separate newly enforced option gates from existing real-content style checks."""
    return error.startswith("Correct answer is uniquely longest") or (
        error.startswith("Choice ") and "four-option mean" in error
    )


@pytest.mark.parametrize("artifact_name, count", [("pmle-pilot-6b.json", 6), ("ace-pilot-4b.json", 4)])
def test_original_cached_pilot_content(artifact_name, count):
    artifact = Path(__file__).resolve().parents[1] / ".cache" / "generation" / artifact_name
    if not artifact.exists():
        pytest.skip("Optional local pilot artifact is absent")
    candidates = json.loads(artifact.read_text())["candidates"]
    assert len(candidates) == count
    for candidate in candidates:
        options = {option["label"]: option["text"] for option in candidate["options"]}
        assert len(options) == 4
        key = candidate["key"]
        data = {
            "stem": candidate["stem"],
            "correct_answer": options[key],
            "correct_explanation": candidate["rationales"][key],
        }
        for index, label in enumerate((label for label in options if label != key), 1):
            data[f"distractor_{index}"] = options[label]
            data[f"distractor_{index}_explanation"] = candidate["rationales"][label]
        # No cleanup or normalization: validate exactly the original artifact text.
        result = validate_question(data)
        if artifact_name == "pmle-pilot-6b.json" and candidate["index"] in (3, 6):
            assert not result.is_valid
            assert any("requirements checklist" in error for error in result.errors)
        else:
            assert all(_is_option_balance_error(error) for error in result.errors), (
                f"{artifact_name} item {candidate['index']}: {result.errors}"
            )


REAL_THIRD_PERSON_CASES = json.loads(
    (Path(__file__).parent / "fixtures/pmle_batch2_schema_failures.json").read_text()
)["cases"]


@pytest.mark.parametrize("case", REAL_THIRD_PERSON_CASES, ids=lambda item: str(item["index"]))
def test_real_batch2_stems_follow_new_style_gate_without_rewording(case):
    question = case["question"]
    assert question["stem"].startswith("A machine learning engineer")
    assert case["schema_errors"] == ["Stem does not contain scenario indicators (e.g., 'you', 'your team', 'company', 'client')"]
    result = validate_question(question)
    assert not any("scenario indicators" in error for error in result.errors)
    assert "has_scenario" not in result.stem_metrics
    if case["index"] in (9, 15):
        assert not result.is_valid and result.review_status == "NEEDS_ANSWER_FIX"
        assert any("requirements checklist" in error for error in result.errors)
        if case["index"] == 9:
            assert any("documentation/specification" in error for error in result.errors)
    else:
        assert all(_is_option_balance_error(error) for error in result.errors)
        assert result.review_status == ("NEEDS_ANSWER_FIX" if result.errors else "UNREVIEWED")


@pytest.mark.parametrize("case", REAL_THIRD_PERSON_CASES, ids=lambda item: str(item["index"]))
@pytest.mark.parametrize("failure", [
    "missing_key", "empty_key", "empty_option", "duplicate_option", "banned_option",
    "missing_rationale", "empty_rationale", "short_rationale", "url", "citation",
    "short_stem", "no_question_mark",
])
def test_structural_failures_still_reject_real_third_person_questions(case, failure):
    question = dict(case["question"])
    if failure == "missing_key": del question["correct_answer"]
    elif failure == "empty_key": question["correct_answer"] = ""
    elif failure == "empty_option": question["distractor_3"] = ""
    elif failure == "duplicate_option": question["distractor_1"] = question["correct_answer"]
    elif failure == "banned_option": question["distractor_2"] = "All of the above"
    elif failure == "missing_rationale": del question["distractor_3_explanation"]
    elif failure == "empty_rationale": question["distractor_3_explanation"] = ""
    elif failure == "short_rationale": question["correct_explanation"] = "Too short."
    elif failure == "url": question["distractor_2_explanation"] += " https://example.invalid/docs"
    elif failure == "citation": question["distractor_1_explanation"] += " [123]"
    elif failure == "short_stem": question["stem"] = "Why?"
    elif failure == "no_question_mark": question["stem"] = question["stem"].rstrip().removesuffix("?") + "."
    result = validate_question(question)
    assert not result.is_valid and result.errors
