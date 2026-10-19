#!/usr/bin/env python3
"""Coordinator-only frozen six-domain A/B: offline prepare, explicit live run, offline report."""
import argparse
from collections import Counter
from itertools import combinations
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.generate_variants import generate
from scripts.ingest_external_verdicts import _read_json, _validate_candidate, _external_decision
from shared.external_judge import request_directory, candidate_question
from shared.gates import evaluate_gate, blind_choice_map
from shared.near_duplicates import similarity, comparison_row
from shared.distractor_evidence import verdict_gates

PARENTS = (
    ("pmle-d033-v5-lowcode-30-b21.json", "a23ed85e-042b-5eaf-ba0d-ccf52b149bd8"),
    ("pmle-d033-v5-collab-30-b24.json", "2552fa69-5a20-5744-90a3-2c76eba518d2"),
    ("pmle-d033-v5-scaling-12-b25.json", "9a174e39-5c98-524a-abec-952a689185d0"),
    ("pmle-d033-v5-serving-30-b26.json", "a31d11b8-8dd5-55ed-9ba4-a4b4e8400bcf"),
    ("pmle-d033-v5-pipelines-30-b20t.json", "57b9d0c7-8d93-5858-a699-4fc0afeae507"),
    ("pmle-d033-v5-monitoring-30-b27.json", "532fb45c-7f86-542a-a470-39ad0df5d199"),
)
BANK = "machine-learning-engineer-v5-b28-scaling-1018.existing.json"
# Historical denominators differ: these are reference points, not a paired experiment.
BASELINES = {"ab1_baseline_all_tokens_per_gate_pass": 4_360_000,
             "ab1_treatment_all_tokens_per_gate_pass": 3_220_000,
             "ab2_strict_all_tokens_per_gate_pass": 2_910_000 / 3,
             "ab2_consistent_all_tokens_per_gate_pass": 2_570_000 / 5,
             "b28_generation_tokens_per_accepted": 8_670_000 / 8,
             "founder_target_lower_reference": 790_000}


def rate(passed, measured):
    return {"passed": passed, "measured": measured, "rate": passed / measured if measured else None}


