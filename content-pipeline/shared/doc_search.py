"""Discover official documentation URLs, then fetch their HTML directly.

Exa results are discovery hints only. No search snippet is accepted as evidence.
Imports and context formatting are offline-safe; retrieval is an explicit action.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from shared.cert_registry import content_node

logger = logging.getLogger(__name__)
DISCOVERY_HOST = "docs.cloud.google.com"
OFFICIAL_DOC_HOSTS = frozenset({DISCOVERY_HOST, "cloud.google.com"})
MAX_HTML_BYTES = 4 * 1024 * 1024


class DocumentationError(ValueError):
    """No trustworthy fetched documentation is available."""


def approved_documentation_url(url: str, *, discovery: bool = False) -> str:
    """Allow HTTPS official documentation only; no credentials or other ports."""
    if not isinstance(url, str) or not url or any(c.isspace() for c in url):
        raise DocumentationError("Invalid documentation URL")
    try:
        parsed = urlparse(url)
        hosts = {DISCOVERY_HOST} if discovery else OFFICIAL_DOC_HOSTS
        if (parsed.scheme != "https" or parsed.hostname not in hosts
                or parsed.username is not None or parsed.password is not None
                or parsed.port not in (None, 443) or "\\" in url):
            raise DocumentationError("Unapproved documentation URL: " + url)
    except ValueError as exc:
        raise DocumentationError("Invalid documentation URL: " + url) from exc
    return url


class OfficialDocsRedirectHandler(HTTPRedirectHandler):
    """Validate each redirect target BEFORE urllib can request it."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        approved_documentation_url(newurl)
        time.sleep(0.3)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _discovery_query(objective_text: str, services: list[str]) -> str:
    """Focus objective examples without changing existing question-first queries."""
    fallback = " ".join(["Google Cloud", objective_text, ", ".join(services)])
    if objective_text.startswith("Marked answer: ") and "\nQuestion stem: " in objective_text:
        return fallback
    pattern = r"\(\s*(?:e\.g\.\s*,?\s*|for example\b\s*[:,]?\s*)([^()]*)\)"
    examples = [match.group(1).strip() for match in re.finditer(pattern, objective_text, re.I)
                if match.group(1).strip()]
    if not examples:
        return fallback
    context = re.sub(pattern, " ", objective_text, flags=re.I)
    # Examples provide concrete retrieval targets; service lists can dilute them.
    query = " ".join(["Google Cloud", *examples, context])
    query = re.sub(r"\bA\s*/\s*B\b", "A/B", query, flags=re.I)
    return " ".join(query.split())


def _discover_urls(objective_text: str, services: list[str], num_results: int) -> list[str]:
    # Do not import the legacy Exa wrapper: it loads credential files on import.
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        raise DocumentationError("EXA_API_KEY must be supplied in the environment")
    from exa_py import Exa  # Lazy: imports and pure operations never initialize Exa.
    query = _discovery_query(objective_text, services)
    results = Exa(api_key=api_key).search(
        query=query, type="neural", num_results=num_results,
        include_domains=[DISCOVERY_HOST],
    )
    urls = []
    for result in results.results:
        url = getattr(result, "url", None)
        try:
            approved_documentation_url(url, discovery=True)
        except DocumentationError:
            continue
        if url not in urls:
            urls.append(url)
    return urls


def _fetch_documentation(url: str) -> dict:
    requested_url = approved_documentation_url(url, discovery=True)
    opener = build_opener(OfficialDocsRedirectHandler())
    request = Request(requested_url, headers={"User-Agent": "Testero-documentation/1.0"})
    time.sleep(0.3)
    with opener.open(request, timeout=30) as response:
        final_url = approved_documentation_url(response.geturl())
        if response.status != 200:
            raise DocumentationError("Documentation response was not HTTP 200")
        if response.headers.get_content_type() not in {"text/html", "application/xhtml+xml"}:
            raise DocumentationError("Documentation response is not HTML")
        raw = response.read(MAX_HTML_BYTES + 1)
        if len(raw) > MAX_HTML_BYTES:
            raise DocumentationError("Documentation HTML exceeds size limit")
        html = raw.decode(response.headers.get_content_charset() or "utf-8", errors="strict")
    text = content_node(html).text()
    if not text:
        raise DocumentationError("Fetched documentation has no content")
    return {
        "requested_url": requested_url,
        "url": final_url,
        "text": text,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


def _search_objective_docs(objective_text: str, services: list[str], num_results: int) -> list[dict]:
    if not isinstance(objective_text, str) or not objective_text.strip():
        raise DocumentationError("An objective text is required")
    if not isinstance(services, list) or any(not isinstance(s, str) for s in services):
        raise DocumentationError("Services must be a list of names")
    if num_results < 1:
        raise DocumentationError("At least one documentation result is required")
    sources = []
    for url in _discover_urls(objective_text, services, num_results):
        try:
            source = _fetch_documentation(url)
        except Exception as exc:
            logger.warning("Could not fetch discovered documentation %s: %s", url, exc)
            continue
        previous = next((s for s in sources if s["url"] == source["url"]), None)
        if previous is not None:
            if previous["text_sha256"] != source["text_sha256"]:
                raise DocumentationError("Conflicting text for one final documentation URL")
            continue
        sources.append(source)
    if not sources:
        raise DocumentationError("No official documentation was successfully fetched")
    return sources


def search_objective_docs(objective_text: str, services: list[str]) -> list[dict]:
    """Return fetched source records for one registry objective plus its services.

    Each record binds requested_url and final url to the same fetched text,
    retrieval timestamp and SHA-256 of the exact UTF-8 text. Raises when empty.
    """
    return _search_objective_docs(objective_text, services, 5)


def documentation_context(sources: list[dict]) -> str:
    """Format fetched sources only. Refuse missing text or inconsistent hashes."""
    if not sources:
        raise DocumentationError("Fetched documentation is required")
    sections = ["Official fetched Google Cloud documentation (quote only this text):"]
    for source in sources:
        url = approved_documentation_url(source.get("url"))
        requested = approved_documentation_url(source.get("requested_url"), discovery=True)
        text = source.get("text")
        if (not isinstance(text, str) or not text.strip() or not source.get("retrieved_at")
                or source.get("text_sha256") != hashlib.sha256(text.encode("utf-8")).hexdigest()):
            raise DocumentationError("Incomplete or inconsistent fetched source")
        sections.append(
            f"URL: {url}\nRequested URL: {requested}\n"
            f"Retrieved at: {source['retrieved_at']}\nText SHA-256: {source['text_sha256']}\n"
            f"Source text:\n{text}"
        )
    return "\n\n".join(sections)


def search_google_docs(topic: str, services: list[str], num_results: int = 5,
                       subsection_considerations: list[str] | None = None) -> tuple[str, list[str]]:
    """Compatibility wrapper. Never guess URLs or return unfetched snippets."""
    objective_text = " ".join([topic] + (subsection_considerations or []))
    sources = _search_objective_docs(objective_text, services, num_results)
    return documentation_context(sources), list(dict.fromkeys(s["url"] for s in sources))


search_google_docs_with_exa = search_google_docs
