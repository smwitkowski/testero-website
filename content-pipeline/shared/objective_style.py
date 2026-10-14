"""Reviewed objective-scoped rules v5.1 style policy; absent policy keeps v5."""
import json
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[1] / "certs/ml-practice-objectives.json"
RELAXED_STYLE_CHECKS = frozenset({"product_knowledge_hinge", "cloud_specific_alternative", "generic_validation_key"})
ALLOWANCE = "general_ml_mlops"


def style_policy(objective_id):
    reviewed = json.loads(CONFIG.read_text())
    return {"version": "5.1", "objective_id": objective_id,
            "allowance": ALLOWANCE if objective_id in reviewed["objectives"] else None}


def validate_style_policy(policy, objective_id):
    if not isinstance(objective_id, str) or not objective_id or policy != style_policy(objective_id):
        raise ValueError("Style policy differs from reviewed objective allowance")
    return policy


def allows_ml_practice(policy):
    if policy is None:
        return False
    if not isinstance(policy, dict):
        raise ValueError("Style policy must be an object")
    validate_style_policy(policy, policy.get("objective_id"))
    return policy["allowance"] == ALLOWANCE


def policy_instructions(policy):
    if not allows_ml_practice(policy):
        return ""
    return ("\nRules v5.1 objective allowance (overrides only S13/O8 and the generic-key cap): "
            "This reviewed objective tests general ML/MLOps practice. Prefer a realistic Google Cloud "
            "context, but a sound ML-practice decision is sufficient; product_knowledge_hinge, "
            "cloud_specific_alternative and generic_validation_key are descriptive, not rejection checks. "
            "Score and verdict must reflect all remaining required style checks. No telegraphing stem, "
            "throwaway distractor, literal requirement elimination or cloned approaches. "
            "All other style, evidence and independent solver requirements stay mandatory.")
