"""Frozen distractor-evidence policy; absent metadata means historical strict."""
from copy import deepcopy


def evidence_policy(mode):
    if mode not in ("strict", "consistent"):
        raise ValueError("Unsupported distractor-evidence mode")
    return {"version": 1, "mode": mode}


def validate_policy(policy):
    if not isinstance(policy, dict) or type(policy.get("version")) is not int or policy != evidence_policy(policy.get("mode")):
        raise ValueError("Invalid frozen distractor-evidence policy")
    return policy


def mode_for(policy):
    return "strict" if policy is None else validate_policy(policy)["mode"]


def verdict_with_policy(raw, policy):
    if policy is None:
        return raw
    validate_policy(policy)
    return {**raw, "distractor_evidence": deepcopy(policy)}


def verdict_gates(raw, policy):
    """Validate the verdict's frozen mode before evaluating any gate."""
    mode_for(policy)
    if not isinstance(raw, dict):
        raise ValueError("Verdict must be an object")
    if policy is None:
        if "distractor_evidence" in raw:
            raise ValueError("Unexpected distractor-evidence verdict policy")
    else:
        validate_policy(raw.get("distractor_evidence"))
        if raw["distractor_evidence"] != policy:
            raise ValueError("Verdict differs from frozen distractor-evidence policy")
    return {k: v for k, v in raw.items() if k != "distractor_evidence"}
