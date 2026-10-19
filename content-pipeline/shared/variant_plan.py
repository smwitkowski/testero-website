"""Deterministic round-5 variant plans and key-length batch gate, offline only."""
from collections import Counter

from shared.external_judge import candidate_question

REPAIR_MODE = "round5_repair_v1"
REPAIR_SLOTS = (
    {"slot": "automl_migration", "parent_question_id": "9a174e39-5c98-524a-abec-952a689185d0",
     "scenario_moment": "migration", "replaces": ["95c6f14a"]},
    {"slot": "cloud_run_scale", "parent_question_id": "a31d11b8-8dd5-55ed-9ba4-a4b4e8400bcf",
     "scenario_moment": "scale growth", "replaces": ["c2bd1146"]},
    {"slot": "group_split_migration", "parent_question_id": "57b9d0c7-8d93-5858-a699-4fc0afeae507",
     "scenario_moment": "migration", "replaces": ["6fc94925", "84d6"]},
    {"slot": "automl_cost", "parent_question_id": "9a174e39-5c98-524a-abec-952a689185d0",
     "scenario_moment": "cost/latency reduction", "replaces": ["a612"]},
)


def assignments(parents, count, *, repair_mode=None):
    """Yield unique family ordinals; repair mode makes two NEW attempts per slot."""
    by_id = {p["question_id"]: p for p in parents}
    if len(by_id) != len(parents):
        raise ValueError("Duplicate planned parent")
    if repair_mode is None:
        if type(count) is not int or not 1 <= count <= 5:
            raise ValueError("Invalid variants per parent")
        return [(parent, ordinal, None) for parent in parents for ordinal in range(1, count + 1)]
    if repair_mode != REPAIR_MODE or count != 2 or set(by_id) != {s["parent_question_id"] for s in REPAIR_SLOTS}:
        raise ValueError("Round-5 repair requires exactly its three verified parents")
    result, ordinals = [], Counter()
    for slot in REPAIR_SLOTS:
        for _ in range(2):
            ident = slot["parent_question_id"]
            ordinals[ident] += 1
            result.append((by_id[ident], ordinals[ident], slot["scenario_moment"]))
    return result


def make_scope(base, parent, ordinal, *, policy_version, index, total, moment=None):
    from shared.variants import variant_scope, planned_key_length_ranks
    if policy_version == 4:
        if moment is not None:
            raise ValueError("Targeted moments require policy 5")
        return variant_scope(base, parent, ordinal, policy_version=4)
    if policy_version != 5:
        raise ValueError("Unsupported new-generation variant policy")
    return variant_scope(base, parent, ordinal, policy_version=5,
                         key_length_rank=planned_key_length_ranks(total)[index - 1],
                         scenario_moment=moment)


def validate_repair_history(payload):
    """Repair artifacts cannot discard the approved live-family dedupe snapshot."""
    if payload.get("repair_mode") is not None:
        from shared.variant_live_history import LIVE_HISTORY_POLICY, validate_live_priors
        history = payload.get("prior_variants")
        if (payload["repair_mode"] != REPAIR_MODE or not isinstance(history, dict)
                or history.get("policy") != LIVE_HISTORY_POLICY):
            raise ValueError("Repair replay requires the approved 13-live prior snapshot")
        validate_live_priors(history)


def replay_scope(payload, index, base):
    """Reconstruct policy-5 scope from fixed slots, not caller-edited hints."""
    validate_repair_history(payload)
    parents = list(payload["variant_parents"].values())
    mode = payload.get("repair_mode")
    if mode is not None:
        rows = assignments(parents, 2, repair_mode=mode)
        if len(payload["plan"]) != len(rows):
            raise ValueError("Repair plan must contain exactly eight attempts")
    else:
        origins = [scope["variant_origin"] for scope in payload["plan"]]
        counts = Counter(row["parent_question_id"] for row in origins)
        if not counts or len(set(counts.values())) != 1 or set(counts) != set(payload["variant_parents"]):
            raise ValueError("Standard variant plan requires equal family sizes")
        rows = assignments(parents, next(iter(counts.values())))
    parent, ordinal, moment = rows[index - 1]
    scope = payload["plan"][index - 1]
    if scope.get("variant_origin") != {"parent_question_id": parent["question_id"], "ordinal": ordinal}:
        raise ValueError("Variant plan order or origin changed")
    expected = make_scope(base, parent, ordinal, policy_version=5, index=index, total=len(rows), moment=moment)
    from shared.variants import frozen_industry
    expected["industry"] = frozen_industry(payload, scope)
    return expected


def key_length_batch_report(payload, entries):
    """Gate the supplied population, not just planner hints or saved PASS flags."""
    enforced = any(s.get("variant_policy_version") == 5 for s in payload.get("plan", []))
    result = {"enforced": enforced, "count": 0, "shortest_or_tied_count": 0,
              "unique_longest_count": 0, "shortest_or_tied_fraction": None,
              "maximum_shortest_fraction": 0.25, "passed": True, "errors": [], "items": []}
    if not enforced:
        return result
    if not payload.get("plan") or any(s.get("variant_policy_version") != 5 for s in payload["plan"]):
        raise ValueError("Mixed round-5 variant policy")
    fields = ("correct_answer", "distractor_1", "distractor_2", "distractor_3")
    for entry in entries:
        question = candidate_question(entry)
        lengths = [len(question[name].split()) for name in fields]
        shortest, longest = lengths[0] == min(lengths), lengths[0] > max(lengths[1:])
        result["items"].append({"candidate_id": entry["candidate_id"], "word_counts": lengths,
                                "shortest_or_tied": shortest, "unique_longest": longest})
        result["shortest_or_tied_count"] += shortest
        result["unique_longest_count"] += longest
    n = result["count"] = len(result["items"])
    if n:
        result["shortest_or_tied_fraction"] = result["shortest_or_tied_count"] / n
    if not n:
        result["errors"].append("No eligible candidates for length distribution")
    if result["shortest_or_tied_count"] * 4 > n:
        result["errors"].append("More than 25% of keys are shortest or tied-shortest")
    if not result["unique_longest_count"]:
        result["errors"].append("At least one key must be uniquely longest")
    result["passed"] = not result["errors"]
    return result
