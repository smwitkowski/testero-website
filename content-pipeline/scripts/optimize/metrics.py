"""Frozen production judges as DSPy/GEPA score-and-feedback metrics.

Production doccheck uses the writer model, not the Claude council model:
``scripts.generate_pmle_questions`` calls ``verify_decision(..., model=model)``.
A checker override changes the transport only, never the proof signature.
"""
from collections.abc import Mapping
import math

import dspy

PROOF_FLAGS = ("supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas")


def _mapping(value):
    return dict(value) if value is not None else {}


def _field(value, name, default=None):
    if isinstance(value, Mapping):
        return value.get(name, default)
    return getattr(value, name, default)


def proof_feedback(proof):
    """Score semantic flags, but never give full credit to a vetoed proof."""
    reason = proof.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        return dspy.Prediction(score=0.0, feedback="Doccheck returned no reason; rejected.")
    if any(type(proof.get(flag)) is not bool for flag in PROOF_FLAGS):
        return dspy.Prediction(score=0.0, feedback="Malformed doccheck flags; rejected. " + reason)
    score = sum(proof[flag] for flag in PROOF_FLAGS) / len(PROOF_FLAGS)
    if (proof.get("passed") is not True or proof.get("mechanical_check", {}).get("passed") is not True
            or proof.get("failing_options")):
        score = min(score, 0.75)
    failures = [flag for flag in PROOF_FLAGS if proof[flag] is not True]
    failures.extend(proof.get("mechanical_check", {}).get("errors", []))
    failures.extend("Failing option " + str(label) for label in proof.get("failing_options", []))
    return dspy.Prediction(score=score, feedback=reason + ("\n" + "; ".join(failures) if failures else ""))


def make_plan_metric(*, writer_model, checker_model=None, checker_temperature=0.0, verifier=None):
    """Use the unmodified production proof and mechanical receipt checks.

    ``verifier`` has the same interface as ``shared.decision_planner.verify_decision``.
    Gold examples carry ``scope`` and full frozen ``sources``. Missing sources
    fail closed; a recorded proof is never substituted for candidate verification.
    """
    if not isinstance(writer_model, str) or not writer_model.strip():
        raise ValueError("A writer model is required to resolve the production checker")
    model = writer_model if checker_model is None else checker_model
    if not isinstance(model, str) or not model.strip():
        raise ValueError("A nonempty checker model is required")
    if verifier is None:
        from shared.decision_planner import verify_decision
        verifier = verify_decision

    def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
        scope = _field(gold, "scope")
        sources = _field(gold, "sources")
        plan = _field(pred, "plan")
        if not isinstance(scope, dict) or not isinstance(plan, dict) or not (sources or _field(gold, "objective_corpus")):
            return dspy.Prediction(score=0.0, feedback="Missing scope, candidate plan, or frozen documentation; rejected.")
        if plan.get("objective_id") != scope.get("objective_id"):
            return dspy.Prediction(score=0.0, feedback="Candidate plan changed the objective; rejected.")
        from scripts.optimize.corpus import sources_for_record
        sources = sources_for_record({"scope": scope, "sources": sources,
                                      "objective_corpus": _field(gold, "objective_corpus")}, plan)
        proof = verifier(scope, plan, sources, model=model, reasoning_effort="medium", stable_prefix=True,
                         temperature=checker_temperature)
        return proof_feedback(_mapping(proof))

    return metric


def make_draft_metric(*, judge_model="claude", include_evidence=False, runner=None):
    """Run frozen Style (and optional Evidence) signatures through Claude CLI.

    ``runner(model, signature, inputs)`` supports offline fakes. No judge prompt
    is edited. All required checks still apply; UNCERTAIN cannot receive a pass.
    """
    if judge_model != "claude" and not judge_model.startswith("claude/"):
        raise ValueError("Draft metrics require the unchanged Claude CLI critic")
    if runner is None:
        from shared.cli_models import run_signature
        runner = run_signature

    def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
        from shared.gates import build_gate_inputs, evaluate_gate, gate_signatures
        from shared.quality_gate import QUESTION_FIELDS
        scope = _field(gold, "scope", {}) or {}
        stored_inputs = _field(gold, "inputs", {}) or {}
        candidate = _field(pred, "question")
        candidate = _mapping(pred) if candidate is None else _mapping(candidate)
        if any(not isinstance(candidate.get(name), str) or not candidate[name].strip() for name in QUESTION_FIELDS):
            return dspy.Prediction(score=0.0, feedback="Missing candidate question fields; rejected.")
        documentation = stored_inputs.get("documentation_context", _field(gold, "documentation_context", ""))
        evidence = candidate.get("evidence", [])
        if isinstance(evidence, dict):
            evidence = evidence.get("options", [])
        if include_evidence and (not documentation or not evidence):
            return dspy.Prediction(score=0.0, feedback="Missing frozen documentation or candidate evidence; rejected.")
        inputs = build_gate_inputs(candidate, scope.get("domain_prompt", stored_inputs.get("domain_context", "")),
                                   documentation, evidence, style_policy=scope.get("style_policy"))
        signatures = gate_signatures(cert_id=scope.get("cert_id"), style_policy=scope.get("style_policy"),
                                     distractor_evidence=scope.get("distractor_evidence"))
        scores, feedback, passed_gates = [], [], []
        for name in (("style", "evidence") if include_evidence else ("style",)):
            raw = _mapping(runner(judge_model, signatures[name], inputs[name]))
            passed, reason = evaluate_gate(name, raw, candidate, style_policy=scope.get("style_policy"))
            score = raw.get("score")
            if type(score) not in (int, float) or not math.isfinite(score) or not 0 <= score <= 1:
                return dspy.Prediction(score=0.0, feedback="Invalid critic score; rejected.")
            scores.append(float(score) if passed else min(float(score), 0.79))
            passed_gates.append(passed)
            feedback.append(name + ": " + reason)
        aggregate = sum(scores) / len(scores)
        if not all(passed_gates):
            aggregate = min(aggregate, 0.79)
        return dspy.Prediction(score=aggregate, feedback="\n".join(feedback))

    return metric
