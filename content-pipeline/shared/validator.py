"""Question validation module.

Validates LLM-generated questions against generic quality checks before database insertion.
"""

import re
from dataclasses import dataclass, field
from typing import Dict, Any, List

# Retained for legacy batch_eval/eval_accuracy callers, not active validation.
# Extracted from domain_context.py
GCP_SERVICES = [
    "BigQuery ML", "AutoML Tables", "AutoML Vision", "AutoML Text", "AutoML Video",
    "Tabular Workflows", "ML APIs", "Model Garden", "Vertex AI Agent Builder",
    "Vertex AI Search", "Document AI API", "Retail API", "Vertex AI Feature Store",
    "Vertex AI Workbench", "Vertex AI Experiments", "Vertex AI TensorBoard",
    "Dataflow", "TensorFlow Extended (TFX)", "Cloud Storage", "BigQuery",
    "Spanner", "Cloud SQL", "Apache Spark", "Apache Hadoop", "Colab Enterprise",
    "Dataproc", "Vertex AI", "Vertex AI Custom Training", "Vertex AI Training",
    "Cloud TPU", "Cloud GPU", "Vertex AI Hyperparameter Tuning",
    "Vertex AI Model Registry", "Kubeflow on GKE", "Reduction Server", "Horovod",
    "AutoML", "Vertex AI Endpoints", "Vertex AI public endpoints",
    "Vertex AI private endpoints", "Vertex AI Batch Prediction", "Cloud Run",
    "Google Kubernetes Engine", "Cloud Load Balancing", "Vertex AI Pipelines",
    "Kubeflow Pipelines", "Cloud Build", "Cloud Composer", "Cloud Functions",
    "Pub/Sub", "Vertex AI Metadata", "Vertex ML Metadata", "MLFlow",
    "Jenkins", "Vertex AI Model Monitoring", "Vertex AI Explainable AI",
    "Cloud Monitoring", "Cloud Logging", "Vertex AI Prediction",
    # Common variations
    "GKE", "Kubernetes Engine", "Vertex AI Online Prediction",
]


@dataclass
class ValidationResult:
    """Result of question validation."""
    is_valid: bool
    errors: List[str]
    warnings: List[str] = field(default_factory=list)  # Non-blocking issues
    review_status: str = "UNREVIEWED"  # 'UNREVIEWED' or 'NEEDS_ANSWER_FIX'
    # Component scores (0.0-1.0) for DSPy optimization
    structural_score: float = 1.0
    style_score: float = 1.0
    explanation_score: float = 1.0
    # Detailed breakdowns
    stem_metrics: Dict[str, Any] = field(default_factory=dict)
    option_metrics: List[Dict[str, Any]] = field(default_factory=list)


def _extract_gcp_services(text: str) -> List[str]:
    """Extract GCP service names mentioned in text.
    
    Args:
        text: Text to search for GCP services
        
    Returns:
        List of GCP service names found
    """
    found_services = []
    text_lower = text.lower()
    for service in GCP_SERVICES:
        # Check for service name (case-insensitive, word boundaries)
        service_pattern = r'\b' + re.escape(service.lower()) + r'\b'
        if re.search(service_pattern, text_lower):
            found_services.append(service)
    return found_services


def _check_action_question(stem: str) -> bool:
    """Check that the stem ends with a question, without restricting phrasing."""
    return stem.rstrip().endswith("?")


def _check_why_wrong_reasoning(explanation: str) -> bool:
    """Check if distractor explanation contains 'why wrong' reasoning.
    
    Args:
        explanation: Explanation text
        
    Returns:
        True if contains why-wrong reasoning
    """
    why_wrong_patterns = [
        r'too expensive', r'doesn\'t scale', r'does not scale',
        r'legacy', r'outdated', r'inefficient', r'not suitable',
        r'violates', r'fails', r'incorrect because', r'wrong because',
        r'does not meet', r'doesn\'t meet', r'does not satisfy',
        r'doesn\'t satisfy', r'not appropriate', r'inappropriate',
        r'limitation', r'constraint', r'requirement'
    ]
    explanation_lower = explanation.lower()
    return any(re.search(pattern, explanation_lower) for pattern in why_wrong_patterns)


