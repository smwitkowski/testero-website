"""Cheap documentation-anchor checks; never a semantic support verdict."""
from __future__ import annotations

from copy import deepcopy
from urllib.parse import urldefrag

from shared.doc_search import (DocumentationError, _ConflictingDocumentationError,
                               approved_documentation_url, documentation_context)


def _metadata(commitments):
    if hasattr(commitments, "model_dump"):
        commitments = commitments.model_dump()
    from pydantic import ValidationError
    from shared.decision_planner import DocumentationCommitments

    try:
        commitments = DocumentationCommitments.model_validate(commitments).model_dump()
    except ValidationError:
        return None, ["Missing or malformed documentation commitments"]
    anchors = commitments["anchors"]
    if sorted(anchor["option_label"] for anchor in anchors) != list("ABCD"):
        return None, ["Documentation anchors must cover A-D exactly once"]
    try:
        for anchor in anchors:
            approved_documentation_url(urldefrag(anchor["url"])[0], discovery=True)
    except DocumentationError:
        return None, ["Unapproved documentation anchor URL"]
    return commitments, []


def fetch_commitment_sources(commitments, cache, sources):
    """Fetch at most four approved pages through the caller's existing cache."""
    result = deepcopy(sources)
    metadata, errors = _metadata(commitments)
    if errors:
        return result, errors
    urls = list(dict.fromkeys(urldefrag(a["url"])[0] for a in metadata["anchors"]))
    for url in urls:
        if any(url in (s.get("url"), s.get("requested_url"), *s.get("requested_urls", [])) for s in result):
            continue
        try:
            source = cache._fetch(url)
        except _ConflictingDocumentationError:
            raise
        except (DocumentationError, OSError, UnicodeError):
            errors.append("Documentation request failed: " + url)
            continue
        previous = next((s for s in result if s.get("url") == source.get("url")), None)
        if previous is not None:
            if previous.get("text_sha256") != source.get("text_sha256"):
                raise _ConflictingDocumentationError("Conflicting text for one final documentation URL")
            aliases = previous.setdefault("requested_urls", [previous.get("requested_url")])
            if source.get("requested_url") not in aliases:
                aliases.append(source.get("requested_url"))
        else:
            result.append(source)
    return result, errors


def check_doc_commitments(plan, commitments, sources):
    """Check bindings and section presence, not claim entailment.

    Section matching is case-sensitive after collapsing whitespace. URL fragments
    are stripped only for page identity; a fragment alone never proves a section.
    """
    metadata, reasons = _metadata(commitments)
    result = {"passed": False, "reasons": reasons, "checks": [], "provenance": [],
              "semantic_support_verified": False}
    if reasons:
        return result
    try:
        documentation_context(sources)
    except (DocumentationError, TypeError, AttributeError):
        reasons.append("Invalid fetched documentation provenance")
        return result
    hashes = {}
    for source in sources:
        previous = hashes.setdefault(source["url"], source["text_sha256"])
        if previous != source["text_sha256"]:
            reasons.append("Conflicting fetched snapshots")
            return result
    if hasattr(plan, "model_dump"):
        plan = plan.model_dump()
    try:
        targets = {"A": plan["best_action"], **{
            label: mistake["scenario_reason"] for label, mistake in zip("BCD", plan["mistakes"])
        }}
        if len(plan["mistakes"]) != 3:
            raise ValueError("Invalid mistakes")
    except (KeyError, TypeError, ValueError):
        reasons.append("Invalid decision plan")
        return result
    for issue in metadata["unresolved_issues"]:
        reasons.append("Unresolved " + issue["kind"] + ": " + issue["detail"][:500])
    for anchor in metadata["anchors"]:
        label = anchor["option_label"]
        errors = []
        if anchor["target_claim"] != targets[label]:
            errors.append("Target claim does not match plan")
        url = urldefrag(anchor["url"])[0]
        matches = [s for s in sources if isinstance(s, dict) and url in
                   (s.get("url"), s.get("requested_url"), *s.get("requested_urls", []))]
        if not matches:
            errors.append("Anchor page was not fetched")
        valid = []
        for source in matches:
            try:
                documentation_context([source])
            except DocumentationError:
                errors.append("Invalid fetched snapshot provenance")
                continue
            valid.append(source)
        if len({s["text_sha256"] for s in valid}) > 1:
            errors.append("Conflicting fetched snapshots")
        if valid and not any(" ".join(anchor["section"].split()) in
                             " ".join(s["text"].split()) for s in valid):
            errors.append("Section not found in anchor page")
        for source in valid:
            result["provenance"].append({key: source[key] for key in
                ("requested_url", "url", "text_sha256", "retrieved_at")})
        result["checks"].append({"option_label": label, "passed": not errors, "reasons": errors})
        reasons.extend(label + ": " + error for error in errors)
    result["passed"] = not reasons
    return result
