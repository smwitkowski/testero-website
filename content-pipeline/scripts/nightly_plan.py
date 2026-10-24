"""Offline coverage-gap planner. PMLE is weighted first; agentic stays disabled."""
from datetime import datetime, timezone

from scripts.nightly_budget import instant
from shared.cert_context import DEFAULT_CERT, load_cert_context

ENABLED = (DEFAULT_CERT, "cloud-architect", "data-engineer", "cloud-engineer", "generative-ai-leader")


def plan(snapshot, now, *, batches=2, count=40):
    if type(batches) is not int or not 0 <= batches <= 2 or type(count) is not int or not 1 <= count <= 40:
        raise ValueError("At most two batches of 1..40 candidates are allowed")
    if not isinstance(snapshot, dict) or snapshot.get("complete") is not True:
        raise ValueError("A complete coverage snapshot is required")
    age = (now - instant(snapshot.get("captured_at"))).total_seconds()
    if not 0 <= age <= 86400:
        raise ValueError("Coverage snapshot must be at most one day old")
    rows = snapshot.get("questions")
    if not isinstance(rows, list):
        raise ValueError("Coverage questions must be a list")
    ids = set()
    counts = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or row["id"] in ids:
            raise ValueError("Duplicate or malformed coverage row")
        ids.add(row["id"])
        if row.get("status") != "ACTIVE" or row.get("review_status") != "GOOD" or row.get("parent_question_id") is not None:
            continue
        cert = DEFAULT_CERT if row.get("exam") == "GCP_PM_ML_ENG" else row.get("exam")
        domain = row.get("domain", row.get("exam_domains", {})).get("code")
        if cert in ENABLED:
            if not isinstance(domain, str):
                raise ValueError("Original ACTIVE coverage needs a canonical domain")
            counts[cert, domain] = counts.get((cert, domain), 0) + 1
    gaps = []
    for cert in ENABLED:
        context = load_cert_context(cert)
        target = 400 if cert == DEFAULT_CERT else 40
        for domain, details in context["domains"].items():
            live = counts.get((cert, domain), 0)
            gap = max(0, target * float(details["exam_weight"]) / 100 - live)
            gaps.append({"cert": cert, "section": details["section_number"] + ".",
                         "domain": domain, "live": live, "target": target * float(details["exam_weight"]) / 100,
                         "gap": gap, "priority": gap * (2 if cert == DEFAULT_CERT else 1), "count": count})
    ranked = sorted((g for g in gaps if g["gap"] > 0),
                    key=lambda g: (-g["priority"], g["cert"] != DEFAULT_CERT, g["cert"], g["section"]))
    return {"batches": ranked[:batches], "coverage": gaps,
            "note": "Domain coverage first; objective-grid planning and demand tiers generalize in week 2."}
