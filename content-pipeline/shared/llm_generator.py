"""LLM-backed question generator using DSPy.

This module provides question generation using DSPy with OpenRouter,
generating scoped certification questions and then citing their finished options.
"""

import os
import time
import logging
import json
from typing import Dict, Any, Optional, Callable, Tuple
import dspy
from shared.completion_diagnostics import CompletionCaptureAdapter, MAX_RAW_RESPONSE, _safe_completion
from shared.evidence import OptionEvidence
from shared.question_style import STYLE_INSTRUCTIONS
from shared.llm_limits import MaxTokensTruncation, TRUNCATION_REASON, reject_token_limit

from shared.tracing import traceable_decorator

logger = logging.getLogger(__name__)


class PmleQuestionSignature(dspy.Signature):
    """Generate a question within the supplied certification registry objective scope.

    Follow the supplied STYLE guidance and certification level. Produce exactly
    four reasonable options with one best answer and per-option explanations.
    Use the founder's purpose-first style, allowing business-first or task-first openings, at the supplied certification level.
    A is correct_answer; B, C and
    D are distractor_1, distractor_2 and distractor_3 respectively.
    Every technical claim in all four explanations must be documented in the
    supplied sources, including claims that alternatives cannot meet a constraint.
    Each distractor must fail one decisive constraint explicitly stated in the stem;
    do not reject an otherwise valid option using an unstated preference.
    Test the exact target registry objective, not a neighboring objective. For
    PMLE's model-version comparison objective 4.1:4, compare model versions using
    A/B testing or a canary; rolling
    replacement alone does not test model-version comparison.
    """
    # Input fields
    domain_context: str = dspy.InputField(
        description=(
            "High-level domain guidance including exam weight, services, topics, and guidance. "
            "May include subsection-specific context (e.g., '1.1', '1.2') with detailed considerations. "
            "Use this to understand the exam domain structure and focus areas."
        )
    )
    documentation_context: str = dspy.InputField(
        description=(
            "Authoritative Google Cloud docs. ALL technical claims in the question, "
            "options, and every explanation MUST be supported by this context. Do not invent features."
        )
    )
    difficulty: str = dspy.InputField(
        description="Difficulty level: EASY, MEDIUM, or HARD"
    )
    exam_subsection: str = dspy.InputField(
        description=(
            "Optional exam subsection code (e.g., '1.1', '2.3') to target specific exam subsection. "
            "If provided, focus the question on the considerations and services for that subsection. "
            "If empty, generate a question covering the broader domain."
        ),
        default=""
    )
    gap_analysis_guidance: str = dspy.InputField(
        description=(
            "Optional guidance on coverage gaps to address. If provided, prioritize generating "
            "questions that fill these gaps (underrepresented topics, services, or scenarios). "
            "If empty, generate questions following standard domain guidance."
        ),
        default=""
    )
    
    # Output fields
    stem: str = dspy.OutputField(
        description=(
            "Question appropriate to the registry objective and certification level, using ONLY documented facts. "
            "For a scenario, state the constraints needed to distinguish the best answer. "
            "Ask one clear single-answer question."
        )
    )
    
    # Answer options with individual explanations
    correct_answer: str = dspy.OutputField(
        description=(
            "Solution that satisfies ALL constraints using services from documentation_context. "
            "Must be the single best answer for the scenario."
        )
    )
    correct_explanation: str = dspy.OutputField(
        description=(
            "Explain step-by-step: 1) Key constraints from stem "
            "2) How solution addresses each constraint "
            "3) Reference specific services/features from docs by name (e.g., 'Cloud Run', 'BigQuery') "
            "4) Why alternatives fail at least one constraint. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )
    
    distractor_1: str = dspy.OutputField(
        description=(
            "Plausible but incorrect solution that violates ONE specific requirement from stem. "
            "Base on real services in documentation_context."
        )
    )
    distractor_1_explanation: str = dspy.OutputField(
        description=(
            "State exactly which requirement this fails (e.g., latency, cost, governance) "
            "and why, citing documentation_context. Do NOT say it is 'less optimal'; show why it is wrong."
        )
    )
    
    distractor_2: str = dspy.OutputField(
        description=(
            "Plausible but incorrect solution that violates a different requirement. "
            "Test service choice errors or scalability limitations."
        )
    )
    distractor_2_explanation: str = dspy.OutputField(
        description=(
            "Explain which specific requirement this violates, focusing on service choice errors, "
            "scalability limitations, or cost inefficiencies. Cite documentation_context. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )
    
    distractor_3: str = dspy.OutputField(
        description=(
            "Plausible but incorrect solution that violates another requirement. "
            "Test architecture anti-patterns or operational issues."
        )
    )
    distractor_3_explanation: str = dspy.OutputField(
        description=(
            "Explain which requirement this violates, focusing on architecture patterns, "
            "security issues, or operational complexity. Compare to better approaches from docs. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )


class QuestionCorrectionSignature(dspy.Signature):
    """Correct a scoped certification question based on validation errors.
    
    Takes the original question output and validation errors, then produces
    a corrected version that addresses all validation issues.
    """
    # Input fields
    original_question: str = dspy.InputField(
        description=(
            "Original question data in JSON format with fields: stem, correct_answer, "
            "distractor_1, distractor_2, distractor_3, correct_explanation, "
            "distractor_1_explanation, distractor_2_explanation, distractor_3_explanation"
        )
    )
    validation_errors: str = dspy.InputField(
        description=(
            "Validation feedback including CRITICAL ERRORS (must fix) and WARNINGS (should fix). "
            "Each item describes a specific issue with the original question (e.g., 'Stem too short', "
            "'Explanation contains references', 'Missing required field', 'Distractor explanation should explain why it's wrong'). "
            "Address ALL errors in the corrected version. Also address warnings to improve quality."
        )
    )
    domain_context: str = dspy.InputField(
        description=(
            "High-level domain guidance including exam weight, services, topics, and guidance. "
            "May include subsection-specific context with detailed considerations."
        )
    )
    documentation_context: str = dspy.InputField(
        description=(
            "Authoritative Google Cloud docs. ALL technical claims in the question, "
            "options, and every explanation MUST be supported by this context. Do not invent features."
        )
    )
    difficulty: str = dspy.InputField(
        description="Difficulty level: EASY, MEDIUM, or HARD"
    )
    
    # Output fields - same structure as PmleQuestionSignature
    stem: str = dspy.OutputField(
        description=(
            "Corrected question appropriate to the registry objective and certification level, using ONLY documented facts. "
            "For a scenario, state the constraints needed to distinguish the best answer. "
            "Ask one clear single-answer question. "
            "Ensure minimum 20 characters if that was an error."
        )
    )
    
    correct_answer: str = dspy.OutputField(
        description=(
            "Corrected solution that satisfies ALL constraints using services from documentation_context. "
            "Must be the single best answer for the scenario."
        )
    )
    correct_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: 1) Key constraints from stem "
            "2) How solution addresses each constraint "
            "3) Reference specific services/features from docs by name (e.g., 'Cloud Run', 'BigQuery') "
            "4) Why alternatives fail at least one constraint. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names. "
            "Ensure minimum 30 characters (50+ for comprehensive explanation)."
        )
    )
    
    distractor_1: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates ONE specific requirement from stem. "
            "Base on real services in documentation_context."
        )
    )
    distractor_1_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: State exactly which requirement this fails (e.g., latency, cost, governance) "
            "and why, citing documentation_context. Do NOT say it is 'less optimal'; show why it is wrong. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Ensure minimum 30 characters."
        )
    )
    
    distractor_2: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates a different requirement. "
            "Test service choice errors or scalability limitations."
        )
    )
    distractor_2_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: Explain which specific requirement this violates, focusing on service choice errors, "
            "scalability limitations, or cost inefficiencies. Cite documentation_context. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names. "
            "Ensure minimum 30 characters."
        )
    )
    
    distractor_3: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates another requirement. "
            "Test architecture anti-patterns or operational issues."
        )
    )
    distractor_3_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: Explain which requirement this violates, focusing on architecture patterns, "
            "security issues, or operational complexity. Compare to better approaches from docs. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names. "
            "Ensure minimum 30 characters."
        )
    )


