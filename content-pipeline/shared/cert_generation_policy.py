"""Versioned, offline generation hints and pure planning reports.

The exam guide remains the scope authority. Topic reports measure planned hints,
not generated content or accepted-question coverage. Product attribution uses
explicit best-action names, then an unambiguous single-product context. Unknown
or ambiguous attribution cannot certify a product cap. No judge is replaced.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from decimal import Decimal, ROUND_FLOOR
from pathlib import Path
from typing import Any

CERTS_DIR = Path(__file__).resolve().parents[1] / "certs"
_POLICY_FILES = {"data-engineer": "data-engineer-generation.json"}
TUNING_SCOPE_FIELDS = ("generation_policy", "required_topic_id", "required_topic_label",
                       "required_topic_guidance", "topic_coverage_scope", "stem_word_range")


def generation_policy(cert_id: str) -> dict[str, Any] | None:
    """Return a fresh configured policy, or None for an unconfigured cert."""
    filename = _POLICY_FILES.get(cert_id)
    if filename is None:
        return None
    raw = (CERTS_DIR / filename).read_bytes()
    policy = json.loads(raw)
    if policy.get("schema_version") != 1 or policy.get("cert_id") != cert_id:
        raise ValueError("Unsupported or mismatched generation policy")
    policy["sha256"] = hashlib.sha256(raw).hexdigest()
    return policy


def topic_distribution(plan: list[dict]) -> dict[str, Any]:
    """Report frozen topic slots; filtered and incomplete runs are partial."""
    certs = {row["cert_id"] for row in plan}
    if len(certs) > 1:
        raise ValueError("Topic report requires a single certification")
    policy = generation_policy(next(iter(certs))) if certs else None
    if policy is None or not any("generation_policy" in row for row in plan):
        return {"status": "not_applicable", "planned_count": len(plan), "topics": []}
    reference = {"version": policy["version"], "sha256": policy["sha256"]}
    if any(row.get("generation_policy") != reference for row in plan):
        raise ValueError("Topic report requires a single reviewed generation policy")
    counts = Counter(row.get("required_topic_id") for row in plan)
    eligible = set().union(*(set(row["topic_coverage_scope"]["eligible_topic_ids"]) for row in plan))
    filtered = any(row["topic_coverage_scope"]["mode"] != "unfiltered" for row in plan)
    topics = [{"id": topic["id"], "label": topic["label"],
               "planned_count": counts[topic["id"]], "applicable": topic["id"] in eligible}
              for topic in policy["required_topics"]]
    missing = [topic["id"] for topic in topics if topic["applicable"] and not topic["planned_count"]]
    complete = all(topic["planned_count"] for topic in topics)
    return {"status": ("not_applicable" if not eligible else
                       "complete" if complete and not filtered else "partial"),
            "policy_version": policy["version"], "policy_sha256": policy["sha256"],
            "planned_count": len(plan), "coverage_basis": "planned_topic_hints_only",
            "scope": "filtered" if filtered else "unfiltered", "topics": topics,
            "missing_topic_ids": missing,
            "not_applicable_topic_ids": [topic["id"] for topic in topics if not topic["applicable"]]}


def product_mentions(text: str, cert_id: str = "data-engineer") -> list[str]:
    """Identify canonical guide product names in one correct-answer action.

    Substring names are bounded by word characters. A product counts at most
    once, including aliases and family names such as BigQueryML / BigQuery.
    """
    if not isinstance(text, str):
        raise ValueError("Product mentions require text")
    policy = generation_policy(cert_id)
    if policy is None:
        return []
    return [product["name"] for product in policy["product_share"]["products"]
            if any(re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", text, re.IGNORECASE)
                   for name in product["guide_names"])]


def _best_action(row: str | dict) -> str:
    if isinstance(row, str) and row.strip():
        return row
    if isinstance(row, dict):
        action = row.get("best_action")
        if action is None and isinstance(row.get("decision_plan"), dict):
            action = row["decision_plan"].get("best_action")
        if isinstance(action, str) and action.strip():
            return action
    raise ValueError("Product share requires a nonempty best_action for every row")


def product_attribution(row: str | dict, cert_id: str = "data-engineer") -> dict[str, Any]:
    """Attribute a correct action without guessing from multi-product context.

    Explicit action names take priority. Otherwise use only a context naming
    exactly one canonical product. Written rows supply product_context (stem);
    bare decision plans fall back to existing_system. Unresolved rows fail closed.
    """
    products = product_mentions(_best_action(row), cert_id)
    if products:
        return {"products": products, "basis": "explicit_best_action", "error": None}
    context = None
    if isinstance(row, dict):
        if "product_context" in row:
            context = row["product_context"]
        else:
            context = row.get("existing_system")
            if context is None and isinstance(row.get("decision_plan"), dict):
                context = row["decision_plan"].get("existing_system")
    if context is None or (isinstance(context, str) and not context.strip()):
        return {"products": [], "basis": "unnamed", "error": "No named action product or usable product context"}
    if not isinstance(context, str):
        return {"products": [], "basis": "invalid_product_context", "error": "Product context must be text"}
    context_products = product_mentions(context, cert_id)
    if len(context_products) == 1:
        return {"products": context_products, "basis": "single_product_context", "error": None}
    if not context_products:
        return {"products": [], "basis": "unnamed", "error": "No guide product named in action or context"}
    return {"products": [], "basis": "ambiguous_product_context", "context_products": context_products,
            "error": "Action omits product and context names multiple canonical products"}


def check_product_share(plan_or_key: str | dict, prior_rows: list[str | dict],
                        planned_count: int) -> dict[str, Any]:
    """Check proposed plus reserved prior best actions against a fixed run cap.

    Callers must reserve successful actions and call this helper under their
    admission lock. It does not write or mutate inputs. Small positive batches
    allow at least one mention per product: max(1, floor(fraction * N)). Text
    inputs imply PDE; dictionary inputs may select an unconfigured certification.
    """
    if isinstance(planned_count, bool) or not isinstance(planned_count, int) or planned_count < 1:
        raise ValueError("planned_count must be a positive integer")
    cert_id = plan_or_key.get("cert_id", "data-engineer") if isinstance(plan_or_key, dict) else "data-engineer"
    policy = generation_policy(cert_id)
    if policy is None:
        return {"status": "not_applicable", "passed": None, "cert_id": cert_id}
    if not isinstance(prior_rows, (list, tuple)):
        raise ValueError("prior_rows must be a list or tuple of reserved actions")
    fraction = policy["product_share"]["max_fraction"]
    cap = max(1, int((Decimal(str(fraction)) * planned_count).to_integral_value(rounding=ROUND_FLOOR)))
    rows = [*prior_rows, plan_or_key]
    attributions = []
    for row in rows:
        if isinstance(row, dict) and row.get("cert_id", cert_id) != cert_id:
            raise ValueError("Product share requires a single certification")
        attributions.append(product_attribution(row, cert_id))
    counts = Counter(product for attribution in attributions for product in attribution["products"])
    exceeded = sorted(product for product, count in counts.items() if count > cap)
    unnamed = sum(not attribution["products"] for attribution in attributions)
    errors = [{"row_index": index, "code": attribution["basis"], "message": attribution["error"]}
              for index, attribution in enumerate(attributions) if attribution["error"]]
    errors.extend({"row_index": None, "code": "product_cap_exceeded", "message": f"{product} exceeds cap {cap}"}
                  for product in exceeded)
    if len(rows) > planned_count:
        errors.append({"row_index": None, "code": "population_exceeded", "message": "Checked rows exceed planned count"})
    passed = not errors
    return {"status": "pass" if passed else "fail", "passed": passed, "cert_id": cert_id,
            "policy_version": policy["version"], "policy_sha256": policy["sha256"],
            "planned_count": planned_count, "checked_count": len(rows),
            "max_fraction": fraction, "max_per_product": cap, "rounding": "floor_min_one",
            "counts": dict(sorted(counts.items())), "exceeded_products": exceeded,
            "proposed_products": attributions[-1]["products"], "proposed_basis": attributions[-1]["basis"],
            "basis": dict(sorted(Counter(attribution["basis"] for attribution in attributions).items())),
            "attributions": attributions, "unnamed_count": unnamed, "errors": errors,
            "population_exceeded": len(rows) > planned_count}


def product_share_report(rows: list[str | dict], *, cert_id: str = "data-engineer") -> dict[str, Any]:
    """Measure actual eligible best actions, never the larger planned budget.

    The caller selects the actual eligible population. No rows is unavailable,
    not a passing cap. Products absent from the guide vocabulary stay unnamed.
    """
    policy = generation_policy(cert_id)
    if policy is None:
        return {"status": "not_applicable", "passed": None, "cert_id": cert_id}
    if not isinstance(rows, (list, tuple)):
        raise ValueError("rows must be a list or tuple of eligible actions")
    if not rows:
        return {"status": "not_available", "passed": None, "cert_id": cert_id,
                "denominator": 0, "counts": {}, "max_share": None,
                "max_per_product": None, "unnamed_count": 0, "basis": {}, "attributions": [], "errors": []}
    last = rows[-1]
    proposed = dict(last) if isinstance(last, dict) else {"best_action": _best_action(last)}
    if proposed.get("cert_id", cert_id) != cert_id:
        raise ValueError("Product share requires a single certification")
    proposed["cert_id"] = cert_id
    result = check_product_share(proposed, rows[:-1], len(rows))
    return {**result, "denominator": len(rows),
            "max_share": max(result["counts"].values(), default=0) / len(rows),
            "coverage_basis": "explicit_best_action_or_single_product_context"}


def select_publication_products(candidates: list[dict], bank: list[dict], *,
                                cert_id: str = "data-engineer") -> dict[str, Any]:
    """Select bank-safe additions, removing lowest-scored excess actions first.

    Rows have unique ``id``, ``best_action``, optional ``product_context`` and
    candidate ``score`` (higher is better). The denominator is the resulting
    unique bank plus additions, with a full-plan bootstrap minimum of 40. It is
    recalculated after every veto. Existing bank rows cannot be vetoed, and an
    existing overage never blocks unrelated additions. Unknown bank actions
    reserve capacity against every product. Ties retain earlier rows.
    This policy does not replace any candidate quality or duplicate checks.
    """
    policy = generation_policy(cert_id)
    if policy is None:
        return {"selected_indices": list(range(len(candidates))), "vetoes": {},
                "report": {"status": "not_applicable", "passed": None, "cert_id": cert_id}}
    existing = {}
    for row in bank:
        if row.get("cert_id", cert_id) != cert_id:
            raise ValueError("Publication bank certification mismatch")
        ident = row.get("id")
        if not isinstance(ident, str) or not ident.strip():
            raise ValueError("Publication bank requires a stable ID")
        if ident in existing and existing[ident] != row:
            raise ValueError("Conflicting publication bank IDs")
        _best_action(row)
        existing[ident] = row
    ids = [row.get("id") for row in candidates]
    if any(not isinstance(ident, str) or not ident.strip() for ident in ids) or len(set(ids)) != len(ids):
        raise ValueError("Publication candidates require unique stable IDs")
    unknown_bank_count = sum(bool(product_attribution(row, cert_id)["error"]) for row in existing.values())
    attributions = [product_attribution(row, cert_id) for row in candidates]
    selected = [i for i, row in enumerate(candidates) if row["id"] not in existing]
    vetoes = {}
    for i in list(selected):
        if attributions[i]["error"]:
            selected.remove(i)
            vetoes[i] = attributions[i]["error"]
    while True:
        rows = [*existing.values(), *(candidates[i] for i in selected)]
        denominator = max(40, len(rows))
        fraction = policy["product_share"]["max_fraction"]
        cap = int((Decimal(str(fraction)) * denominator).to_integral_value(rounding=ROUND_FLOOR))
        counts = Counter(product for row in rows for product in product_attribution(row, cert_id)["products"])
        # An unattributed historical action could use any guide product. Reserve
        # that capacity conservatively, without rejecting unrelated safe actions.
        reserved_counts = {product["name"]: counts[product["name"]] + unknown_bank_count
                           for product in policy["product_share"]["products"]}
        exceeded = {product for product, count in reserved_counts.items() if count > cap}
        removable = [i for i in selected if exceeded.intersection(attributions[i]["products"])]
        if not removable:
            break
        lowest = min(removable, key=lambda i: (candidates[i].get("score", 0), -i))
        selected.remove(lowest)
        vetoes[lowest] = "Correct-answer product exceeds the rolling bank/full-plan cap"
    if rows:
        last = {**rows[-1], "cert_id": cert_id}
        report = check_product_share(last, rows[:-1], denominator)
    else:
        report = product_share_report([], cert_id=cert_id)
    report.update(denominator=denominator, checked_count=len(rows),
                  max_per_product=cap, max_fraction=fraction,
                  coverage_basis="rolling_bank_with_full_plan_bootstrap", bootstrap_minimum=40,
                  bank_count=len(existing), selected_count=len(selected), vetoed_count=len(vetoes),
                  aggregate_blocker=False, unknown_bank_count=unknown_bank_count,
                  attribution_status="incomplete" if unknown_bank_count else "complete",
                  product_cap_status="fail" if exceeded else "pass",
                  reserved_counts=reserved_counts,
                  observed_population=product_share_report(rows, cert_id=cert_id))
    return {"selected_indices": selected, "vetoes": vetoes, "report": report}
