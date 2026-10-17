"""Summarize known token counts without treating missing usage as zero."""
import argparse
import json
from collections import defaultdict
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.call_logging import TOKEN_FIELDS


def summarize(rows, denominator):
    groups = defaultdict(list)
    for row in rows:
        groups[("stage", row.get("stage"))].append(row)
        groups[("candidate", row.get("index") if row.get("index") is not None else row.get("candidate_id"))].append(row)
    def totals(values):
        return {key: {"known_tokens": sum(row[key] for row in values if type(row.get(key)) is int),
                      "calls_with_usage": sum(type(row.get(key)) is int for row in values),
                      "total_calls": len(values)} for key in TOKEN_FIELDS}
    total = totals(rows)
    return {"calls": len(rows), "failed_calls": sum(row.get("ok") is False for row in rows),
            "seconds": sum(row.get("seconds", 0) for row in rows), "tokens": total,
            "groups": [{"kind": kind, "value": value, "tokens": totals(values)}
                       for (kind, value), values in groups.items()],
            "published_denominator": denominator,
            "known_tokens_per_published": {
                key: value["known_tokens"] / denominator if denominator else None
                for key, value in total.items()},
            "note": "Known token subtotal only; missing usage is not zero. Accepted is not published."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--calls", type=Path, required=True)
    parser.add_argument("--published", type=int, help="Explicit verified published count, not accepted count")
    parser.add_argument("--artifact", type=Path, help="Report artifact populations separately; never infer publication")
    args = parser.parse_args()
    if args.published is not None and args.published < 0:
        parser.error("--published must be nonnegative")
    rows = [json.loads(line) for line in args.calls.read_text().splitlines() if line.strip()]
    artifact = json.loads(args.artifact.read_text()) if args.artifact else None
    if artifact is not None:
        indices = {candidate.get("candidate_id"): candidate.get("index")
                   for candidate in artifact.get("candidates", []) if candidate.get("candidate_id")}
        rows = [{**row, "index": indices.get(row.get("candidate_id"), row.get("index"))}
                for row in rows]
    result = summarize(rows, args.published)
    if artifact is not None:
        result["artifact"] = {"path": str(args.artifact),
                              "note": "Artifact acceptance/persistence is not proof of publication.",
                              "candidates": len(artifact.get("candidates", [])),
                              "accepted": sum(row.get("accepted") is True for row in artifact.get("candidates", [])),
                              "persisted": sum((row.get("persisted") is True or row.get("persistence_status") == "complete") for row in artifact.get("candidates", [])),
                              "awaiting_external_judge": sum(row.get("awaiting_external_judge") is True for row in artifact.get("candidates", [])),
                              "status_counts": {}}
        candidates = artifact.get("candidates", [])
        for candidate in candidates:
            status = str(candidate.get("status", "unknown"))
            counts = result["artifact"]["status_counts"]
            counts[status] = counts.get(status, 0) + 1
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
