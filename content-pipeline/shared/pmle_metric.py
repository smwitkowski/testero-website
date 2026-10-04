"""Metric function for DSPy optimization of PMLE question generation.

This module provides a metric function that DSPy's compiler can use to optimize
the PMLEQuestionProgram. The metric combines:
- Structural validation (hard requirement)
- Factual accuracy (hard requirement)
- Style conformance (soft scoring)
- Optional gold-standard comparison (for supervised optimization)
"""

import logging
import re
from typing import Dict, Any, Optional
from shared.validator import validate_question
from shared.pmle_program import ProgramOutput

logger = logging.getLogger(__name__)


def pmle_hard_constraints_metric(
    example: Optional[Dict[str, Any]] = None,
    prediction: Optional[ProgramOutput] = None,
    trace: Optional[Any] = None,
) -> float:
    """Binary pass/fail metric for hard constraints.
    
    Returns 0.0 if any hard constraint fails (gates DB insertion).
    Returns 1.0 if all hard constraints pass.
    
    Hard constraints:
    - Structural validation must pass
    - No factual contradictions (FAIL verdicts)
    - All required fields present
    
    Args:
        example: Optional gold-standard example (unused in hard constraints)
        prediction: ProgramOutput from PMLEQuestionProgram.forward()
        trace: Optional trace object from DSPy (unused)
        
    Returns:
        0.0 if hard constraints fail, 1.0 otherwise
    """
    if prediction is None:
        return 0.0
    
    # Extract question data
    question = prediction.question
    if not question:
        return 0.0
    
    # 1. Structural validation (hard requirement)
    validation_result = prediction.validation_result
    if not validation_result or not validation_result.is_valid:
        logger.debug("Hard constraints: Structural validation failed")
        return 0.0
    
    # 2. Factual accuracy (hard requirement)
    factual_eval = prediction.factual_eval
    if factual_eval is not None:
        # Check for FAIL verdicts - these are hard failures
        failed_options = [r for r in factual_eval.option_results if r.verdict == "FAIL"]
        if failed_options:
            logger.debug(f"Hard constraints: Factual evaluation failed for options: {[r.option_label for r in failed_options]}")
            return 0.0
        
        # Check for contradictions in doc_support
        contradicted_options = [r for r in factual_eval.option_results if r.doc_support == "contradicted"]
        if contradicted_options:
            logger.debug(f"Hard constraints: Contradictions found in options: {[r.option_label for r in contradicted_options]}")
            return 0.0
    
    # All hard constraints passed
    return 1.0


def pmle_soft_quality_metric(
    example: Optional[Dict[str, Any]] = None,
    prediction: Optional[ProgramOutput] = None,
    trace: Optional[Any] = None,
) -> float:
    """Continuous quality metric for DSPy teleprompt optimization.
    
    Returns a score between 0.0 and 1.0 based on weighted component scores.
    
    Scoring components (weighted):
    - structural_score: 0.25
    - style_score: 0.25
    - explanation_score: 0.25
    - factual groundedness: 0.25
    
    Penalties:
    - References in explanations: -0.1
    - Low groundedness: -0.1 per option below 0.5
    
    Args:
        example: Optional gold-standard example for bonus scoring
        prediction: ProgramOutput from PMLEQuestionProgram.forward()
        trace: Optional trace object from DSPy (unused)
        
    Returns:
        Quality score between 0.0 and 1.0
    """
    if prediction is None:
        return 0.0
    
    # Extract question data
    question = prediction.question
    if not question:
        return 0.0
    
    validation_result = prediction.validation_result
    if not validation_result:
        return 0.0
    
    # Component scores from validation
    structural_score = validation_result.structural_score
    style_score = validation_result.style_score
    explanation_score = validation_result.explanation_score
    
    # Factual groundedness (average across all options)
    factual_eval = prediction.factual_eval
    if factual_eval and factual_eval.option_results:
        groundedness_scores = [r.groundedness_score for r in factual_eval.option_results]
        avg_groundedness = sum(groundedness_scores) / len(groundedness_scores) if groundedness_scores else 0.0
        
        # Penalty for low groundedness
        low_groundedness_penalty = 0.0
        for result in factual_eval.option_results:
            if result.groundedness_score < 0.5:
                low_groundedness_penalty += 0.05
        
        # Check for references
        has_references = any(r.has_references for r in factual_eval.option_results)
        reference_penalty = 0.1 if has_references else 0.0
    else:
        avg_groundedness = 0.5  # Default if no evaluation
        low_groundedness_penalty = 0.0
        reference_penalty = 0.0
    
    # Weighted combination
    score = (
        0.25 * structural_score +
        0.25 * style_score +
        0.25 * explanation_score +
        0.25 * avg_groundedness
    )
    
    # Apply penalties
    score -= reference_penalty
    score -= low_groundedness_penalty
    
    # Optional gold comparison bonus
    gold_bonus = 0.0
    if example is not None:
        gold_score = _compare_to_gold(question, example)
        gold_bonus = gold_score * 0.1  # Up to +0.1 bonus
    
    score += gold_bonus
    
    # Clamp to [0.0, 1.0]
    return max(0.0, min(1.0, score))


