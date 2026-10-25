"""Offline, pre-outcome paired assignment for a generation-only experiment."""
from copy import deepcopy
import hashlib
import random
import re

ARMS = ("control", "challenger")


def interleave_plan(plan, *, experiment, seed, pack_sha256, cohort="default"):
    """Expand each preselected scope to a randomized adjacent arm pair.

    Input scopes represent half the candidate budget. Outcome-adaptive objective
    rotation must not change these scopes after assignment. Seed must be selected
    before outcomes; never search seeds using outcomes.
    """
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", experiment or ""):
        raise ValueError("A/B requires a safe --ab-experiment ID")
    if type(seed) is not int or not re.fullmatch(r"[0-9a-f]{64}", pack_sha256):
        raise ValueError("A/B requires an integer seed and challenger pack SHA256")
    result = []
    counts = {}
    for scope in plan:
        objective = scope["objective_id"]
        ordinal = counts.get(objective, 0)
        counts[objective] = ordinal + 1
        material = f"{experiment}:{seed}:{cohort}:{objective}:{ordinal}"
        pair_id = hashlib.sha256(material.encode()).hexdigest()[:24]
        arms = list(ARMS)
        random.Random(int(hashlib.sha256(material.encode()).hexdigest(), 16)).shuffle(arms)
        for arm in arms:
            row = deepcopy(scope)
            row["ab_assignment"] = {"experiment": experiment, "cohort": cohort, "arm": arm,
                "pair_id": pair_id, "objective_pair": ordinal, "seed": seed,
                "challenger_sha256": pack_sha256,
                "prompt_pack_sha256": pack_sha256 if arm == "challenger" else None}
            result.append(row)
    return result


def generation_call(function, *args, prompt_pack=None, writer_functions=(), **kwargs):
    """Clear ambient packs for control and all non-writers, including proof/judges."""
    from shared.prompt_pack import use_prompt_pack
    selected = prompt_pack if function in writer_functions else None
    with use_prompt_pack(selected):
        return function(*args, **kwargs)
