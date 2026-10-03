"""DSPy Module for end-to-end PMLE question generation and vetting.

This module wraps all LLM-backed steps into a single dspy.Module that can be
optimized by DSPy's compiler. It includes:
- Documentation search (Exa + Firecrawl)
- Gap analysis
- Question generation with correction loop
- Semantic deduplication with retry
- Factual evaluation (with Exa research)

Non-LLM plumbing (Supabase persistence) remains outside this module.
"""

import os
import json
import logging
import time
from dataclasses import dataclass
from typing import Dict, Any, Optional, List, Tuple
import dspy
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

from shared.llm_generator import (
    PmleQuestionSignature,
    QuestionCorrectionSignature,
    FactualCorrectionSignature,
    GapAnalysisSignature,
)
from shared.eval_accuracy import OptionEvalSignature, OptionEvalResult, QuestionEvalResult
from shared.validator import validate_question, ValidationResult
from shared.doc_search import search_google_docs
from shared.exa_client import search_technical_facts
from shared.embeddings import get_embedding
from shared.dedupe import is_duplicate_stem, is_semantic_duplicate, normalize_stem
from shared.tracing import traceable_decorator, trace_dspy_call, trace

logger = logging.getLogger(__name__)


@dataclass
class ProgramOutput:
    """Output from PMLEQuestionProgram.forward()."""
    question: Dict[str, Any]
    documentation_context: str
    doc_links: List[str]
    gap_analysis: Optional[Dict[str, Any]]
    factual_eval: Optional[QuestionEvalResult]
    stem_embedding: Optional[List[float]]
    validation_result: ValidationResult
    is_duplicate: bool
    attempts: int


