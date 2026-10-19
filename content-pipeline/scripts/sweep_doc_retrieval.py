#!/usr/bin/env python3
"""Offline paired recall/size frontier. Selection never receives proof receipts."""
from __future__ import annotations
import argparse
from concurrent.futures import ProcessPoolExecutor
from dataclasses import asdict
import hashlib
import itertools
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.doc_retrieval import RetrievalConfig
from scripts.replay_doc_retrieval import replay

ARTIFACTS = None


def initialize(paths):
    global ARTIFACTS
    ARTIFACTS = [(Path(path).stem, json.loads(Path(path).read_bytes())) for path in paths]
    # Sweep-only memoization of pure inputs, never proof reasons; live code and
    # selected spans are unchanged. Workers reuse frozen pages across budgets.
    import shared.doc_retrieval as retrieval
    original_chunks, original_ranker = retrieval.chunk_sources, retrieval.BM25
    chunk_cache, rank_cache, rankers = {}, {}, {}
    def cached_chunks(sources, *, size=retrieval.CHUNK_CHARS, overlap=retrieval.CHUNK_OVERLAP):
        key = (size, overlap, tuple((s["url"], s["requested_url"], s["text_sha256"], s["retrieved_at"]) for s in sources))
        if key not in chunk_cache:
            chunk_cache[key] = original_chunks(sources, size=size, overlap=overlap)
        return chunk_cache[key]
    class CachedRanker:
        def __init__(self, chunks):
            self.chunks = chunks
            self.key = tuple((chunk.id, chunk.requested_url, chunk.retrieved_at) for chunk in chunks)
        def rank(self, query):
            key = (self.key, query)
            if key not in rank_cache:
                if self.key not in rankers:
                    rankers[self.key] = original_ranker(self.chunks)
                rank_cache[key] = rankers[self.key].rank(query)
            return rank_cache[key]
    retrieval.chunk_sources, retrieval.BM25 = cached_chunks, CachedRanker


def measure(parameters):
    config = RetrievalConfig(**parameters["config"])
    results = {}
    for name, artifact in ARTIFACTS:
        report = replay(artifact, budget=parameters["budget"], config=config)
        results[name] = {key: report[key] for key in ("quote_recall", "quotes_recovered", "quote_count",
            "calls_replayed", "treatment_estimated_prompt_tokens", "baseline_estimated_prompt_tokens", "estimated_prompt_reduction")}
        results[name]["mean_prompt_tokens"] = report["treatment_estimated_prompt_tokens"] / report["calls_replayed"]
    return {**parameters, "results": results,
            "passes_both": all(row["quote_recall"] is not None and row["quote_recall"] >= .95 for row in results.values()),
            "mean_prompt_tokens": sum(row["treatment_estimated_prompt_tokens"] for row in results.values()) /
                                  sum(row["calls_replayed"] for row in results.values())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", action="append", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--configs", type=Path, help="Explicit JSON list; absent runs predeclared base grid")
    args = parser.parse_args()
    if len(args.artifact) != 2:
        parser.error("Need two artifact sets")
    configs = json.loads(args.configs.read_text()) if args.configs else [
        {"config": asdict(RetrievalConfig(chunk_chars=size, overlap=overlap, top_k=k)), "budget": budget}
        for size, overlap, k, budget in itertools.product([800, 1200, 2200], [300, 500], [0, 4, 12], [60000, 100000, 140000, 180000])]
    source_paths = [Path(__file__).resolve().parents[1] / path for path in
                    ("scripts/replay_doc_retrieval.py", "shared/doc_retrieval.py", "shared/decision_planner.py", "shared/cli_models.py", "shared/doc_claims.py")]
    provenance = {"sweep_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  "implementation_sha256": hashlib.sha256(b"".join(path.read_bytes() for path in source_paths)).hexdigest(),
                  "artifacts": {str(path.resolve()): hashlib.sha256(path.read_bytes()).hexdigest() for path in args.artifact},
                  "stable_prefix": True}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    existing = [json.loads(line) for line in args.output.read_text().splitlines() if line.strip()] if args.output.exists() else []
    if any(row.get("provenance") != provenance for row in existing):
        parser.error("Existing sweep has different/missing source or artifact provenance; choose a new output")
    completed = {(json.dumps(row["config"], sort_keys=True), row["budget"]) for row in existing}
    configs = [row for row in configs if (json.dumps(row["config"], sort_keys=True), row["budget"]) not in completed]
    with ProcessPoolExecutor(max_workers=args.workers, initializer=initialize, initargs=([str(p) for p in args.artifact],)) as pool:
        with args.output.open("a") as stream:
            for result in pool.map(measure, configs, chunksize=1):
                result["provenance"] = provenance
                stream.write(json.dumps(result) + "\n")
                stream.flush()
                print(json.dumps({"config": result["config"], "budget": result["budget"],
                                  "passes": result["passes_both"], "mean": result["mean_prompt_tokens"],
                                  "recall": [r["quote_recall"] for r in result["results"].values()]}), flush=True)


if __name__ == "__main__":
    main()
