"""Typed option citations and a pure, deterministic fetched-evidence checker.

No DSPy, environment loading, network or runtime pipeline imports belong here.
This gate checks provenance and exact quote presence, not semantic correctness.
"""
from __future__ import annotations

import hashlib
import re
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field


class OptionEvidence(BaseModel):
    option_label: Literal["A", "B", "C", "D"]
    url: str = Field(min_length=1)
    quote: str = Field(min_length=1, max_length=300)


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def evidence_records(evidence) -> list[dict]:
    """Convert typed output to records without silently dropping missing evidence."""
    if not isinstance(evidence, list):
        raise ValueError("Evidence must be a list")
    records = []
    for item in evidence:
        if isinstance(item, OptionEvidence):
            records.append(item.model_dump())
        elif isinstance(item, dict):
            records.append(dict(item))
        else:
            raise ValueError("Evidence entries must be option records")
    return records


def _official_source_url(url, *, requested=False) -> bool:
    if not isinstance(url, str) or not url or any(c.isspace() for c in url) or "\\" in url:
        return False
    try:
        parsed = urlparse(url)
        hosts = {"docs.cloud.google.com"} if requested else {"docs.cloud.google.com", "cloud.google.com"}
        return (parsed.scheme == "https" and parsed.hostname in hosts
                and parsed.username is None and parsed.password is None
                and parsed.port in (None, 443))
    except ValueError:
        return False


def check_evidence(evidence, sources) -> dict:
    """Require exactly A-D and an exact quote in each option's own fetched source.

    Only explicit requested_url/final url aliases match; there is no URL guessing
    or normalization. Hash and timestamp always come from the fetched record.
    Quotes use whitespace normalization only and remain case-sensitive.
    """
    errors = []
    options = []
    aliases = {}
    if not isinstance(sources, list) or not sources:
        errors.append("Fetched sources are required")
        sources = []
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            errors.append(f"Source {index} is not a record")
            continue
        text = source.get("text")
        url, requested = source.get("url"), source.get("requested_url")
        if (not isinstance(text, str) or not text.strip()
                or not _official_source_url(url)
                or not _official_source_url(requested, requested=True)
                or not isinstance(source.get("retrieved_at"), str) or not source["retrieved_at"].strip()
                or source.get("text_sha256") != hashlib.sha256(text.encode("utf-8")).hexdigest()):
            errors.append(f"Source {index} has incomplete or inconsistent fetch provenance")
            continue
        for alias in {url, requested}:
            if alias in aliases and aliases[alias] != source:
                errors.append(f"Ambiguous fetched source URL: {alias}")
            else:
                aliases[alias] = source
    try:
        records = evidence_records(evidence)
    except ValueError as exc:
        errors.append(str(exc))
        records = []
    labels = [r.get("option_label") for r in records]
    if len(labels) != 4 or any(labels.count(label) != 1 for label in "ABCD"):
        errors.append("Evidence must contain A, B, C and D exactly once")
    for index, record in enumerate(records):
        label, url, quote = record.get("option_label"), record.get("url"), record.get("quote")
        if label not in ("A", "B", "C", "D"):
            errors.append(f"Evidence {index} has an invalid option label")
            continue
        if not isinstance(url, str) or url not in aliases:
            errors.append(f"Option {label}: URL was not actually fetched")
            continue
        if not isinstance(quote, str) or not quote.strip() or len(quote) > 300:
            errors.append(f"Option {label}: quote must be nonempty and at most 300 characters")
            continue
        source = aliases[url]
        quote = normalize_whitespace(quote)
        if quote not in normalize_whitespace(source["text"]):
            errors.append(f"Option {label}: quote is not present in its own fetched source")
            continue
        options.append({
            "option_label": label, "url": source["url"], "quote": quote,
            "retrieved_at": source["retrieved_at"], "text_sha256": source["text_sha256"],
        })
    options.sort(key=lambda option: option["option_label"])
    return {"passed": not errors, "errors": errors, "options": options}
