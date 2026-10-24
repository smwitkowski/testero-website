"""Offline PMLE DRAFT provenance and guarded D-025 legacy retirement.

No migrations or env files. Default requires a local export. Coordinator-only
--read-db performs reads; --apply uses locked eligibility guards in retire_question.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

from scripts.nightly_budget import instant

EXAM = "GCP_PM_ML_ENG"
CUTOFF = "2026-10-04T00:00:00+00:00"
FIELDS = "id,exam,status,created_at,generation_run_id,review_status,revision,content_sha256"


def artifact_ids(root):
    root = Path(root)
    if not root.is_dir() or any(p.is_symlink() for p in (root, *root.parents)):
        raise ValueError("A real, non-symlink artifact root is required")
    ids = set()
    for path in sorted(root.rglob("*.json")):
        if any(part.startswith(".env") for part in path.relative_to(root).parts):
            continue
        if path.is_symlink():
            raise ValueError("Artifact symlinks are not accepted")
        payload = json.loads(path.read_text())
        if not isinstance(payload, dict):
            continue
        candidates = payload.get("candidates", [])
        if not isinstance(candidates, list):
            raise ValueError("Malformed candidate artifact")
        for candidate in candidates:
            ident = candidate.get("inserted_question_id") if isinstance(candidate, dict) else None
            if isinstance(ident, str) and ident:
                ids.add(ident)
    return ids


def draft_rows(payload):
    rows = payload.get("questions") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        raise ValueError("Questions export must be a list")
    result, seen = [], set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or row["id"] in seen:
            raise ValueError("Duplicate or malformed question")
        seen.add(row["id"])
        if row.get("exam") != EXAM or row.get("status") != "DRAFT":
            continue
        instant(row.get("created_at"))
        if "generation_run_id" not in row or "review_status" not in row:
            raise ValueError("Missing provenance fields")
        result.append(row)
    return result


def report(rows, ids):
    groups = Counter(("before" if instant(row["created_at"]) < instant(CUTOFF) else "on_or_after",
                      row["generation_run_id"], row["review_status"], row["id"] in ids) for row in rows)
    return {"cutoff": CUTOFF, "total_drafts": len(rows), "groups": [
        {"created_bucket": bucket, "generation_run_id": run, "review_status": review,
         "local_artifact_exists": local, "count": count}
        for (bucket, run, review, local), count in sorted(groups.items(), key=lambda item: str(item[0]))],
        "note": "Local artifact means an inserted_question_id link under the supplied artifact root; not semantic similarity."}


def write_report(path, value):
    import os
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w") as handle:
        os.chmod(temporary, 0o600)
        json.dump(value, handle, indent=2, allow_nan=False)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def retire(client, rows, *, journal_path=None):
    selected = [row for row in rows if row.get("exam") == EXAM and row.get("status") == "DRAFT"
                and instant(row["created_at"]) < instant(CUTOFF)]
    if journal_path and Path(journal_path).exists():
        raise ValueError("Existing retirement journal requires reconciliation, not replay")
    journal = {"version": 1, "status": "prepared", "eligible_ids": [r["id"] for r in selected],
               "attempts": [], "retired": []}
    def flush():
        if journal_path:
            write_report(journal_path, journal)
    flush()
    for row in selected:
        args = {"p_question_id": row["id"], "p_reason": "D-025 legacy", "p_actor": "pipeline-v6-legacy-retire",
                "p_payload": {"expected_status": "DRAFT", "expected_exam": EXAM,
                              "expected_created_before": CUTOFF}, "p_expected_sha256": row.get("content_sha256")}
        attempt = {"question_id": row["id"], "status": "attempting"}
        journal["attempts"].append(attempt)
        journal["status"] = "in_progress"
        flush()  # Durable uncertainty marker precedes the RPC.
        try:
            outcome = client.rpc("retire_question", args).execute().data
            if (not isinstance(outcome, dict) or outcome.get("question_id") != row["id"]
                    or outcome.get("outcome") != "changed" or outcome.get("changed") is not True
                    or type(outcome.get("revision")) is not int or outcome["revision"] < 1
                    or not isinstance(outcome.get("content_sha256"), str)
                    or len(outcome["content_sha256"]) != 64):
                raise ValueError("Unknown retirement result; reconcile before retrying")
            attempt.update(status="retired", response=outcome)
            journal["retired"].append(row["id"])
            flush()
        except Exception as error:
            attempt.update(status="unknown", error_class=type(error).__name__)
            journal["status"] = "stopped_reconcile"
            flush()
            raise
    journal["status"] = "complete"
    flush()
    return journal["retired"]


def read_db(client):
    from scripts.review_batch import all_pages
    return all_pages(lambda: client.table("questions").select(FIELDS).eq("exam", EXAM).eq("status", "DRAFT").order("id"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--questions", type=Path)
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument("--artifact-ids", action="store_true", help="Print a JSON id array for the read-only SQL psql variable")
    parser.add_argument("--report", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--read-db", action="store_true")
    mode.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.apply and not args.report:
        parser.error("--apply requires --report for durable outcome recording")
    output = None
    journal_path = args.report.with_suffix(args.report.suffix + ".retire-journal.json") if args.report else None
    try:
        ids = artifact_ids(args.artifact_root)
        if args.artifact_ids:
            if args.read_db or args.apply:
                parser.error("--artifact-ids is offline only")
            print(json.dumps(sorted(ids)))
            return
        if args.apply or args.read_db:
            from scripts.retire_legacy import get_client
            client = get_client()
            rows = draft_rows(read_db(client))
        elif args.questions:
            rows = draft_rows(json.loads(args.questions.read_text()))
        else:
            parser.error("Use --questions for offline reporting or explicit --read-db/--apply")
        output = report(rows, ids)
        output["would_retire"] = [r["id"] for r in rows if instant(r["created_at"]) < instant(CUTOFF)]
        output["retired"] = []
        output["mode"] = "apply" if args.apply else "dry-run"
        if args.apply:
            output["journal"] = str(journal_path)
            output["status"] = "prepared"
            write_report(args.report, output)
            output["retired"] = retire(client, rows, journal_path=journal_path)
            output["status"] = "complete"
        text = json.dumps(output, indent=2) + "\n"
        if args.report:
            write_report(args.report, output)
        print(text, end="")
    except Exception:
        if args.apply and output is not None:
            output["status"] = "stopped_reconcile"
            if journal_path and journal_path.exists():
                output["retirement_journal"] = json.loads(journal_path.read_text())
                output["retired"] = output["retirement_journal"]["retired"]
            write_report(args.report, output)
        parser.exit(1, "Provenance/retirement failed; inspect inputs and reconcile any partial RPC outcomes before retry.\n")


if __name__ == "__main__":
    main()
