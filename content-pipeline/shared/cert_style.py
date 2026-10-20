"""Versioned PDE learner-prose checks. Evidence objects are never rewritten."""
from __future__ import annotations

import json
import re
from pathlib import Path

from shared.objective_style import uses_pde_style

GUIDE = Path(__file__).resolve().parents[1] / "certs/data-engineer.json"
LEARNER_FIELDS = (
    "stem", "correct_answer", "distractor_1", "distractor_2", "distractor_3",
    "correct_explanation", "distractor_1_explanation",
    "distractor_2_explanation", "distractor_3_explanation",
)
OPTION_FIELDS = LEARNER_FIELDS[1:5]
# Explicit brand aliases only, not a heuristic for capitalized/descriptive nouns.
# Sources document naming relationships; they are not answer evidence receipts.
PDE_NAME_ALIASES = (
    ("Sensitive Data Protection", "Cloud DLP", "https://cloud.google.com/sensitive-data-protection/docs/overview"),
    ("Google Cloud Managed Service for Apache Spark", "Dataproc", "https://cloud.google.com/dataproc"),
    ("Managed Service for Apache Spark", "Dataproc", "https://cloud.google.com/dataproc"),
    ("Google Cloud Managed Service for Apache Airflow", "Cloud Composer", "https://cloud.google.com/composer"),
    ("Managed Service for Apache Airflow", "Cloud Composer", "https://cloud.google.com/composer"),
    ("Cloud Bigtable", "Bigtable", "https://cloud.google.com/bigtable"),
)
_URL = re.compile(r"https?://[^\s<>]+", re.IGNORECASE)


def _aliases():
    registry = json.loads(GUIDE.read_text())
    guides = [guide for guide in registry["guides"] if guide.get("variant") == "standard"]
    if len(guides) != 1:
        raise ValueError("PDE style requires one standard exam guide")
    guide = guides[0]
    objective_text = " ".join(
        objective["text"] for section in guide["sections"]
        for subsection in section["subsections"] for objective in subsection["objectives"]
    )
    aliases = []
    for alias, canonical, source in PDE_NAME_ALIASES:
        if re.search(r"(?<!\w)" + re.escape(canonical) + r"(?!\w)", objective_text, re.IGNORECASE):
            aliases.append((alias, canonical, source))
    return aliases


def _pattern(alias):
    return re.compile(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", re.IGNORECASE)


def _prose_parts(text):
    """Split out URLs so neither the normalizer nor the name check treats them as prose."""
    parts, cursor = [], 0
    for match in _URL.finditer(text):
        parts.append((False, text[cursor:match.start()]))
        parts.append((True, match.group()))
        cursor = match.end()
    parts.append((False, text[cursor:]))
    return parts


def normalize_learner_prose(question, *, style_policy=None):
    """Return a new dict; rewrite only known learner fields under frozen PDE 5.2/5.3.

    Other keys (including nested evidence, quotes, URLs and source documents)
    retain their original values. URLs embedded in learner fields are protected.
    Historical/absent policies return an unchanged shallow copy.
    """
    result = dict(question)
    if not uses_pde_style(style_policy):
        return result
    aliases = _aliases()
    for field in LEARNER_FIELDS:
        if field not in result:
            continue
        if not isinstance(result[field], str):
            raise ValueError("Learner prose fields must be strings")
        parts = _prose_parts(result[field])
        for alias, canonical, _ in aliases:
            parts = [(url, text if url else _pattern(alias).sub(canonical, text)) for url, text in parts]
        result[field] = "".join(text for _, text in parts)
    return result


def check_cert_style(question, *, style_policy=None):
    """Return {passed, errors, metrics}; no mutation and no semantic inference claim.

    Active PDE checks require all learner fields, a 30–85 word stem, single-answer
    wording and no documented guide-name aliases in learner prose. Option lengths
    are reported against the 15–22 target, not rejected. Existing validation and
    the strict semantic style judge remain separate mandatory gates.
    """
    if not uses_pde_style(style_policy):
        return {"passed": True, "errors": [], "metrics": {"active": False}}
    errors = []
    for field in LEARNER_FIELDS:
        if not isinstance(question.get(field), str) or not question[field].strip():
            errors.append("Missing or invalid learner field: " + field)
    if errors:
        return {"passed": False, "errors": errors, "metrics": {"active": True}}
    count = len(question["stem"].split())
    if not 30 <= count <= 85:
        errors.append(f"PDE stem word count ({count}) must be between 30 and 85 words")
    if re.search(r"\b(?:(?:choose|select|pick|mark)\s+(?:(?:the|any)\s+)?(?:two|three|four|all|multiple|[234])|(?:which|what)\s+(?:two|three|four|[234]))\b", question["stem"], re.IGNORECASE):
        errors.append("PDE supports four-option single-answer items only")
    drift = []
    aliases = _aliases()
    for field in LEARNER_FIELDS:
        prose = " ".join(text for url, text in _prose_parts(question[field]) if not url)
        for alias, canonical, source in aliases:
            if _pattern(alias).search(prose):
                drift.append({"field": field, "alias": alias, "canonical": canonical, "source_url": source})
                errors.append(f"PDE guide-name drift in {field}: use {canonical}, not {alias}")
    counts = {field: len(question[field].split()) for field in OPTION_FIELDS}
    return {"passed": not errors, "errors": errors,
            "metrics": {"active": True, "stem_words": count, "short_stem": 30 <= count <= 50,
                        "option_words": counts,
                        "options_within_target": {field: 15 <= words <= 22 for field, words in counts.items()},
                        "name_drift": drift}}
