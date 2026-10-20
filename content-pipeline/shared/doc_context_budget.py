"""Deterministic, offline documentation budgeting with exact source offsets.

Scores are lexical navigation hints, never evidence of factual support. Sources
are validated by the legacy formatter and are never edited. All offsets and
character counts use Python Unicode characters, not UTF-8 bytes.
"""
from __future__ import annotations

import hashlib
import re
from bisect import bisect_right
from collections.abc import Mapping
from urllib.parse import unquote

from shared.doc_search import DocumentationError, documentation_context

DEFAULT_DOC_CONTEXT_CHARS = 400_000
BUDGET_VERSION = 1
_PREAMBLE = "Official fetched Google Cloud documentation (quote only this text):"
_STOP = frozenset("a an and are as at be by can do for from has have in into is it its of on or that the their then this to use using with you your configure create instead should".split())
_WORD = re.compile(r"[a-zA-Z][a-zA-Z0-9_]*")


class DocumentationBudgetError(DocumentationError):
    """Required documentation cannot be represented safely within the budget."""


def _record(value):
    return value.model_dump() if hasattr(value, "model_dump") else value


def _tokens(text):
    return {m.group().casefold() for m in _WORD.finditer(text)
            if len(m.group()) > 2 and m.group().casefold() not in _STOP}


def _merge(spans):
    result = []
    for start, end in sorted(spans):
        if start >= end:
            continue
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(end, result[-1][1]))
        else:
            result.append((start, end))
    return result


def _quote_fields(value, inherited_url=None):
    """Read explicit quote fields only; never extract quotes from action prose."""
    value = _record(value)
    if isinstance(value, Mapping):
        url = value.get("url", value.get("source_url", inherited_url))
        for key, child in value.items():
            if key == "quote" or key.endswith("_quote") or key == "quotes" or key.endswith("_quotes"):
                if isinstance(child, str):
                    yield url, child
                elif isinstance(child, (Mapping, list, tuple)):
                    # A list of literal quotes may inherit its containing URL.
                    for item in child if isinstance(child, (list, tuple)) else [child]:
                        if isinstance(item, str):
                            yield url, item
                        else:
                            yield from _quote_fields(item, url)
                else:
                    raise DocumentationBudgetError("Invalid planned quote field")
            elif isinstance(child, (Mapping, list, tuple)) or hasattr(child, "model_dump"):
                yield from _quote_fields(child, url)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _quote_fields(item, inherited_url)


def _quote_pattern(quote):
    """Case-sensitive whitespace normalization, mapped to original raw offsets."""
    parts = quote.split()
    if not parts:
        raise DocumentationBudgetError("Required quotes must be nonempty strings")
    return re.compile(r"\s+".join(re.escape(part) for part in parts))


def quote_in_context(receipt, sources, metadata):
    """Return whether a receipt occurs within one retained raw source span.

    Match only fetched URL aliases and matching original hash/timestamp metadata.
    Whitespace may normalize as in ``check_evidence``; case may not. Disjoint
    excerpts are never joined to manufacture a quote across an omitted span.
    Malformed receipts/metadata return false rather than approve evidence.
    """
    receipt = _record(receipt)
    if not isinstance(receipt, Mapping) or not isinstance(metadata, Mapping):
        return False
    url, quote = receipt.get("url"), receipt.get("quote")
    if not isinstance(url, str) or not isinstance(quote, str) or not quote.strip():
        return False
    pattern = _quote_pattern(quote)
    pages = metadata.get("pages")
    if not isinstance(pages, (list, tuple)) or not isinstance(sources, (list, tuple)):
        return False
    for source in sources:
        if not isinstance(source, Mapping) or url not in (source.get("url"), source.get("requested_url")):
            continue
        text = source.get("text")
        if (not isinstance(text, str) or not isinstance(source.get("retrieved_at"), str)
                or source.get("text_sha256") != hashlib.sha256(text.encode("utf-8")).hexdigest()):
            continue
        for page in pages:
            if not isinstance(page, Mapping) or page.get("omitted") is True:
                continue
            if (page.get("url") != source.get("url") or page.get("text_sha256") != source.get("text_sha256")
                    or page.get("retrieved_at") != source.get("retrieved_at")):
                continue
            offsets = page.get("retained_offsets")
            if not isinstance(offsets, (list, tuple)):
                continue
            for span in offsets:
                if (not isinstance(span, (list, tuple)) or len(span) != 2
                        or any(type(offset) is not int for offset in span)):
                    continue
                start, end = span
                if 0 <= start < end <= len(text) and pattern.search(text[start:end]):
                    return True
    return False


