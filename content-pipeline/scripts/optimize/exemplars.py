"""Deterministic selection of compact, accepted training plans; never draft/docs demos."""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import random

from shared.prompt_pack import _compact_exemplars

_SEATS = {"style", "evidence", "blind_solver", "argon.blind", "argon.review"}


def select_compact_exemplars(splits, *, domain, cert_id=None, exclude_objective_ids=(), limit=3, seed=0):
    """Select at most three other-objective, same-domain, council-accepted plans.

    Pass the objective-disjoint *draft* splits produced by build_datasets: these
    carry validated acceptance by all five seats, plus the original plan. Output
    contains no question, proof, receipt, source, documentation, or input context.
    No synthesized or merely doccheck-passing plans are used as exemplars.
    """
    if type(limit) is not int or not 0 <= limit <= 3:
        raise ValueError("Compact exemplar limit must be between zero and three")
    if not isinstance(splits, dict) or set(splits) != {"train", "dev", "test"}:
        raise ValueError("Full train/dev/test splits are required for train-only selection")
    objective_sets = {key: {row["objective_id"] for row in rows} for key, rows in splits.items()}
    if any(objective_sets[a] & objective_sets[b] for a, b in (("train", "dev"), ("train", "test"), ("dev", "test"))):
        raise ValueError("Exemplar splits must be objective-disjoint")
    excluded = set(exclude_objective_ids) | objective_sets["dev"] | objective_sets["test"]
    pool = []
    for row in splits["train"]:
        scope = row.get("scope", {})
        if (row["objective_id"] in excluded or row.get("domain") != domain
                or scope.get("objective_id") != row["objective_id"]
                or scope.get("domain_code", domain) != domain
                or (cert_id is not None and scope.get("cert_id") != cert_id)
                or row.get("proof", {}).get("passed") is not True
                or set(row.get("council", {}).get("seats", [])) != _SEATS
                or str(row.get("cohort", "")).lower() in ("canary", "gold")
                or row.get("is_canary") or row.get("is_gold")):
            continue
        plan = row.get("plan")
        if plan is None:
            plan = row.get("outputs", {}).get("plan")
        record = {"domain": domain, "cert_id": scope.get("cert_id"),
                  "objective_id": row["objective_id"], "plan": deepcopy(plan)}
        try:
            compact = _compact_exemplars([record])[0]
        except (ValueError, TypeError):
            continue
        pool.append(compact)
    # Sort first: shuffling stays deterministic when input file order changes.
    pool.sort(key=lambda row: json.dumps(row, sort_keys=True, ensure_ascii=False))
    random.Random(seed).shuffle(pool)
    selected, used_objectives = [], set()
    def tokens(row):
        return set(json.dumps(row["plan"], sort_keys=True).casefold().split())
    while pool and len(selected) < limit:
        def distance(row):
            a = tokens(row)
            return min((1 - len(a & tokens(other)) / max(1, len(a | tokens(other)))
                        for other in selected), default=1.0)
        best = max(range(len(pool)), key=lambda index: distance(pool[index]))
        record = pool.pop(best)
        if record["objective_id"] in used_objectives:
            continue
        used_objectives.add(record["objective_id"])
        selected.append(record)
    return _compact_exemplars(selected)


def exemplar_hash(exemplars):
    """Bind immutable selected examples to a run manifest/pack policy."""
    text = json.dumps(_compact_exemplars(exemplars), sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()