def _compute_string_similarity(a: str, b: str) -> float:
    """Compute simple string similarity using token overlap.
    
    Args:
        a: First string
        b: Second string
        
    Returns:
        Similarity score between 0.0 and 1.0
    """
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    return intersection / union if union > 0 else 0.0


def validate_question(question_data: Dict[str, Any]) -> ValidationResult:
    """Validate LLM-generated question data against quality rubric.
    
    Validates:
    - Required fields present & non-empty
    - Stem structure (length and final question mark); scenario quality is judged independently
    - Option quality (non-empty, no near duplicates, no banned patterns)
    - Explanation quality (length, no URLs/citations, why-wrong reasoning)
    
    Args:
        question_data: Dictionary with keys: stem, correct_answer, distractor_1, distractor_2, distractor_3,
                      correct_explanation, distractor_1_explanation, distractor_2_explanation, distractor_3_explanation
                      
    Returns:
        ValidationResult with is_valid flag, errors, warnings, scores, and detailed metrics
    """
    errors: List[str] = []
    warnings: List[str] = []
    
    # Initialize scores (start at 1.0, deduct for issues)
    structural_score = 1.0
    style_score = 1.0
    explanation_score = 1.0
    
    # Check required fields exist
    required_fields = [
        "stem",
        "correct_answer",
        "distractor_1",
        "distractor_2",
        "distractor_3",
        "correct_explanation",
        "distractor_1_explanation",
        "distractor_2_explanation",
        "distractor_3_explanation",
    ]
    for field in required_fields:
        if field not in question_data:
            errors.append(f"Missing required field: {field}")
            return ValidationResult(
                is_valid=False,
                errors=errors,
                warnings=warnings,
                review_status="NEEDS_ANSWER_FIX",
                structural_score=0.0,
                style_score=0.0,
                explanation_score=0.0,
            )
    
    stem = question_data["stem"]
    correct_answer = question_data["correct_answer"]
    distractor_1 = question_data["distractor_1"]
    distractor_2 = question_data["distractor_2"]
    distractor_3 = question_data["distractor_3"]
    correct_explanation = question_data["correct_explanation"]
    distractor_1_explanation = question_data["distractor_1_explanation"]
    distractor_2_explanation = question_data["distractor_2_explanation"]
    distractor_3_explanation = question_data["distractor_3_explanation"]
    
    # === STEM VALIDATION ===
    stem_metrics = {}
    
    if not stem or not stem.strip():
        errors.append("Stem is empty")
        structural_score -= 1.0
    else:
        stem = stem.strip()
        stem_length = len(stem)
        word_count = len(stem.split())
        sentence_count = len(re.findall(r'[.!?]+', stem))
        
        stem_metrics = {
            "length": stem_length,
            "word_count": word_count,
            "sentence_count": sentence_count,
            "has_action_question": False,
        }
        
        # Minimum length check (20 chars is too low, use 25-30 words)
        if stem_length < 20:
            errors.append(f"Stem too short (minimum 20 characters, got {stem_length})")
            structural_score -= 0.5
        elif word_count < 25:
            warnings.append(f"Stem word count ({word_count}) is below recommended minimum (25 words)")
            style_score -= 0.1
        
        # Action question check
        has_action_question = _check_action_question(stem)
        stem_metrics["has_action_question"] = has_action_question
        if not has_action_question:
            errors.append("Stem does not end with an action question (final sentence must end with '?')")
            style_score -= 0.3
        
        # Sentence count check (ideal: 3-5)
        if sentence_count < 3:
            warnings.append(f"Stem has only {sentence_count} sentence(s), ideal is 3-5")
            style_score -= 0.1
        elif sentence_count > 7:
            warnings.append(f"Stem has {sentence_count} sentences, ideal is 3-5")
            style_score -= 0.05
    
    # === OPTION VALIDATION ===
    choices = {
        "A": ("correct_answer", correct_answer),
        "B": ("distractor_1", distractor_1),
        "C": ("distractor_2", distractor_2),
        "D": ("distractor_3", distractor_3),
    }
    
    option_metrics = []
    choice_texts = []
    
    for label, (field_name, choice_text) in choices.items():
        option_metric = {
            "label": label,
            "is_empty": False,
        }
        
        if not choice_text or not choice_text.strip():
            errors.append(f"Choice {label} is empty")
            structural_score -= 0.25
            option_metric["is_empty"] = True
        else:
            choice_text = choice_text.strip()
            choice_texts.append(choice_text)
            
            # Check for banned patterns
            banned_patterns = [
                r'all of the above',
                r'none of the above',
                r'both a and b',
                r'both a and c',
            ]
            choice_lower = choice_text.lower()
            for pattern in banned_patterns:
                if re.search(pattern, choice_lower):
                    errors.append(f"Choice {label} contains banned pattern: '{pattern}'")
                    style_score -= 0.2
            
        option_metrics.append(option_metric)
    
    # Reject only exact or near-duplicate options (similarity >= 0.97).
    for i, choice_a in enumerate(choice_texts):
        for j, choice_b in enumerate(choice_texts[i+1:], start=i+1):
            similarity = _compute_string_similarity(choice_a, choice_b)
            if similarity >= 0.97:
                errors.append(f"Choices are too similar (similarity: {similarity:.2f})")
                structural_score -= 0.3
                break
    
    # === EXPLANATION VALIDATION ===
    explanations = {
        "correct": ("correct_explanation", correct_explanation, True),
        "distractor_1": ("distractor_1_explanation", distractor_1_explanation, False),
        "distractor_2": ("distractor_2_explanation", distractor_2_explanation, False),
        "distractor_3": ("distractor_3_explanation", distractor_3_explanation, False),
    }
    
    for option_name, (field_name, explanation_text, is_correct) in explanations.items():
        if not explanation_text or not explanation_text.strip():
            errors.append(f"Explanation for {option_name} is empty")
            explanation_score -= 0.25
            structural_score -= 0.25
        else:
            explanation_text = explanation_text.strip()
            explanation_length = len(explanation_text)
            
            # Minimum length check
            if explanation_length < 30:
                errors.append(
                    f"Explanation for {option_name} too short "
                    f"(minimum 30 characters, got {explanation_length})"
                )
                explanation_score -= 0.2
            elif is_correct and explanation_length < 50:
                warnings.append(
                    f"Correct answer explanation is short ({explanation_length} chars), "
                    "recommended minimum is 50 characters"
                )
                explanation_score -= 0.1
            
            # Check for references (URLs, citations)
            has_url = bool(re.search(r'https?://|www\.', explanation_text, re.IGNORECASE))
            has_citation = bool(re.search(r'\[\d+\]', explanation_text))
            if has_url or has_citation:
                errors.append(
                    f"Explanation for {option_name} contains references (URLs or citations). "
                    "References should not be included in explanations."
                )
                explanation_score -= 0.2
            
            # For distractor explanations: must contain why-wrong reasoning
            if not is_correct:
                has_why_wrong = _check_why_wrong_reasoning(explanation_text)
                if not has_why_wrong:
                    warnings.append(
                        f"Distractor explanation for {option_name} should explain why it's wrong "
                        "(e.g., 'too expensive', 'doesn't scale', 'violates requirement')"
                    )
                    explanation_score -= 0.15
    
    # Normalize scores to [0.0, 1.0]
    structural_score = max(0.0, min(1.0, structural_score))
    style_score = max(0.0, min(1.0, style_score))
    explanation_score = max(0.0, min(1.0, explanation_score))
    
    # Determine review status
    review_status = "UNREVIEWED" if len(errors) == 0 else "NEEDS_ANSWER_FIX"
    
    return ValidationResult(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        review_status=review_status,
        structural_score=structural_score,
        style_score=style_score,
        explanation_score=explanation_score,
        stem_metrics=stem_metrics,
        option_metrics=option_metrics,
    )


def format_validation_errors(validation_result: ValidationResult) -> str:
    """Format validation errors and warnings for logging/display.
    
    Args:
        validation_result: ValidationResult to format
        
    Returns:
        Formatted error/warning message string
    """
    if validation_result.is_valid and not validation_result.warnings:
        return "Validation passed"
    
    lines = []
    if not validation_result.is_valid:
        lines.append("Validation failed:")
        for i, error in enumerate(validation_result.errors, 1):
            lines.append(f"  {i}. {error}")
    
    if validation_result.warnings:
        if lines:
            lines.append("")
        lines.append("Warnings:")
        for i, warning in enumerate(validation_result.warnings, 1):
            lines.append(f"  {i}. {warning}")
    
    if validation_result.is_valid and validation_result.warnings:
        lines.insert(0, "Validation passed with warnings:")
    
    return "\n".join(lines)
