"""Reviewed objective-scoped style policies; absent policy keeps frozen v5."""
import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[1] / "certs/ml-practice-objectives.json"
RELAXED_STYLE_CHECKS = frozenset({"product_knowledge_hinge", "cloud_specific_alternative", "generic_validation_key"})
ALLOWANCE = "general_ml_mlops"


def _legacy_policy(objective_id):
    reviewed = json.loads(CONFIG.read_text())
    return {"version": "5.1", "objective_id": objective_id,
            "allowance": ALLOWANCE if objective_id in reviewed["objectives"] else None}


def style_policy(objective_id):
    if isinstance(objective_id, str) and objective_id.startswith("data-engineer:"):
        return {"version": "5.3", "objective_id": objective_id, "allowance": None}
    return _legacy_policy(objective_id)


def validate_style_policy(policy, objective_id):
    if not isinstance(objective_id, str) or not objective_id or not isinstance(policy, dict):
        raise ValueError("Style policy differs from reviewed objective allowance")
    accepted = [style_policy(objective_id), _legacy_policy(objective_id)]
    if objective_id.startswith("data-engineer:"):
        # A frozen 5.2 request retains its exact original rubric and schema.
        accepted.append({"version": "5.2", "objective_id": objective_id, "allowance": None})
    if policy not in accepted:
        raise ValueError("Style policy differs from reviewed objective allowance")
    return policy


def uses_pde_style(policy):
    """Validate supplied policies; frozen PDE 5.2 and 5.3 activate tuning."""
    if policy is None:
        return False
    if not isinstance(policy, dict):
        raise ValueError("Style policy must be an object")
    validate_style_policy(policy, policy.get("objective_id"))
    return policy["version"] in ("5.2", "5.3")


def uses_filler_style(policy):
    """Require the additive distractor check only for exact frozen PDE 5.3."""
    return uses_pde_style(policy) and policy["version"] == "5.3"


def allows_ml_practice(policy):
    if policy is None:
        return False
    if not isinstance(policy, dict):
        raise ValueError("Style policy must be an object")
    validate_style_policy(policy, policy.get("objective_id"))
    return policy["allowance"] == ALLOWANCE


def policy_instructions(policy):
    if uses_pde_style(policy):
        from shared.question_style import PDE_STYLE_RULES, PDE_FILLER_STYLE_RULES
        return "\n" + (PDE_FILLER_STYLE_RULES if uses_filler_style(policy) else PDE_STYLE_RULES)
    if not allows_ml_practice(policy):
        return ""
    return ("\nRules v5.1 objective allowance (overrides only S13/O8 and the generic-key cap): "
            "This reviewed objective tests general ML/MLOps practice. Prefer a realistic Google Cloud "
            "context, but a sound ML-practice decision is sufficient; product_knowledge_hinge, "
            "cloud_specific_alternative and generic_validation_key are descriptive, not rejection checks. "
            "Score and verdict must reflect all remaining required style checks. No telegraphing stem, "
            "throwaway distractor, literal requirement elimination or cloned approaches. "
            "All other style, evidence and independent solver requirements stay mandatory.")