def report(artifact, verdicts):
    """Revalidate each all-gate PASS; never infer publication or count missing usage as zero."""
    payload = _read_json(artifact)
    calls_path = artifact.with_suffix(artifact.suffix + ".calls.jsonl")
    rows = [json.loads(line) for line in calls_path.read_text().splitlines() if line.strip()] if calls_path.exists() else []
    counts = {name: Counter() for name in ("schema", "near_duplicate", "style", "evidence", "blind_solver", "argon")}
    accuracy, argon_revise, argon_n = 0, 0, 0
    accepted, errors = [], []
    parent_scores, sibling_scores = [], []
    pairs = []
    for entry in payload["candidates"]:
        ident = entry["candidate_id"]
        for name, field in (("schema", "schema_check"), ("near_duplicate", "near_duplicate_check")):
            check = entry.get(field, {})
            if type(check.get("passed")) is bool:
                counts[name]["measured"] += 1
                counts[name]["passed"] += check["passed"]
        if "variant" not in entry:
            continue
        try:
            question = candidate_question(entry)
            parent = payload["variant_parents"][entry["parent_question_id"]]
            row, original = comparison_row(entry), comparison_row(parent["entry"])
            parent_scores.append({"candidate_id": ident, "parent_question_id": entry["parent_question_id"],
                **similarity(row["stem"], row["key"], original["stem"], original["key"])})
            raw_path = verdicts / (ident + ".json")
            if not raw_path.exists():
                continue
            scope, question, checked = _validate_candidate(artifact, payload, entry)
            raw = _read_json(raw_path)
            gates = verdict_gates(raw, entry.get("distractor_evidence"))
            for name in ("style", "evidence", "blind_solver"):
                gate = gates.get(name, {})
                if gate.get("status") == "skipped":
                    counts[name]["skipped"] += 1
                    continue
                passed, _ = evaluate_gate(name, gate, question, version=5, style_policy=entry.get("style_policy"))
                counts[name]["measured"] += 1
                counts[name]["passed"] += passed
                if name == "blind_solver":
                    accuracy += blind_choice_map(question)[gate["choice"]] == "A"
            argon = gates.get("argon", {})
            if "review" in argon:
                from shared.argon_gate import evaluate_argon
                request = _read_json(artifact.parent / entry["external_judge_request"]["path"])
                passed, _ = evaluate_argon(question, argon, request["argon"])
                counts["argon"]["measured"] += 1
                counts["argon"]["passed"] += passed
                argon_n += 1
                argon_revise += argon["review"]["verdict"] == "REVISE"
            request = _read_json(artifact.parent / entry["external_judge_request"]["path"])
            decision = _external_decision(question, scope, entry["sources"], checked["options"], raw,
                payload["model"], gate_version=2, rules_version=5, argon_request=request["argon"])
            # Recompute diversity rather than trusting saved generation booleans.
            from shared.variants import variant_duplicates
            others = payload["existing_questions"]["questions"] + [comparison_row(e)
                for e in payload["candidates"] if e.get("variant") and e is not entry and e.get("options")]
            if decision.passed and variant_duplicates(entry, others, parent)["passed"]:
                accepted.append(ident)
                if len(pairs) < 3 and not any(p["parent_question_id"] == entry["parent_question_id"] for p in pairs):
                    pairs.append({"parent_question_id": entry["parent_question_id"], "candidate_id": ident,
                                  "parent": parent["question"], "variant": question})
        except (ValueError, KeyError, TypeError, OSError) as error:
            errors.append({"candidate_id": ident, "error_class": type(error).__name__})
    valid = [e for e in payload["candidates"] if e.get("variant") and e.get("options")]
    for a, b in combinations(valid, 2):
        if a["parent_question_id"] != b["parent_question_id"]:
            continue
        x, y = comparison_row(a), comparison_row(b)
        sibling_scores.append({"a": a["candidate_id"], "b": b["candidate_id"],
            **similarity(x["stem"], x["key"], y["stem"], y["key"])})
    known = sum(r.get(k, 0) for r in rows for k in ("input_tokens", "output_tokens") if type(r.get(k)) is int)
    usage_complete = bool(rows) and all(type(r.get(k)) is int for r in rows for k in ("input_tokens", "output_tokens"))
    expected_stages = {"variant_write": len(payload.get("variant_attempts", [])),
        "judge_style": counts["style"]["measured"], "judge_evidence": counts["evidence"]["measured"],
        "judge_blind": counts["blind_solver"]["measured"], "argon_review": counts["argon"]["measured"]}
    recorded_stages = Counter(r.get("stage") for r in rows)
    stage_coverage = {k: {"expected_at_least": n, "recorded": recorded_stages[k]} for k, n in expected_stages.items()}
    complete = usage_complete and all(recorded_stages[k] >= n for k, n in expected_stages.items())
    per_pass = known / len(accepted) if complete and accepted else None
    by_stage = {}
    for r in rows:
        stage = by_stage.setdefault(r.get("stage"), {"calls": 0, "known_tokens": 0})
        stage["calls"] += 1
        stage["known_tokens"] += sum(r[k] for k in ("input_tokens", "output_tokens") if type(r.get(k)) is int)
    attempted = len(payload.get("variant_attempts", []))
    generation_rows = [r for r in rows if r.get("stage") == "variant_write"]
    generation_complete = (len(generation_rows) == attempted and attempted > 0
        and all(type(r.get(k)) is int for r in generation_rows for k in ("input_tokens", "output_tokens")))
    generation_cost = (sum(r[k] for r in generation_rows for k in ("input_tokens", "output_tokens"))
                       / len(accepted) if generation_complete and accepted else None)
    return {"attempted": attempted, "all_gate_passed": len(accepted), "accepted_variant_ids": accepted,
            "acceptance_rate": len(accepted) / attempted if attempted else None,
            "publication_count": None, "note": "Gate passes are NOT persisted or published. Historical references are not paired controls.",
            "gates": {k: {**rate(v["passed"], v["measured"]), "skipped": v["skipped"]} for k, v in counts.items()},
            "blind_solver_accuracy": rate(accuracy, counts["blind_solver"]["measured"]),
            "argon_revise": rate(argon_revise, argon_n), "errors": errors,
            "tokens": {"calls": len(rows), "known_input_output": known, "complete_usage": complete,
                       "known_tokens_per_gate_pass": known / len(accepted) if accepted else None,
                       "tokens_per_gate_pass": per_pass, "stages": by_stage, "stage_coverage": stage_coverage,
                       "coverage": {k: {"calls_with_usage": sum(type(r.get(k)) is int for r in rows), "total_calls": len(rows)}
                                    for k in ("input_tokens", "output_tokens")},
                       "accounting": "Recorded input_tokens + output_tokens only (matches historical reports). Claude cache reads/creation may be separate; not total cache-inclusive traffic. No provider-comparable saving claim without usage audit."},
            "baseline_references": BASELINES,
            "historical_saving_factors": {k: v / per_pass if per_pass else None for k, v in BASELINES.items()
                                          if k.startswith("ab")},
            "generation_only_tokens_per_gate_pass": generation_cost,
            "b28_generation_only_saving_factor": (BASELINES["b28_generation_tokens_per_accepted"] / generation_cost
                                                   if generation_cost else None),
            "parent_similarity": parent_scores, "sibling_similarity": sibling_scores,
            "human_review_pairs": pairs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run", "report"))
    parser.add_argument("--parent-dir", type=Path)
    parser.add_argument("--bank", type=Path)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--allow-live", action="store_true")
    args = parser.parse_args()
    if args.artifact.suffix != ".json":
        parser.error("--artifact must end in .json for shared writer/judge telemetry")
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    verdicts = args.artifact.with_name(args.artifact.stem + ".verdicts")
    if args.mode in ("prepare", "run"):
        if args.parent_dir is None:
            parser.error("--parent-dir is required")
        if args.mode == "run" and not args.allow_live:
            parser.error("run requires --allow-live; only the coordinator runs live models")
        artifact_paths = [args.parent_dir / name for name, _ in PARENTS]
        ids = [ident for _, ident in PARENTS]
        payload = generate(artifact_paths, ids, args.bank or args.parent_dir / BANK, args.artifact,
                           variants_per_parent=3, enable_variants=args.mode == "run")
        if args.mode == "prepare":
            print(json.dumps({k: v for k, v in payload["dry_run"].items() if k != "prompts"}, indent=2))
            return
        if any(e.get("external_judge_request") for e in payload["candidates"]):
            from scripts.judge_requests import run_requests
            result = run_requests(request_directory(args.artifact), verdicts, judge_model="claude", parallel=3,
                                  argon_gate=True, full_gate_sample=1)
            if result.failed or result.usage_stopped:
                print("Judge errors/stops: inspect receipts before any retry", file=sys.stderr)
    result = report(args.artifact, verdicts)
    output = args.artifact.with_name(args.artifact.stem + ".report.json")
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
