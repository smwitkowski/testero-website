"""LLM-based factual accuracy evaluation for generated questions.

This module evaluates whether generated questions have factually correct
answers and explanations by using Exa web search to ground truth-checking.
"""

import os
import logging
import time
import re
from dataclasses import dataclass
from typing import Dict, Any, List
import dspy
from dotenv import load_dotenv

from shared.exa_client import search_technical_facts
from shared.tracing import traceable_decorator, trace_dspy_call, trace

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger(__name__)


class QueryRefinementSignature(dspy.Signature):
    """Refine a search query to find missing information."""
    original_query: str = dspy.InputField(
        description="The original search query that was used"
    )
    question_stem: str = dspy.InputField(
        description="The question scenario/stem"
    )
    option_text: str = dspy.InputField(
        description="The answer option text being evaluated"
    )
    missing_information: str = dspy.InputField(
        description="Description of what information is missing or unclear from the previous search"
    )
    
    refined_query: str = dspy.OutputField(
        description=(
            "A refined search query that targets the specific missing information. "
            "Focus on specific Google Cloud services, features, or technical details mentioned in the option. "
            "Make it more specific and targeted than the original query."
        )
    )


class OptionEvalSignature(dspy.Signature):
    """Evaluate a single answer option conservatively."""
    question_stem: str = dspy.InputField(
        description="The question scenario/stem"
    )
    option_text: str = dspy.InputField(
        description="The answer option text to evaluate"
    )
    option_explanation: str = dspy.InputField(
        description="The explanation provided for this option"
    )
    is_marked_correct: bool = dspy.InputField(
        description=(
            "True if this option is labeled as the correct answer in the source data; "
            "False if it is labeled as a distractor."
        )
    )
    research_context: str = dspy.InputField(
        description=(
            "Exa search results summarizing relevant Google Cloud docs. "
            "Use these as the primary source of truth. "
            "If they are ambiguous or incomplete, verdict should be UNCERTAIN."
        )
    )
    
    verdict: str = dspy.OutputField(
        description=(
            "Return exactly one of: 'PASS', 'FAIL', or 'UNCERTAIN'. "
            "PASS = docs support the label; FAIL = docs clearly contradict; "
            "UNCERTAIN = insufficient evidence to judge"
        )
    )
    correctness_accurate: bool = dspy.OutputField(
        description=(
            "True only if you are confident (from research_context) that the label "
            "(correct vs incorrect) is accurate."
        )
    )
    explanation_accurate: bool = dspy.OutputField(
        description=(
            "True only if the explanation is factually correct AND grounded in research_context "
            "or well-known best practices."
        )
    )
    reasoning: str = dspy.OutputField(
        description=(
            "Briefly cite 1-3 concrete facts from research_context supporting your verdict. "
            "If UNCERTAIN, explain what information is missing."
        )
    )
    issues: str = dspy.OutputField(
        description=(
            "If verdict is FAIL, list the specific incorrect claims or contradictions. "
            "If PASS or UNCERTAIN, return an empty string."
        )
    )
    has_references: bool = dspy.OutputField(
        description=(
            "True if the explanation contains URLs, links, citations, or references. "
            "Explanations should NOT contain references - only plain text explaining the answer."
        )
    )
    doc_support: str = dspy.OutputField(
        description=(
            "Return exactly one of: 'supported', 'contradicted', or 'uncertain'. "
            "supported = research_context supports this option; "
            "contradicted = research_context contradicts this option; "
            "uncertain = research_context is ambiguous or incomplete"
        )
    )
    groundedness_score: float = dspy.OutputField(
        description=(
            "On a scale of 0.0 to 1.0, how strongly does this explanation rely on "
            "research_context vs invented facts? 1.0 = fully grounded, 0.0 = mostly invented."
        )
    )
    explanation_quality_score: float = dspy.OutputField(
        description=(
            "On a scale of 0.0 to 1.0, rate the quality of the explanation. "
            "Consider clarity, completeness, and accuracy. 1.0 = excellent, 0.0 = poor."
        )
    )


@dataclass
class OptionEvalResult:
    """Result of evaluating a single answer option."""
    option_label: str  # A, B, C, D
    verdict: str  # "PASS", "FAIL", or "UNCERTAIN"
    passed: bool  # True for PASS or UNCERTAIN (only FAIL blocks insertion)
    correctness_accurate: bool
    explanation_accurate: bool
    reasoning: str
    issues: str
    has_references: bool  # True if explanation contains URLs/citations
    research_urls: List[str]
    # New fields
    doc_support: str = "uncertain"  # "supported", "contradicted", or "uncertain"
    groundedness_score: float = 0.0  # 0.0-1.0
    explanation_quality_score: float = 0.0  # 0.0-1.0
    services_mentioned: List[str] = None  # Extracted GCP services
    services_verified: bool = False  # All services found in research context


