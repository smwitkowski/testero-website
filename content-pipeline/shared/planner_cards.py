"""Deterministic, planner-only lint for frozen doc-reality cards."""
from __future__ import annotations

import re

from scripts.optimize.components import _FORBIDDEN

CARD_CHAR_CAP = 1200
_INTERNAL = re.compile(r"\b(?:council|judg(?:e|es|ing)|rubrics?|receipts?|verdicts?)\b", re.I)
_URL = re.compile(r"(?:https?://|www\.|\b[a-z0-9-]+\.(?:com|org|net|dev)/)", re.I)
_QUOTES = re.compile(r"[\"“”«»]|(?<!\w)['‘]|['’](?!\w)")


def lint_card_text(text):
    """Return a clean card unchanged, or reject it without truncating facts."""
    if not isinstance(text, str) or not text.strip() or len(text) > CARD_CHAR_CAP:
        raise ValueError("Card must contain 1 to 1200 characters")
    if any(ord(char) < 32 and char not in "\n\t" for char in text):
        raise ValueError("Card contains control characters")
    if _FORBIDDEN.search(text) or _INTERNAL.search(text):
        raise ValueError("Card contains evaluation vocabulary")
    if _URL.search(text) or _QUOTES.search(text):
        raise ValueError("Card contains URLs or quoted material")
    return text
