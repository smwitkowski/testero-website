"""Frozen objective-wide fetched pages and candidate-specific offline ranking.

No search or model call occurs here. Ranking is lexical, not evidence of support.
Historical discovery labels are discarded: they belong to an older candidate.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
from types import SimpleNamespace

from shared.doc_search import documentation_context, decision_discovery_text, _discovery_query, _product_aliases
from shared.doc_retrieval import BM25


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False,
                                     separators=(",", ":")).encode()).hexdigest()


def freeze_corpus(objective_id, sources):
    """Keep all distinct snapshots; choose newest non-conflicting URL aliases.

    Superseded snapshots remain in the hash-bound corpus for audit. The production
    context builder refuses conflicting versions, so only one alias-compatible
    version is active. Retrieval timestamps break ties, then the snapshot hash.
    """
    if not isinstance(objective_id, str) or not objective_id.strip():
        raise ValueError("Corpus requires an objective identity")
    snapshots = {}
    for original in sources:
        documentation_context([original])
        source = {key: deepcopy(value) for key, value in original.items()
                  if key not in ("discovery_options", "discovery_kind")}
        # A refetch of identical URL/body content is the same snapshot, not a
        # second copy of a potentially huge public page. Keep its latest fetch.
        identity = (source["url"], source["requested_url"], source["text_sha256"])
        previous = snapshots.get(identity)
        if previous is None or (source["retrieved_at"], digest(source)) > (previous["retrieved_at"], digest(previous)):
            snapshots[identity] = source
    if not snapshots:
        raise ValueError("Corpus requires fetched documentation")
    ordered = sorted(snapshots.values(), key=lambda s: (s["retrieved_at"], s["url"], s["text_sha256"], digest(s)), reverse=True)
    active, aliases, superseded = [], {}, []
    for source in ordered:
        names = {source["url"], source["requested_url"]}
        if any(name in aliases and aliases[name] != source["text_sha256"] for name in names):
            superseded.append(source)
            continue
        # Identical bodies at one final URL need only one context copy. Keep
        # alternate requested aliases as snapshots for full provenance.
        if any(row["url"] == source["url"] and row["text_sha256"] == source["text_sha256"] for row in active):
            continue
        active.append(source)
        aliases.update({name: source["text_sha256"] for name in names})
    body = {"version": 1, "objective_id": objective_id,
            "sources": sorted(active, key=lambda s: (s["url"], s["text_sha256"])),
            "snapshots": sorted(snapshots.values(), key=lambda s: (s["url"], s["retrieved_at"], digest(s))),
            "superseded_snapshots": len(superseded),
            "version_policy": "newest timestamp, then URL/hash; conflicting aliases omitted from active view"}
    return {**body, "sha256": digest(body)}


def validate_corpus(corpus, objective_id):
    if (not isinstance(corpus, dict) or corpus.get("version") != 1
            or corpus.get("objective_id") != objective_id
            or corpus.get("sha256") != digest({k: v for k, v in corpus.items() if k != "sha256"})):
        raise ValueError("Frozen objective corpus binding mismatch")
    documentation_context(corpus["sources"])
    return corpus


def discovery_queries(scope, plan):
    """Production search_objective_docs templates, without live discovery.

    The parity test compares these targets with the production search seam.
    """
    objective = scope.get("objective_text", scope.get("domain_prompt", ""))
    services = scope.get("services", [])
    targets = [(decision_discovery_text(objective, plan), 5, None, services)]
    actions = [(plan["best_action"], " ".join(plan["decisive_constraints"]))]
    actions.extend((mistake["action"], mistake["scenario_reason"]) for mistake in plan["mistakes"])
    for label, (action, reason) in zip("ABCD", actions):
        if scope.get("doccheck_policy", "v5") == "v6" and label != "A":
            target = ("Engineering decision: Find positive documented behavior for this option's named Google Cloud products and action."
                      + "\nPlanned action: " + action
                      + "\nOfficial overview capabilities supported use cases how it works documentation")
        else:
            target = ("Engineering decision: Verify this option's named Google Cloud products and capabilities."
                      + "\nPlanned action: " + action + "\nTradeoff to verify: " + reason
                      + "\nOfficial overview capability limitations support lifecycle documentation")
        targets.append((target, 2, label, []))
    return [(_product_aliases(_discovery_query(text, names)), limit, label)
            for text, limit, label, names in targets]


def ranked_corpus_sources(scope, plan, corpus):
    """Rank the entire frozen corpus; build fresh per-option priority hints.

    Top 5 overview and top 2 per-option lexical hits receive the production
    discovery hints. Remaining pages stay available to the production context
    builder. Neither recorded proof receipts nor council labels affect ranking.
    """
    validate_corpus(corpus, scope["objective_id"])
    sources = deepcopy(corpus["sources"])
    ranker = BM25([SimpleNamespace(id=str(i).zfill(8), text=s["url"] + " " + s["text"])
                   for i, s in enumerate(sources)])
    order = []
    for query, limit, label in discovery_queries(scope, plan):
        for hit in ranker.rank(query)[:limit]:
            index = int(hit.id)
            if index not in order:
                order.append(index)
            source = sources[index]
            source.setdefault("discovery_options", [])
            if label:
                source["discovery_kind"] = "option"
                if label not in source["discovery_options"]:
                    source["discovery_options"].append(label)
            else:
                source.setdefault("discovery_kind", "overview")
    order.extend(i for i in range(len(sources)) if i not in order)
    return [sources[i] for i in order]


def sources_for_record(record, plan=None):
    """Read a v2 corpus, retaining explicit legacy rows for offline compatibility."""
    corpus = record.get("objective_corpus")
    if corpus is None:
        return deepcopy(record.get("sources", []))
    scope = record["scope"]
    if plan is None:
        return deepcopy(validate_corpus(corpus, scope["objective_id"])["sources"])
    return ranked_corpus_sources(scope, plan, corpus)


def hydrate_record_corpora(records, dataset_dir, manifest):
    """Resolve hash-bound sidecar references, sharing one corpus per objective.

    Returned corpora are read-only by contract. Ranking always deep-copies its
    source view. The caller must not mutate corpus snapshots. No path from a row
    is followed: the sole permitted sidecar is dataset_dir/corpora.json.
    """
    from pathlib import Path
    refs = [row.get("objective_corpus") for row in records
            if isinstance(row.get("objective_corpus"), dict) and "corpus_file" in row["objective_corpus"]]
    if not refs:
        return records
    if any(ref.get("corpus_file") != "corpora.json" for ref in refs):
        raise ValueError("Unapproved objective corpus sidecar path")
    raw = (Path(dataset_dir) / "corpora.json").read_bytes()
    expected = manifest.get("files", {}).get("corpora.json")
    if not isinstance(expected, str) or hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Objective corpus sidecar does not match manifest hash")
    corpora = json.loads(raw)
    validated = {}
    for row in records:
        ref = row.get("objective_corpus")
        if not isinstance(ref, dict) or "corpus_file" not in ref:
            continue
        ident = row["objective_id"]
        if ref.get("objective_id") != ident:
            raise ValueError("Corpus reference objective mismatch")
        if ident not in validated:
            validated[ident] = validate_corpus(corpora[ident], ident)
        corpus = validated[ident]
        if ref.get("sha256") != corpus["sha256"]:
            raise ValueError("Corpus reference hash mismatch")
        row["objective_corpus"] = corpus
    return records
