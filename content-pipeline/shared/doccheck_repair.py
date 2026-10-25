"""Conservative option-local repair selection for opt-in doccheck v6."""
from __future__ import annotations

from copy import deepcopy
import json
import re


def failing_distractors(proof):
    """Return only explicitly isolated wrong-option failures; otherwise replace all."""
    if proof.get("passed") is True or proof.get("uniquely_best") is not True:
        return None
    # A malformed or explicitly global structured result is never narrowed by prose.
    if "failing_options" in proof:
        labels = proof["failing_options"]
        if (not isinstance(labels, list) or not labels
                or any(label not in ("B", "C", "D") for label in labels)
                or len(labels) != len(set(labels))):
            return None
    else:
        labels = re.findall(r"\b(?:option\s+([A-D])\b|([A-D])['’]s\s+(?:losing|rejection|reason|claim))",
                            proof.get("reason", ""), re.I)
        labels = sorted({(a or b).upper() for a, b in labels})
        if not labels or "A" in labels:
            return None
    # Any mechanical failure not explicitly bound to the isolated labels is global.
    for error in proof.get("mechanical_check", {}).get("errors", []):
        match = re.match(r"Option ([A-D]):", error)
        if match is None or match[1] not in labels:
            return None
    return sorted(labels)


def repair_feedback(plan, labels, veto_feedback):
    """Ask for a full typed plan but authorize edits only to named distractors."""
    if not labels or any(label not in ("B", "C", "D") for label in labels):
        raise ValueError("Surgical repair needs isolated distractor labels")
    return json.dumps({"repair_options": labels, "frozen_plan": plan,
        "previous_vetoes": veto_feedback,
        "instruction": "Surgical repair overrides full-replacement instructions for this attempt. "
            "Return the complete plan, keeping the scenario, objective, engineering decision, "
            "business consequence, existing system, constraints, key A and every passing option "
            "byte-identical. Rewrite only the flagged B-D actions and/or losing reasons. "
            "Use supported positive behavior plus the existing scenario constraints. "
            "Do not add constraints or exceptions. The entire repaired plan gets a fresh full proof."},
        ensure_ascii=False)


def validate_repair(original, proposed, labels):
    """Fail closed if a repair changes any field outside its explicit edit set."""
    expected = deepcopy(original)
    for label in labels:
        if label not in ("B", "C", "D"):
            raise ValueError("Cannot surgically repair the key")
        index = "BCD".index(label)
        expected["mistakes"][index] = deepcopy(proposed["mistakes"][index])
    if proposed != expected:
        raise ValueError("Surgical repair changed frozen scenario, key or passing options")
    return proposed
