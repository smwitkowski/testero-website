#!/usr/bin/env python3
"""Offline prompt reconstruction and exact receipt recall; never calls a model."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.cli_models import signature_prompt
from shared.decision_planner import verification_prompt
from shared.doc_retrieval import DEFAULT_CONTEXT_CHARS, DEFAULT_CONFIG, RetrievalConfig, RetrievalSession, quote_in_chunks


def replay(artifact, *, budget=DEFAULT_CONTEXT_CHARS, stable_prefix=True, config=DEFAULT_CONFIG):
    session = RetrievalSession(config)
    rows, recovered, quotes = [], 0, 0
    for candidate in artifact["candidates"]:
        index = candidate["index"]
        if type(index) is not int or not 1 <= index <= len(artifact["plan"]):
            raise ValueError("Recorded candidate has no frozen objective scope index")
        scope = artifact["plan"][index - 1]
        if scope["objective_id"] != candidate["objective_id"]:
            raise ValueError("Recorded candidate objective does not match frozen scope; rotation cannot be replayed")
        scope = {**scope, "distractor_evidence": candidate.get("distractor_evidence", artifact.get("distractor_evidence"))}
        for attempt in candidate.get("decision_attempts", []):
            if not attempt.get("sources") or "proof" not in attempt:
                continue
            sources, plan = attempt["sources"], attempt["plan"]
            baseline = signature_prompt(*verification_prompt(scope, plan, sources))
            retrieved = session.prepare(scope, plan, sources, budget=budget)
            treatment = signature_prompt(*verification_prompt(scope, plan, retrieved["sources"], retrieval=retrieved, stable_prefix=stable_prefix))
            receipts = attempt["proof"].get("reasons", [])
            hits = sum(quote_in_chunks(receipt, retrieved["chunks"]) for receipt in receipts)
            recovered += hits
            quotes += len(receipts)
            rows.append({"index": candidate["index"], "attempt": attempt["attempt"],
                         "baseline_prompt_chars": len(baseline), "treatment_prompt_chars": len(treatment),
                         "doc_chars": len(retrieved["context"]), "quotes": len(receipts), "recovered": hits,
                         "missing": [{"option_label": receipt["option_label"], "url": receipt["url"], "quote": receipt["quote"]}
                                     for receipt in receipts if not quote_in_chunks(receipt, retrieved["chunks"])],
                         "retrieval": retrieved["metadata"]})
    before = sum(row["baseline_prompt_chars"] for row in rows)
    after = sum(row["treatment_prompt_chars"] for row in rows)
    source_paths = [Path(__file__).resolve(), Path(__file__).resolve().parents[1] / "shared/doc_retrieval.py",
                    Path(__file__).resolve().parents[1] / "shared/decision_planner.py",
                    Path(__file__).resolve().parents[1] / "shared/cli_models.py"]
    source_hash = hashlib.sha256(b"".join(path.read_bytes() for path in source_paths)).hexdigest()
    return {"implementation_sha256": source_hash, "config": config.__dict__, "stable_prefix": stable_prefix,
            "method": "Exact live signature_prompt; character/4 token estimates, NOT provider-measured tokens. No verifier rejudging.",
            "calls_replayed": len(rows), "baseline_estimated_prompt_tokens": math.ceil(before / 4),
            "treatment_estimated_prompt_tokens": math.ceil(after / 4),
            "estimated_prompt_reduction": 1 - after / before if before else None,
            "receipt_population": "All recorded proposed proof reasons, including any mechanically invalid ones; vetoes with empty reasons provide no receipt recall denominator.",
            "quote_count": quotes, "quotes_recovered": recovered, "quote_recall": recovered / quotes if quotes else None,
            "recall_gate_passed": quotes > 0 and recovered / quotes >= .95, "budget_chars": budget,
            "rows": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--budget-chars", type=int, default=DEFAULT_CONTEXT_CHARS)
    parser.add_argument("--config", type=Path, help="JSON RetrievalConfig overrides; absent uses live default")
    args = parser.parse_args()
    raw = args.artifact.read_bytes()
    config = RetrievalConfig(**json.loads(args.config.read_text())) if args.config else DEFAULT_CONFIG
    report = replay(json.loads(raw), budget=args.budget_chars, config=config)
    report["artifact_sha256"] = hashlib.sha256(raw).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "rows"}, indent=2))


if __name__ == "__main__":
    main()
