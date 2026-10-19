#!/usr/bin/env python3
"""Coordinator-only paired A/B. Prints commands by default; --execute makes live calls.

No environment files or DB writes. Both arms run identical distractor policy,
objectives, candidate count and model settings on this exact checkout.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from shared.doc_retrieval import DEFAULT_CONTEXT_CHARS, DEFAULT_CONFIG
from scripts.replay_claim_support import implementation_sha256

DEFAULT_OBJECTIVES = ["machine-learning-engineer:standard:3.1:1", "machine-learning-engineer:standard:3.1:3"]


EXPECTED_ARTIFACTS = {
    "baseline": "6c39536af7ff7cf1bc7ae201c114e691921cb7e8b7e53db957d3fff32bf76138",
    "treatment": "f8c48c83573d0ee255fafd8c4b1af44ce26a192ace71a19903021172b0c54e1a",
}


def claim_gate_passed(report, current_hash):
    """Check report freshness against current code, settings and frozen inputs."""
    if not isinstance(report, dict):
        return False
    def sufficient(value):
        return type(value) in (int, float) and .95 <= value <= 1
    try:
        if not (report.get("complete_attempt_coverage") is True
                and report.get("complete_field_coverage") is True
                and report.get("gate_passed") is True
                and sufficient(report.get("claim_support_recall"))
                and set(report.get("by_arm", {})) == set(EXPECTED_ARTIFACTS)
                and all(sufficient(report["by_arm"][arm].get("recall")) for arm in EXPECTED_ARTIFACTS)
                and report.get("implementation_sha256") == current_hash
                and report.get("config") == DEFAULT_CONFIG.__dict__
                and report.get("budget_chars") == DEFAULT_CONTEXT_CHARS
                and report.get("artifacts") == EXPECTED_ARTIFACTS):
            return False
        for arm, digest in EXPECTED_ARTIFACTS.items():
            path = ROOT / ".cache/generation/retrieval-1019-b" / f"{arm}.json"
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                return False
        ledgers = report.get("ledgers")
        return isinstance(ledgers, dict) and bool(ledgers) and all(
            hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest
            for path, digest in ledgers.items())
    except (OSError, TypeError, ValueError, AttributeError):
        return False


def commands(args, arm, artifact):
    generate = ["uv", "run", "python", "scripts/generate_all_domains.py", "--cert", args.cert,
                "--n-questions", str(args.n), "--seed", str(args.seed), "--model", args.model,
                "--judge-model", "external", "--argon-gate", "--dry-run", "--parallel", "1",
                "--gen-effort", "high", "--cite-effort", "medium", "--distractor-evidence", "consistent",
                "--existing-questions", str(args.bank), "--artifact", str(artifact),
                "--decision-attempts", str(args.treatment_attempts if arm == "treatment" else 3)]
    for objective in args.objective or DEFAULT_OBJECTIVES:
        generate += ["--objective", objective]
    if arm == "treatment":
        generate += ["--doc-cache", "--verify-retrieval", "--verify-stable-prefix"]
    requests = artifact.with_suffix(".judge-requests")
    verdicts = artifact.with_suffix(".verdicts")
    return [generate,
            ["uv", "run", "python", "scripts/judge_requests.py", "--requests", str(requests),
             "--verdicts", str(verdicts), "--judge-model", "claude", "--parallel", "3", "--argon-gate", "--full-gate-sample", "1"],
            ["uv", "run", "python", "scripts/ingest_external_verdicts.py", "--artifact", str(artifact),
             "--verdicts", str(verdicts), "--dry-run"],
            ["uv", "run", "python", "scripts/token_report.py", "--calls", str(artifact) + ".calls.jsonl",
             "--artifact", str(artifact), "--published", "0"]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank", required=True, type=Path, help="Frozen ACTIVE/DRAFT export; never loaded from a DB")
    parser.add_argument("--tag", required=True, help="New artifact cohort tag, e.g. retrieval-1019-a")
    parser.add_argument("--cert", default="machine-learning-engineer")
    parser.add_argument("--objective", action="append", help="Repeat identical objective IDs for each arm")
    parser.add_argument("--n", type=int, default=12)
    parser.add_argument("--seed", type=int, default=1710)
    parser.add_argument("--model", default="codex")
    parser.add_argument("--treatment-attempts", type=int, choices=[1, 2, 3], default=3)
    parser.add_argument("--order", choices=["baseline-first", "treatment-first"], default="baseline-first")
    parser.add_argument("--execute", action="store_true", help="LIVE coordinator action; absent means print commands only")
    parser.add_argument("--claim-report", type=Path, help="Current complete offline claim-support report")
    parser.add_argument("--replay-report", type=Path, action="append", help="Informational legacy receipt replay; never authorizes execution")
    parser.add_argument("--allow-failed-recall", action="store_true", help="Explicit exploratory-only override; no rollout approval")
    args = parser.parse_args()
    args.bank = args.bank.resolve()
    if not args.bank.is_file() or args.n < 1 or not args.tag or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for c in args.tag):
        parser.error("Need an existing bank, positive N and simple alphanumeric/hyphen tag")
    cohort = ROOT / ".cache/generation" / args.tag
    if cohort.exists():
        parser.error("Cohort already exists; use a fresh tag (never overwrite journals)")
    replay_paths = args.replay_report or []
    current_hash = implementation_sha256()
    claim_report = None
    claim_hash = None
    if args.claim_report:
        try:
            raw = args.claim_report.read_bytes()
            claim_hash = hashlib.sha256(raw).hexdigest()
            claim_report = json.loads(raw)
        except (OSError, ValueError):
            pass
    recall_ok = claim_gate_passed(claim_report, current_hash)
    if args.execute and not recall_ok and not args.allow_failed_recall:
        parser.error("Claim-support gate missing/failed/stale: need a current complete claim report or exploratory override")
    arms = ["baseline", "treatment"] if args.order == "baseline-first" else ["treatment", "baseline"]
    planned = {arm: commands(args, arm, cohort / (arm + ".json")) for arm in arms}
    for arm, stages in planned.items():
        print(arm.upper())
        for command in stages: print(shlex.join(command))
    if not args.execute:
        print("DRY PLAN ONLY: no model, retrieval, credentials or DB accessed.")
        return
    cohort.mkdir(parents=True)
    env = {**os.environ, "PYTHON_DOTENV_DISABLED": "1"}
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    manifest = {"version": 1, "commit": commit, "started_at": datetime.now(timezone.utc).isoformat(),
                "bank_sha256": hashlib.sha256(args.bank.read_bytes()).hexdigest(),
                "cache_state": "warm" if (ROOT / ".cache/documentation").exists() else "cold",
                "recall_gate_passed": recall_ok, "implementation_sha256": current_hash,
                "exploratory_override": args.allow_failed_recall,
                "retrieval_config": DEFAULT_CONFIG.__dict__, "budget_chars": DEFAULT_CONTEXT_CHARS,
                "claim_report": {"path": str(args.claim_report.resolve()), "sha256": claim_hash,
                                 "provenance": claim_report} if args.claim_report else None,
                "replays": [{"path": str(path.resolve()), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                            for path in replay_paths],
                "commands": planned, "arms": {}}
    manifest_path = cohort / "run.json"
    for arm, stages in planned.items():
        results = []
        for index, command in enumerate(stages):
            started = time.monotonic()
            with (cohort / f"{arm}-{index}.log").open("w") as log:
                result = subprocess.run(command, cwd=ROOT, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT)
            results.append({"stage": index, "exit_code": result.returncode, "seconds": time.monotonic() - started})
            manifest["arms"][arm] = results
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            # A generator's nonzero batch yield still leaves judgeable candidates.
            if index == 0 and not (cohort / f"{arm}.json").exists():
                raise SystemExit("Generator produced no artifact; inspect stage log")
    print("Results and exit codes:", manifest_path)
    if any(stage["exit_code"] != 0 for stages in manifest["arms"].values() for stage in stages[1:]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