class FactualCorrectionSignature(dspy.Signature):
    """Correct a scoped certification question based on factual accuracy evaluation feedback.
    
    Takes the original question output and factual evaluation errors, then produces
    a corrected version that addresses all factual issues found during evaluation.
    """
    # Input fields
    original_question: str = dspy.InputField(
        description=(
            "Original question data in JSON format with fields: stem, correct_answer, "
            "distractor_1, distractor_2, distractor_3, correct_explanation, "
            "distractor_1_explanation, distractor_2_explanation, distractor_3_explanation"
        )
    )
    evaluation_feedback: str = dspy.InputField(
        description=(
            "Specific factual issues found during evaluation. For each failed option, "
            "includes: which option failed (A, B, C, or D), what the issue is, and why "
            "it contradicts the documentation. Address ALL issues in the corrected version."
        )
    )
    research_context: str = dspy.InputField(
        description=(
            "Search results from documentation that contradicted the original answer. "
            "Use this as the source of truth for corrections. All corrections must be "
            "grounded in this research context."
        )
    )
    domain_context: str = dspy.InputField(
        description=(
            "High-level domain guidance including exam weight, services, topics, and guidance. "
            "May include subsection-specific context with detailed considerations."
        )
    )
    documentation_context: str = dspy.InputField(
        description=(
            "Authoritative Google Cloud docs. ALL technical claims in the question, "
            "options, and every explanation MUST be supported by this context. Do not invent features."
        )
    )
    difficulty: str = dspy.InputField(
        description="Difficulty level: EASY, MEDIUM, or HARD"
    )
    
    # Output fields - same structure as PmleQuestionSignature
    stem: str = dspy.OutputField(
        description=(
            "Corrected question appropriate to the registry objective and certification level, using ONLY documented facts. "
            "For a scenario, state the constraints needed to distinguish the best answer. "
            "Ask one clear single-answer question."
        )
    )
    
    correct_answer: str = dspy.OutputField(
        description=(
            "Corrected solution that satisfies ALL constraints using services from documentation_context. "
            "Must be the single best answer for the scenario and must be factually accurate based on research_context."
        )
    )
    correct_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: 1) Key constraints from stem "
            "2) How solution addresses each constraint "
            "3) Reference specific services/features from docs by name (e.g., 'Cloud Run', 'BigQuery') "
            "4) Why alternatives fail at least one constraint. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names. "
            "Must be factually accurate based on research_context."
        )
    )
    
    distractor_1: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates ONE specific requirement from stem. "
            "Base on real services in documentation_context. Must be factually accurate as a distractor."
        )
    )
    distractor_1_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: State exactly which requirement this fails (e.g., latency, cost, governance) "
            "and why, citing documentation_context. Do NOT say it is 'less optimal'; show why it is wrong. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )
    
    distractor_2: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates a different requirement. "
            "Test service choice errors or scalability limitations. Must be factually accurate as a distractor."
        )
    )
    distractor_2_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: Explain which specific requirement this violates, focusing on service choice errors, "
            "scalability limitations, or cost inefficiencies. Cite documentation_context. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )
    
    distractor_3: str = dspy.OutputField(
        description=(
            "Corrected plausible but incorrect solution that violates another requirement. "
            "Test architecture anti-patterns or operational issues. Must be factually accurate as a distractor."
        )
    )
    distractor_3_explanation: str = dspy.OutputField(
        description=(
            "Corrected explanation: Explain which requirement this violates, focusing on architecture patterns, "
            "security issues, or operational complexity. Compare to better approaches from docs. "
            "IMPORTANT: Do NOT include URLs, links, citations, or references. Only mention service names."
        )
    )


