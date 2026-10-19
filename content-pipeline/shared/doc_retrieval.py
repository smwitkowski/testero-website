"""Offline, deterministic per-option passage ranking; no model or network calls."""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass

from shared.doc_search import documentation_context

# Character budgets are conservative token estimates, not provider token counts.
DEFAULT_CONTEXT_CHARS = 60000
OBJECTIVE_PREFIX_CHARS = 8000
CHUNK_CHARS = 2200
CHUNK_OVERLAP = 350  # At least the maximum receipt length (300 characters).
STOP = frozenset("a an the and or to of in on for with is are be by as it this that from should do use using your you its which what into can has have".split())


def terms(text):
    return [word for word in re.findall(r"[a-z0-9]+", text.casefold()) if word not in STOP]


@dataclass(frozen=True)
class Chunk:
    id: str
    url: str
    requested_url: str
    source_sha256: str
    retrieved_at: str
    start: int
    end: int
    text: str


def chunk_sources(sources, *, size=CHUNK_CHARS, overlap=CHUNK_OVERLAP):
    """Split original text at section/sentence boundaries, retaining exact spans."""
    documentation_context(sources)
    if size <= overlap or overlap < 300:
        raise ValueError("Chunks need size > overlap >= maximum quote length (300)")
    chunks = []
    seen = set()
    for source in sorted(sources, key=lambda row: (row["url"], row["text_sha256"])):
        identity = (source["url"], source["text_sha256"])
        if identity in seen:
            continue
        seen.add(identity)
        text, start = source["text"], 0
        while start < len(text):
            end = min(len(text), start + size)
            if end < len(text):
                # Headings/paragraphs when retained; flattened historic sources
                # use sentence sections. No rewriting of the quoted text.
                boundaries = list(re.finditer(r"\n\s*\n|(?<=[.!?])\s+(?=[A-Z])", text[start + size // 2:end]))
                if boundaries:
                    boundary = start + size // 2 + boundaries[-1].end()
                    if boundary > start + overlap:
                        end = boundary
            chunk_id = hashlib.sha256(f"{source['url']}|{source['text_sha256']}|{start}:{end}".encode()).hexdigest()[:24]
            chunks.append(Chunk(chunk_id, source["url"], source["requested_url"],
                                source["text_sha256"], source["retrieved_at"], start, end, text[start:end]))
            if end == len(text):
                break
            start = end - overlap
    return chunks


class BM25:
    def __init__(self, chunks):
        self.chunks = chunks
        self.counts = [Counter(terms(chunk.text)) for chunk in chunks]
        self.lengths = [sum(count.values()) for count in self.counts]
        self.average = sum(self.lengths) / max(1, len(chunks)) or 1
        df = Counter(word for count in self.counts for word in count)
        self.idf = {word: math.log(1 + (len(chunks) - n + .5) / (n + .5)) for word, n in df.items()}

    def rank(self, query):
        query_terms = set(terms(query))
        scored = []
        for chunk, count, length in zip(self.chunks, self.counts, self.lengths):
            score = sum(self.idf.get(word, 0) * count[word] * 2.5 /
                        (count[word] + 1.5 * (.25 + .75 * length / self.average))
                        for word in query_terms if count[word])
            scored.append((score, chunk))
        return [chunk for score, chunk in sorted(scored, key=lambda row: (-row[0], row[1].id)) if score > 0]


def plan_queries(scope, plan):
    constraints = " ".join(plan["decisive_constraints"])
    return [scope.get("objective_text", "") + " " + plan["engineering_decision"] + " " + constraints,
            plan["best_action"], constraints,
            *(mistake["action"] for mistake in plan["mistakes"]),
            *(mistake["scenario_reason"] for mistake in plan["mistakes"])]


def render_chunk(chunk):
    return (f"URL: {chunk.url}\nRequested URL: {chunk.requested_url}\n"
            f"Retrieved at: {chunk.retrieved_at}\nFull source text SHA-256: {chunk.source_sha256}\n"
            f"Chunk ID: {chunk.id}; source span [{chunk.start}:{chunk.end}]\nSource excerpt:\n{chunk.text}")


def merge_chunks(chunks):
    """Merge only overlapping exact spans from the same frozen source record."""
    merged = []
    for chunk in sorted(chunks, key=lambda row: (row.url, row.source_sha256, row.start, row.end)):
        if merged and (merged[-1].url, merged[-1].source_sha256) == (chunk.url, chunk.source_sha256) and chunk.start <= merged[-1].end:
            previous = merged.pop()
            text = previous.text + chunk.text[max(0, previous.end - chunk.start):]
            end = max(previous.end, chunk.end)
            identity = hashlib.sha256(f"{chunk.url}|{chunk.source_sha256}|{previous.start}:{end}".encode()).hexdigest()[:24]
            merged.append(Chunk(identity, previous.url, previous.requested_url, previous.source_sha256,
                                previous.retrieved_at, previous.start, end, text))
        else:
            merged.append(chunk)
    return merged


def select_chunks(chunks, queries, budget):
    """Round-robin query ranks so every option gets its own retrieval budget."""
    ranker = BM25(chunks)
    rankings = [ranker.rank(query) for query in queries]
    chosen, used = [], set()
    for rank in range(max((len(rows) for rows in rankings), default=0)):
        for rows in rankings:
            if rank >= len(rows) or rows[rank].id in used:
                continue
            chunk = rows[rank]
            merged = merge_chunks([*chosen, chunk])
            size = sum(len(render_chunk(row)) + 2 for row in merged)
            if size <= budget:
                chosen = merged
                used.add(chunk.id)
    return chosen


class RetrievalSession:
    """Freeze a small objective prefix per run; candidate evidence stays separate."""
    def __init__(self):
        from threading import Lock
        self._lock = Lock()
        self._prefixes = {}

    def prepare(self, scope, plan, sources, *, budget=DEFAULT_CONTEXT_CHARS):
        if not isinstance(budget, int) or isinstance(budget, bool) or budget < 4000:
            raise ValueError("Retrieval budget must be at least 4000 characters")
        chunks = chunk_sources(sources)
        key = (scope["objective_id"], budget)
        with self._lock:
            if key not in self._prefixes:
                objective_query = scope.get("objective_text", scope["objective_id"])
                prefix = select_chunks(chunks, [objective_query], min(OBJECTIVE_PREFIX_CHARS, budget // 4))
                urls = {chunk.url for chunk in prefix}
                self._prefixes[key] = (prefix, [source for source in sources if source["url"] in urls])
            prefix, prefix_sources = self._prefixes[key]
        # Preserve complete records for receipts, writer and independent judges.
        merged = {source["url"]: source for source in prefix_sources}
        for source in sources:
            previous = merged.get(source["url"])
            if previous and previous["text_sha256"] != source["text_sha256"]:
                raise ValueError("Conflicting source versions in retrieval session")
            merged.setdefault(source["url"], source)
        chunks = chunk_sources([merged[source["url"]] for source in sources])
        prefix_ids = {chunk.id for chunk in prefix}
        prefix_text = "\n\n".join(render_chunk(chunk) for chunk in prefix)
        # A short introduction from every discovered page keeps broad capability,
        # lifecycle and limitation statements that lexical ranking can bury.
        anchors = [chunk for chunk in chunks if chunk.start == 0 and chunk.id not in prefix_ids]
        anchor_cost = sum(len(render_chunk(chunk)) + 2 for chunk in anchors)
        remaining = budget - len(prefix_text) - 200
        if anchor_cost > remaining // 2:
            anchors = select_chunks(anchors, plan_queries(scope, plan), remaining // 2)
        anchor_ids = {chunk.id for chunk in anchors}
        anchor_cost = sum(len(render_chunk(chunk)) + 2 for chunk in anchors)
        selected = merge_chunks([*anchors, *select_chunks([chunk for chunk in chunks if chunk.id not in prefix_ids | anchor_ids],
                                 plan_queries(scope, plan), remaining - anchor_cost)])
        prefix_context = "Official fetched Google Cloud documentation excerpts (quote only these passages):\n" + prefix_text
        candidate_context = "Candidate-specific per-option passages:\n" + "\n\n".join(render_chunk(chunk) for chunk in selected)
        context = prefix_context + "\n\n" + candidate_context
        return {"context": context, "prefix_context": prefix_context, "candidate_context": candidate_context,
                "chunks": [*prefix, *selected], "sources": list(merged.values()),
                "metadata": {"version": 1, "budget_chars": budget, "context_chars": len(context),
                             "estimated_doc_tokens": math.ceil(len(context) / 4),
                             "objective_prefix_sha256": hashlib.sha256(prefix_text.encode()).hexdigest(),
                             "chunk_ids": [chunk.id for chunk in [*prefix, *selected]]}}


def quote_in_chunks(receipt, chunks):
    """Same case-sensitive whitespace policy as check_evidence, within ONE span."""
    from shared.evidence import normalize_whitespace
    quote = receipt.get("quote")
    return isinstance(quote, str) and bool(quote.strip()) and any(
        receipt.get("url") in (chunk.url, chunk.requested_url)
        and normalize_whitespace(quote) in normalize_whitespace(chunk.text) for chunk in chunks)