def _actions(plan):
    plan = _record(plan) or {}
    if not isinstance(plan, Mapping):
        raise DocumentationBudgetError("Plan must be a record")
    best = plan.get("best_action", "")
    constraints = plan.get("decisive_constraints", ())
    actions = {"A": " ".join([best if isinstance(best, str) else "", *[c for c in constraints if isinstance(c, str)]])}
    for label, mistake in zip("BCD", plan.get("mistakes", ())):
        mistake = _record(mistake)
        if isinstance(mistake, Mapping):
            actions[label] = " ".join(value for key in ("action", "scenario_reason")
                                       if isinstance(value := mistake.get(key), str))
        else:
            actions[label] = str(mistake)
    return {label: _tokens(action) for label, action in actions.items() if action}


def _header(source):
    return (f"URL: {source['url']}\nRequested URL: {source['requested_url']}\n"
            f"Retrieved at: {source['retrieved_at']}\nText SHA-256: {source['text_sha256']}\nSource text:\n")


def _body(page, spans):
    text = page["source"]["text"]
    if spans == [(0, len(text))]:
        return text
    return "\n\n".join(f"[Exact source excerpt {start}:{end}]\n{text[start:end]}" for start, end in spans)


def _render_page(page, spans):
    return _header(page["source"]) + _body(page, spans) if spans else ""


def _render(pages):
    return "\n\n".join([_PREAMBLE] + [_render_page(p, p["spans"]) for p in pages if p["spans"]])


def _anchor(page, terms):
    """Choose a dense lexical window, breaking ties by original offset."""
    hits = [(m.start(), m.end()) for m in _WORD.finditer(page["source"]["text"])
            if m.group().casefold() in terms]
    if not hits:
        text = page["source"]["text"]
        # No lexical evidence: discovery provenance alone cannot invent a match.
        middle = len(text) // 2
        return middle, min(len(text), middle + 1)
    starts = [s for s, _ in hits]
    best = max(range(len(hits)), key=lambda i: (bisect_right(starts, starts[i] + 600) - i, -starts[i]))
    return hits[best]


def _sections(text):
    # Markdown heading sections take precedence over paragraph boundaries.
    boundaries = [m.start() for m in re.finditer(r"(?m)^ {0,3}#{1,6}\s+", text)]
    if not boundaries:
        boundaries = [m.end() for m in re.finditer(r"\n[ \t]*\n", text)]
    boundaries = sorted({0, len(text), *boundaries})
    return list(zip(boundaries, boundaries[1:]))


def _fit_page(page, target):
    """Prefer whole sections, then exact excerpts around lexical/quote anchors."""
    text = page["source"]["text"]
    full = [(0, len(text))]
    if len(_render_page(page, full)) <= target:
        return full
    spans = list(page["minimum"])
    if spans and len(_render_page(page, spans)) > target:
        return spans
    sections = _sections(text)
    terms = page["terms"]
    anchors = list(page["required"]) + list(page["anchors"])
    if not anchors:
        anchors = [_anchor(page, terms)]
    # Quote-bearing and action-bearing sections precede shared/overview text.
    def section_key(span):
        start, end = span
        required = any(start < hi and lo < end for lo, hi in page["required"])
        score = len(_tokens(text[start:end]) & terms)
        return (-int(required), -score, end - start, start)
    candidates = sorted(sections, key=section_key)
    def add(span):
        nonlocal spans
        trial = _merge([*spans, span])
        if len(_render_page(page, trial)) <= target:
            spans = trial
            return True
        return False
    selected_sections = []
    relevant, other = [], []
    for span in candidates:
        start, end = span
        has_quote = any(start < hi and lo < end for lo, hi in page["required"])
        (relevant if has_quote or _tokens(text[start:end]) & terms else other).append(span)
    primary = [span for span in relevant if any(span[0] < end and start < span[1] for start, end in anchors)]
    for span in primary:
        if add(span):
            selected_sections.append(span)
    # A flattened/giant section must not fall back to a first-N prefix. Reserve
    # action/quote windows before unrelated sections can consume the budget.
    # Do not extend an already-retained whole section across its boundaries.
    active = [(start, end) for start, end in anchors
              if not any(lo <= start and end <= hi for lo, hi in selected_sections)]
    if active:
        baseline = list(spans)
        def expanded(radius):
            return _merge([*baseline, *[(max(0, start - radius), min(len(text), end + radius))
                                       for start, end in active]])
        low, high = 0, len(text)
        best = spans
        while low <= high:
            radius = (low + high) // 2
            trial = expanded(radius)
            if len(_render_page(page, trial)) <= target:
                best = trial
                low = radius + 1
            else:
                high = radius - 1
        spans = best
    for span in relevant:
        if span not in primary:
            add(span)
    for span in other:
        add(span)
    return spans