class PMLEQuestionProgram(dspy.Module):
    """End-to-end PMLE question generation + vetting as a DSPy Module.
    
    This module represents the complete LLM-backed pipeline:
    1. Documentation search (Exa + Firecrawl)
    2. Optional gap analysis
    3. Question generation with validation correction loop
    4. Semantic deduplication with retry
    5. Factual evaluation (with Exa research per option)
    
    All context-building and LLM operations are inside forward() so DSPy's
    compiler can optimize the entire graph. Non-LLM plumbing (Supabase persistence)
    remains outside.
    """
    
    def __init__(
        self,
        max_retries: int = 2,
        max_duplicate_retries: int = 2,
        jaccard_threshold: float = 0.9,
        semantic_threshold: float = 0.85,
        model: str = "openai/gpt-4o",
        max_tokens: int = 100_000,
        temperature: float = 0.7,
    ):
        """Initialize the PMLE question program.
        
        Args:
            max_retries: Max validation correction retries per question
            max_duplicate_retries: Max regeneration attempts for duplicates
            jaccard_threshold: Lexical duplicate threshold (0.0-1.0)
            semantic_threshold: Semantic duplicate threshold (0.0-1.0)
            model: OpenRouter model identifier
            max_tokens: Maximum tokens for generation
            temperature: Sampling temperature
        """
        super().__init__()
        
        # Store config
        self.max_retries = max_retries
        self.max_duplicate_retries = max_duplicate_retries
        self.jaccard_threshold = jaccard_threshold
        self.semantic_threshold = semantic_threshold
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        
        # Setup DSPy
        self._setup_dspy()
        
        # Core abilities (DSPy Signatures wrapped in ChainOfThought)
        self.gap_analyzer = dspy.ChainOfThought(GapAnalysisSignature)
        self.question_gen = dspy.ChainOfThought(PmleQuestionSignature)
        self.question_corrector = dspy.ChainOfThought(QuestionCorrectionSignature)
        self.factual_corrector = dspy.ChainOfThought(FactualCorrectionSignature)
        self.option_evaluator = dspy.ChainOfThought(OptionEvalSignature)
    
    def _setup_dspy(self):
        """Configure DSPy with OpenRouter language model."""
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY not found in environment variables. "
                "Please set it in your .env file."
            )
        
        logger.info(f"Configuring DSPy with OpenRouter model: {self.model}")
        try:
            dspy.configure_cache(
                enable_disk_cache=False,
                enable_memory_cache=False
            )
            
            lm = dspy.LM(
                model=self.model,
                api_key=api_key,
                api_base="https://openrouter.ai/api/v1",
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                cache=False,
            )
            dspy.configure(lm=lm)
            logger.info("DSPy configured successfully with OpenRouter")
        except Exception as e:
            logger.error(f"Failed to configure DSPy with OpenRouter: {e}")
            raise
    
    @traceable_decorator(
        name="pmle_question_program_forward",
        project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation")
    )
    def forward(
        self,
        # Domain inputs
        domain_context: str,
        domain_name: str,
        services: List[str],
        # Gap analysis inputs (optional)
        existing_questions_summary: str = "",
        domain_topics: str = "",
        # Generation inputs
        difficulty: str = "MEDIUM",
        exam_subsection: str = "",
        gap_analysis_guidance: str = "",
        # Dedupe inputs
        existing_norm_stems: Optional[List[str]] = None,
        existing_embeddings: Optional[List[List[float]]] = None,
        # Options
        skip_eval: bool = False,
        max_regenerations: int = 3,
    ) -> ProgramOutput:
        """Generate and vet a PMLE question end-to-end.
        
        This is the main entry point that DSPy's compiler can optimize.
        All LLM-backed steps and context-building are inside this method.
        
        Args:
            domain_context: Domain-specific context (services, topics, guidance)
            domain_name: Display name of the domain
            services: List of relevant Google Cloud services
            existing_questions_summary: Summary of existing questions for gap analysis
            domain_topics: List of topics that should be covered
            difficulty: Difficulty level (EASY, MEDIUM, HARD)
            exam_subsection: Optional exam subsection code (e.g., "1.1", "2.3")
            gap_analysis_guidance: Optional guidance item from gap analysis
            existing_norm_stems: Normalized stems for lexical dedupe
            existing_embeddings: Embeddings for semantic dedupe
            skip_eval: Skip factual evaluation (faster but less accurate)
            max_regenerations: Maximum number of regeneration attempts if evaluation fails (default: 3)
            
        Returns:
            ProgramOutput with question, evaluation results, and metadata
        """
        # Initialize defaults
        if existing_norm_stems is None:
            existing_norm_stems = []
        if existing_embeddings is None:
            existing_embeddings = []
        
        # 1. Fetch documentation (Exa + Firecrawl)
        logger.debug(f"Fetching documentation for domain: {domain_name}")
        try:
            # Note: doc_search.py will handle its own tracing, but we wrap here for visibility
            documentation_context, doc_links = search_google_docs(
                topic=domain_name,
                services=services,
                num_results=5
            )
            logger.debug(f"Found {len(doc_links)} documentation links")
        except Exception as e:
            logger.warning(f"Documentation search failed: {e}, continuing without docs")
            documentation_context = ""
            doc_links = []
        
        # 2. Optional gap analysis
        gap_analysis = None
        if existing_questions_summary and domain_topics:
            try:
                gap_analysis = self._run_gap_analysis(
                    domain_context=domain_context,
                    existing_questions_summary=existing_questions_summary,
                    domain_topics=domain_topics,
                )
                # Use gap analysis guidance if provided, otherwise pick from results
                if not gap_analysis_guidance and gap_analysis:
                    guidance_items = gap_analysis.get("generation_guidance_items", [])
                    if guidance_items:
                        gap_analysis_guidance = guidance_items[0]
            except Exception as e:
                logger.warning(f"Gap analysis failed: {e}, continuing without guidance")
        
        # 3. Question generation with regeneration loop (for validation and factual failures)
        question = None
        stem_embedding = None
        validation_result = None
        is_duplicate = False
        attempts = 0
        factual_eval = None
        need_regeneration = False  # Flag to track if we need to regenerate from scratch
        
        # Outer regeneration loop: regenerate from scratch if validation or factual evaluation fails
        for regen_attempt in range(max_regenerations):
            need_regeneration = False  # Reset flag for each regeneration attempt
            
            # Inner duplicate retry loop
            for attempt in range(self.max_duplicate_retries + 1):
                attempts = attempt + 1
                
                # 3a. Generate question (with validation correction loop)
                try:
                    with trace("generate_with_validation", metadata={
                        "regen_attempt": regen_attempt + 1,
                        "duplicate_retry": attempt + 1,
                        "difficulty": difficulty,
                    }) as gen_run:
                        if gen_run:
                            gen_run.inputs = {
                                "difficulty": difficulty,
                                "exam_subsection": exam_subsection or "",
                                "regen_attempt": regen_attempt + 1,
                                "duplicate_retry": attempt + 1,
                            }
                        
                        question, validation_result = self._generate_with_correction(
                            domain_context=domain_context,
                            documentation_context=documentation_context,
                            difficulty=difficulty,
                            exam_subsection=exam_subsection,
                            gap_analysis_guidance=gap_analysis_guidance,
                        )
                        
                        if gen_run:
                            gen_run.end(outputs={
                                "is_valid": validation_result.is_valid,
                                "error_count": len(validation_result.errors),
                                "warning_count": len(validation_result.warnings),
                                "stem_preview": question.get("stem", "")[:200] if question else "",
                            })
                except Exception as e:
                    logger.error(f"Question generation failed on attempt {attempts}: {e}")
                    # Return empty question on failure
                    return ProgramOutput(
                        question={},
                        documentation_context=documentation_context,
                        doc_links=doc_links,
                        gap_analysis=gap_analysis,
                        factual_eval=None,
                        stem_embedding=None,
                        validation_result=ValidationResult(
                            is_valid=False,
                            errors=[f"Generation failed: {str(e)}"],
                            review_status="NEEDS_ANSWER_FIX"
                        ),
                        is_duplicate=False,
                        attempts=attempts
                    )
                
                if not question:
                    continue
                
                # 3b. Check if validation failed after all correction attempts
                # If validation still fails, we'll regenerate from scratch (like factual eval)
                if not validation_result.is_valid:
                    if regen_attempt < max_regenerations - 1:
                        logger.info(
                            f"Validation failed after correction attempts (attempt {regen_attempt + 1}/{max_regenerations}). "
                            f"Errors: {validation_result.errors}. Regenerating from scratch..."
                        )
                        question = None
                        validation_result = None
                        need_regeneration = True
                        break  # Break out of duplicate retry loop to regenerate
                    else:
                        logger.warning(
                            f"Validation failed after all regeneration attempts. "
                            f"Final validation errors: {validation_result.errors}"
                        )
                        # Don't set need_regeneration - we'll return this invalid question
                
                # 3c. Check lexical duplicate
                stem = question.get("stem", "")
                if is_duplicate_stem(stem, existing_norm_stems, threshold=self.jaccard_threshold):
                    logger.debug(f"Lexical duplicate detected on attempt {attempts}, retrying...")
                    is_duplicate = True
                    continue  # Retry
                
                # 3d. Compute embedding and check semantic duplicate
                try:
                    with trace("compute_embedding", metadata={
                        "stem_preview": stem[:100],
                        "attempt": attempts,
                    }) as run:
                        # Capture inputs for debugging
                        if run:
                            run.inputs = {
                                "stem": stem[:500],
                                "attempt": attempts,
                            }
                        
                        stem_embedding = get_embedding(stem)
                        if run:
                            run.end(outputs={"embedding_dim": len(stem_embedding) if stem_embedding else 0})
                    
                    if is_semantic_duplicate(
                        stem_embedding,
                        existing_embeddings,
                        threshold=self.semantic_threshold
                    ):
                        logger.debug(f"Semantic duplicate detected on attempt {attempts}, retrying...")
                        is_duplicate = True
                        continue  # Retry
                except Exception as e:
                    logger.warning(f"Semantic duplicate check failed: {e}, continuing without check")
                    # On error, continue without semantic check (fail-open)
                    stem_embedding = None
                
                # If we get here, no duplicates detected - break out of duplicate retry loop
                break
            
            # Check if we need to regenerate due to validation failure
            if need_regeneration:
                continue  # Skip to next regeneration attempt
            
            # If still duplicate after all retries, mark as duplicate
            if attempts > self.max_duplicate_retries + 1 or is_duplicate:
                is_duplicate = True
            
            # 4. Factual evaluation (with multi-hop search)
            if not skip_eval and question:
                try:
                    factual_eval = self._evaluate_options(question)
                except Exception as e:
                    logger.warning(f"Factual evaluation failed: {e}")
                    # Continue without evaluation (fail-open)
                    factual_eval = None
                
                # If evaluation passed, we're done!
                if factual_eval and factual_eval.passed:
                    logger.info(f"Question passed factual evaluation on regeneration attempt {regen_attempt + 1}")
                    break
                
                # If evaluation failed, try to correct based on feedback
                if factual_eval and not factual_eval.passed:
                    logger.info(f"Factual evaluation failed, attempting correction (regen attempt {regen_attempt + 1}/{max_regenerations})")
                    corrected_question = self._correct_factual_issues(
                        question=question,
                        factual_eval=factual_eval,
                        domain_context=domain_context,
                        documentation_context=documentation_context,
                        difficulty=difficulty,
                    )
                    
                    if corrected_question:
                        # Re-evaluate corrected question
                        try:
                            factual_eval = self._evaluate_options(corrected_question)
                            if factual_eval and factual_eval.passed:
                                logger.info(f"Question passed after factual correction on regeneration attempt {regen_attempt + 1}")
                                question = corrected_question
                                break
                        except Exception as e:
                            logger.warning(f"Re-evaluation after correction failed: {e}")
                    
                    # Correction didn't work - regenerate from scratch
                    if regen_attempt < max_regenerations - 1:
                        logger.info(f"Correction failed, regenerating from scratch (attempt {regen_attempt + 2}/{max_regenerations})")
                        question = None
                        factual_eval = None
                        continue
            else:
                # Skip eval or no question - break out of regeneration loop
                break
        
        # If we exhausted all regenerations and still have failures, return what we have
        if factual_eval and not factual_eval.passed:
            logger.warning(f"All {max_regenerations} regeneration attempts exhausted. Question failed factual evaluation.")
            # Return empty question to signal failure
            return ProgramOutput(
                question={},
                documentation_context=documentation_context,
                doc_links=doc_links,
                gap_analysis=gap_analysis,
                factual_eval=factual_eval,
                stem_embedding=stem_embedding,
                validation_result=validation_result or ValidationResult(
                    is_valid=False,
                    errors=["Factual evaluation failed after all regeneration attempts"],
                    review_status="NEEDS_ANSWER_FIX"
                ),
                is_duplicate=is_duplicate,
                attempts=attempts
            )
        
        # If validation failed after all regeneration attempts, return empty question
        if validation_result and not validation_result.is_valid:
            logger.warning(
                f"All {max_regenerations} regeneration attempts exhausted. "
                f"Question failed validation with {len(validation_result.errors)} error(s)."
            )
            # Return empty question to signal failure
            return ProgramOutput(
                question={},
                documentation_context=documentation_context,
                doc_links=doc_links,
                gap_analysis=gap_analysis,
                factual_eval=factual_eval,
                stem_embedding=stem_embedding,
                validation_result=validation_result,
                is_duplicate=is_duplicate,
                attempts=attempts
            )
        
        return ProgramOutput(
            question=question or {},
            documentation_context=documentation_context,
            doc_links=doc_links,
            gap_analysis=gap_analysis,
            factual_eval=factual_eval,
            stem_embedding=stem_embedding,
            validation_result=validation_result or ValidationResult(
                is_valid=False,
                errors=["Generation failed"],
                review_status="NEEDS_ANSWER_FIX"
            ),
            is_duplicate=is_duplicate,
            attempts=attempts
        )
    
    def _run_gap_analysis(
        self,
        domain_context: str,
        existing_questions_summary: str,
        domain_topics: str,
        n_questions: int = 1,
    ) -> Optional[Dict[str, Any]]:
        """Run gap analysis to identify coverage gaps.
        
        Args:
            domain_context: Domain-specific context
            existing_questions_summary: Summary of existing questions
            domain_topics: List of topics that should be covered
            n_questions: Number of questions to generate (for guidance count)
            
        Returns:
            Gap analysis dict with identified_gaps, priority_focus_areas, generation_guidance
        """
        try:
            # Enhance domain context with number of questions to generate
            enhanced_domain_context = f"""{domain_context}

IMPORTANT: Generate EXACTLY {n_questions} distinct guidance items (one per question). 
Each guidance item should address a different gap, topic, or scenario to ensure diverse coverage."""
            
            with trace_dspy_call("dspy_gap_analysis", metadata={
                "n_questions": n_questions,
                "existing_questions_count": len(existing_questions_summary.split("\n")) if existing_questions_summary else 0,
            }) as run:
                # Capture inputs for debugging
                if run:
                    run.inputs = {
                        "domain_context": domain_context[:500],
                        "existing_questions_summary": existing_questions_summary[:500] if existing_questions_summary else "",
                        "domain_topics": domain_topics[:500] if domain_topics else "",
                        "n_questions": n_questions,
                    }
                
                result = self.gap_analyzer(
                    domain_context=enhanced_domain_context,
                    existing_questions_summary=existing_questions_summary,
                    domain_topics=domain_topics,
                    config={
                        "rollout_id": int(time.time() * 1000),
                        "temperature": self.temperature,
                    }
                )
                if run:
                    run.end(outputs={
                        "identified_gaps_preview": result.identified_gaps[:200] if hasattr(result, 'identified_gaps') else "",
                        "guidance_items_count": len(self._parse_guidance_items(result.generation_guidance.strip(), n_questions)),
                    })
            
            # Parse generation_guidance into individual items
            guidance_text = result.generation_guidance.strip()
            guidance_items = self._parse_guidance_items(guidance_text, n_questions)
            
            return {
                "identified_gaps": result.identified_gaps.strip(),
                "priority_focus_areas": result.priority_focus_areas.strip(),
                "generation_guidance": guidance_text,
                "generation_guidance_items": guidance_items,
            }
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            return None
    
    def _generate_with_correction(
        self,
        domain_context: str,
        documentation_context: str,
        difficulty: str,
        exam_subsection: str,
        gap_analysis_guidance: str,
    ) -> Tuple[Dict[str, Any], ValidationResult]:
        """Generate question with automatic correction on validation failure.
        
        Args:
            domain_context: Domain-specific context
            documentation_context: Documentation context from search
            difficulty: Difficulty level
            exam_subsection: Exam subsection code
            gap_analysis_guidance: Guidance from gap analysis
            
        Returns:
            Tuple of (question_data, validation_result)
        """
        # Initial generation attempt
        try:
            with trace_dspy_call("dspy_question_gen", metadata={
                "difficulty": difficulty,
                "exam_subsection": exam_subsection or "",
                "has_gap_guidance": bool(gap_analysis_guidance),
            }) as run:
                # Capture inputs for debugging
                if run:
                    run.inputs = {
                        "domain_context": domain_context[:500],
                        "documentation_context": documentation_context[:1000],
                        "difficulty": difficulty,
                        "exam_subsection": exam_subsection or "",
                        "gap_analysis_guidance": gap_analysis_guidance[:300] if gap_analysis_guidance else "",
                    }
                
                result = self.question_gen(
                    domain_context=domain_context,
                    documentation_context=documentation_context,
                    difficulty=difficulty,
                    exam_subsection=exam_subsection or "",
                    gap_analysis_guidance=gap_analysis_guidance or "",
                    config={
                        "rollout_id": int(time.time() * 1000),
                        "temperature": self.temperature,
                    }
                )
                if run:
                    run.end(outputs={
                        "stem_preview": result.stem[:200] if hasattr(result, 'stem') else "",
                        "has_correct_answer": bool(result.correct_answer) if hasattr(result, 'correct_answer') else False,
                    })
            
            # Extract question data
            question_data = {
                "stem": result.stem.strip(),
                "correct_answer": result.correct_answer.strip(),
                "distractor_1": result.distractor_1.strip(),
                "distractor_2": result.distractor_2.strip(),
                "distractor_3": result.distractor_3.strip(),
                "correct_explanation": result.correct_explanation.strip(),
                "distractor_1_explanation": result.distractor_1_explanation.strip(),
                "distractor_2_explanation": result.distractor_2_explanation.strip(),
                "distractor_3_explanation": result.distractor_3_explanation.strip(),
            }
            
            # Validate
            validation_result = validate_question(question_data)
            
            if validation_result.is_valid:
                return question_data, validation_result
            
            # Retry loop for validation failures
            logger.debug(f"Initial generation failed validation, attempting corrections...")
            for retry_attempt in range(1, self.max_retries + 1):
                try:
                    # Format errors and warnings for correction prompt
                    feedback_lines = []
                    if validation_result.errors:
                        feedback_lines.append("CRITICAL ERRORS (must fix):")
                        feedback_lines.extend([f"- {error}" for error in validation_result.errors])
                    if validation_result.warnings:
                        if feedback_lines:
                            feedback_lines.append("")  # Blank line between errors and warnings
                        feedback_lines.append("WARNINGS (should fix for better quality):")
                        feedback_lines.extend([f"- {warning}" for warning in validation_result.warnings])
                    
                    errors_text = "\n".join(feedback_lines)
                    original_question_json = json.dumps(question_data, indent=2)
                    
                    # Call correction signature
                    with trace_dspy_call("dspy_question_correction", metadata={
                        "retry_attempt": retry_attempt,
                        "error_count": len(validation_result.errors),
                        "warning_count": len(validation_result.warnings),
                    }) as run:
                        # Capture inputs for debugging
                        if run:
                            run.inputs = {
                                "validation_errors": errors_text[:500],
                                "original_stem": question_data.get("stem", "")[:200],
                                "difficulty": difficulty,
                                "retry_attempt": retry_attempt,
                            }
                        
                        corrected_result = self.question_corrector(
                            original_question=original_question_json,
                            validation_errors=errors_text,
                            domain_context=domain_context,
                            documentation_context=documentation_context,
                            difficulty=difficulty,
                            config={
                                "rollout_id": int(time.time() * 1000),
                                "temperature": self.temperature,
                            }
                        )
                        if run:
                            run.end(outputs={
                                "corrected_stem_preview": corrected_result.stem[:200] if hasattr(corrected_result, 'stem') else "",
                            })
                    
                    # Extract corrected question data
                    question_data = {
                        "stem": corrected_result.stem.strip(),
                        "correct_answer": corrected_result.correct_answer.strip(),
                        "distractor_1": corrected_result.distractor_1.strip(),
                        "distractor_2": corrected_result.distractor_2.strip(),
                        "distractor_3": corrected_result.distractor_3.strip(),
                        "correct_explanation": corrected_result.correct_explanation.strip(),
                        "distractor_1_explanation": corrected_result.distractor_1_explanation.strip(),
                        "distractor_2_explanation": corrected_result.distractor_2_explanation.strip(),
                        "distractor_3_explanation": corrected_result.distractor_3_explanation.strip(),
                    }
                    
                    # Validate corrected question
                    validation_result = validate_question(question_data)
                    
                    if validation_result.is_valid:
                        logger.debug(f"Question corrected successfully on attempt {retry_attempt + 1}")
                        return question_data, validation_result
                    
                except Exception as e:
                    logger.error(f"Correction attempt {retry_attempt} failed: {e}")
                    # Continue to next retry
            
            # All retries exhausted
            logger.warning(
                f"Question generation exhausted {self.max_retries} retry attempts. "
                f"Final validation has {len(validation_result.errors)} errors."
            )
            return question_data, validation_result
            
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            raise
    
    def _evaluate_options(self, question: Dict[str, Any]) -> QuestionEvalResult:
        """Evaluate all 4 options of a question for factual accuracy with multi-hop search.
        
        Uses Exa research with multi-hop search to ground truth-checking for each option.
        
        Args:
            question: Question data dict with stem, options, and explanations
            
        Returns:
            QuestionEvalResult with overall pass/fail and per-option results
        """
        from shared.eval_accuracy import OptionEvaluator
        
        evaluator = OptionEvaluator(model=self.model)
        stem = question["stem"]
        
        # Evaluate all 4 options with multi-hop search
        option_results = [
            evaluator.evaluate_single_option(
                stem=stem,
                option_text=question["correct_answer"],
                explanation=question["correct_explanation"],
                is_correct=True,
                option_label="A",
                max_search_hops=3
            ),
            evaluator.evaluate_single_option(
                stem=stem,
                option_text=question["distractor_1"],
                explanation=question["distractor_1_explanation"],
                is_correct=False,
                option_label="B",
                max_search_hops=3
            ),
            evaluator.evaluate_single_option(
                stem=stem,
                option_text=question["distractor_2"],
                explanation=question["distractor_2_explanation"],
                is_correct=False,
                option_label="C",
                max_search_hops=3
            ),
            evaluator.evaluate_single_option(
                stem=stem,
                option_text=question["distractor_3"],
                explanation=question["distractor_3_explanation"],
                is_correct=False,
                option_label="D",
                max_search_hops=3
            ),
        ]
        
        # Overall pass if no options have FAIL verdict
        passed = all(result.verdict != "FAIL" for result in option_results)
        
        # Build overall reasoning
        failed_options = [r for r in option_results if r.verdict == "FAIL"]
        
        if failed_options:
            overall_reasoning = f"FAILED options: {', '.join([r.option_label for r in failed_options])}"
        else:
            overall_reasoning = "All options passed factual accuracy evaluation"
        
        return QuestionEvalResult(
            passed=passed,
            option_results=option_results,
            overall_reasoning=overall_reasoning
        )
    
    def _correct_factual_issues(
        self,
        question: Dict[str, Any],
        factual_eval: QuestionEvalResult,
        domain_context: str,
        documentation_context: str,
        difficulty: str,
    ) -> Optional[Dict[str, Any]]:
        """Correct a question based on factual evaluation feedback.
        
        Args:
            question: Original question data dict
            factual_eval: QuestionEvalResult with failed options and issues
            domain_context: Domain-specific context
            documentation_context: Documentation context
            difficulty: Difficulty level
            
        Returns:
            Corrected question data dict, or None if correction failed
        """
        # Build evaluation feedback string
        failed_options = [r for r in factual_eval.option_results if r.verdict == "FAIL"]
        if not failed_options:
            return None
        
        feedback_lines = []
        research_context_parts = []
        
        for option_result in failed_options:
            feedback_lines.append(
                f"Option {option_result.option_label}: {option_result.issues}"
            )
            # Collect research URLs for context
            research_context_parts.extend(option_result.research_urls)
        
        evaluation_feedback = "\n".join(feedback_lines)
        
        # Format research context from failed options
        research_context = "\n".join([
            f"Research URL: {url}" for url in set(research_context_parts)
        ]) if research_context_parts else "No specific research context available."
        
        # Format original question as JSON
        try:
            import json
            original_question_json = json.dumps(question, indent=2)
        except Exception as e:
            logger.warning(f"Failed to serialize question to JSON: {e}, using string representation")
            original_question_json = str(question)
        
        try:
            # Call factual correction signature
            with trace_dspy_call("dspy_factual_correction", metadata={
                "failed_options": [r.option_label for r in failed_options],
                "failed_options_count": len(failed_options),
            }) as run:
                # Capture inputs for debugging
                if run:
                    run.inputs = {
                        "evaluation_feedback": evaluation_feedback[:500],
                        "original_stem": question.get("stem", "")[:200],
                        "failed_options": [r.option_label for r in failed_options],
                        "research_urls": list(set(research_context_parts))[:5],
                    }
                
                corrected_result = self.factual_corrector(
                    original_question=original_question_json,
                    evaluation_feedback=evaluation_feedback,
                    research_context=research_context,
                    domain_context=domain_context,
                    documentation_context=documentation_context,
                    difficulty=difficulty,
                    config={
                        "rollout_id": int(time.time() * 1000),
                        "temperature": self.temperature,
                    }
                )
                if run:
                    run.end(outputs={
                        "corrected_stem_preview": corrected_result.stem[:200] if hasattr(corrected_result, 'stem') else "",
                    })
            
            # Extract corrected question data
            corrected_question = {
                "stem": corrected_result.stem.strip(),
                "correct_answer": corrected_result.correct_answer.strip(),
                "distractor_1": corrected_result.distractor_1.strip(),
                "distractor_2": corrected_result.distractor_2.strip(),
                "distractor_3": corrected_result.distractor_3.strip(),
                "correct_explanation": corrected_result.correct_explanation.strip(),
                "distractor_1_explanation": corrected_result.distractor_1_explanation.strip(),
                "distractor_2_explanation": corrected_result.distractor_2_explanation.strip(),
                "distractor_3_explanation": corrected_result.distractor_3_explanation.strip(),
            }
            
            logger.info(f"Factual correction completed for question")
            return corrected_question
            
        except Exception as e:
            logger.error(f"Factual correction failed: {e}")
            return None
    
    def _parse_guidance_items(self, guidance_text: str, n_questions: int) -> List[str]:
        """Parse guidance text into individual guidance items.
        
        Args:
            guidance_text: Raw guidance text from LLM
            n_questions: Expected number of items
            
        Returns:
            List of individual guidance strings
        """
        import re
        
        if not guidance_text:
            return [""] * n_questions
        
        # Try to extract numbered list items (1., 2., 3., etc.)
        numbered_pattern = r'^\s*\d+[\.\)]\s*(.+)$'
        numbered_items = re.findall(numbered_pattern, guidance_text, re.MULTILINE)
        
        if numbered_items and len(numbered_items) >= n_questions // 2:
            items = [item.strip() for item in numbered_items]
        else:
            # Try bullet points (-, *, •)
            bullet_pattern = r'^\s*[-*•]\s*(.+)$'
            bullet_items = re.findall(bullet_pattern, guidance_text, re.MULTILINE)
            
            if bullet_items and len(bullet_items) >= n_questions // 2:
                items = [item.strip() for item in bullet_items]
            else:
                # Fall back to splitting by double newlines or single newlines
                paragraphs = [p.strip() for p in guidance_text.split('\n\n') if p.strip()]
                if len(paragraphs) >= n_questions // 2:
                    items = paragraphs
                else:
                    lines = [line.strip() for line in guidance_text.split('\n') if line.strip() and len(line.strip()) > 10]
                    items = lines if lines else [guidance_text]
        
        # Pad or truncate to exactly n_questions items
        if len(items) < n_questions:
            while len(items) < n_questions:
                items.append(items[-1] if items else "")
        elif len(items) > n_questions:
            items = items[:n_questions]
        
        return items