# Keep these instructions identical on first generation and both correction paths.
PmleQuestionSignature.instructions += "\n\n" + STYLE_INSTRUCTIONS
QuestionCorrectionSignature.instructions += "\n\n" + STYLE_INSTRUCTIONS
FactualCorrectionSignature.instructions += "\n\n" + STYLE_INSTRUCTIONS


class GapAnalysisSignature(dspy.Signature):
    """Analyze existing questions to identify coverage gaps.
    
    Examines existing questions and domain requirements to identify
    underrepresented topics, services, or scenarios that need more coverage.
    """
    # Input fields
    domain_context: str = dspy.InputField(
        description="High-level domain guidance (services, topics, guidance)"
    )
    existing_questions_summary: str = dspy.InputField(
        description=(
            "Summary of existing questions in this domain. Includes question stems "
            "and difficulty levels. Analyze what topics, services, and scenarios are "
            "already covered."
        )
    )
    domain_topics: str = dspy.InputField(
        description=(
            "List of topics, services, and scenarios that should be covered in this domain. "
            "Compare against existing questions to identify gaps."
        )
    )
    
    # Output fields
    identified_gaps: str = dspy.OutputField(
        description=(
            "Specific gaps in coverage identified by comparing existing questions against "
            "domain requirements. List underrepresented topics, services, scenarios, or "
            "difficulty levels. Be specific and actionable."
        )
    )
    priority_focus_areas: str = dspy.OutputField(
        description=(
            "High-priority areas to focus on for next questions. Rank gaps by importance "
            "and provide clear guidance on what should be prioritized."
        )
    )
    generation_guidance: str = dspy.OutputField(
        description=(
            "Specific guidance for generating questions to fill identified gaps. "
            "Provide EXACTLY the requested number of guidance items, one per question to be generated. "
            "Format as a numbered list (1., 2., 3., etc.) where each item is a concrete, actionable "
            "instruction for generating one question. Each item should specify: topic/service to focus on, "
            "scenario type, or specific gap to address. Be specific and diverse across items."
        )
    )


