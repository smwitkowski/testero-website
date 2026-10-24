"""Deterministic learner-prose freshness gate. Receipts and URLs are not renamed."""
from pathlib import Path
import json
import re

LEXICON_PATH = Path(__file__).resolve().parents[1] / "certs/product-lexicon.json"
QUESTION_TEXT_FIELDS = ("stem", "correct_answer", "correct_explanation", "distractor_1",
    "distractor_1_explanation", "distractor_2", "distractor_2_explanation",
    "distractor_3", "distractor_3_explanation")


def freshness_errors(question, cert_id=None, *, lexicon_path=None):
    """Return all retired/renamed learner-prose hits; never rewrite evidence."""
    data = json.loads(Path(lexicon_path or LEXICON_PATH).read_text(encoding="utf-8"))
    if data.get("version") != 1 or not isinstance(data.get("products"), list):
        raise ValueError("Invalid product freshness lexicon")
    errors = []
    for item in data["products"]:
        if (set(item) != {"old", "new", "status", "source"}
                or item["status"] not in ("retired", "renamed")
                or any(not isinstance(item[key], str) or not item[key].strip() for key in item)):
            raise ValueError("Invalid product freshness lexicon entry")
        pattern = re.compile(r"(?<!\w)" + re.escape(item["old"]) + r"(?!\w)", re.I)
        for field in QUESTION_TEXT_FIELDS:
            text = question.get(field)
            if not isinstance(text, str):
                raise ValueError("Missing learner prose field: " + field)
            # Keep captured URLs untouched: their legacy paths are not prose.
            prose = re.sub(r"https?://[^\s<>]+", "", text)
            if pattern.search(prose):
                errors.append(f"freshness:{field}: {item['old']} ({item['status']}); use {item['new']}")
    return errors