@dataclass
class QuestionEvalResult:
    """Result of evaluating an entire question."""
    passed: bool  # True only if ALL options pass
    option_results: List[OptionEvalResult]
    overall_reasoning: str


class OptionEvaluator:
    """Evaluator for single answer options using DSPy and Exa."""
    
    def __init__(self, model: str = "openai/gpt-4o", max_tokens: int = 100_000, temperature: float = 0.3):
        """Initialize the option evaluator.
        
        Args:
            model: OpenRouter model identifier (default: "openai/gpt-4o")
            max_tokens: Maximum tokens for generation (increased to 4000 for detailed analysis)
            temperature: Sampling temperature (lower = more deterministic)
        """
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self._setup_dspy()
        self.evaluator = dspy.ChainOfThought(OptionEvalSignature)
        self.query_refiner = dspy.ChainOfThought(QueryRefinementSignature)
    
    def _setup_dspy(self):
        """Configure DSPy with OpenRouter language model."""
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError(
                "OPENROUTER_API_KEY not found in environment variables. "
                "Please set it in your .env file."
            )
        
        logger.debug(f"Configuring DSPy evaluator with OpenRouter model: {self.model}")
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
        except Exception as e:
            logger.error(f"Failed to configure DSPy evaluator: {e}")
            raise
    
    def _refine_search_query(
        self,
        original_query: str,
        stem: str,
        option_text: str,
        missing_information: str
    ) -> str:
        """Refine a search query based on missing information.
        
        Args:
            original_query: The original search query
            stem: The question stem
            option_text: The option text
            missing_information: Description of what's missing
            
        Returns:
            Refined search query string
        """
        try:
            with trace_dspy_call("dspy_query_refinement", metadata={
                "original_query": original_query[:100],
            }) as run:
                # Capture inputs for debugging
                if run:
                    run.inputs = {
                        "original_query": original_query[:200],
                        "question_stem": stem[:200],
                        "option_text": option_text[:200],
                        "missing_information": missing_information[:300],
                    }
                
                result = self.query_refiner(
                    original_query=original_query,
                    question_stem=stem,
                    option_text=option_text,
                    missing_information=missing_information,
                    config={
                        "rollout_id": int(time.time() * 1000),
                        "temperature": self.temperature,
                    }
                )
                refined_query = result.refined_query.strip() if hasattr(result, 'refined_query') else original_query
                if run:
                    run.end(outputs={"refined_query": refined_query[:100]})
                return refined_query
        except Exception as e:
            logger.warning(f"Query refinement failed: {e}, using original query")
            return original_query
    
    @traceable_decorator(name="evaluate_single_option", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
    def evaluate_single_option(
        self,
        stem: str,
        option_text: str,
        explanation: str,
        is_correct: bool,
        option_label: str = "A",
        max_search_hops: int = 3
    ) -> OptionEvalResult:
        """Evaluate a single answer option for factual accuracy with multi-hop search.
        
        Performs up to max_search_hops searches, refining the query if UNCERTAIN verdict.
        After all hops, if still UNCERTAIN, treats as PASS.
        
        Args:
            stem: The question stem/scenario
            option_text: The answer option text
            explanation: The explanation for this option
            is_correct: Whether this option is marked as correct
            option_label: Label for this option (A, B, C, D)
            max_search_hops: Maximum number of search iterations (default: 3)
            
        Returns:
            OptionEvalResult with evaluation verdict and reasoning
        """
        # Build initial search query
        search_query = f"{stem} {option_text} Google Cloud"
        all_research_urls = []
        final_result = None
        final_verdict = None
        
        # Multi-hop search loop
        for hop in range(max_search_hops):
            logger.debug(f"Search hop {hop + 1}/{max_search_hops} for option {option_label}: {search_query[:80]}...")
            
            # Search Exa for technical facts
            with trace(f"search_hop_{hop+1}", metadata={
                "option_label": option_label,
                "query": search_query[:100],
                "hop_number": hop + 1,
                "max_hops": max_search_hops,
            }) as search_run:
                # Capture inputs for debugging
                if search_run:
                    search_run.inputs = {
                        "query": search_query,
                        "option_label": option_label,
                        "hop_number": hop + 1,
                        "num_results": 3,
                    }
                
                research_results = search_technical_facts(search_query, num_results=3)
                hop_urls = [r["url"] for r in research_results]
                all_research_urls.extend(hop_urls)
                if search_run:
                    search_run.end(outputs={
                        "result_count": len(research_results),
                        "urls": hop_urls[:3],  # Limit to first 3 URLs
                    })
            
            # Format research context for LLM
            if research_results:
                research_context = "\n\n".join([
                    f"Source: {r['title']} ({r['url']})\n{r['text'][:500]}"
                    for r in research_results
                ])
            else:
                research_context = "No research results found. Evaluate based on general knowledge."
                if hop == 0:
                    logger.warning(f"No Exa results for option {option_label}, proceeding without research context")
            
            # Run LLM evaluation
            try:
                with trace_dspy_call("option_eval_llm", metadata={
                    "option_label": option_label,
                    "hop_number": hop + 1,
                    "has_research": bool(research_results),
                    "is_correct": is_correct,
                }) as eval_run:
                    # Capture inputs for debugging
                    if eval_run:
                        eval_run.inputs = {
                            "question_stem": stem[:300],
                            "option_text": option_text[:200],
                            "option_explanation": explanation[:300],
                            "is_marked_correct": is_correct,
                            "research_context": research_context[:500],
                            "hop_number": hop + 1,
                        }
                    
                    result = self.evaluator(
                        question_stem=stem,
                        option_text=option_text,
                        option_explanation=explanation,
                        is_marked_correct=is_correct,
                        research_context=research_context,
                        config={
                            "rollout_id": int(time.time() * 1000),
                            "temperature": self.temperature,
                        }
                    )
                    if eval_run:
                        verdict_upper = result.verdict.strip().upper() if hasattr(result, 'verdict') else "UNCERTAIN"
                        eval_run.end(outputs={
                            "verdict": verdict_upper,
                            "reasoning_preview": result.reasoning[:200] if hasattr(result, 'reasoning') else "",
                        })
                
                # Parse verdict (three-way: PASS, FAIL, UNCERTAIN)
                verdict_upper = result.verdict.strip().upper()
                if verdict_upper not in ("PASS", "FAIL", "UNCERTAIN"):
                    verdict_upper = "UNCERTAIN"  # Default to uncertain if parsing fails
                
                final_result = result
                final_verdict = verdict_upper
                
                # If we got a definitive answer (PASS or FAIL), stop searching
                if verdict_upper in ("PASS", "FAIL"):
                    logger.debug(f"Got definitive verdict {verdict_upper} on hop {hop + 1}, stopping search")
                    break
                
                # If UNCERTAIN and not last hop, refine query and continue
                if hop < max_search_hops - 1:
                    missing_info = result.reasoning.strip() if hasattr(result, 'reasoning') else "Need more specific information"
                    with trace("query_refinement", metadata={
                        "option_label": option_label,
                        "hop_number": hop + 1,
                    }) as refine_run:
                        # Capture inputs for debugging
                        if refine_run:
                            refine_run.inputs = {
                                "original_query": search_query[:200],
                                "missing_information": missing_info[:300],
                                "option_label": option_label,
                                "hop_number": hop + 1,
                            }
                        
                        search_query = self._refine_search_query(
                            original_query=search_query,
                            stem=stem,
                            option_text=option_text,
                            missing_information=missing_info
                        )
                        if refine_run:
                            refine_run.end(outputs={"refined_query": search_query[:100]})
                    logger.debug(f"Refining query for next hop: {search_query[:80]}...")
                
            except Exception as e:
                logger.error(f"Failed to evaluate option {option_label} on hop {hop + 1}: {e}")
                # Continue to next hop or use fail-safe below
        
        # After all hops: if still UNCERTAIN, treat as PASS
        if final_verdict == "UNCERTAIN":
            logger.debug(f"After {max_search_hops} hops, verdict is UNCERTAIN - treating as PASS")
            final_verdict = "PASS"
        
        # Parse boolean fields (DSPy may return strings or booleans)
        def parse_bool(value):
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.strip().upper() in ("TRUE", "YES", "1", "PASS")
            return bool(value)
        
        def parse_float(value, default=0.0):
            """Parse float value, handling strings and defaults."""
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                try:
                    return float(value.strip())
                except (ValueError, AttributeError):
                    return default
            return default
        
        # Extract GCP services from option and explanation
        from shared.validator import _extract_gcp_services
        services_mentioned = _extract_gcp_services(option_text + " " + explanation)
        
        # Verify services in research context
        research_context_text = ""
        if research_results:
            research_context_text = "\n\n".join([
                f"{r['title']} {r['text']}"
                for r in research_results
            ])
        
        services_verified = True
        if services_mentioned:
            research_lower = research_context_text.lower()
            for service in services_mentioned:
                service_pattern = r'\b' + re.escape(service.lower()) + r'\b'
                if not re.search(service_pattern, research_lower):
                    services_verified = False
                    break
        
        if final_result:
            correctness_accurate = parse_bool(final_result.correctness_accurate) if hasattr(final_result, 'correctness_accurate') else False
            explanation_accurate = parse_bool(final_result.explanation_accurate) if hasattr(final_result, 'explanation_accurate') else False
            has_references = parse_bool(final_result.has_references) if hasattr(final_result, 'has_references') else False
            reasoning = final_result.reasoning.strip() if hasattr(final_result, 'reasoning') else ""
            issues = final_result.issues.strip() if hasattr(final_result, 'issues') else ""
            
            # Parse new fields
            doc_support = "uncertain"
            if hasattr(final_result, 'doc_support'):
                doc_support_raw = str(final_result.doc_support).strip().lower()
                if doc_support_raw in ("supported", "contradicted", "uncertain"):
                    doc_support = doc_support_raw
                elif final_verdict == "PASS":
                    doc_support = "supported"
                elif final_verdict == "FAIL":
                    doc_support = "contradicted"
            
            groundedness_score = parse_float(
                final_result.groundedness_score if hasattr(final_result, 'groundedness_score') else None,
                default=0.5 if research_results else 0.0
            )
            groundedness_score = max(0.0, min(1.0, groundedness_score))
            
            explanation_quality_score = parse_float(
                final_result.explanation_quality_score if hasattr(final_result, 'explanation_quality_score') else None,
                default=0.5 if explanation_accurate else 0.3
            )
            explanation_quality_score = max(0.0, min(1.0, explanation_quality_score))
        else:
            # Fallback if all hops failed
            correctness_accurate = False
            explanation_accurate = False
            has_references = False
            reasoning = "Evaluation failed on all search hops"
            issues = "Evaluation error occurred"
            doc_support = "uncertain"
            groundedness_score = 0.0
            explanation_quality_score = 0.0
        
        # Only FAIL blocks insertion; PASS (including converted UNCERTAIN) allows insertion
        passed = final_verdict != "FAIL"
        
        # Also check programmatically for references as a backup
        # Note: re is already imported at module level
        explanation_has_refs = bool(
            re.search(r'https?://|www\.|\[[\d\w\s]+\]|\(see\s+[^)]+\)|\(reference|\(source|\(ref|\(docs|\(documentation|See\s*:?\s*|Reference\s*:?\s*', explanation, re.IGNORECASE)
        )
        has_references = has_references or explanation_has_refs
        
        return OptionEvalResult(
            option_label=option_label,
            verdict=final_verdict or "PASS",  # Default to PASS if all failed
            passed=passed,
            correctness_accurate=correctness_accurate,
            explanation_accurate=explanation_accurate,
            reasoning=reasoning,
            issues=issues,
            has_references=has_references,
            research_urls=list(set(all_research_urls)),  # Deduplicate URLs
            doc_support=doc_support,
            groundedness_score=groundedness_score,
            explanation_quality_score=explanation_quality_score,
            services_mentioned=services_mentioned,
            services_verified=services_verified,
        )


@traceable_decorator(name="evaluate_question_accuracy", project_name=os.environ.get("LANGSMITH_PROJECT", "question-generation"))
def evaluate_question_accuracy(
    question_data: Dict[str, Any],
    model: str = "openai/gpt-4o",
    max_search_hops: int = 3
) -> QuestionEvalResult:
    """Evaluate all 4 options of a question for factual accuracy.
    
    Evaluates:
    - Option A (correct): verify it IS the right answer
    - Options B, C, D (distractors): verify they ARE incorrect
    
    Args:
        question_data: Dictionary with keys: stem, correct_answer, distractor_1, distractor_2, distractor_3,
                      correct_explanation, distractor_1_explanation, distractor_2_explanation, distractor_3_explanation
        model: OpenRouter model identifier for evaluation
        max_search_hops: Maximum number of search iterations per option (default: 3)
        
    Returns:
        QuestionEvalResult with overall pass/fail and per-option results
    """
    evaluator = OptionEvaluator(model=model)
    stem = question_data["stem"]
    
    # Evaluate all 4 options with multi-hop search
    option_results = [
        evaluator.evaluate_single_option(
            stem=stem,
            option_text=question_data["correct_answer"],
            explanation=question_data["correct_explanation"],
            is_correct=True,
            option_label="A",
            max_search_hops=max_search_hops
        ),
        evaluator.evaluate_single_option(
            stem=stem,
            option_text=question_data["distractor_1"],
            explanation=question_data["distractor_1_explanation"],
            is_correct=False,
            option_label="B",
            max_search_hops=max_search_hops
        ),
        evaluator.evaluate_single_option(
            stem=stem,
            option_text=question_data["distractor_2"],
            explanation=question_data["distractor_2_explanation"],
            is_correct=False,
            option_label="C",
            max_search_hops=max_search_hops
        ),
        evaluator.evaluate_single_option(
            stem=stem,
            option_text=question_data["distractor_3"],
            explanation=question_data["distractor_3_explanation"],
            is_correct=False,
            option_label="D",
            max_search_hops=max_search_hops
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