def pmle_question_metric(
    example: Optional[Dict[str, Any]] = None,
    prediction: Optional[ProgramOutput] = None,
    trace: Optional[Any] = None,
) -> float:
    """Combined metric: hard gate + soft quality.
    
    This is the main metric function for DSPy optimization.
    First checks hard constraints (returns 0.0 if fail), then returns soft quality score.
    
    Args:
        example: Optional gold-standard example for comparison
        prediction: ProgramOutput from PMLEQuestionProgram.forward()
        trace: Optional trace object from DSPy (unused)
        
    Returns:
        Score between 0.0 and 1.0, where:
        - 0.0 = Hard failure (invalid structure or factual errors)
        - 0.1-0.9 = Soft quality score (passes hard constraints)
        - 0.9-1.0 = Excellent quality
    """
    # Hard constraints gate
    if pmle_hard_constraints_metric(example, prediction, trace) == 0.0:
        return 0.0
    
    # Return soft quality score
    return pmle_soft_quality_metric(example, prediction, trace)


def _compute_style_score(question: Dict[str, Any]) -> float:
    """Compute style conformance score for a question.
    
    Checks:
    - Stem length (3-5 sentences ideal)
    - Explanation length (comprehensive but not verbose)
    - No markdown artifacts
    - Scenario clarity
    
    Args:
        question: Question data dict
        
    Returns:
        Style score between -0.2 and 0.2
    """
    score = 0.0
    
    # Check stem length (3-5 sentences ideal)
    stem = question.get("stem", "")
    sentence_count = len(re.findall(r'[.!?]+', stem))
    if 3 <= sentence_count <= 5:
        score += 0.1
    elif sentence_count < 3:
        score -= 0.1  # Too short
    elif sentence_count > 7:
        score -= 0.05  # Too long
    
    # Check explanation lengths (should be comprehensive)
    explanations = [
        question.get("correct_explanation", ""),
        question.get("distractor_1_explanation", ""),
        question.get("distractor_2_explanation", ""),
        question.get("distractor_3_explanation", ""),
    ]
    
    min_explanation_length = min(len(e) for e in explanations if e)
    max_explanation_length = max(len(e) for e in explanations if e)
    
    # Ideal: 50-300 chars per explanation
    if min_explanation_length >= 50:
        score += 0.05
    else:
        score -= 0.05
    
    if max_explanation_length <= 500:
        score += 0.05
    else:
        score -= 0.02  # Some explanations too verbose
    
    # Check for markdown artifacts (should be minimal)
    has_markdown = any(
        re.search(r'```|`[^`]+`|\[.*\]\(.*\)|#{1,6}\s', text)
        for text in [stem] + explanations
    )
    if not has_markdown:
        score += 0.05
    
    return score


def _compare_to_gold(question: Dict[str, Any], gold: Dict[str, Any]) -> float:
    """Compare generated question to gold-standard example.
    
    Uses simple lexical similarity on key fields. More sophisticated
    comparison could use embeddings or semantic similarity.
    
    Args:
        question: Generated question dict
        gold: Gold-standard question dict
        
    Returns:
        Similarity score between 0.0 and 1.0
    """
    # Extract key fields for comparison
    question_fields = {
        "stem": question.get("stem", ""),
        "correct_answer": question.get("correct_answer", ""),
    }
    
    gold_fields = {
        "stem": gold.get("stem", ""),
        "correct_answer": gold.get("correct_answer", ""),
    }
    
    # Simple token-based similarity
    similarities = []
    for field in ["stem", "correct_answer"]:
        q_tokens = set(question_fields[field].lower().split())
        g_tokens = set(gold_fields[field].lower().split())
        
        if not q_tokens or not g_tokens:
            continue
        
        intersection = len(q_tokens & g_tokens)
        union = len(q_tokens | g_tokens)
        
        if union > 0:
            similarity = intersection / union
            similarities.append(similarity)
    
    if not similarities:
        return 0.0
    
    # Average similarity across fields
    avg_similarity = sum(similarities) / len(similarities)
    return avg_similarity


def pmle_question_metric_strict(
    example: Optional[Dict[str, Any]] = None,
    prediction: Optional[ProgramOutput] = None,
    trace: Optional[Any] = None,
) -> float:
    """Strict version of the metric that only returns 0.0 or 1.0.
    
    Useful for binary pass/fail optimization where you only care about
    meeting hard requirements, not fine-grained quality.
    
    This is now just an alias for pmle_hard_constraints_metric.
    
    Args:
        example: Optional gold-standard example
        prediction: ProgramOutput from PMLEQuestionProgram.forward()
        trace: Optional trace object
        
    Returns:
        1.0 if all hard requirements pass, 0.0 otherwise
    """
    return pmle_hard_constraints_metric(example, prediction, trace)
