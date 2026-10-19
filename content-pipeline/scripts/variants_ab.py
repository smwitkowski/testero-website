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
from scripts.ingest_external_verdicts import (_read_json, _validate_candidate, _external_decision,
    _scope, artifact_lock, _flush)
from shared.variants import FAMILY_STEM_THRESHOLD, family_threshold, validate_variant, variant_duplicates, option_rewrite_check
from shared.validator import validate_question
from shared.option_order import canonical_evidence
from shared.evidence import check_evidence
from shared.external_judge import candidate_storage_id, validate_candidate_records
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
    if any(scope.get("variant_policy_version") == 5 for scope in payload["plan"]):
        validate_candidate_records(payload)
    calls_path = artifact.with_suffix(artifact.suffix + ".calls.jsonl")
    rows = [json.loads(line) for line in calls_path.read_text().splitlines() if line.strip()] if calls_path.exists() else []
    counts = {name: Counter() for name in ("schema", "near_duplicate", "style", "evidence", "blind_solver", "argon")}
    accuracy, argon_revise, argon_n = 0, 0, 0
    accepted, accepted_entries, errors = [], [], []
    parent_scores, sibling_scores, family_scores = [], [], []
    pairs = []
    # Read actual bound quality decisions before any family-stem comparison.
    # Missing verdicts remain eligible; rejected copies cannot consume slots.
    from shared.variant_eligibility import reviewed_siblings
    from shared.variants import eligible_sibling
    siblings = [entry for entry in reviewed_siblings(artifact, payload, verdicts)
                if entry.get("variant") and entry.get("options") and eligible_sibling(entry)]
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
            duplicate = variant_duplicates(entry, payload["existing_questions"]["questions"], parent,
                                            siblings=siblings, prior=payload.get("prior_variants", {}).get("questions", []))
            family_scores.append({"candidate_id": ident,
                "max_family_stem_similarity": duplicate["max_family_stem_similarity"],
                "family_stem_threshold": duplicate["family_stem_threshold"]})
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
                passed, _ = evaluate_gate(name, gate, question, version=5,
                                          style_policy=entry.get("style_policy"), variant=True,
                                          variant_policy_version=scope.get("variant_policy_version"))
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
            others = payload["existing_questions"]["questions"] + [comparison_row(e)
                for e in siblings if e["candidate_id"] != ident and eligible_sibling(e)]
            diversity_passed = variant_duplicates(entry, others, parent, siblings=siblings,
                prior=payload.get("prior_variants", {}).get("questions", []))["passed"]
            if decision.passed and not diversity_passed:
                # A rejected candidate must not veto a later eligible sibling.
                for sibling in siblings:
                    if sibling["candidate_id"] == ident:
                        sibling.update(failure_stage="near_duplicate", awaiting_external_judge=False,
                                       accepted=False)
            if decision.passed and diversity_passed:
                accepted.append(ident)
                accepted_entries.append(entry)
                if len(pairs) < 3 and not any(p["parent_question_id"] == entry["parent_question_id"] for p in pairs):
                    pairs.append({"parent_question_id": entry["parent_question_id"], "candidate_id": ident,
                                  "parent": parent["question"], "variant": question})
        except (ValueError, KeyError, TypeError, OSError) as error:
            errors.append({"candidate_id": ident, "error_class": type(error).__name__})
    from shared.variant_plan import key_length_batch_report
    pre_batch_accepted = list(accepted)
    batch_length = key_length_batch_report(payload, accepted_entries)
    if batch_length["enforced"] and not batch_length["passed"]:
        accepted, pairs = [], []
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
        "variant_length_repair": sum(max(a.get("calls_started", 1) - 1, 0) for a in payload.get("variant_attempts", [])),
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
    generation_rows = [r for r in rows if r.get("stage") in ("variant_write", "variant_length_repair")]
    generation_complete = (len(generation_rows) == attempted + expected_stages["variant_length_repair"] and attempted > 0
        and all(type(r.get(k)) is int for r in generation_rows for k in ("input_tokens", "output_tokens")))
    generation_cost = (sum(r[k] for r in generation_rows for k in ("input_tokens", "output_tokens"))
                       / len(accepted) if generation_complete and accepted else None)
    return {"attempted": attempted, "all_gate_passed": len(accepted), "accepted_variant_ids": accepted,
            "pre_batch_accepted_variant_ids": pre_batch_accepted,
            "variant_key_length_batch_report": batch_length,
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
            "family_similarity": family_scores,
            "option_rewrite": [{"candidate_id": e["candidate_id"], **option_rewrite_check(
                candidate_question(e), payload["variant_parents"][e["parent_question_id"]],
                **({"key_length_rank": payload["plan"][e["index"]-1]["key_length_rank"]}
                   if payload["plan"][e["index"]-1].get("variant_policy_version") == 5 else {}))} for e in valid],
            "key_positions": dict(Counter(e["key"] for e in valid if e["candidate_id"] in accepted)),
            "industry_counts": dict(Counter(s["industry"] for s in payload["plan"])),
            "human_review_pairs": pairs}


