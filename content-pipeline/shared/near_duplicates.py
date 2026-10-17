"""Offline scenario-and-decision similarity calibrated on stored batch 7/8 items."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path

THRESHOLD = 0.20
STOP = frozenset("a an and are as at be been being but by do each for in is it its more of on or should that the these this those to under use want what which while whose with you your".split())


def tokens(text):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Missing scenario or decision text")
    result = set(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKC", text).casefold())) - STOP
    if not result:
        raise ValueError("Empty normalized scenario or decision")
    return result


def similarity(stem, key, other_stem, other_key):
    pairs = ((tokens(stem), tokens(other_stem)), (tokens(key), tokens(other_key)))
    scores = [len(a & b) / len(a | b) for a, b in pairs]
    return {"stem_score": scores[0], "key_score": scores[1], "score": min(scores)}


def comparison_row(entry):
    options = entry.get("options", entry.get("answers"))
    if not isinstance(options, list):
        raise ValueError("Export row needs options or answers")
    keys = [row.get("text", row.get("choice_text")) for row in options
            if (row.get("label") == entry.get("key") if "key" in entry else row.get("is_correct") is True)]
    if len(keys) != 1:
        raise ValueError("Export row needs exactly one correct option")
    ident = entry.get("candidate_id", entry.get("id"))
    if not isinstance(ident, str) or not ident.strip():
        raise ValueError("Export row needs a question ID")
    tokens(entry.get("stem")); tokens(keys[0])
    return {"id": ident, "stem": entry["stem"], "key": keys[0]}


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate export JSON key")
        result[key] = value
    return result


def load_export(path):
    """Accept a local list or {questions: [...]} export; malformed active rows block."""
    raw = Path(path).read_bytes()
    data = json.loads(raw, object_pairs_hook=_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Invalid export number")))
    rows = data.get("questions") if isinstance(data, dict) else data
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise ValueError("Export must contain a question list")
    if any(row.get("status") not in ("ACTIVE", "DRAFT", "RETIRED") for row in rows):
        raise ValueError("Export question status must be ACTIVE, DRAFT or RETIRED")
    selected = [{**comparison_row(row),
                 **({"objective_id": row["objective_id"]} if isinstance(row.get("objective_id"), str) and row["objective_id"].strip() else {})}
                for row in rows if row["status"] in ("ACTIVE", "DRAFT")]
    if len({row["id"] for row in selected}) != len(selected):
        raise ValueError("Duplicate export question IDs")
    return {"sha256": hashlib.sha256(raw).hexdigest(), "questions": selected}


def check_plan_near_duplicate(plan, existing):
    """Compare the proposed scenario and best action using the unchanged veto."""
    scenario = " ".join([plan["existing_system"], plan["business_consequence"], *plan["decisive_constraints"]])
    return check_near_duplicate({"id": "decision-plan", "stem": scenario, "key": "A",
                                 "options": [{"label": "A", "text": plan["best_action"]}]}, existing)


def check_near_duplicate(entry, existing, *, exclude=()):
    candidate = comparison_row(entry)
    matches = []
    for row in existing:
        if row["id"] in exclude:
            continue
        scores = similarity(candidate["stem"], candidate["key"], row["stem"], row["key"])
        if scores["score"] >= THRESHOLD:
            matches.append({"matched_id": row["id"], **scores})
    return {"passed": not matches, "threshold": THRESHOLD,
            "method": "min(stem token Jaccard, correct-option token Jaccard), NFKC/casefold/stopwords",
            "matches": matches,
            "reason": "Near-duplicate scenario and decision" if matches else "No near-duplicate scenario and decision"}
