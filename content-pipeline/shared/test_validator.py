"""Unit tests for question validation logic."""

import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.validator import (
    validate_question, ValidationResult, format_validation_errors,
    _check_scenario_presence, _check_action_question, _extract_gcp_services,
    _check_why_wrong_reasoning, _compute_string_similarity
)


def test_validate_question_valid():
    """Test validation passes for a valid question."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model for real-time predictions. What is the best approach?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features as Vertex AI.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is True
    assert len(result.errors) == 0
    assert result.review_status == "UNREVIEWED"


def test_validate_question_missing_stem():
    """Test validation fails when stem is missing."""
    question_data = {
        "correct_answer": "Option A",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "Explanation text here",
        "distractor_1_explanation": "Explanation text here",
        "distractor_2_explanation": "Explanation text here",
        "distractor_3_explanation": "Explanation text here"
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert "Missing required field: stem" in result.errors
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_stem_too_short():
    """Test validation fails when stem is too short."""
    question_data = {
        "stem": "Short",
        "correct_answer": "Option A",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_1_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_2_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_3_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert any("Stem too short" in error for error in result.errors)
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_empty_choice():
    """Test validation fails when a choice is empty."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Option A",
        "distractor_1": "",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_1_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_2_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_3_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert "Choice B is empty" in result.errors
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_empty_explanation():
    """Test validation fails when an explanation is empty."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Option A",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "",
        "distractor_1_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_2_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_3_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert any("correct" in error.lower() and "explanation" in error.lower() for error in result.errors)
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_explanation_too_short():
    """Test validation fails when an explanation is too short."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Option A",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "Short",
        "distractor_1_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_2_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_3_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert any("correct" in error.lower() and "too short" in error.lower() for error in result.errors)
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_multiple_explanations_too_short():
    """Test validation captures multiple explanation errors."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Option A",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "Short",
        "distractor_1_explanation": "Also short",
        "distractor_2_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters.",
        "distractor_3_explanation": "This is a longer explanation that meets the minimum length requirement of 30 characters."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert len(result.errors) >= 2  # At least 2 explanation errors
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_multiple_errors():
    """Test validation captures multiple errors."""
    question_data = {
        "stem": "Short",
        "correct_answer": "",
        "distractor_1": "Option B",
        "distractor_2": "Option C",
        "distractor_3": "Option D",
        "correct_explanation": "Short",
        "distractor_1_explanation": "Short",
        "distractor_2_explanation": "Short",
        "distractor_3_explanation": "Short"
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is False
    assert len(result.errors) > 1
    assert result.review_status == "NEEDS_ANSWER_FIX"


def test_validate_question_all_explanations_valid():
    """Test validation passes when all explanations meet requirements."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model for real-time predictions. What is the best approach?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features as Vertex AI.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference."
    }
    
    result = validate_question(question_data)
    
    assert result.is_valid is True
    assert result.review_status == "UNREVIEWED"


def test_format_validation_errors_valid():
    """Test formatting errors for valid result."""
    result = ValidationResult(
        is_valid=True,
        errors=[],
        review_status="UNREVIEWED"
    )
    
    formatted = format_validation_errors(result)
    assert formatted == "Validation passed"


def test_format_validation_errors_invalid():
    """Test formatting errors for invalid result."""
    result = ValidationResult(
        is_valid=False,
        errors=["Stem too short", "Choice A is empty"],
        review_status="NEEDS_ANSWER_FIX"
    )
    
    formatted = format_validation_errors(result)
    assert "Validation failed" in formatted
    assert "Stem too short" in formatted
    assert "Choice A is empty" in formatted


def test_check_scenario_presence():
    """Test scenario presence detection."""
    assert _check_scenario_presence("You are working for a company") is True
    assert _check_scenario_presence("Your team needs to deploy") is True
    assert _check_scenario_presence("The client requires") is True
    assert _check_scenario_presence("A machine learning model") is False
    assert _check_scenario_presence("What is the best approach?") is False


def test_check_action_question():
    """Test action question detection."""
    assert _check_action_question("What should you do?") is True
    assert _check_action_question("Which approach is best?") is True
    assert _check_action_question("How would you solve this?") is True
    assert _check_action_question("What is Vertex AI?") is True
    assert _check_action_question("What should you do? Then explain your answer.") is False
    assert _check_action_question("A machine learning model") is False


def test_extract_gcp_services():
    """Test GCP service extraction."""
    text = "Use Vertex AI Online Prediction with Cloud Storage and BigQuery ML"
    services = _extract_gcp_services(text)
    assert "Vertex AI" in services or "Vertex AI Online Prediction" in services
    assert "Cloud Storage" in services
    assert "BigQuery ML" in services