def prepare_rejudge(artifact, *, threshold=FAMILY_STEM_THRESHOLD):
    """Rebuild existing questions' requests offline; archive prior verdicts, never regenerate."""
    from scripts.export_judge_requests import export_requests
    threshold = family_threshold(threshold)
    artifact = Path(artifact).absolute()
    with artifact_lock(artifact):
        payload = _read_json(artifact)
        if (payload.get("variant_mode") != 1 or payload.get("generation_runs")
                or payload.get("external_run_journal")
                or any(e.get("persistence_status") is not None or e.get("inserted_question_id") is not None
                       for e in payload["candidates"])):
            raise ValueError("Rejudge requires an unpersisted variant artifact")
        validate_candidate_records(payload)
        # Verify the OLD policy/lineage before explicitly changing only its threshold.
        for entry in payload["candidates"]:
            _scope(payload, entry)
            if "variant" in entry:
                validate_variant(payload, entry)
                if entry.get("external_judge_request"):
                    _validate_candidate(artifact, payload, entry)
            elif entry.get("options"):
                raise ValueError("Written variant is missing frozen lineage")
        payload["family_stem_threshold"] = threshold
        for entry in payload["candidates"]:
            if "variant" not in entry:
                continue
            meta = entry["variant"]
            meta.pop("parent_stem_threshold", None)
            meta["family_stem_threshold"] = threshold
            validate_variant(payload, entry)
            scope = _scope(payload, entry)
            question = candidate_question(entry)
            candidate_storage_id(entry, scope, question)
            validation = validate_question(question, industry_only=True)
            checked = check_evidence(canonical_evidence(entry), entry["sources"])
            if not checked["passed"] or checked["options"] != canonical_evidence(entry):
                raise ValueError("Frozen evidence changed")
            entry["schema_check"] = {"passed": validation.is_valid, "errors": validation.errors,
                                     "warnings": validation.warnings}
            parent = payload["variant_parents"][entry["parent_question_id"]]
            bank_and_others = payload["existing_questions"]["questions"] + [comparison_row(e)
                for e in payload["candidates"] if e.get("options") and e is not entry]
            duplicate = variant_duplicates(entry, bank_and_others, parent, siblings=payload["candidates"], prior=payload.get("prior_variants", {}).get("questions", []))
            entry["near_duplicate_check"] = duplicate
            # Old verdicts remain archived by export, never used as new-policy passes.
            entry["accepted"] = False
            entry["awaiting_external_judge"] = validation.is_valid and duplicate["passed"]
            if entry["awaiting_external_judge"]:
                entry.update(status="awaiting_external_judge", mechanical_check={"passed": True, "errors": []})
                for field in ("failure_stage", "reason", "error_class", "error_message", "external_verdict"):
                    entry.pop(field, None)
            else:
                entry.update(status="generation_failed", failure_stage="schema" if not validation.is_valid else "near_duplicate")
        _flush(artifact, payload)
    # Existing exporter owns safe atomic requests, locks, digests and verdict archives.
    export_requests(artifact, force=True)
    payload = _read_json(artifact)
    return [e["candidate_id"] for e in payload["candidates"] if e.get("awaiting_external_judge")]


