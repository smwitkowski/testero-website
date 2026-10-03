#!/usr/bin/env python3
"""Generate PMLE questions using LLM-backed generation pipeline.

This script creates a generation run and inserts LLM-generated canonical questions
with validation. Generated questions are marked as DRAFT + UNREVIEWED (or NEEDS_ANSWER_FIX
if validation fails) and can be reviewed via the admin panel.
"""

import sys
import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import random

import click

# Add parent directory to path to import shared modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from shared.supabase_client import SupabaseClient
from shared.domain_context import get_domain_context, build_domain_prompt_context
from shared.pmle_program import PMLEQuestionProgram
from shared.validator import validate_question, format_validation_errors, ValidationResult
from shared.dedupe import normalize_stem
from shared.tracing import traceable_decorator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def strip_option_letter(text: str) -> str:
    """Strip leading letter prefix like 'A. ' or 'A) ' from option text."""
    import re
    return re.sub(r'^[A-Da-d][\.\):\s]\s*', '', text.strip())


def strip_markdown(text: str) -> str:
    """Strip markdown formatting from text, keeping only the plain text content."""
    import re
    if not text:
        return text
    
    # Remove markdown code blocks (```code``` or `code`)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # Remove markdown links but keep the link text: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown images: ![alt](url) -> alt
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown headers (# Header -> Header)
    text = re.sub(r'^#{1,6}\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Remove markdown bold (**text** or __text__ -> text)
    text = re.sub(r'\*\*([^\*]+)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+)__', r'\1', text)
    
    # Remove markdown italic (*text* or _text_ -> text, but be careful not to remove underscores in words)
    text = re.sub(r'(?<!\w)\*([^\*]+)\*(?!\w)', r'\1', text)
    text = re.sub(r'(?<!\w)_([^_]+)_(?!\w)', r'\1', text)
    
    # Remove markdown strikethrough (~~text~~ -> text)
    text = re.sub(r'~~([^~]+)~~', r'\1', text)
    
    # Remove markdown blockquotes (> text -> text)
    text = re.sub(r'^>\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Remove markdown horizontal rules
    text = re.sub(r'^[-*]{3,}$', '', text, flags=re.MULTILINE)
    
    # Remove markdown list markers (- item, * item, 1. item -> item)
    text = re.sub(r'^[\s]*[-*+]\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    text = re.sub(r'^[\s]*\d+\.\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Clean up extra whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Max 2 consecutive newlines
    text = text.strip()
    
    return text


def strip_references(text: str) -> str:
    """Strip references (URLs, citations, links) from text, keeping only plain explanation content."""
    import re
    if not text:
        return text
    
    # Remove URLs (http://, https://, www.)
    text = re.sub(r'https?://[^\s]+', '', text)
    text = re.sub(r'www\.[^\s]+', '', text)
    text = re.sub(r'[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*', '', text)  # Generic domain patterns
    
    # Remove citation patterns like [1], (see docs), (reference), etc.
    text = re.sub(r'\[[\d\w\s]+\]', '', text)  # [1], [reference], etc.
    text = re.sub(r'\(see\s+[^)]+\)', '', text, flags=re.IGNORECASE)  # (see docs)
    text = re.sub(r'\(reference[^)]*\)', '', text, flags=re.IGNORECASE)  # (reference...)
    text = re.sub(r'\(source[^)]*\)', '', text, flags=re.IGNORECASE)  # (source...)
    text = re.sub(r'\(ref[^)]*\)', '', text, flags=re.IGNORECASE)  # (ref...)
    text = re.sub(r'\(docs[^)]*\)', '', text, flags=re.IGNORECASE)  # (docs...)
    text = re.sub(r'\(documentation[^)]*\)', '', text, flags=re.IGNORECASE)  # (documentation...)
    
    # Remove patterns like "See: url" or "Reference: url"
    text = re.sub(r'See\s*:?\s*[^\n]+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Reference\s*:?\s*[^\n]+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Source\s*:?\s*[^\n]+', '', text, flags=re.IGNORECASE)
    text = re.sub(r'Docs\s*:?\s*[^\n]+', '', text, flags=re.IGNORECASE)
    
    # Clean up extra whitespace and punctuation artifacts
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single space
    text = re.sub(r'\s*,\s*,', ',', text)  # Double commas
    text = re.sub(r'\s*\.\s*\.', '.', text)  # Double periods
    text = re.sub(r'\s+([.,;:])', r'\1', text)  # Space before punctuation
    text = text.strip()
    
    return text


def has_references(text: str) -> bool:
    """Check if text contains references (URLs, citations, links)."""
    import re
    if not text:
        return False
    
    # Check for URLs
    if re.search(r'https?://', text) or re.search(r'www\.', text):
        return True
    
    # Check for citation patterns
    if re.search(r'\[[\d\w\s]+\]', text):  # [1], [reference]
        return True
    
    if re.search(r'\(see\s+[^)]+\)', text, re.IGNORECASE):  # (see docs)
        return True
    
    if re.search(r'\(reference|source|ref|docs|documentation', text, re.IGNORECASE):
        return True
    
    # Check for "See:" or "Reference:" patterns
    if re.search(r'See\s*:?\s*[^\n]+', text, re.IGNORECASE):
        return True
    
    if re.search(r'Reference\s*:?\s*[^\n]+', text, re.IGNORECASE):
        return True
    
    return False


def strip_markdown_from_question_data(question_data: Dict[str, Any]) -> Dict[str, Any]:
    """Strip markdown formatting from all text fields in question data for evaluation."""
    return {
        "stem": strip_markdown(question_data.get("stem", "")),
        "correct_answer": strip_markdown(question_data.get("correct_answer", "")),
        "distractor_1": strip_markdown(question_data.get("distractor_1", "")),
        "distractor_2": strip_markdown(question_data.get("distractor_2", "")),
        "distractor_3": strip_markdown(question_data.get("distractor_3", "")),
        "correct_explanation": strip_markdown(question_data.get("correct_explanation", "")),
        "distractor_1_explanation": strip_markdown(question_data.get("distractor_1_explanation", "")),
        "distractor_2_explanation": strip_markdown(question_data.get("distractor_2_explanation", "")),
        "distractor_3_explanation": strip_markdown(question_data.get("distractor_3_explanation", "")),
    }


@click.command()
@click.option(
    '--exam',
    default='GCP_PM_ML_ENG',
    help='Exam identifier (default: GCP_PM_ML_ENG)'
)
@click.option(
    '--domain-code',
    required=True,
    help='Domain code (e.g., ARCHITECTING_LOW_CODE_ML_SOLUTIONS, MONITORING_ML_SOLUTIONS)'
)
@click.option(
    '--n-questions',
    default=10,
    type=int,
    help='Number of questions to generate (default: 10)'
)
@click.option(
    '--model',
    default='openrouter/google/gemini-2.5-flash',
    help='OpenRouter model identifier (default: openai/gpt-5.1). Examples: openai/gpt-5.1, anthropic/claude-3-opus'
)
@click.option(
    '--prompt-version',
    default=None,
    help='Optional prompt version identifier'
)
@click.option(
    '--notes',
    default=None,
    help='Optional notes about this generation run'
)
@click.option(
    '--dry-run',
    is_flag=True,
    help='Generate questions without inserting into database'
)
@click.option(
    '--skip-invalid/--insert-invalid',
    default=True,
    help='Skip invalid questions (default) or insert with NEEDS_ANSWER_FIX status'
)
@click.option(
    '--difficulty',
    default='MEDIUM',
    type=click.Choice(['EASY', 'MEDIUM', 'HARD'], case_sensitive=False),
    help='Difficulty level for generated questions (default: MEDIUM)'
)
@click.option(
    '--skip-eval',
    is_flag=True,
    help='Skip factual accuracy evaluation (faster but less accurate)'
)
@click.option(
    '--jaccard-threshold',
    default=0.9,
    type=float,
    help='Jaccard similarity threshold for lexical duplicate detection (default: 0.9)'
)
@click.option(
    '--semantic-threshold',
    default=0.85,
    type=float,
    help='Cosine similarity threshold for semantic duplicate detection (default: 0.85)'
)
@click.option(
    '--skip-semantic-dedup',
    is_flag=True,
    help='Skip semantic duplicate detection (faster but may allow paraphrased duplicates)'
)
@click.option(
    '--max-retries',
    default=2,
    type=int,
    help='Max LLM retries on validation failure (default: 2)'
)
@click.option(
    '--skip-gap-analysis',
    is_flag=True,
    help='Skip gap analysis step (faster but less targeted question generation)'
)
@click.option(
    '--subsection',
    default=None,
    help='Exam subsection code (e.g., "1.1", "2.3") to target specific subsection'
)
@traceable_decorator(
    name="generate_pmle_questions_batch",
    project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation")
)
def main(
    exam: str,
    domain_code: str,
    n_questions: int,
    model: str,
    prompt_version: str | None,
    notes: str | None,
    dry_run: bool,
    skip_invalid: bool,
    difficulty: str,
    skip_eval: bool,
    jaccard_threshold: float,
    semantic_threshold: float,
    skip_semantic_dedup: bool,
    max_retries: int,
    skip_gap_analysis: bool,
    subsection: str | None,
):
    """Generate LLM-backed PMLE questions for the content pipeline."""
    
    click.echo(f"🚀 Starting LLM question generation...")
    click.echo(f"   Exam: {exam}")
    click.echo(f"   Domain: {domain_code}")
    click.echo(f"   Target count: {n_questions}")
    click.echo(f"   Model: {model}")
    click.echo(f"   Difficulty: {difficulty}")
    click.echo(f"   Max retries: {max_retries}")
    if dry_run:
        click.echo(f"   ⚠️  DRY RUN MODE - No database insertion")
    
    try:
        # 1. Connect to Supabase (skip if dry-run)
        client = None
        if not dry_run:
            client = SupabaseClient()
            click.echo("✓ Connected to Supabase")
        
        # 2. Look up domain context
        try:
            domain_context = get_domain_context(domain_code)
            domain_name = domain_context["display_name"]
        except ValueError as e:
            click.echo(f"❌ Error: {e}", err=True)
            click.echo("   Valid domain codes include:", err=True)
            click.echo("   - ARCHITECTING_LOW_CODE_ML_SOLUTIONS", err=True)
            click.echo("   - COLLABORATING_TO_MANAGE_DATA_AND_MODELS", err=True)
            click.echo("   - SCALING_PROTOTYPES_INTO_ML_MODELS", err=True)
            click.echo("   - SERVING_AND_SCALING_MODELS", err=True)
            click.echo("   - AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES", err=True)
            click.echo("   - MONITORING_ML_SOLUTIONS", err=True)
            sys.exit(1)
        
        click.echo(f"✓ Found domain: {domain_name}")
        
        # Validate subsection if provided
        if subsection:
            try:
                from shared.domain_context import get_subsection_context
                subsection_context = get_subsection_context(domain_code, subsection)
                click.echo(f"✓ Targeting subsection: {subsection_context['title']} ({subsection})")
            except ValueError as e:
                click.echo(f"❌ Error: {e}", err=True)
                sys.exit(1)
        
        # Build domain prompt context (with subsection if provided)
        prompt_context = build_domain_prompt_context(domain_code, domain_name, subsection_code=subsection)
        
        # Get services list for documentation search
        services = domain_context.get("services", [])
        
        # 3. Create generation run (skip if dry-run)
        run_id = None
        if not dry_run:
            domain = client.get_domain_by_code(domain_code)
            if not domain:
                click.echo(f"❌ Error: Domain '{domain_code}' not found in exam_domains table", err=True)
                sys.exit(1)
            
            run_data = {
                "exam": exam,
                "domain_code": domain_code,
                "target_count": n_questions,
                "generated_count": 0,
                "model": model,
                "prompt_version": prompt_version,
                "notes": notes
            }
            
            generation_run = client.create_generation_run(run_data)
            if not generation_run:
                click.echo("❌ Error: Failed to create generation run", err=True)
                sys.exit(1)
            
            run_id = generation_run['id']
            domain_id = domain['id']
            click.echo(f"✓ Created generation run: {run_id}")
        else:
            # For dry-run, create a mock domain_id
            domain_id = "dry-run-domain-id"
        
        # 4. Load existing stems and embeddings for duplicate detection
        existing_norm_stems: list[str] = []
        existing_embeddings: list[list[float]] = []
        if not dry_run:
            try:
                existing_stems = client.get_question_stems_for_domain(exam, domain_id)
                existing_norm_stems = [normalize_stem(s) for s in existing_stems if s]
                click.echo(f"✓ Loaded {len(existing_norm_stems)} existing stems for duplicate detection")
            except Exception as e:
                logger.warning(f"Failed to load existing stems for duplicate detection: {e}")
                click.echo(f"⚠️  Warning: Could not load existing stems, duplicate detection may be incomplete", err=True)
            
            if not skip_semantic_dedup:
                try:
                    existing_embeddings = client.get_question_embeddings_for_domain(exam, domain_id)
                    click.echo(f"✓ Loaded {len(existing_embeddings)} existing embeddings for semantic duplicate detection")
                except Exception as e:
                    logger.warning(f"Failed to load existing embeddings for semantic duplicate detection: {e}")
                    click.echo(f"⚠️  Warning: Could not load existing embeddings, semantic duplicate detection may be incomplete", err=True)
        
        # Track normalized stems and embeddings from this run to avoid duplicates within the same batch
        run_norm_stems: list[str] = []
        run_embeddings: list[list[float]] = []
        
        # Initialize PMLE question program (handles all LLM operations)
        program = PMLEQuestionProgram(
            max_retries=max_retries,
            max_duplicate_retries=max_retries,
            jaccard_threshold=jaccard_threshold,
            semantic_threshold=semantic_threshold,
            model=model,
        )
        
        # 5. Run gap analysis (if enabled and not dry-run) to get guidance items
        existing_questions_summary = ""
        domain_topics_text = ""
        gap_analysis_guidance_items: list[str] = []
        
        if not skip_gap_analysis and client is not None:
            try:
                click.echo("\n🔍 Running gap analysis...")
                existing_questions = client.get_existing_questions_for_domain(exam, domain_id, limit=100)
                
                if existing_questions:
                    # Format existing questions summary
                    max_questions_to_analyze = 50
                    questions_to_analyze = existing_questions[:max_questions_to_analyze]
                    
                    questions_summary_lines = []
                    for i, q in enumerate(questions_to_analyze, 1):
                        stem = q.get('stem', '')[:200]
                        difficulty = q.get('difficulty', 'MEDIUM')
                        questions_summary_lines.append(f"{i}. [{difficulty}] {stem}...")
                    
                    existing_questions_summary = "\n".join(questions_summary_lines)
                    
                    # Extract domain topics
                    domain_topics_list = domain_context.get("topics", []) + domain_context.get("services", [])
                    domain_topics_text = "\n".join([f"- {topic}" for topic in domain_topics_list])
                    
                    # Run gap analysis using program's internal method
                    try:
                        gap_analysis = program._run_gap_analysis(
                            domain_context=prompt_context,
                            existing_questions_summary=existing_questions_summary,
                            domain_topics=domain_topics_text,
                            n_questions=n_questions,
                        )
                        
                        if gap_analysis and gap_analysis.get("generation_guidance_items"):
                            gap_analysis_guidance_items = gap_analysis["generation_guidance_items"]
                            click.echo(f"✓ Gap analysis complete")
                            click.echo(f"   Generated {len(gap_analysis_guidance_items)} guidance items for {n_questions} questions")
                            if gap_analysis.get("identified_gaps"):
                                gaps_preview = gap_analysis["identified_gaps"][:200]
                                click.echo(f"   Gaps: {gaps_preview}...")
                        else:
                            click.echo("   No specific gaps identified, proceeding with standard generation")
                    except Exception as e:
                        logger.warning(f"Gap analysis failed: {e}")
                        click.echo(f"⚠️  Warning: Gap analysis failed, continuing without guidance: {e}", err=True)
                else:
                    click.echo("   No existing questions found, skipping gap analysis")
            except Exception as e:
                logger.warning(f"Failed to prepare gap analysis: {e}")
                click.echo(f"⚠️  Warning: Failed to prepare gap analysis: {e}", err=True)
        
        # 6. Generate questions
        generated_count = 0
        failed_count = 0
        validation_failed_count = 0
        eval_failed_count = 0
        duplicate_count = 0
        semantic_duplicate_count = 0
        total_retry_attempts = 0
        
        for i in range(1, n_questions + 1):
            try:
                click.echo(f"\n📝 Generating question {i}/{n_questions}...")
                
                # Get guidance item for this specific question (if gap analysis was done)
                question_guidance = ""
                if gap_analysis_guidance_items and i <= len(gap_analysis_guidance_items):
                    question_guidance = gap_analysis_guidance_items[i - 1]
                    if question_guidance:
                        click.echo(f"   📋 Using guidance: {question_guidance[:100]}...")
                
                # Call PMLEQuestionProgram - handles doc search, generation, dedupe, and evaluation
                try:
                    result = program(
                        domain_context=prompt_context,
                        domain_name=domain_name,
                        services=services,
                        existing_questions_summary=existing_questions_summary if not skip_gap_analysis else "",
                        domain_topics=domain_topics_text if not skip_gap_analysis else "",
                        difficulty=difficulty,
                        exam_subsection=subsection or "",  # Pass subsection code for targeted generation
                        gap_analysis_guidance=question_guidance,
                        existing_norm_stems=existing_norm_stems + run_norm_stems,
                        existing_embeddings=existing_embeddings + run_embeddings if not skip_semantic_dedup else [],
                        skip_eval=skip_eval,
                        max_regenerations=3,  # Maximum regeneration attempts if factual evaluation fails
                    )
                    
                    # Track retry attempts
                    if result.attempts > 1:
                        total_retry_attempts += (result.attempts - 1)
                    
                    # Check if duplicate after all retries
                    if result.is_duplicate:
                        if result.attempts > max_retries + 1:
                            # Check which type of duplicate
                            stem = result.question.get("stem", "")
                            if stem:
                                norm_stem = normalize_stem(stem)
                                # Quick check to determine duplicate type (approximate)
                                if any(normalize_stem(s) == norm_stem for s in existing_norm_stems + run_norm_stems):
                                    duplicate_count += 1
                                else:
                                    semantic_duplicate_count += 1
                            else:
                                duplicate_count += 1
                        click.echo(f"   ⚠️  Detected duplicate after {result.attempts} attempts, skipping")
                        continue
                    
                    # Extract outputs
                    raw_output = result.question
                    doc_links = result.doc_links
                    stem_embedding = result.stem_embedding
                    validation = result.validation_result
                    eval_result = result.factual_eval
                    
                    # Check if question generation failed (empty question dict)
                    if not raw_output or not raw_output.get("stem"):
                        click.echo(f"⚠️  Question generation failed for question {i} (empty output)", err=True)
                        failed_count += 1
                        continue
                    
                    # Show doc search results
                    if doc_links:
                        click.echo(f"   ✓ Found {len(doc_links)} documentation links")
                    
                    # Show generation status
                    if result.attempts > 1:
                        click.echo(f"   ✓ Generated after {result.attempts} attempt(s)")
                    
                except Exception as e:
                    logger.error(f"Program execution failed for question {i}: {e}")
                    click.echo(f"⚠️  Program execution failed for question {i}: {e}", err=True)
                    failed_count += 1
                    continue
                
                # Validate question (should already be valid from program, but check for reporting)
                if not validation.is_valid:
                    validation_failed_count += 1
                    error_msg = format_validation_errors(validation)
                    click.echo(f"⚠️  Validation failed for question {i}:", err=True)
                    click.echo(f"   {error_msg}", err=True)
                    
                    if skip_invalid:
                        click.echo(f"   Skipping invalid question (--skip-invalid)", err=True)
                        continue
                    else:
                        click.echo(f"   Inserting with review_status={validation.review_status}", err=True)
                
                # Process factual evaluation results
                final_review_status = "GOOD"  # Default to GOOD for valid questions
                if eval_result is not None:
                    # Check for references in explanations
                    options_with_references = [r for r in eval_result.option_results if r.has_references]
                    if options_with_references:
                        ref_labels = [r.option_label for r in options_with_references]
                        click.echo(f"⚠️  References found in explanations for options: {', '.join(ref_labels)}", err=True)
                        click.echo(f"   References will be stripped, but flagging for review", err=True)
                        final_review_status = "NEEDS_ANSWER_FIX"
                    
                    # Check for FAIL verdicts - these should have been handled by regeneration loop
                    # If we still have failures here, it means all regeneration attempts failed
                    failed_options = [r for r in eval_result.option_results if r.verdict == "FAIL"]
                    if failed_options:
                        eval_failed_count += 1
                        failed_labels = [r.option_label for r in failed_options]
                        click.echo(f"⚠️  Factual eval FAILED for question {i} after all regeneration attempts:", err=True)
                        click.echo(f"   Failed options: {', '.join(failed_labels)}", err=True)
                        for option_result in failed_options:
                            click.echo(f"   Option {option_result.option_label}: {option_result.issues}", err=True)
                        click.echo(f"   Skipping question - all regeneration attempts exhausted", err=True)
                        failed_count += 1
                        continue
                    
                    # UNCERTAIN verdicts are now treated as PASS after multi-hop search
                    # No need to flag for manual review - the system handles it automatically
                    click.echo(f"   ✓ Factual eval passed (all options PASS or UNCERTAIN treated as PASS)")
                
                # Track normalized stem and embedding for this run
                if raw_output.get("stem"):
                    run_norm_stems.append(normalize_stem(raw_output["stem"]))
                if stem_embedding and not skip_semantic_dedup:
                    run_embeddings.append(stem_embedding)
                
                # Skip database insertion if dry-run
                if dry_run:
                    click.echo(f"   ✓ Generated (dry-run): {raw_output.get('stem', '')[:80]}...")
                    generated_count += 1
                    continue
                
                # If we get here, we have a valid question ready for insertion
                if not raw_output:
                    continue
                
                # Determine final status and review_status
                # For valid questions: ACTIVE + GOOD (unless references found)
                # For invalid questions (if skip_invalid=False): DRAFT + validation.review_status
                if validation.is_valid:
                    final_status = "ACTIVE"
                    # final_review_status already set above (GOOD or NEEDS_ANSWER_FIX if references)
                else:
                    # Invalid question - keep as DRAFT with validation review_status
                    final_status = "DRAFT"
                    final_review_status = validation.review_status
                
                # 3. Prepare question data
                question_data = {
                    "exam": exam,
                    "domain_id": domain_id,
                    "stem": strip_markdown(raw_output["stem"]),
                    "difficulty": difficulty,
                    "status": final_status,
                    "review_status": final_review_status,
                    "generation_run_id": run_id
                }
                
                # Insert question
                question = client.insert_question(question_data)
                if not question:
                    click.echo(f"⚠️  Warning: Failed to insert question {i}", err=True)
                    failed_count += 1
                    continue
                
                question_id = question['id']
                
                # 4. Prepare and insert answers WITH per-option explanations
                # Map: correct_answer -> A, distractors -> B, C, D
                # Strip markdown and references from explanations
                answers_data = [
                    {
                        "question_id": question_id,
                        "choice_label": "A",
                        "choice_text": strip_markdown(strip_option_letter(raw_output["correct_answer"])),
                        "is_correct": True,
                        "explanation_text": strip_references(strip_markdown(raw_output["correct_explanation"]))
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "B",
                        "choice_text": strip_markdown(strip_option_letter(raw_output["distractor_1"])),
                        "is_correct": False,
                        "explanation_text": strip_references(strip_markdown(raw_output["distractor_1_explanation"]))
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "C",
                        "choice_text": strip_markdown(strip_option_letter(raw_output["distractor_2"])),
                        "is_correct": False,
                        "explanation_text": strip_references(strip_markdown(raw_output["distractor_2_explanation"]))
                    },
                    {
                        "question_id": question_id,
                        "choice_label": "D",
                        "choice_text": strip_markdown(strip_option_letter(raw_output["distractor_3"])),
                        "is_correct": False,
                        "explanation_text": strip_references(strip_markdown(raw_output["distractor_3_explanation"]))
                    }
                ]
                
                answers = client.insert_answers_batch(answers_data)
                if not answers or len(answers) != 4:
                    click.echo(f"⚠️  Warning: Failed to insert all answers for question {i}", err=True)
                    failed_count += 1
                    continue
                
                # 5. Insert explanation with doc_links
                # Create a summary explanation combining all option explanations
                # Strip references from explanations (doc_links are stored separately)
                summary_explanation = (
                    f"Correct Answer (A): {strip_references(strip_markdown(raw_output['correct_explanation']))}\n\n"
                    f"Distractor B: {strip_references(strip_markdown(raw_output['distractor_1_explanation']))}\n\n"
                    f"Distractor C: {strip_references(strip_markdown(raw_output['distractor_2_explanation']))}\n\n"
                    f"Distractor D: {strip_references(strip_markdown(raw_output['distractor_3_explanation']))}"
                )
                
                explanation_data = {
                    "question_id": question_id,
                    "explanation_text": summary_explanation,
                    "doc_links": doc_links if doc_links else None
                }
                
                explanation = client.insert_explanation(explanation_data)
                if not explanation:
                    click.echo(f"⚠️  Warning: Failed to insert explanation for question {i}", err=True)
                    failed_count += 1
                    continue
                
                # 6. Store embedding for future duplicate detection
                if not skip_semantic_dedup and stem_embedding is not None:
                    try:
                        # Update question with embedding we computed during duplicate check
                        if not client.update_question_embedding(question_id, stem_embedding):
                            click.echo(f"⚠️  Warning: Failed to store embedding for question {i}", err=True)
                            # Don't fail the whole operation, just log warning
                    except Exception as e:
                        logger.warning(f"Failed to store embedding for question {i}: {e}")
                        click.echo(f"⚠️  Warning: Failed to store embedding: {e}", err=True)
                        # Don't fail the whole operation, just log warning
                
                generated_count += 1
                status_emoji = "✓" if validation.is_valid else "⚠️"
                click.echo(f"   {status_emoji} Question {i} inserted (status: {final_status}, review_status: {final_review_status})")
                
            except Exception as e:
                logger.exception(f"Error creating question {i}")
                click.echo(f"⚠️  Error creating question {i}: {e}", err=True)
                failed_count += 1
                continue
        
        # 7. Update generation run (skip if dry-run)
        if not dry_run and run_id:
            from datetime import timezone
            update_data = {
                "generated_count": generated_count,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
            
            updated_run = client.update_generation_run(run_id, update_data)
            if not updated_run:
                click.echo("⚠️  Warning: Failed to update generation run completion", err=True)
        
        # Summary
        click.echo("")
        click.echo("✅ Generation complete!")
        click.echo(f"   Generated: {generated_count}/{n_questions} questions")
        if total_retry_attempts > 0:
            click.echo(f"   Total retry attempts: {total_retry_attempts}")
        if duplicate_count > 0:
            click.echo(f"   Lexical duplicates skipped: {duplicate_count}")
        if semantic_duplicate_count > 0:
            click.echo(f"   Semantic duplicates skipped: {semantic_duplicate_count}")
        if validation_failed_count > 0:
            click.echo(f"   Validation failures: {validation_failed_count}")
        if eval_failed_count > 0:
            click.echo(f"   Factual eval failures: {eval_failed_count}")
        if failed_count > 0:
            click.echo(f"   Failed: {failed_count}")
        if not dry_run:
            click.echo(f"   Generation run ID: {run_id}")
        click.echo("")
        
        if not dry_run:
            click.echo("📋 Next steps:")
            click.echo(f"   1. View questions in admin UI: /admin/questions")
            click.echo(f"   2. Filter by domain: {domain_code}")
            click.echo(f"   3. Filter by generation_run_id: {run_id}")
            click.echo("")
        
        if generated_count < n_questions:
            click.echo(
                f"⚠️  Warning: Only {generated_count} of {n_questions} questions were generated",
                err=True
            )
            if not dry_run:
                sys.exit(1)
        
    except ValueError as ve:
        click.echo(f"❌ Configuration Error: {ve}", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ Unexpected error: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
