#!/usr/bin/env python3
"""Batch evaluation script for PMLE question generation.

This script evaluates batches of generated questions and produces a dashboard report
showing validation pass rates, quality scores, duplicate detection, difficulty distribution,
and blueprint coverage.
"""

import sys
import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import click

# Add parent directory to path to import shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.pmle_program import ProgramOutput, PMLEQuestionProgram
from shared.batch_eval import evaluate_batch, format_batch_report, BatchEvalReport
from shared.supabase_client import SupabaseClient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_questions_from_json(file_path: str) -> List[ProgramOutput]:
    """Load questions from JSON file.
    
    Expected JSON format:
    [
        {
            "question": {...},
            "validation_result": {...},
            "factual_eval": {...},
            ...
        },
        ...
    ]
    
    Args:
        file_path: Path to JSON file
        
    Returns:
        List of ProgramOutput objects
    """
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    predictions = []
    for item in data:
        try:
            # Convert dict to ProgramOutput
            # Note: This assumes the JSON has all required fields
            pred = ProgramOutput(
                question=item.get("question", {}),
                documentation_context=item.get("documentation_context", ""),
                doc_links=item.get("doc_links", []),
                gap_analysis=item.get("gap_analysis"),
                factual_eval=item.get("factual_eval"),  # Would need to convert to QuestionEvalResult
                stem_embedding=item.get("stem_embedding"),
                validation_result=item.get("validation_result"),  # Would need to convert to ValidationResult
                is_duplicate=item.get("is_duplicate", False),
                attempts=item.get("attempts", 0),
            )
            predictions.append(pred)
        except Exception as e:
            logger.warning(f"Failed to parse question from JSON: {e}")
            continue
    
    return predictions


def load_questions_from_supabase(
    limit: Optional[int] = None,
    run_id: Optional[str] = None
) -> List[ProgramOutput]:
    """Load questions from Supabase database.
    
    Args:
        limit: Maximum number of questions to load
        run_id: Optional generation run ID to filter by
        
    Returns:
        List of ProgramOutput objects
    """
    client = SupabaseClient()
    
    # Query questions from database
    query = client.supabase.table("questions").select("*")
    
    if run_id:
        query = query.eq("generation_run_id", run_id)
    
    if limit:
        query = query.limit(limit)
    
    results = query.execute()
    
    # Convert database rows to ProgramOutput
    # Note: This is a simplified conversion - actual implementation would need
    # to reconstruct ValidationResult, QuestionEvalResult, etc. from database fields
    predictions = []
    for row in results.data:
        try:
            # Extract question data
            question_data = {
                "stem": row.get("stem", ""),
                "correct_answer": row.get("correct_answer", ""),
                "distractor_1": row.get("distractor_1", ""),
                "distractor_2": row.get("distractor_2", ""),
                "distractor_3": row.get("distractor_3", ""),
                "correct_explanation": row.get("correct_explanation", ""),
                "distractor_1_explanation": row.get("distractor_1_explanation", ""),
                "distractor_2_explanation": row.get("distractor_2_explanation", ""),
                "distractor_3_explanation": row.get("distractor_3_explanation", ""),
            }
            
            # Reconstruct validation result
            from shared.validator import ValidationResult
            validation_result = ValidationResult(
                is_valid=row.get("review_status") != "NEEDS_ANSWER_FIX",
                errors=[],
                warnings=[],
                review_status=row.get("review_status", "UNREVIEWED"),
            )
            
            pred = ProgramOutput(
                question=question_data,
                documentation_context="",
                doc_links=[],
                gap_analysis=None,
                factual_eval=None,  # Would need to reconstruct from DB
                stem_embedding=None,  # Would need to load from DB
                validation_result=validation_result,
                is_duplicate=False,
                attempts=0,
            )
            predictions.append(pred)
        except Exception as e:
            logger.warning(f"Failed to convert database row to ProgramOutput: {e}")
            continue
    
    return predictions


@click.command()
@click.option(
    "--input-file",
    "-i",
    type=click.Path(exists=True),
    help="Path to JSON file containing questions"
)
@click.option(
    "--supabase",
    is_flag=True,
    help="Load questions from Supabase database"
)
@click.option(
    "--run-id",
    type=str,
    help="Generation run ID to filter Supabase queries"
)
@click.option(
    "--limit",
    type=int,
    help="Maximum number of questions to evaluate"
)
@click.option(
    "--output",
    "-o",
    type=click.Path(),
    help="Output file path for report (default: stdout)"
)
def main(input_file: Optional[str], supabase: bool, run_id: Optional[str], limit: Optional[int], output: Optional[str]):
    """Evaluate a batch of PMLE questions and generate a dashboard report.
    
    Examples:
    
    \b
    # Evaluate questions from JSON file
    python eval_batch.py -i questions.json
    
    \b
    # Evaluate questions from Supabase
    python eval_batch.py --supabase --run-id abc123
    
    \b
    # Evaluate first 100 questions from Supabase
    python eval_batch.py --supabase --limit 100
    """
    # Load questions
    if input_file:
        logger.info(f"Loading questions from JSON file: {input_file}")
        predictions = load_questions_from_json(input_file)
    elif supabase:
        logger.info("Loading questions from Supabase database")
        predictions = load_questions_from_supabase(limit=limit, run_id=run_id)
    else:
        click.echo("Error: Must specify either --input-file or --supabase", err=True)
        sys.exit(1)
    
    if not predictions:
        click.echo("Error: No questions loaded", err=True)
        sys.exit(1)
    
    logger.info(f"Loaded {len(predictions)} questions for evaluation")
    
    # Run batch evaluation
    logger.info("Running batch evaluation...")
    report = evaluate_batch(predictions)
    
    # Format and output report
    report_text = format_batch_report(report)
    
    if output:
        with open(output, 'w') as f:
            f.write(report_text)
        logger.info(f"Report written to {output}")
    else:
        click.echo(report_text)


if __name__ == "__main__":
    main()