QUESTION_FIELDS = (
    "stem", "correct_answer", "distractor_1", "distractor_2", "distractor_3",
    "correct_explanation", "distractor_1_explanation", "distractor_2_explanation",
    "distractor_3_explanation",
)


def _question_data(result) -> Dict[str, Any]:
    """Extract only question fields; citations are a separate finished-question step."""
    return {name: getattr(result, name).strip() for name in QUESTION_FIELDS}


class LLMGenerator:
    """Question generator using DSPy with OpenRouter.
    
    This class is now a backward-compatible facade over PMLEQuestionProgram.
    For new code, prefer using PMLEQuestionProgram directly.
    """
    
    def __init__(self, model: str = "openai/gpt-4o", max_tokens: int = 100_000, temperature: float = 0.7):
        """Initialize the LLM generator.
        
        Args:
            model: OpenRouter model identifier (default: "openai/gpt-4o")
                   Examples: "openai/gpt-4o", "anthropic/claude-3-opus", "google/gemini-pro-1.5"
            max_tokens: Maximum tokens for generation (increased to 8000 to accommodate detailed explanations)
            temperature: Sampling temperature (0.0-1.0)
        """
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        
        # Use PMLEQuestionProgram internally
        from shared.pmle_program import PMLEQuestionProgram
        self.program = PMLEQuestionProgram(
            max_retries=2,
            max_duplicate_retries=0,  # Legacy code doesn't use dedupe retries
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        
        # Keep direct access to signatures for backward compatibility
        self.generator = self.program.question_gen
        self.corrector = self.program.question_corrector
        self.gap_analyzer = self.program.gap_analyzer
    
    
    @traceable_decorator(name="generate_question", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
    def generate_question(
        self,
        domain_context: str,
        documentation_context: str,
        difficulty: str = "MEDIUM",
        exam_subsection: str = "",
        gap_analysis_guidance: str = "",
    ) -> Dict[str, Any]:
        """Generate a single PMLE question.
        
        Args:
            domain_context: Domain-specific context (services, topics, guidance, exam weight, subsections)
            documentation_context: Google Cloud documentation context from web search
            difficulty: Difficulty level (EASY, MEDIUM, HARD)
            exam_subsection: Optional exam subsection code (e.g., "1.1", "2.3") to target specific subsection
            gap_analysis_guidance: Optional guidance on coverage gaps to address
            
        Returns:
            Dictionary with keys: stem, correct_answer, distractor_1, distractor_2, distractor_3,
            correct_explanation, distractor_1_explanation, distractor_2_explanation, distractor_3_explanation
            
        Raises:
            Exception: If generation fails
        """
        import time
        logger.info(f"Generating question with difficulty: {difficulty}" + (f", subsection: {exam_subsection}" if exam_subsection else ""))
        
        try:
            # Force fresh generation by adding unique config to bypass any remaining cache
            # Using timestamp-based rollout_id ensures each request is treated as unique
            result = self.generator(
                domain_context=domain_context,
                documentation_context=documentation_context,
                difficulty=difficulty,
                exam_subsection=exam_subsection or "",
                gap_analysis_guidance=gap_analysis_guidance or "",
                config={
                    "rollout_id": int(time.time() * 1000),  # Unique ID for each request
                    "temperature": self.temperature,  # Ensure temperature is applied
                }
            )
            
            # Extract and structure the output
            # Note: correct_answer becomes choice A, distractors become B, C, D
            question_data = _question_data(result)
            
            logger.debug(f"Generated question stem: {question_data['stem'][:100]}...")
            return question_data
            
        except Exception as e:
            logger.error(f"Failed to generate question: {e}")
            raise
    
    @traceable_decorator(name="correct_question", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
    def _correct_question(
        self,
        original_question_json: str,
        validation_errors: str,
        domain_context: str,
        documentation_context: str,
        difficulty: str,
    ) -> Dict[str, Any]:
        """Correct a question based on validation errors.
        
        This is a helper method that wraps the corrector call for tracing purposes.
        
        Args:
            original_question_json: Original question data as JSON string
            validation_errors: Formatted validation error messages
            domain_context: Domain-specific context
            documentation_context: Documentation context
            difficulty: Difficulty level
            
        Returns:
            Corrected question data dictionary
        """
        corrected_result = self.corrector(
            original_question=original_question_json,
            validation_errors=validation_errors,
            domain_context=domain_context,
            documentation_context=documentation_context,
            difficulty=difficulty,
            config={
                "rollout_id": int(time.time() * 1000),
                "temperature": self.temperature,
            }
        )
        
        # Replace the full question; citations must be made after corrections.
        return _question_data(corrected_result)

    @traceable_decorator(name="generate_question_with_retry", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
    def generate_question_with_retry(
        self,
        domain_context: str,
        documentation_context: str,
        difficulty: str = "MEDIUM",
        max_retries: int = 2,
        validator_fn: Optional[Callable] = None,
        exam_subsection: str = "",
        gap_analysis_guidance: str = "",
    ) -> Tuple[Dict[str, Any], int]:
        """Generate a question with automatic retry on validation failure.
        
        If validation fails, sends the validation errors back to the LLM for correction.
        Retries up to max_retries times until validation passes or retries are exhausted.
        
        Args:
            domain_context: Domain-specific context (services, topics, guidance, exam weight, subsections)
            documentation_context: Google Cloud documentation context from web search
            difficulty: Difficulty level (EASY, MEDIUM, HARD)
            max_retries: Maximum number of retry attempts (default: 2)
            validator_fn: Validation function that takes question_data and returns ValidationResult.
                          If None, imports and uses validate_question from shared.validator
            exam_subsection: Optional exam subsection code (e.g., "1.1", "2.3") to target specific subsection
            gap_analysis_guidance: Optional guidance on coverage gaps to address
            
        Returns:
            Tuple of (question_data, attempt_count) where attempt_count includes the initial attempt
            and any retries. Returns the last generated question even if validation ultimately fails.
            
        Raises:
            Exception: If initial generation fails (before validation)
        """
        # Import validator if not provided
        if validator_fn is None:
            from shared.validator import validate_question
            validator_fn = validate_question
        
        # Initial generation attempt
        attempt = 1
        question_data = self.generate_question(
            domain_context=domain_context,
            documentation_context=documentation_context,
            difficulty=difficulty,
            exam_subsection=exam_subsection,
            gap_analysis_guidance=gap_analysis_guidance,
        )
        
        # Validate initial attempt
        validation_result = validator_fn(question_data)
        
        # If valid, return immediately
        if validation_result.is_valid:
            logger.info(f"Question generated successfully on attempt {attempt}")
            return question_data, attempt
        
        # Retry loop for validation failures
        logger.info(f"Initial generation failed validation with {len(validation_result.errors)} errors, attempting corrections...")
        
        for retry_attempt in range(1, max_retries + 1):
            attempt += 1
            logger.info(f"Retry attempt {retry_attempt}/{max_retries}")
            
            # Format validation errors for the correction prompt
            errors_text = "\n".join([f"- {error}" for error in validation_result.errors])
            
            # Format original question as JSON for the correction prompt
            try:
                original_question_json = json.dumps(question_data, indent=2)
            except Exception as e:
                logger.warning(f"Failed to serialize question to JSON: {e}, using string representation")
                original_question_json = str(question_data)
            
            try:
                # Call correction signature (traced via helper method)
                logger.debug(f"Calling correction signature with {len(validation_result.errors)} errors")
                question_data = self._correct_question(
                    original_question_json=original_question_json,
                    validation_errors=errors_text,
                    domain_context=domain_context,
                    documentation_context=documentation_context,
                    difficulty=difficulty,
                )
                
                # Validate corrected question
                validation_result = validator_fn(question_data)
                
                if validation_result.is_valid:
                    logger.info(f"Question corrected successfully on attempt {attempt}")
                    return question_data, attempt
                else:
                    logger.warning(
                        f"Correction attempt {retry_attempt} still has {len(validation_result.errors)} validation errors: "
                        f"{', '.join(validation_result.errors[:3])}"
                    )
                    # Continue to next retry if available
                    
            except Exception as e:
                logger.error(f"Correction attempt {retry_attempt} failed with exception: {e}")
                # If correction fails, return the last known question_data
                # This allows the calling code to decide whether to skip or insert with NEEDS_ANSWER_FIX
                break
        
        # All retries exhausted
        logger.warning(
            f"Question generation exhausted {max_retries} retry attempts. "
            f"Final validation has {len(validation_result.errors)} errors."
        )
        return question_data, attempt
    
    @traceable_decorator(name="analyze_domain_gaps", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
    def analyze_domain_gaps(
        self,
        domain_context: str,
        existing_questions: list[Dict[str, Any]],
        domain_topics: list[str],
        n_questions: int = 10,
    ) -> Dict[str, Any]:
        """Analyze existing questions to identify coverage gaps.
        
        Uses DSPy to analyze what topics, services, scenarios, and exam subsections are underrepresented
        in the existing question set compared to domain requirements. Prioritizes subsections based on exam weight.
        
        Args:
            domain_context: Domain-specific context (services, topics, guidance, exam weight, subsections)
            existing_questions: List of existing question dicts with 'stem', 'difficulty', 'status'
            domain_topics: List of topics/services that should be covered
            n_questions: Number of questions to generate (determines number of guidance items)
            
        Returns:
            Dictionary with keys: identified_gaps, priority_focus_areas, generation_guidance (string),
            and generation_guidance_items (list of individual guidance strings, one per question).
            Returns empty dict if analysis fails or no questions exist.
        """
        if not existing_questions:
            logger.info("No existing questions found, skipping gap analysis")
            return {}
        
        try:
            # Format existing questions summary
            # Limit to avoid token limits - summarize if too many
            max_questions_to_analyze = 50
            questions_to_analyze = existing_questions[:max_questions_to_analyze]
            
            if len(existing_questions) > max_questions_to_analyze:
                logger.info(
                    f"Limiting gap analysis to {max_questions_to_analyze} of {len(existing_questions)} "
                    "existing questions to manage token usage"
                )
            
            questions_summary_lines = []
            for i, q in enumerate(questions_to_analyze, 1):
                stem = q.get('stem', '')[:200]  # Truncate long stems
                difficulty = q.get('difficulty', 'MEDIUM')
                questions_summary_lines.append(
                    f"{i}. [{difficulty}] {stem}..."
                )
            
            existing_questions_summary = "\n".join(questions_summary_lines)
            
            # Format domain topics
            domain_topics_text = "\n".join([f"- {topic}" for topic in domain_topics])
            
            # Use program's gap analysis method
            gap_analysis = self.program._run_gap_analysis(
                domain_context=domain_context,
                existing_questions_summary=existing_questions_summary,
                domain_topics=domain_topics_text,
                n_questions=n_questions,
            )
            
            if gap_analysis:
                logger.info(f"Gap analysis completed successfully, parsed {len(gap_analysis.get('generation_guidance_items', []))} guidance items")
                return gap_analysis
            else:
                return {}
            
        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            return {}


class CitationSignature(dspy.Signature):
    """Cite the factual basis of each option in a finished question, without editing it.

    Return exactly one receipt for each label A, B, C, D. Use only a URL listed
    with fetched source text. Each quote must be a nonempty exact, case-sensitive
    substring of that URL's own text and at most 300 characters. For distractors,
    cite the documented capability or limitation used in the rationale, not an
    endorsement of the incorrect option. Address every mechanical check error.
    """

    finished_question: str = dspy.InputField(desc="Stem and labeled A-D options with their final rationales")
    fetched_sources: str = dspy.InputField(desc="Fetched source URLs and their associated source text")
    check_errors: str = dspy.InputField(desc="Mechanical checker errors from the previous citation attempt, or empty")
    evidence: list[OptionEvidence] = dspy.OutputField(desc="One required option_label, url and quote receipt per A-D option")


GENERATION_MAX_TOKENS = 16000


class GenerationOutputError(ValueError):
    """Question parsing failed, with only a safe actual-completion diagnostic."""

    def __init__(self, raw_response=None, diagnostics=None):
        super().__init__("Question output could not be parsed")
        self.raw_response = raw_response
        self.diagnostics = diagnostics


def _generation_lm(model: str, max_tokens: int = 8000):
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY must be supplied in the environment")
    try:
        return dspy.LM(
            model=model, api_key=api_key, api_base="https://openrouter.ai/api/v1",
            max_tokens=max_tokens, temperature=0.7, cache=False,
        )
    except Exception:
        raise RuntimeError("Generation model initialization failed") from None


def generate_question(
    domain_context: str,
    documentation_context: str,
    model: str = "openai/gpt-4o",
    difficulty: str = "MEDIUM",
    exam_subsection: str = "",
    prompt_version: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate only a question; cite its finished options in a separate call."""
    from dspy.utils.exceptions import AdapterParseError
    if (not isinstance(domain_context, str) or not domain_context.strip()
            or not isinstance(documentation_context, str) or not documentation_context.strip()):
        raise ValueError("Registry objective scope and fetched documentation are required")
    if model == "codex" or model.startswith("codex/"):
        from shared.cli_models import run_signature
        return run_signature(model, PmleQuestionSignature, {
            "domain_context": domain_context, "documentation_context": documentation_context,
            "difficulty": difficulty, "exam_subsection": exam_subsection or "",
            "gap_analysis_guidance": "",
        })
    lm = _generation_lm(model, max_tokens=GENERATION_MAX_TOKENS)
    adapter = CompletionCaptureAdapter()
    predictor = dspy.ChainOfThought(PmleQuestionSignature)
    try:
        with reject_token_limit(lm, capture=adapter.capture), dspy.context(adapter=adapter):
            result = predictor(
                domain_context=domain_context,
                documentation_context=documentation_context,
                difficulty=difficulty,
                exam_subsection=exam_subsection or "",
                gap_analysis_guidance="",
                lm=lm,
                config={"rollout_id": time.time_ns(), "temperature": 0.7},
            )
        return _question_data(result)
    except MaxTokensTruncation:
        raise
    except AdapterParseError:
        raise GenerationOutputError(adapter.raw_response, adapter.capture.failure()) from None
    except Exception:
        # Never expose a provider exception body, which may contain credentials.
        raise RuntimeError("Question generation request failed") from None


def cite_question(
    question_data: dict,
    sources: list[dict],
    model: str,
    check_errors: list[str] | None = None,
    *,
    max_tokens: int = 8000,
) -> dict:
    """Make one citation call. Root checks and stores every attempt, then retries."""
    from dspy.utils.exceptions import AdapterParseError
    question = {
        "stem": question_data["stem"],
        "options": [
            {"option_label": label, "option": question_data[answer],
             "rationale": question_data[explanation]}
            for label, answer, explanation in [
                ("A", "correct_answer", "correct_explanation"),
                ("B", "distractor_1", "distractor_1_explanation"),
                ("C", "distractor_2", "distractor_2_explanation"),
                ("D", "distractor_3", "distractor_3_explanation"),
            ]
        ],
    }
    fetched = [{"url": source["url"], "requested_url": source.get("requested_url"),
                "text": source["text"]} for source in sources]
    if model == "codex" or model.startswith("codex/"):
        from shared.cli_models import run_signature
        return run_signature(model, CitationSignature, {
            "finished_question": json.dumps(question, ensure_ascii=False),
            "fetched_sources": json.dumps(fetched, ensure_ascii=False),
            "check_errors": "\n".join(check_errors or []),
        })
    adapter = CompletionCaptureAdapter(preserve_receipts=True)
    try:
        lm = _generation_lm(model, max_tokens=max_tokens)
        with reject_token_limit(lm, capture=adapter.capture), dspy.context(adapter=adapter):
            result = dspy.Predict(CitationSignature)(
                finished_question=json.dumps(question, ensure_ascii=False),
                fetched_sources=json.dumps(fetched, ensure_ascii=False),
                check_errors="\n".join(check_errors or []),
                lm=lm,
                config={"rollout_id": time.time_ns(), "temperature": 0.7},
            )
        receipts = result.evidence
        if not isinstance(receipts, list):
            return {"evidence": None, "parse_failure": "Citation evidence is not a list",
                    **_citation_diagnostics(adapter)}
        return {"evidence": [item.model_dump() if isinstance(item, OptionEvidence) else item
                             for item in receipts]}
    except MaxTokensTruncation:
        return {"evidence": None, "parse_failure": TRUNCATION_REASON,
                "error_class": "MaxTokensTruncation", **_citation_diagnostics(adapter)}
    except AdapterParseError:
        return {"evidence": None, "parse_failure": "Citation output could not be parsed",
                **_citation_diagnostics(adapter)}
    except Exception:
        # Transport failures have no completion; never serialize the exception body.
        return {"evidence": None, "parse_failure": "Citation request failed"}


def _citation_diagnostics(adapter):
    diagnostics = adapter.capture.failure()
    if diagnostics is None:
        return {}
    return {"diagnostics": diagnostics,
            **({"raw_response": adapter.raw_response} if adapter.raw_response is not None else {})}
