"""Typed decision design before retrieval and fail-closed official-doc veto."""
from __future__ import annotations

import json
import time
from typing import Annotated

import dspy
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from shared.doc_search import documentation_context
from shared.evidence import OptionEvidence, check_evidence
from shared.question_style import STYLE_INSTRUCTIONS

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class RealisticMistake(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    action: Text
    scenario_reason: Text


class DecisionPlan(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    objective_id: Text
    engineering_decision: Text
    business_consequence: Text
    existing_system: Text
    decisive_constraints: Annotated[list[Text], Field(min_length=1, max_length=2)]
    best_action: Text
    mistakes: Annotated[list[RealisticMistake], Field(min_length=3, max_length=3)]


class DecisionPlanSignature(dspy.Signature):
    """Design an engineering decision BEFORE retrieving detailed documentation.

    Ask what an ML engineer should do to achieve an outcome. Choose one primary
    decision within the exact objective. Record the business consequence, existing
    system and one or two decisive constraints. Propose a best action and three
    real mistakes with scenario-specific losing reasons. Prefer unnecessary
    migration, wrong execution mode, wrong metric, or missing validation over
    feature gotchas, arbitrary limits, syntax trivia, or hidden exceptions.
    No sources are supplied at this stage; proposals are unverified, not evidence.
    Follow current short Agent Platform names. If a previous decision is vetoed,
    replace its decision and alternatives; do not retain it with extra constraints,
    prohibitions, security wrappers or exception-padding. Hints never expand scope.
    """
    objective_scope: str = dspy.InputField()
    difficulty: str = dspy.InputField()
    replacement_feedback: str = dspy.InputField(desc="Empty initially; previous unsupported decision and veto on replacement")
    plan: DecisionPlan = dspy.OutputField()


class VerifiedReason(OptionEvidence):
    model_config = ConfigDict(strict=True, extra="forbid")
    scenario_reason: Text


class DecisionProofSignature(dspy.Signature):
    """Use current official docs as a veto, not as inspiration for harder trivia.

    Verify the proposed engineering decision, its best action (A), and all three
    realistic mistakes (B-D). Check decisive capability claims, objective fit,
    scenario-specific losing reasons and whether another action also fits.
    Return supported=false if any capability or rejection reason is unsupported,
    uncertain, relies only on an unsupported-feature gotcha (such as a missing
    format, API parameter or narrow support exception) instead of the planned
    engineering tradeoff, depends on a hidden exception/gotcha, or permits a second best
    answer. Do not revise the scenario or add constraints to manufacture support.
    For a supported plan, return exactly A-D reasons with fetched URL and an exact
    case-sensitive quote <=300 characters from that URL's own text. These receipts
    prove provenance only; final evidence review remains independent. On a veto,
    reasons may be empty and reason must explain why the decision needs replacement.
    """
    objective_scope: str = dspy.InputField()
    proposed_plan: str = dspy.InputField()
    fetched_documentation: str = dspy.InputField()
    supported: bool = dspy.OutputField()
    uniquely_best: bool = dspy.OutputField()
    scenario_reasons_supported: bool = dspy.OutputField()
    no_feature_gotchas: bool = dspy.OutputField()
    reason: str = dspy.OutputField()
    reasons: list[VerifiedReason] = dspy.OutputField()


DecisionPlanSignature.instructions += "\n\n" + STYLE_INSTRUCTIONS


class DecisionVetoError(ValueError):
    """The replacement decision still lacks support; discard the candidate."""


def _predict(signature, inputs, model, reasoning_effort):
    if model == "codex" or model.startswith("codex/"):
        from shared.cli_models import run_signature
        return run_signature(model, signature, inputs, reasoning_effort=reasoning_effort)
    from shared.llm_generator import _generation_lm, GenerationOutputError
    from shared.cli_models import output_model
    from shared.completion_diagnostics import CompletionCaptureAdapter
    from shared.llm_limits import reject_token_limit
    from dspy.utils.exceptions import AdapterParseError
    lm = _generation_lm(model)
    adapter = CompletionCaptureAdapter(preserve_receipts=True)
    try:
        with reject_token_limit(lm, capture=adapter.capture), dspy.context(adapter=adapter):
            result = dspy.Predict(signature)(**inputs, lm=lm, config={"rollout_id": time.time_ns()})
        return output_model(signature).model_validate({
            key: getattr(result, key) for key in signature.output_fields
        }).model_dump()
    except AdapterParseError:
        raise GenerationOutputError(adapter.raw_response, adapter.capture.failure()) from None


def plan_decision(scope, *, model, difficulty="MEDIUM", replacement_feedback="", reasoning_effort="high", predictor=None):
    inputs = {"objective_scope": scope["domain_prompt"], "difficulty": difficulty,
              "replacement_feedback": replacement_feedback}
    from shared.cli_models import output_model
    output = predictor(**inputs) if predictor else _predict(DecisionPlanSignature, inputs, model, reasoning_effort)
    plan = output_model(DecisionPlanSignature).model_validate(output).model_dump()["plan"]
    if plan["objective_id"] != scope["objective_id"]:
        raise ValueError("Decision plan changed the selected objective")
    actions = [plan["best_action"], *(m["action"] for m in plan["mistakes"])]
    if len(set(a.casefold() for a in actions)) != 4:
        raise ValueError("Decision alternatives must be distinct")
    return plan


def verify_decision(scope, plan, sources, *, model, reasoning_effort="medium", predictor=None):
    from shared.cli_models import output_model
    inputs = {"objective_scope": scope["domain_prompt"], "proposed_plan": json.dumps(plan, ensure_ascii=False),
              "fetched_documentation": documentation_context(sources)}
    raw = predictor(**inputs) if predictor else _predict(DecisionProofSignature, inputs, model, reasoning_effort)
    proof = output_model(DecisionProofSignature).model_validate(raw).model_dump()
    receipts = [{k: row[k] for k in ("option_label", "url", "quote")} for row in proof["reasons"]]
    checked = check_evidence(receipts, sources)
    proof["mechanical_check"] = {"passed": checked["passed"], "errors": checked["errors"]}
    proof["passed"] = all(proof[k] is True for k in (
        "supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas"
    )) and checked["passed"]
    if not proof["reason"].strip():
        proof["passed"] = False
    return proof


def writer_decision_context(scope, plan, proof):
    """Render verified decision hints; docs must not displace the primary task."""
    if not proof.get("passed"):
        raise DecisionVetoError("Unsupported decision must not reach the writer")
    return (scope["domain_prompt"] + "\n\nVerified decision plan (write this decision, not documentation trivia):\n"
            + json.dumps(plan, ensure_ascii=False) + "\nVerified scenario reasons:\n"
            + json.dumps(proof["reasons"], ensure_ascii=False)
            + "\nKeep one clear task and comparable option granularity. Do not add wants, exceptions, "
              "feature gotchas or unsupported capability claims. Evidence stays outside learner prose.")