def build_documentation_context(sources, *, max_chars=DEFAULT_DOC_CONTEXT_CHARS, plan=None, receipts=()):
    """Return bounded context and JSON-safe audit metadata, without changing sources.

    Explicit receipts require URL and quote strings. Nested plan fields named
    ``quote``, ``*_quote``, ``quotes`` or ``*_quotes`` are also protected. A plan
    quote without a URL protects every matching fetched page. Matching is case-
    sensitive with whitespace normalization; retained spans keep original raw
    whitespace. URL aliases use fetched provenance only.

    The strongest page for every discovered/planned option is mandatory. Scores
    use discovery labels then action-token overlap (URL tokens weighted above
    body tokens); they are not semantic relevance or support judgments. On tiny
    budgets mandatory pages may contain only an anchor token and required quotes.
    Metadata page counts exclude headers; top-level counts include all headers
    and excerpt markers. Offset pairs are half-open original-text spans.
    """
    full_context = documentation_context(sources)
    if type(max_chars) is not int or max_chars <= 0:
        raise DocumentationBudgetError("Documentation budget must be a positive integer")
    actions = _actions(plan)
    pages = []
    aliases = {}
    for index, source in enumerate(sources):
        text = source["text"]
        # Provenance metadata is deliberately scalar and stage-independent.
        if not isinstance(source["retrieved_at"], str):
            raise DocumentationBudgetError("Source retrieval timestamp must be a string")
        discovered = source.get("discovery_options", [])
        if not isinstance(discovered, (list, tuple)) or any(label not in "ABCD" or len(label) != 1 for label in discovered if isinstance(label, str)) or any(not isinstance(label, str) for label in discovered):
            raise DocumentationBudgetError("Invalid discovery option labels")
        url_terms, text_terms = _tokens(unquote(source["url"])), _tokens(text)
        scores = {label: (10_000 if label in discovered else 0) + 8 * len(terms & url_terms) + len(terms & text_terms)
                  for label, terms in actions.items()}
        for label in discovered:
            scores[label] = max(scores.get(label, 0), 10_000)
        overview = source.get("discovery_kind") == "overview"
        priority = max(scores.values(), default=0) * 10 + (0 if overview else 1)
        page = {"source": source, "index": index, "scores": scores, "priority": priority,
                "required": [], "anchors": [], "mandatory_options": [], "terms": set().union(*actions.values()) if actions else set(),
                "spans": [(0, len(text))]}
        pages.append(page)
        for alias in {source["url"], source["requested_url"]}:
            prior = aliases.setdefault(alias, [])
            if any(p["source"]["text"] != text for p in prior):
                raise DocumentationBudgetError("Conflicting fetched URL aliases")
            prior.append(page)
    # Cover every option with evidence of discovery or nonzero lexical overlap.
    for label in "ABCD":
        relevant = [p for p in pages if p["scores"].get(label, 0) > 0]
        if relevant:
            page = min(relevant, key=lambda p: (-p["scores"][label], -p["priority"], len(p["source"]["text"]), p["index"]))
            page["mandatory_options"].append(label)
            page["anchors"].append(_anchor(page, actions.get(label, set())))
    required_quotes = []
    for receipt in receipts:
        receipt = _record(receipt)
        if not isinstance(receipt, Mapping) or not isinstance(receipt.get("url"), str) or not isinstance(receipt.get("quote"), str):
            raise DocumentationBudgetError("Receipts require URL and quote strings")
        required_quotes.append((receipt["url"], receipt["quote"]))
    required_quotes.extend(_quote_fields(plan))
    for url, quote in required_quotes:
        if not isinstance(quote, str) or not quote.strip():
            raise DocumentationBudgetError("Required quotes must be nonempty strings")
        if url is not None and (not isinstance(url, str) or url not in aliases):
            raise DocumentationBudgetError("Required quote URL was not fetched")
        pattern = _quote_pattern(quote)
        matches = [(p, pattern.search(p["source"]["text"])) for p in (aliases[url] if url is not None else pages)]
        matches = [(page, match) for page, match in matches if match is not None]
        if not matches:
            raise DocumentationBudgetError("Required quote does not match fetched text (case-sensitive, whitespace-normalized)")
        for page, match in matches:
            page["required"].append(match.span())
            page["priority"] = max(page["priority"], 1_000_000)
    for page in pages:
        page["required"] = _merge(page["required"])
        page["mandatory"] = bool(page["required"] or page["mandatory_options"])
        # Quotes already provide content on a mandatory page; action anchors are
        # optional when quotes consume the available budget.
        page["minimum"] = page["required"] or _merge(page["anchors"])
        if page["mandatory"] and len(_render_page(page, page["spans"])) < len(_render_page(page, page["minimum"])):
            # On very short pages the full source costs less than an excerpt label.
            page["minimum"] = page["spans"]
        # Every option representative and every explicit-quote page shares the
        # same protected tier. Longest-first trimming prevents a huge key page
        # from starving smaller distractor pages based on incidental token scores.
        if page["mandatory"]:
            page["priority"] = 1_000_000
    context = full_context
    if len(context) > max_chars:
        minimum_pages = [{**p, "spans": p["minimum"] if p["mandatory"] else []} for p in pages]
        minimum_chars = len(_render(minimum_pages))
        if minimum_chars > max_chars:
            raise DocumentationBudgetError("Required quote spans and mandatory option pages exceed documentation budget")
        mandatory_count = sum(p["mandatory"] for p in pages)
        # Fair soft floors reserve useful per-option context. They shrink to the
        # exact protected minimum at tiny budgets, never add an extra failure gate.
        fair_extra = (max_chars - minimum_chars) // max(1, mandatory_count)
        for page in pages:
            minimum_size = len(_render_page(page, page["minimum"])) if page["mandatory"] else 0
            full_size = len(_render_page(page, page["spans"]))
            page["floor"] = (min(full_size, max(minimum_size, min(16_000, minimum_size + fair_extra)))
                             if page["mandatory"] else 0)
        # Trim lower priority first, longest page first on equal priority.
        for page in sorted(pages, key=lambda p: (p["priority"], -len(p["source"]["text"]), p["index"])):
            if len(context) <= max_chars:
                break
            old_size = len(_render_page(page, page["spans"]))
            target = max(page["floor"], old_size - (len(context) - max_chars))
            spans = _fit_page(page, max(0, target))
            if not spans and page["mandatory"]:
                spans = page["minimum"]
            page["spans"] = spans
            context = _render(pages)
        if len(context) > max_chars:
            raise DocumentationBudgetError("Documentation context exceeds budget after trimming")
    metadata_pages = []
    for page in pages:
        source, spans = page["source"], page["spans"]
        cursor, omitted = 0, []
        for start, end in spans:
            if cursor < start:
                omitted.append([cursor, start])
            cursor = end
        if cursor < len(source["text"]):
            omitted.append([cursor, len(source["text"])])
        metadata_pages.append({
            "url": source["url"], "requested_url": source["requested_url"],
            "text_sha256": source["text_sha256"], "retrieved_at": source["retrieved_at"],
            "before_chars": len(source["text"]), "after_chars": sum(end - start for start, end in spans),
            "priority": page["priority"], "priority_basis": "discovery_options_then_lexical_action_overlap",
            "option_scores": page["scores"], "mandatory_options": page["mandatory_options"],
            "required_quote_offsets": [list(span) for span in page["required"]],
            "retained_offsets": [list(span) for span in spans], "trimmed_spans": omitted,
            "status": "omitted" if not spans else "trimmed" if omitted else "full",
            "omitted": not bool(spans), "trimmed": bool(omitted),
        })
    return {"context": context, "metadata": {
        "version": BUDGET_VERSION, "max_chars": max_chars, "before_chars": len(full_context),
        "after_chars": len(context), "before_pages": len(pages),
        "after_pages": sum(bool(p["spans"]) for p in pages), "pages": metadata_pages,
    }}
