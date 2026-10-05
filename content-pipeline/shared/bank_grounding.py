"""Read-only grounding gate for an existing, A-keyed bank question.

No generation, text cleaning, database access, environment-file loading, or file
writes occur here. Retrieval and citation are explicit calls. A mechanical pass
is necessary but never sufficient: an independent judge must also accept.
"""
from copy import deepcopy
from dataclasses import asdict
import re

from shared.doc_search import documentation_context, search_objective_docs
from shared.evidence import check_evidence
from shared.llm_generator import QUESTION_FIELDS, _safe_completion, cite_question
from shared.model_policy import (
    DEFAULT_GENERATOR_MODEL, DEFAULT_JUDGE_MODEL, require_independent_models,
)
from shared.quality_gate import JudgeVerdict, judge_question
from shared.validator import validate_question


def _reason(text: str) -> str:
    return " ".join(_safe_completion(text).split())[:300]


def check_existing_question(
    question: dict,
    scope: dict,
    *,
    model: str = DEFAULT_GENERATOR_MODEL,
    judge_model: str = DEFAULT_JUDGE_MODEL,
) -> dict:
    """Check exact native question fields without changing or persisting them.

    Return all available stage results. Citation receives one retry after a
    mechanical failure, never a regenerated question. Exceptions fail closed
    with fixed stage diagnostics, not provider exception bodies. Scope requires
    objective_text, services, domain_prompt, objective_id, and guide_sha256.
    """
    result = {
        "passed": False, "reasons": [], "question": deepcopy(question),
        "sources": [], "citation_attempts": [], "evidence": [],
        "schema_check": {"passed": False, "errors": ["Not checked"]},
        "mechanical_check": {"passed": False, "errors": ["Not checked"]},
        "judge_verdict": {"passed": False, "score": 0.0,
                          "reason": "Not judged", "model": judge_model},
    }
    stage = "Model policy"
    try:
        require_independent_models(model, judge_model)
        stage = "Input validation"
        if (not isinstance(question, dict) or set(question) != set(QUESTION_FIELDS)
                or any(not isinstance(question[key], str) or not question[key].strip()
                       for key in QUESTION_FIELDS)):
            result["schema_check"] = {"passed": False, "errors": ["Invalid native question fields"]}
            result["reasons"] = result["schema_check"]["errors"].copy()
            return result
        if (not isinstance(scope, dict)
                or any(not isinstance(scope.get(key), str) or not scope[key].strip()
                       for key in ("objective_text", "domain_prompt", "objective_id"))
                or not isinstance(scope.get("services"), list)
                or any(not isinstance(service, str) for service in scope["services"])
                or not isinstance(scope.get("guide_sha256"), str)
                or not re.fullmatch(r"[0-9a-fA-F]{64}", scope["guide_sha256"])):
            result["reasons"] = ["Invalid objective scope"]
            return result
        stage = "Schema validation"
        validation = validate_question(deepcopy(question))
        result["schema_check"] = {
            "passed": validation.is_valid,
            "errors": [_reason(error) for error in validation.errors],
        }
        if not validation.is_valid:
            result["reasons"] = result["schema_check"]["errors"].copy()
            return result
        stage = "Documentation retrieval"
        sources = search_objective_docs(scope["objective_text"], deepcopy(scope["services"]))
        result["sources"] = deepcopy(sources)
        stage = "Documentation validation"
        context = documentation_context(sources)
        checked = None
        for _ in range(2):
            stage = "Citation request"
            citation = cite_question(
                deepcopy(question), deepcopy(sources), model=model,
                check_errors=deepcopy(checked["errors"]) if checked else None,
            )
            stage = "Mechanical evidence check"
            checked = check_evidence(citation.get("evidence"), sources)
            mechanical = {"passed": checked["passed"],
                          "errors": [_reason(error) for error in checked["errors"]]}
            attempt = {"evidence": deepcopy(citation.get("evidence")),
                       "mechanical_check": mechanical}
            for key in ("parse_failure", "raw_response"):
                if isinstance(citation.get(key), str):
                    attempt[key] = _safe_completion(citation[key])
            result["citation_attempts"].append(attempt)
            result["mechanical_check"] = mechanical
            if checked["passed"]:
                break
        if not checked["passed"]:
            result["reasons"] = result["mechanical_check"]["errors"].copy()
            return result
        result["evidence"] = deepcopy(checked["options"])
        stage = "Independent judge"
        verdict = judge_question(
            deepcopy(question), scope["domain_prompt"], documentation_context=context,
            model=judge_model, generator_model=model,
            option_evidence=deepcopy(checked["options"]),
        )
        # Reject malformed injected verdicts too; never interpret truthy values as PASS.
        verdict = JudgeVerdict(**asdict(verdict))
        if verdict.model != judge_model:
            result["reasons"] = ["Independent judge model mismatch"]
            return result
        result["judge_verdict"] = {**asdict(verdict), "reason": _reason(verdict.reason)}
        result["passed"] = verdict.passed
        if not verdict.passed:
            result["reasons"] = [result["judge_verdict"]["reason"]]
        return result
    except Exception:
        result["reasons"] = [stage + " failed"]
        return result
