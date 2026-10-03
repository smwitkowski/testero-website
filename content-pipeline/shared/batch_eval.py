"""Batch-level evaluation for PMLE question generation.

This module provides batch-level metrics for evaluating sets of generated questions,
including blueprint coverage, duplicate detection, and difficulty distribution.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
from collections import Counter, defaultdict

from shared.pmle_program import ProgramOutput
from shared.pmle_metric import pmle_hard_constraints_metric, pmle_soft_quality_metric
from shared.dedupe import cosine_similarity, normalize_stem
from shared.domain_context import PMLE_DOMAIN_CONTEXT

logger = logging.getLogger(__name__)


@dataclass
class BatchEvalReport:
    """Report of batch-level evaluation metrics."""
    total_questions: int
    valid_count: int
    validation_pass_rate: float
    avg_soft_quality_score: float
    unique_question_ratio: float  # Semantic uniqueness
    avg_nearest_neighbor_sim: float
    blueprint_coverage: Dict[str, float] = field(default_factory=dict)  # domain -> coverage %
    difficulty_distribution: Dict[str, int] = field(default_factory=dict)  # easy/medium/hard counts
    time_to_valid_stats: Dict[str, float] = field(default_factory=dict)  # mean, median iterations


def _classify_difficulty(question: Dict[str, Any]) -> str:
    """Classify question difficulty using heuristics.
    
    Heuristics:
    - Stem word count (longer = harder)
    - Number of GCP services mentioned
    - Multi-step reasoning indicators ("first... then...")
    
    Args:
        question: Question data dict
        
    Returns:
        "easy", "medium", or "hard"
    """
    stem = question.get("stem", "")
    word_count = len(stem.split())
    
    # Count GCP services mentioned
    from shared.validator import _extract_gcp_services
    services_mentioned = _extract_gcp_services(stem)
    service_count = len(services_mentioned)
    
    # Check for multi-step reasoning
    import re
    multi_step_indicators = [
        r'first\s+.*\s+then',
        r'step\s+\d+',
        r'after\s+.*\s+you',
        r'initially\s+.*\s+subsequently',
    ]
    has_multi_step = any(re.search(pattern, stem.lower()) for pattern in multi_step_indicators)
    
    # Difficulty scoring
    difficulty_score = 0
    
    # Word count contribution (0-2 points)
    if word_count < 30:
        difficulty_score += 0
    elif word_count < 50:
        difficulty_score += 1
    else:
        difficulty_score += 2
    
    # Service count contribution (0-2 points)
    if service_count < 2:
        difficulty_score += 0
    elif service_count < 4:
        difficulty_score += 1
    else:
        difficulty_score += 2
    
    # Multi-step contribution (0-1 point)
    if has_multi_step:
        difficulty_score += 1
    
    # Classify
    if difficulty_score <= 2:
        return "easy"
    elif difficulty_score <= 4:
        return "medium"
    else:
        return "hard"


def _compute_blueprint_coverage(
    predictions: List[ProgramOutput],
    domain_mapping: Optional[Dict[str, str]] = None
) -> Dict[str, float]:
    """Compute blueprint coverage by domain.
    
    Args:
        predictions: List of ProgramOutputs
        domain_mapping: Optional mapping from question ID to domain code
        
    Returns:
        Dictionary mapping domain codes to coverage percentages
    """
    # Count questions per domain
    domain_counts = Counter()
    total_valid = 0
    
    for pred in predictions:
        if not pred.question or not pred.validation_result or not pred.validation_result.is_valid:
            continue
        
        total_valid += 1
        
        # Try to extract domain from question metadata or use mapping
        domain_code = None
        if domain_mapping:
            # Would need question ID in ProgramOutput for this
            pass
        
        # For now, we can't reliably extract domain from ProgramOutput
        # This would require adding domain metadata to ProgramOutput
        # For now, return empty dict
        pass
    
    # Calculate coverage percentages
    coverage = {}
    if total_valid > 0:
        target_distribution = {
            "ARCHITECTING_LOW_CODE_ML_SOLUTIONS": 13.0,
            "COLLABORATING_TO_MANAGE_DATA_AND_MODELS": 14.0,
            "SCALING_PROTOTYPES_INTO_ML_MODELS": 18.0,
            "SERVING_AND_SCALING_MODELS": 20.0,
            "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES": 22.0,
            "MONITORING_ML_SOLUTIONS": 13.0,
        }
        
        for domain_code, target_pct in target_distribution.items():
            actual_count = domain_counts.get(domain_code, 0)
            actual_pct = (actual_count / total_valid * 100) if total_valid > 0 else 0.0
            coverage[domain_code] = actual_pct
    
    return coverage


def _compute_duplicate_metrics(predictions: List[ProgramOutput]) -> tuple:
    """Compute duplicate detection metrics.
    
    Args:
        predictions: List of ProgramOutputs with valid questions
        
    Returns:
        Tuple of (unique_question_ratio, avg_nearest_neighbor_sim)
    """
    valid_questions = [
        pred for pred in predictions
        if pred.question and pred.stem_embedding and pred.validation_result and pred.validation_result.is_valid
    ]
    
    if len(valid_questions) < 2:
        return 1.0, 0.0
    
    embeddings = [pred.stem_embedding for pred in valid_questions]
    
    # Compute pairwise similarities
    similarities = []
    for i, emb_a in enumerate(embeddings):
        nearest_sim = 0.0
        for j, emb_b in enumerate(embeddings):
            if i != j:
                try:
                    sim = cosine_similarity(emb_a, emb_b)
                    nearest_sim = max(nearest_sim, sim)
                except (ValueError, TypeError):
                    continue
        similarities.append(nearest_sim)
    
    # Unique ratio: questions with nearest neighbor similarity < 0.85
    unique_count = sum(1 for sim in similarities if sim < 0.85)
    unique_ratio = unique_count / len(similarities) if similarities else 1.0
    
    # Average nearest neighbor similarity
    avg_nearest_sim = sum(similarities) / len(similarities) if similarities else 0.0
    
    return unique_ratio, avg_nearest_sim


def evaluate_batch(predictions: List[ProgramOutput]) -> BatchEvalReport:
    """Compute batch-level metrics for a set of generated questions.
    
    Args:
        predictions: List of ProgramOutputs from PMLEQuestionProgram.forward()
        
    Returns:
        BatchEvalReport with comprehensive batch metrics
    """
    if not predictions:
        return BatchEvalReport(
            total_questions=0,
            valid_count=0,
            validation_pass_rate=0.0,
            avg_soft_quality_score=0.0,
            unique_question_ratio=0.0,
            avg_nearest_neighbor_sim=0.0,
        )
    
    total_questions = len(predictions)
    
    # Count valid questions
    valid_predictions = [
        pred for pred in predictions
        if pred.question and pred.validation_result and pred.validation_result.is_valid
    ]
    valid_count = len(valid_predictions)
    validation_pass_rate = valid_count / total_questions if total_questions > 0 else 0.0
    
    # Compute average soft quality score
    quality_scores = []
    for pred in valid_predictions:
        try:
            score = pmle_soft_quality_metric(None, pred, None)
            quality_scores.append(score)
        except Exception as e:
            logger.warning(f"Failed to compute quality score: {e}")
    
    avg_soft_quality_score = (
        sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
    )
    
    # Compute duplicate metrics
    unique_ratio, avg_nearest_sim = _compute_duplicate_metrics(valid_predictions)
    
    # Compute difficulty distribution
    difficulty_counts = Counter()
    for pred in valid_predictions:
        if pred.question:
            difficulty = _classify_difficulty(pred.question)
            difficulty_counts[difficulty] += 1
    
    difficulty_distribution = dict(difficulty_counts)
    
    # Compute time-to-valid stats (from attempts field)
    attempts_list = [pred.attempts for pred in valid_predictions if pred.attempts > 0]
    if attempts_list:
        time_to_valid_stats = {
            "mean": sum(attempts_list) / len(attempts_list),
            "median": sorted(attempts_list)[len(attempts_list) // 2],
            "min": min(attempts_list),
            "max": max(attempts_list),
        }
    else:
        time_to_valid_stats = {}
    
    # Blueprint coverage (requires domain metadata - placeholder for now)
    blueprint_coverage = {}
    
    return BatchEvalReport(
        total_questions=total_questions,
        valid_count=valid_count,
        validation_pass_rate=validation_pass_rate,
        avg_soft_quality_score=avg_soft_quality_score,
        unique_question_ratio=unique_ratio,
        avg_nearest_neighbor_sim=avg_nearest_sim,
        blueprint_coverage=blueprint_coverage,
        difficulty_distribution=difficulty_distribution,
        time_to_valid_stats=time_to_valid_stats,
    )


def format_batch_report(report: BatchEvalReport) -> str:
    """Format batch evaluation report as a readable string.
    
    Args:
        report: BatchEvalReport to format
        
    Returns:
        Formatted report string
    """
    lines = [
        "=" * 60,
        "Batch Evaluation Report",
        "=" * 60,
        f"Total Questions: {report.total_questions}",
        f"Valid Questions: {report.valid_count} ({report.validation_pass_rate:.1%})",
        f"Average Quality Score: {report.avg_soft_quality_score:.3f}",
        "",
        "Uniqueness Metrics:",
        f"  Unique Question Ratio: {report.unique_question_ratio:.1%}",
        f"  Avg Nearest Neighbor Similarity: {report.avg_nearest_neighbor_sim:.3f}",
        "",
        "Difficulty Distribution:",
    ]
    
    for difficulty in ["easy", "medium", "hard"]:
        count = report.difficulty_distribution.get(difficulty, 0)
        pct = (count / report.valid_count * 100) if report.valid_count > 0 else 0.0
        lines.append(f"  {difficulty.capitalize()}: {count} ({pct:.1f}%)")
    
    if report.time_to_valid_stats:
        lines.append("")
        lines.append("Time to Valid (iterations):")
        lines.append(f"  Mean: {report.time_to_valid_stats.get('mean', 0):.1f}")
        lines.append(f"  Median: {report.time_to_valid_stats.get('median', 0):.1f}")
        lines.append(f"  Range: {report.time_to_valid_stats.get('min', 0):.0f} - {report.time_to_valid_stats.get('max', 0):.0f}")
    
    if report.blueprint_coverage:
        lines.append("")
        lines.append("Blueprint Coverage:")
        for domain_code, coverage_pct in report.blueprint_coverage.items():
            lines.append(f"  {domain_code}: {coverage_pct:.1f}%")
    
    lines.append("=" * 60)
    
    return "\n".join(lines)