def review_pairs(artifact, output, count=3):
    """Write complete review pairs; repair mode may show every slot alternative."""
    if type(count) is not int or count < 1:
        raise ValueError("Review pair count must be positive")
    payload = _read_json(artifact)
    chosen, families = [], set()
    for entry in payload["candidates"]:
        family_key = entry["candidate_id"] if payload.get("repair_mode") else entry.get("parent_question_id")
        if not entry.get("variant") or not entry.get("options") or family_key in families:
            continue
        families.add(family_key)
        chosen.append(entry)
        if len(chosen) == count:
            break
    lines = ["# Parent / variant review", "", "Keys are shown for founder review; these are not publication approvals.", ""]
    for index, entry in enumerate(chosen, 1):
        parent = payload["variant_parents"][entry["parent_question_id"]]
        duplicate = variant_duplicates(entry, payload["existing_questions"]["questions"], parent,
                                       siblings=payload["candidates"], prior=payload.get("prior_variants", {}).get("questions", []))
        lines += [f"## Pair {index}", "", f"Max family stem Jaccard: {duplicate['max_family_stem_similarity']:.4f}", ""]
        for heading, question in (("Parent", parent["entry"]), ("Variant", entry)):
            lines += [f"### {heading} `{question['candidate_id']}`", "", question["stem"], ""]
            lines += [f"- **{o['label']}**: {o['text']}" for o in question["options"]]
            lines += ["", f"**Key: {question['key']}**", ""]
    Path(output).write_text("\n".join(lines) + "\n")
    return len(chosen)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run", "prepare-repair", "repair", "report", "rejudge", "pairs"))
    parser.add_argument("--parent-dir", type=Path)
    parser.add_argument("--bank", type=Path)
    parser.add_argument("--artifact", type=Path, required=True)
    parser.add_argument("--allow-live", action="store_true")
    parser.add_argument("--prior-artifact", type=Path, action="append", default=[],
                        help="Prior variant artifact; repeat for each earlier run (frozen offline acceptance).")
    parser.add_argument("--live-prior-manifest", type=Path,
                        help="Founder-approved 13-live publication receipt; mandatory for repair modes.")
    parser.add_argument("--family-stem-threshold", type=float, default=FAMILY_STEM_THRESHOLD)
    parser.add_argument("--review-pairs", type=int, default=3)
    parser.add_argument("--pairs-output", type=Path, help="Markdown review output (default beside artifact).")
    args = parser.parse_args()
    if args.artifact.suffix != ".json":
        parser.error("--artifact must end in .json for shared writer/judge telemetry")
    generation_modes = ("prepare", "run", "prepare-repair", "repair")
    repair_mode = args.mode in ("prepare-repair", "repair")
    if (args.prior_artifact or args.live_prior_manifest) and args.mode not in generation_modes:
        parser.error("Prior inputs are generation-only; replay uses the artifact's frozen history")
    if repair_mode and args.live_prior_manifest is None:
        parser.error("Repair mode requires --live-prior-manifest for the 13 live family variants")
    if args.live_prior_manifest and not repair_mode:
        parser.error("--live-prior-manifest is repair-mode only")
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    family_threshold(args.family_stem_threshold)
    pairs_output = args.pairs_output or args.artifact.with_name(args.artifact.stem + ".pairs.md")
    if args.mode == "pairs":
        review_pairs(args.artifact, pairs_output, args.review_pairs)
        print(pairs_output)
        return
    verdicts = args.artifact.with_name(args.artifact.stem + ".verdicts")
    if args.mode in generation_modes:
        from shared.variant_plan import REPAIR_MODE, REPAIR_SLOTS
        if args.parent_dir is None:
            parser.error("--parent-dir is required")
        live = args.mode in ("run", "repair")
        if live and not args.allow_live:
            parser.error("Live modes require --allow-live; only the coordinator runs live models")
        repair_ids = {slot["parent_question_id"] for slot in REPAIR_SLOTS}
        selected_parents = [row for row in PARENTS if not repair_mode or row[1] in repair_ids]
        artifact_paths = [args.parent_dir / name for name, _ in selected_parents]
        ids = [ident for _, ident in selected_parents]
        payload = generate(artifact_paths, ids, args.bank or args.parent_dir / BANK, args.artifact,
                           variants_per_parent=2 if repair_mode else 3, enable_variants=live,
                           family_stem_threshold=args.family_stem_threshold, prior_artifacts=args.prior_artifact,
                           variant_policy_version=5, repair_mode=REPAIR_MODE if repair_mode else None,
                           live_prior_manifest=args.live_prior_manifest)
        if not live:
            print(json.dumps({k: v for k, v in payload["dry_run"].items() if k != "prompts"}, indent=2))
            return
        if any(e.get("external_judge_request") for e in payload["candidates"]):
            from scripts.judge_requests import run_requests
            result = run_requests(request_directory(args.artifact), verdicts, judge_model="claude", parallel=3,
                                  argon_gate=True, full_gate_sample=1)
            if result.failed or result.usage_stopped:
                print("Judge errors/stops: inspect receipts before any retry", file=sys.stderr)
    if args.mode == "rejudge":
        if not args.allow_live:
            parser.error("rejudge requires --allow-live; existing questions are never regenerated")
        eligible = prepare_rejudge(args.artifact, threshold=args.family_stem_threshold)
        if eligible:
            from scripts.judge_requests import run_requests
            result = run_requests(request_directory(args.artifact), verdicts, judge_model="claude", parallel=3,
                                  argon_gate=True, full_gate_sample=1, candidate_ids=eligible)
            if result.failed or result.usage_stopped:
                print("Judge errors/stops: inspect receipts before retrying", file=sys.stderr)
    result = report(args.artifact, verdicts)
    if result["accepted_variant_ids"]:
        from shared.option_order import balance_options
        with artifact_lock(args.artifact):
            payload = _read_json(args.artifact)
            accepted = set(result["accepted_variant_ids"])
            balance_options([e for e in payload["candidates"] if e["candidate_id"] in accepted])
            _flush(args.artifact, payload)
        result = report(args.artifact, verdicts)
    review_pairs(args.artifact, pairs_output, args.review_pairs)
    output = args.artifact.with_name(args.artifact.stem + ".report.json")
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
