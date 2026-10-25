"""Frozen doc-check plus calibrated off-council plan-design feedback metrics."""
from collections.abc import Mapping
from copy import deepcopy
import math
from threading import RLock

import dspy

from scripts.optimize.corpus import digest, sources_for_record
from scripts.optimize.plan_critic import (DEFAULT_CRITIC, CRITIC_CHECKS, PlanCriticSignature,
    make_plan_critic, parse_critic, validate_calibration)

PROOF_FLAGS = ("supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas")


def _mapping(value):
    return dict(value) if value is not None else {}


def _field(value, name, default=None):
    if isinstance(value, Mapping):
        return value.get(name, default)
    return getattr(value, name, default)


def proof_feedback(proof, critic=None, *, pred_name=None):
    """1.0 requires both independent passes; docs-only earns .4, else <=.15.

    Plan and repair receive separate actionable feedback. Both retain successes
    so reflection can preserve useful choices rather than rewrite everything.
    """
    reason = proof.get("reason")
    valid = (isinstance(reason, str) and bool(reason.strip())
             and all(type(proof.get(flag)) is bool for flag in PROOF_FLAGS))
    mechanical = proof.get("mechanical_check", {})
    if not isinstance(mechanical, dict):
        mechanical = {}
    failures = [flag for flag in PROOF_FLAGS if proof.get(flag) is not True]
    passed = [flag for flag in PROOF_FLAGS if proof.get(flag) is True]
    errors = mechanical.get("errors", [])
    errors = errors if isinstance(errors, list) else ["Malformed mechanical errors"]
    failures.extend(str(error) for error in errors)
    failing_options = proof.get("failing_options", [])
    failing_options = failing_options if isinstance(failing_options, list) else ["Malformed option labels"]
    failures.extend("Failing option " + str(label) for label in failing_options)
    if mechanical.get("passed") is not True:
        failures.append("mechanical_receipts")
    doc_pass = (valid and all(proof.get(flag) is True for flag in PROOF_FLAGS)
                and proof.get("passed") is True and mechanical.get("passed") is True
                and not errors and not failing_options)
    critic_pass = isinstance(critic, dict) and critic.get("passed") is True
    score = 1.0 if doc_pass and critic_pass else .4 if doc_pass else .15 * len(passed) / len(PROOF_FLAGS) if valid else 0.0
    doc_text = ("Doccheck: " + (reason.strip() if isinstance(reason, str) and reason.strip() else "Missing or malformed explanation; rejected.")
                + "\nPassed doc checks: " + (", ".join(passed) or "none")
                + "\nFailed doc checks/options: " + ("; ".join(failures) or "none"))
    if critic is None:
        critic_text = "Plan critic: not run; doccheck alone cannot earn full credit."
    else:
        critic_text = ("Plan critic: " + critic.get("reason", "Missing reason")
                       + "\nPassed design checks: " + (", ".join(critic.get("passed_checks", [])) or "none")
                       + "\nFailed design checks: " + (", ".join(critic.get("failed_checks", [])) or "none")
                       + "\nFailed design options: " + (", ".join(critic.get("failing_options", [])) or "none"))
    feedbacks = {
        "plan": "Plan predictor: preserve passed decisions; change only failed design choices.\n" + critic_text + "\n" + doc_text,
        "repair": "Repair predictor: repair flagged options/checks using documented positive facts plus stated constraints; preserve passed options.\n" + doc_text + "\n" + critic_text,
    }
    feedback = feedbacks.get(pred_name, doc_text + "\n" + critic_text)
    return dspy.Prediction(score=score, feedback=feedback, feedback_by_predictor=feedbacks,
                           doccheck_passed=bool(doc_pass), critic_passed=critic_pass)


def make_plan_metric(*, writer_model, checker_model=None, checker_temperature=0.0,
                     critic_model=DEFAULT_CRITIC, critic_calibration=None, critic=None, verifier=None):
    """Build a calibrated plan metric; no saved proof substitutes for verification.

    ``critic(scope, plan)`` may inject a strict critic for offline tests, but still
    requires a valid calibration report. ``metric.check_plan(scope, plan, sources)``
    is a trusted in-memory doc-check cache shared with PlanProgram's veto/repair
    path. Exact scope/plan/ranked-source hashes bind entries; student-supplied
    proofs never enter that cache. Codex temperature is transport-unconfigurable.
    """
    if not isinstance(writer_model, str) or not writer_model.strip():
        raise ValueError("A writer model is required to resolve the production checker")
    model = writer_model if checker_model is None else checker_model
    if not isinstance(model, str) or not model.strip():
        raise ValueError("A nonempty checker model is required")
    if type(checker_temperature) not in (int, float) or checker_temperature != 0:
        raise ValueError("Optimization checker must use the lowest configurable temperature (zero)")
    validate_calibration(critic_calibration, critic_model)
    critic = make_plan_critic(model=critic_model, calibration=critic_calibration) if critic is None else critic
    if verifier is None:
        from shared.decision_planner import verify_decision
        verifier = verify_decision
    proofs, lock = {}, RLock()
    def check_plan(scope, plan, sources):
        key = digest({"scope": scope, "plan": plan, "sources": sources,
                      "checker_model": model, "temperature": checker_temperature})
        with lock:
            if key not in proofs:
                proofs[key] = deepcopy(_mapping(verifier(scope, plan, sources, model=model,
                    reasoning_effort="medium", stable_prefix=True, temperature=checker_temperature)))
            return deepcopy(proofs[key])

    def metric(gold, pred, trace=None, pred_name=None, pred_trace=None):
        scope = _field(gold, "scope")
        sources = _field(gold, "sources")
        plan = _field(pred, "plan")
        if not isinstance(scope, dict) or not isinstance(plan, dict) or not (sources or _field(gold, "objective_corpus")):
            return proof_feedback({"reason": "Missing scope, candidate plan, or frozen documentation; rejected."}, pred_name=pred_name)
        if plan.get("objective_id") != scope.get("objective_id"):
            return proof_feedback({"reason": "Candidate plan changed the objective; rejected."}, pred_name=pred_name)
        sources = sources_for_record({"scope": scope, "sources": sources,
                                      "objective_corpus": _field(gold, "objective_corpus")}, plan)
        proof = check_plan(scope, plan, sources)
        raw = _mapping(critic(scope, plan))
        # Revalidate injected callbacks too. Enriched parsed results can carry
        # provenance, but only frozen schema fields influence the score.
        parsed = parse_critic({key: raw[key] for key in PlanCriticSignature.output_fields}, scope)
        return proof_feedback(proof, parsed, pred_name=pred_name)

    metric.check_plan = check_plan
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
