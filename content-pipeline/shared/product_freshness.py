"""Deterministic learner-prose freshness gate. Receipts and URLs are not renamed."""
from pathlib import Path
from datetime import date
import json
import re

LEXICON_PATH = Path(__file__).resolve().parents[1] / "certs/product-lexicon.json"
QUESTION_TEXT_FIELDS = ("stem", "correct_answer", "correct_explanation", "distractor_1",
    "distractor_1_explanation", "distractor_2", "distractor_2_explanation",
    "distractor_3", "distractor_3_explanation")


def _pattern(name):
    return re.compile(r"(?<!\w)" + re.escape(name) + r"(?!\w)", re.I)


def _prose(text):
    return re.sub(r"https?://[^\s<>]+", "", text)


def freshness_findings(question, cert_id=None, *, lexicon_path=None):
    """Return structured retired/renamed learner-prose hits; never rewrite evidence.

    The optional planner_products section is deliberately excluded. Adding an
    experimental lifecycle fact must not silently change learner publication.
    """
    data = json.loads(Path(lexicon_path or LEXICON_PATH).read_text(encoding="utf-8"))
    if data.get("version") != 1 or not isinstance(data.get("products"), list):
        raise ValueError("Invalid product freshness lexicon")
    findings = []
    for item in data["products"]:
        if (set(item) != {"old", "new", "status", "source"}
                or item["status"] not in ("retired", "renamed")
                or any(not isinstance(item[key], str) or not item[key].strip() for key in item)):
            raise ValueError("Invalid product freshness lexicon entry")
        pattern = _pattern(item["old"])
        for field in QUESTION_TEXT_FIELDS:
            text = question.get(field)
            if not isinstance(text, str):
                raise ValueError("Missing learner prose field: " + field)
            # Keep captured URLs untouched: their legacy paths are not prose.
            prose = _prose(text)
            if pattern.search(prose):
                findings.append({"field": field, **item})
    return findings


def freshness_errors(question, cert_id=None, *, lexicon_path=None):
    """Return publication vetoes for all freshness hits, including mere renames."""
    return [f"freshness:{hit['field']}: {hit['old']} ({hit['status']}); use {hit['new']}"
            for hit in freshness_findings(question, cert_id, lexicon_path=lexicon_path)]


def _migration_source(prose, match):
    """Recognize explicit migration-source wording, not a retired destination.

    Ambiguous mentions fail closed for the recommended action. Each occurrence
    is checked, so "migrate from OLD to OLD" still has a blocking destination.
    """
    prefix = prose[:match.start()]
    return bool(re.search(
        r"(?:\b(?:migrate|move|transition|switch|upgrade)\b[^.;!?]{0,100}\bfrom\s+(?:the\s+)?"
        r"|\b(?:replace|retire|decommission|remove)\s+(?:the\s+)?"
        r"|\bstop\s+using\s+(?:the\s+)?)$", prefix, re.I))


def plan_freshness_findings(plan, cert_id=None, *, lexicon_path=None):
    """Return context and blocking name/lifecycle hits in an unverified plan.

    Retired names are allowed in existing systems, mistakes, and explicit
    migration-source wording, but not as recommended destinations. Renamed
    names need current wording in every scanned field. No evidence is rewritten.
    Callers opt in; this function does not alter the learner-prose gate.
    """
    data = json.loads(Path(lexicon_path or LEXICON_PATH).read_text(encoding="utf-8"))
    if data.get("version") != 1 or not isinstance(data.get("products"), list):
        raise ValueError("Invalid product freshness lexicon")
    extra = data.get("planner_products", [])
    if not isinstance(extra, list):
        raise ValueError("Invalid planner freshness lexicon")
    fields = [("existing_system", plan["existing_system"]), ("best_action", plan["best_action"])]
    fields.extend((f"mistakes[{index}].action", mistake["action"])
                  for index, mistake in enumerate(plan["mistakes"]))
    items = [*data["products"], *extra]
    for item in items:
        expected = {"old", "new", "status", "source"}
        if item in extra:
            expected |= {"as_of", "lifecycle_date"}
            if "retirement_date" in item:
                expected.add("retirement_date")
        if (not isinstance(item, dict) or set(item) != expected
                or item["status"] not in ("retired", "renamed", "deprecated")
                or any(not isinstance(value, str) or not value.strip() for value in item.values())):
            raise ValueError("Invalid planner freshness lexicon entry")
        if item in extra:
            for key in ("as_of", "lifecycle_date", "retirement_date"):
                if key in item:
                    date.fromisoformat(item[key])
            if not item["source"].startswith("https://docs.cloud.google.com/"):
                raise ValueError("Planner lifecycle source must be official documentation")
    patterns = [(item, _pattern(item["old"])) for item in items]
    findings = []
    for item, pattern in patterns:
        for field, text in fields:
            if not isinstance(text, str):
                raise ValueError("Missing plan prose field: " + field)
            prose = _prose(text)
            # A specific lifecycle entry owns its span. For example, historical
            # Vertex AI Vision must not also be treated as a generic Vertex AI
            # rename (which would invent an unsupported replacement brand).
            matches = [match for match in pattern.finditer(prose)
                       if not any(len(other["old"]) > len(item["old"])
                                  and any(larger.start() <= match.start() and larger.end() >= match.end()
                                          for larger in other_pattern.finditer(prose))
                                  for other, other_pattern in patterns)]
            if not matches:
                continue
            blocking = (item["status"] == "renamed"
                        or (item["status"] == "retired" and field == "best_action"
                            and any(not _migration_source(prose, match) for match in matches)))
            findings.append({"field": field, **item, "blocking": blocking})
    return findings


def plan_freshness_feedback(findings):
    """Bound deterministic re-plan feedback without putting facts in doc scope."""
    problems = [hit for hit in findings if hit["blocking"]]
    lines = []
    for hit in problems[:12]:
        if hit["status"] == "renamed":
            lines.append(f"{hit['field']}: use current name {hit['new']}, not {hit['old']}.")
        else:
            date = f" as of {hit['lifecycle_date']}" if "lifecycle_date" in hit else ""
            lines.append(f"{hit['field']}: {hit['old']} is retired{date}; do not recommend it as a destination. "
                         f"Consider {hit['new']} without assuming equivalent capabilities.")
    return ("Plan lifecycle/name lint: " + " ".join(lines)
            + " Re-plan within the same objective. Retired products may be migration context only. "
              "These planning hints are not evidence; all documentation checks still apply.")[:2400]
