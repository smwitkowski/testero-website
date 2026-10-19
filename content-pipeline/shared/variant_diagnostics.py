"""Offline failure receipts for variant writer attempts; never change decisions."""
from collections import Counter

from shared.external_judge import candidate_question
from shared.option_order import OPTION_FIELDS
from shared.validator import has_invented_organization_name, validate_question
from shared.variants import option_rewrite_check


def failure_details(payload, entry):
    """Recover check evidence without guessing a provider exception or rerunning judges."""
    stage = entry.get("failure_stage", "variant_write")
    checks, failed = {}, []
    question = None
    if (stage in ("schema", "lineage", "near_duplicate", "request")
            and entry.get("options") and entry.get("variant")):
        try:
            question = candidate_question(entry)
        except (ValueError, KeyError, TypeError):
            checks["reconstruction"] = {"passed": None, "error": "Stored canonical question cannot be reconstructed"}
    if question is not None and stage in ("schema", "lineage", "near_duplicate", "request"):
        scope = payload["plan"][entry["index"] - 1]
        parent = payload["variant_parents"][entry["parent_question_id"]]
        validation = validate_question(question, industry_only=True)
        checks["schema"] = {"passed": validation.is_valid, "errors": validation.errors,
                            "recorded_errors": entry.get("schema_check", {}).get("errors", [])}
        checks["name_detector"] = {"passed": not has_invented_organization_name(question["stem"])}
        actual = entry["variant"]["surface"]["industry"]
        checks["industry"] = {"passed": actual == scope["industry"],
                              "assigned": scope["industry"], "actual": actual}
        try:
            rewrite = option_rewrite_check(question, parent)
        except ValueError:
            checks["option_jaccard"] = {"passed": False, "error": "Missing or empty normalized option tokens"}
        else:
            scores = rewrite["option_jaccard"]
            checks["option_jaccard"] = {"passed": all(v < rewrite["threshold"] for v in scores.values()),
                                        "values": scores, "strict_threshold": rewrite["threshold"],
                                        "failed_options": [k for k,v in scores.items() if v >= rewrite["threshold"]]}
            checks["key_length"] = {"passed": not rewrite["key_uniquely_shortest"],
                                    "canonical_word_counts": dict(zip("ABCD", [len(question[f].split()) for f in OPTION_FIELDS])),
                                    "key_uniquely_shortest": rewrite["key_uniquely_shortest"]}
        # The saved comparison is the actual generation cohort, not later siblings.
        if "near_duplicate_check" in entry:
            checks["near_duplicate"] = entry["near_duplicate_check"]
        failed = [name for name, check in checks.items() if check["passed"] is False]
    reasons = []
    for name in failed:
        check = checks[name]
        if name == "option_jaccard" and "error" in check:
            reasons.append("option_jaccard: " + check["error"])
        elif name == "option_jaccard":
            reasons.append("option_jaccard: " + ", ".join(f"{k}={check['values'][k]:.6f} >= {check['strict_threshold']}" for k in check["failed_options"]))
        elif name == "key_length":
            reasons.append("key_length: key uniquely shortest; canonical word counts " + str(check["canonical_word_counts"]))
        elif name == "near_duplicate":
            reasons.append("near_duplicate: " + check.get("reason", "rejected") +
                           f"; max family stem={check.get('max_family_stem_similarity')}; threshold={check.get('family_stem_threshold')}")
        elif name == "schema":
            reasons.append("schema: " + "; ".join(check["errors"]))
        else:
            reasons.append(name + ": failed")
    reason = "; ".join(reasons) if reasons else "No recoverable check failure; inspect stage and exception class"
    return {"failure_stage": stage, "reason": reason,
            "error_class": entry.get("error_class", "unknown"),
            "failed_checks": failed, "failure_checks": checks}


def record_failure(attempt, payload, entry):
    attempt.update(candidate_id=entry["candidate_id"], **failure_details(payload, entry))


def backfill_failures(payload):
    """Add receipts to failed attempts only; preserve candidates, outputs and verdicts."""
    entries = {e["index"]: e for e in payload["candidates"]}
    if len(entries) != len(payload["candidates"]):
        raise ValueError("Duplicate candidate indices")
    for attempt in payload["variant_attempts"]:
        if attempt["status"] != "failed":
            continue
        entry = entries[attempt["index"]]
        if (entry["parent_question_id"] != attempt["parent_question_id"]
                or (entry.get("variant") and entry["variant"]["ordinal"] != attempt["ordinal"])):
            raise ValueError("Attempt/candidate lineage mismatch")
        record_failure(attempt, payload, entry)
    failed = [a for a in payload["variant_attempts"] if a["status"] == "failed"]
    return {"failed_attempts": len(failed),
            "stages": dict(Counter(a["failure_stage"] for a in failed)),
            "checks": dict(Counter(c for a in failed for c in a["failed_checks"])),
            "unresolved": [a["index"] for a in failed if not a["failed_checks"]],
            "attempts": [{"index": a["index"], "candidate_id": a["candidate_id"],
                          **{k:a[k] for k in ("failure_stage", "reason", "failed_checks", "failure_checks")}} for a in failed]}
