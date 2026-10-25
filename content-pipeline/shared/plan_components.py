"""Named, bounded writer components. Frozen defaults preserve production bytes."""
from __future__ import annotations

import re

COMPONENT_CAPS = {
    "plan.instructions": 3000,
    "plan.distractor_guidance": 1200,
    "plan.repair_guidance": 1200,
}
DEFAULT_DISTRACTOR_GUIDANCE = "For each wrong option, combine a documented POSITIVE fact about what the option does with a stated scenario constraint (cost, latency, minimal change, current workflow/team skills, or compliance). Its losing reason must require product knowledge, not a literal prohibition. Avoid negative comparative claims requiring explicit negative evidence, such as 'X is slower than Y' or 'Y requires redevelopment'. Do not invent positive claims or constraints; all proposals still need the full documentation veto."
DEFAULT_REPAIR_GUIDANCE = 'This attempt is an OPTION-LOCAL REPAIR, not a full replacement. The full-replacement rule does not apply to this attempt. Return the complete frozen plan from replacement_feedback byte-identically except for actions/losing reasons of options {repair_options}. Keep the scenario, constraints, key A and passing options unchanged. The repaired plan must pass a fresh full proof.'


def default_components():
    from shared.decision_planner import DecisionPlanSignature
    return {"plan.instructions": DecisionPlanSignature.instructions,
            "plan.distractor_guidance": DEFAULT_DISTRACTOR_GUIDANCE,
            "plan.repair_guidance": DEFAULT_REPAIR_GUIDANCE}


def validate_components(components):
    """Validate explicit overrides; missing keys keep byte-identical defaults."""
    if not isinstance(components, dict) or set(components) - COMPONENT_CAPS.keys():
        raise ValueError("Unknown plan component")
    for name, text in components.items():
        if not isinstance(text, str) or not text.strip() or len(text) > COMPONENT_CAPS[name]:
            raise ValueError(f"Invalid or over-cap component: {name}")
        if name == "plan.repair_guidance" and text.count("{repair_options}") != 1:
            raise ValueError("Repair guidance must retain one {repair_options} placeholder")
    return dict(components)


def frozen_decision_rules():
    """Return O3/O5/O6 verbatim from the frozen, current Style rules."""
    from shared.question_style import STYLE_RULES
    blocks = []
    for name in ("O3", "O5", "O6"):
        match = re.search(rf"(?m)^{name} .*?(?=\n(?:[SO]\d+ |Rules v)|\Z)", STYLE_RULES, re.S)
        if match is None:
            raise ValueError(f"Frozen Style rule missing: {name}")
        blocks.append(match.group(0).rstrip("\n"))
    return "\n\n".join(blocks)