def test_check_why_wrong_reasoning():
    """Test why-wrong reasoning detection."""
    assert _check_why_wrong_reasoning("This option is too expensive") is True
    assert _check_why_wrong_reasoning("It doesn't scale well") is True
    assert _check_why_wrong_reasoning("This violates the requirement") is True
    assert _check_why_wrong_reasoning("This is incorrect") is False
    assert _check_why_wrong_reasoning("Wrong answer") is False


def test_compute_string_similarity():
    """Test string similarity computation."""
    assert _compute_string_similarity("Use Vertex AI", "Use Vertex AI") == 1.0
    assert _compute_string_similarity("Use Vertex AI", "Use BigQuery") < 1.0
    assert _compute_string_similarity("", "test") == 0.0
    assert _compute_string_similarity("test", "") == 0.0


def test_validate_question_no_scenario():
    """Test validation fails when stem lacks scenario indicators."""
    question_data = {
        "stem": "A machine learning model needs to be deployed. What is the best approach?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features as Vertex AI.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference."
    }
    
    result = validate_question(question_data)
    assert result.is_valid is False
    assert any("scenario" in error.lower() for error in result.errors)


def test_validate_question_no_action_question():
    """Test validation fails when stem lacks action question."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model.",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features as Vertex AI.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference."
    }
    
    result = validate_question(question_data)
    assert result.is_valid is False
    assert any("action question" in error.lower() for error in result.errors)


def test_validate_question_duplicate_options():
    """Test validation detects duplicate options."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Online Prediction",  # Duplicate!
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency.",
        "distractor_1_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup.",
        "distractor_3_explanation": "Cloud Run requires containerization."
    }
    
    result = validate_question(question_data)
    assert result.is_valid is False
    assert any("similar" in error.lower() for error in result.errors)


def test_validate_question_banned_patterns():
    """Test validation detects banned patterns."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "All of the above",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "All options are correct.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup.",
        "distractor_3_explanation": "Cloud Run requires containerization."
    }
    
    result = validate_question(question_data)
    assert result.is_valid is False
    assert any("banned" in error.lower() for error in result.errors)


def test_validate_question_missing_gcp_service_in_explanation():
    """Test generic explanation validation does not require a listed GCP service."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "This is the best option because it provides managed infrastructure.",  # No GCP service!
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration."
    }
    
    result = validate_question(question_data)
    assert result.is_valid is True
    assert not any("gcp service" in error.lower() for error in result.errors)


def test_validate_question_scores():
    """Test validation result includes component scores."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model for real-time predictions. What is the best approach?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency. It handles scaling automatically and provides built-in monitoring.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference. It processes large datasets offline.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features as Vertex AI.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration, making it less suitable for ML inference."
    }
    
    result = validate_question(question_data)
    assert hasattr(result, 'structural_score')
    assert hasattr(result, 'style_score')
    assert hasattr(result, 'explanation_score')
    assert 0.0 <= result.structural_score <= 1.0
    assert 0.0 <= result.style_score <= 1.0
    assert 0.0 <= result.explanation_score <= 1.0


def test_validate_question_stem_metrics():
    """Test validation result includes stem metrics."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model for real-time predictions. What is the best approach?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference with low latency.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration."
    }
    
    result = validate_question(question_data)
    assert hasattr(result, 'stem_metrics')
    assert 'has_scenario' in result.stem_metrics
    assert 'has_action_question' in result.stem_metrics
    assert result.stem_metrics['has_scenario'] is True
    assert result.stem_metrics['has_action_question'] is True


def test_validate_question_option_metrics():
    """Test validation result includes option metrics."""
    question_data = {
        "stem": "You are working for a company that needs to deploy a machine learning model. What should you do?",
        "correct_answer": "Use Vertex AI Online Prediction",
        "distractor_1": "Use Vertex AI Batch Prediction",
        "distractor_2": "Use Cloud Functions",
        "distractor_3": "Use Cloud Run",
        "correct_explanation": "Vertex AI Online Prediction provides managed infrastructure for real-time inference.",
        "distractor_1_explanation": "Vertex AI Batch Prediction is designed for batch processing, not real-time inference.",
        "distractor_2_explanation": "Cloud Functions requires more manual setup and doesn't provide the same level of ML-specific features.",
        "distractor_3_explanation": "Cloud Run requires containerization and manual scaling configuration."
    }
    
    result = validate_question(question_data)
    assert hasattr(result, 'option_metrics')
    assert len(result.option_metrics) == 4
    for metric in result.option_metrics:
        assert 'label' in metric
        assert 'is_empty' in metric
        assert 'has_gcp_service' not in metric
        assert 'services_mentioned' not in metric


def test_format_validation_errors_with_warnings():
    """Test formatting includes warnings."""
    result = ValidationResult(
        is_valid=True,
        errors=[],
        warnings=["Stem word count is below recommended minimum"],
        review_status="UNREVIEWED"
    )
    
    formatted = format_validation_errors(result)
    assert "warnings" in formatted.lower()
    assert "recommended minimum" in formatted


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
