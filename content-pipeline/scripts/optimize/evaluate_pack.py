"""Paired held-out production evaluation. Live calls require explicit approval.

The current production runner has FIVE downstream seats, not six: Claude
blind/style/evidence and Argon blind/review. Doccheck is a sixth *upstream*
check, not an extra council seat. No judge signature is invented or tuned.
"""
from __future__ import annotations

import argparse
from contextlib import nullcontext
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
from unittest.mock import patch

SEATS = ("claude.blind_solver", "claude.style", "claude.evidence", "argon.blind", "argon.review")
WRITER_STAGES = frozenset(("plan", "verify", "write", "cite", "taxonomy"))
PROMOTION_RULE = ("Promote only if held-out all-council pass rate improves, no seat drops by more than "
                  "5 percentage points, canary catch remains 100%, and all calls/usage are complete.")
CANARY_DEFECTS = ("swapped_key", "retired_name")
COUNCIL_NOTE = ("Production has five downstream council calls (Claude blind/style/evidence and Argon blind/review). "
                "Doccheck is the sixth overall check, upstream of council. The task's six downstream seats "
                "do not match the production implementation; no sixth judge was invented.")


def _read(path):
    return json.loads(Path(path).read_text(), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def _write(path, value):
    Path(path).write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def writer_token_usage(calls):
    """Count explicit provider input+output, including failed writer attempts.

    Proof runs on the writer transport and belongs in its quota denominator.
    Missing provider counts remain unknown; budget estimates are never tokens.
    """
    rows = [row for row in calls if row.get("stage") in WRITER_STAGES]
    missing = sum(any(type(row.get(key)) is not int or row[key] < 0
                      for key in ("input_tokens", "output_tokens")) for row in rows)
    known = sum(row[key] for row in rows for key in ("input_tokens", "output_tokens")
                if type(row.get(key)) is int and row[key] >= 0)
    # Codex/OpenRouter input totals include cached input. Claude input excludes
    # its separately reported cache read/create counts.
    for row in rows:
        if row.get("provider") == "claude":
            for key in ("cached_input_tokens", "cache_creation_input_tokens"):
                if type(row.get(key)) is not int or row[key] < 0:
                    missing += 1
                else:
                    known += row[key]
    complete = bool(rows) and missing == 0
    return {"writer_tokens": known if complete else None, "known_writer_tokens": known,
            "writer_calls": len(rows), "missing_usage_fields_or_calls": missing,
            "complete": complete, "definition": "provider input + output tokens for plan/proof/draft/citation/taxonomy; cached input counted once"}


def summarize_arm(result):
    candidates = result["candidates"]
    if not candidates:
        raise ValueError("Held-out evaluation requires candidates")
    attempts = [passed for row in candidates for passed in row.get("proof_attempts", [])]
    if any(type(value) is not bool for value in attempts):
        raise ValueError("Proof attempts require boolean outcomes")
    judged = [row for row in candidates if row.get("council_attempted") is True]
    for row in judged:
        if set(row.get("seats", {})) != set(SEATS) or any(type(value) is not bool for value in row["seats"].values()):
            raise ValueError("Full council requires every production seat, without skips")
    accepted = sum(row.get("doccheck_passed") is True and row.get("eligible") is True
                   and row.get("council_attempted") is True and all(row["seats"].values()) for row in candidates)
    council_passed = sum(all(row["seats"].values()) for row in judged)
    usage = result["writer_usage"]
    tokens = usage.get("writer_tokens")
    if tokens is not None and (type(tokens) is not int or tokens < 0):
        raise ValueError("Writer token counts must be nonnegative integers or unknown")
    return {"candidate_count": len(candidates), "doccheck_attempts": len(attempts),
            "doccheck_pass_rate": sum(attempts) / len(attempts) if attempts else None,
            "doccheck_candidate_pass_rate": sum(row.get("doccheck_passed") is True for row in candidates) / len(candidates),
            "council_count": len(judged), "council_pass_rate": council_passed / len(judged) if judged else None,
            "seat_pass_rates": {name: sum(row["seats"][name] for row in judged) / len(judged) if judged else None for name in SEATS},
            "accepted": accepted, "accepted_per_million_writer_tokens": accepted * 1_000_000 / tokens if tokens and usage.get("complete") is True else None,
            "writer_usage": usage, "complete": result.get("complete") is True and usage.get("complete") is True}


def promotion_decision(baseline, packed, canary=None):
    reasons = []
    if not baseline["complete"] or not packed["complete"]:
        reasons.append("Incomplete production execution or writer-token telemetry")
    before, after = baseline["council_pass_rate"], packed["council_pass_rate"]
    if before is None or after is None or after <= before:
        reasons.append("Held-out all-council pass rate did not improve")
    for name in SEATS:
        old, new = baseline["seat_pass_rates"][name], packed["seat_pass_rates"][name]
        if old is None or new is None or new < old - .05 - 1e-12:
            reasons.append("Missing evidence or >5pp regression: " + name)
    # A bare numeric 1 is insufficient: bind canary outcomes to actual cohort
    # counts from the existing council_health evaluate flow.
    if (not isinstance(canary, dict) or canary.get("kind") != "canaries"
            or canary.get("complete") is not True or canary.get("errors")
            or not isinstance(canary.get("canaries"), dict) or not set(CANARY_DEFECTS) <= set(canary["canaries"])
            or type(canary.get("observed")) is not int or canary["observed"] < 40
            or any(type(row.get("count")) is not int or row["count"] <= 0 or row.get("catch_rate") != 1
                   or row.get("full") is not True for row in canary["canaries"].values())):
        reasons.append("Canary catch is not proven 100% for a complete current cohort")
    return {"promote": not reasons, "rule": PROMOTION_RULE, "reasons": reasons}


def canary_commands(artifact, output_dir):
    """Exact isolated commands; do not reuse production pause/state files."""
    import shlex
    q = lambda value: shlex.quote(str(Path(value).absolute()))
    cohort = Path(output_dir).absolute() / "canaries"
    return [
        f"PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.council_health prepare --artifact {q(artifact)} --out {q(cohort)} --seed 45 --per-type 20",
        f"PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.council_health live --root {q(cohort)} --coordinator-approved --parallel 1",
        f"PYTHON_DOTENV_DISABLED=1 uv run python -m scripts.council_health evaluate --root {q(cohort)} --state {q(cohort / 'health-state.json')} --pause {q(cohort / 'PAUSED')} --window 20 > {q(cohort / 'report.json')}",
    ]


class ProductionRunner:
    """Actual production plan -> proof -> draft -> frozen full council.

    Saved objective documentation is injected at the production retrieval seam,
    identically for both arms. No accepted/test question text becomes a demo.
    Only dry-run generation and local verdict writes are reachable. Budget
    transport wrappers supplied by the caller cover worker threads too.
    """
    def __call__(self, records, *, model, seed, prompt_pack, output_dir, doccheck_policy):
        from scripts import generate_pmle_questions as generator
        from scripts.judge_requests import run_requests
        from shared.external_judge import request_directory, candidate_question
        from shared.gates import evaluate_gate
        from shared.argon_gate import evaluate_argon
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=False)
        by_cert = {}
        for record in records:
            cert = record["scope"]["cert_id"]
            by_cert.setdefault(cert, []).append(record)
        candidates, calls, artifacts = [], [], []
        complete = True
        for cert, selected in sorted(by_cert.items()):
            from scripts.optimize.corpus import sources_for_record
            bound_records = {row["objective_id"]: row for row in selected}
            docs = {row["objective_id"]: sources_for_record(row) for row in selected}
            if not all(docs.values()):
                raise ValueError("Frozen official documents are required for every objective")
            def frozen_docs(*args, objective_id=None, **kwargs):
                if objective_id not in docs:
                    raise ValueError("Unrecognized held-out objective in retrieval")
                return sources_for_record(bound_records[objective_id], kwargs.get("decision_plan"))
            artifact = output_dir / (cert + ".json")
            args = ["--cert", cert, "--n-questions", str(len(selected)), "--model", model,
                    "--seed", str(seed), "--parallel", "1", "--dry-run", "--judge-model", "external",
                    "--argon-gate", "--doccheck-policy", doccheck_policy, "--artifact", str(artifact)]
            evidence_modes = {row["scope"].get("distractor_evidence", {}).get("mode", "strict") for row in selected}
            if len(evidence_modes) != 1:
                raise ValueError("Mixed distractor evidence policies in certification")
            args += ["--distractor-evidence", evidence_modes.pop()]
            for row in selected:
                args += ["--objective", row["objective_id"]]
            if prompt_pack is not None:
                args += ["--prompt-pack", str(prompt_pack)]
            with patch.object(generator, "search_objective_docs", frozen_docs):
                generator.main.main(args=args, standalone_mode=False)
            payload = _read(artifact)
            if payload.get("batch_stop"):
                complete = False
            artifacts.append(str(artifact))
            requests = request_directory(artifact)
            verdicts = output_dir / (cert + ".verdicts")
            request_count = len(list(requests.glob("*.json"))) if requests.is_dir() else 0
            if request_count:
                summary = run_requests(requests, verdicts, judge_model="claude", parallel=1,
                                       argon_gate=True, full_gate_sample=1)
                complete &= not (summary.failed or summary.remaining or summary.usage_stopped or summary.persistence_failed)
            if len(payload.get("candidates", [])) != len(selected):
                raise ValueError("Production generation did not cover every held-out objective")
            for entry in payload["candidates"]:
                proofs = [attempt.get("proof", {}).get("passed") is True for attempt in entry.get("decision_attempts", [])
                          if "proof" in attempt]
                proof_pass = entry.get("decision_proof", {}).get("passed") is True
                row = {"objective_id": entry["objective_id"], "proof_attempts": proofs,
                       "doccheck_passed": proof_pass, "council_attempted": False, "seats": {},
                       "eligible": entry.get("schema_check", {}).get("passed") is True
                       and entry.get("mechanical_check", {}).get("passed") is True}
                metadata = entry.get("external_judge_request")
                if metadata:
                    verdict_path = verdicts / (entry["candidate_id"] + ".json")
                    if not verdict_path.is_file():
                        complete = False
                    else:
                        raw = _read(verdict_path)
                        request = _read(artifact.parent / metadata["path"])
                        question = candidate_question(entry)
                        style = request.get("style_policy")
                        row["seats"] = {"claude." + name: evaluate_gate(name, raw[name], question,
                            version=request["gate_version"], style_policy=style)[0] for name in ("blind_solver", "style", "evidence")}
                        if request["argon"]["version"] != 3:
                            raise ValueError("Held-out full council requires current Argon blind and review")
                        argon_pass, _ = evaluate_argon(question, raw["argon"], request["argon"])
                        blind = evaluate_gate("blind_solver", raw["argon"]["blind"], question)[0]
                        review = raw["argon"]["review"]
                        row["seats"].update({"argon.blind": blind, "argon.review": review["verdict"] == "PASS"
                            and review["key_correct"] is True and review["other_defensible_option"] is False and not review["issues"]})
                        if argon_pass != (row["seats"]["argon.blind"] and row["seats"]["argon.review"]):
                            raise ValueError("Independent Argon aggregate mismatch")
                        row["council_attempted"] = True
                if entry.get("error_class") not in (None, "DecisionVetoError"):
                    complete = False
                candidates.append(row)
            log_path = Path(str(artifact) + ".calls.jsonl")
            if log_path.is_file():
                calls.extend(_read_jsonl(log_path))
        return {"candidates": candidates, "writer_usage": writer_token_usage(calls),
                "complete": complete, "artifacts": artifacts}


def _read_jsonl(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]


def evaluate_pack(records, *, pack_path, model, seed, output_dir, doccheck_policy="v5", runner=None, budget=None, canary=None, canary_artifact=None, manifest_sha256=None):
    """Run paired arms with one writer, seed, objective set and frozen sources.

    Inject ``runner`` for offline tests. A live caller must supply a SpendBudget.
    Each objective is evaluated once; saved attempts are not extra objectives.
    """
    from scripts.optimize.budget import budgeted_calls
    if not records:
        raise ValueError("No held-out objectives")
    unique = {}
    for row in records:
        objective = row["objective_id"]
        if row["scope"].get("objective_id") != objective or not row.get("sources"):
            raise ValueError("Missing frozen held-out scope/sources")
        unique.setdefault(objective, row)
    # Strip saved candidate outputs before handing anything to live execution.
    from scripts.optimize.corpus import sources_for_record
    selected = [{**{key: deepcopy(row[key]) for key in ("objective_id", "scope")},
                 "sources": sources_for_record(row),
                 **({"objective_corpus": deepcopy(row["objective_corpus"])} if row.get("objective_corpus") else {})}
                for _, row in sorted(unique.items())]
    for row in selected:
        for key in ("decision_plan", "decision_proof", "decision_objective"):
            row["scope"].pop(key, None)
    output_dir = Path(output_dir).absolute()
    output_dir.mkdir(parents=True, exist_ok=False)
    pack_file = Path(pack_path).absolute()
    pack_digest = hashlib.sha256(pack_file.read_bytes()).hexdigest() if pack_file.is_file() else None
    if runner is None:
        if budget is None:
            raise ValueError("Live evaluation requires a hard local model budget")
        runner = ProductionRunner()
    from shared.prompt_pack import load_pack
    loaded_pack = load_pack(pack_file)
    policy = loaded_pack["policy"]
    certs = {row["scope"].get("cert_id") for row in records}
    declared_cert = policy.get("cert_id")
    if len(certs) != 1 or any(not isinstance(cert, str) or not cert for cert in certs):
        raise ValueError("A prompt-pack evaluation must contain exactly one certification")
    if declared_cert is not None and certs != {declared_cert}:
        raise ValueError("Held-out certification differs from prompt-pack policy.cert_id")
    training = policy.get("training_objectives", [])
    if not isinstance(training, list) or any(not isinstance(value, str) or not value for value in training):
        raise ValueError("Invalid prompt-pack training objective provenance")
    if set(training) & set(unique):
        raise ValueError("Prompt pack was trained on held-out evaluation objectives")
    declared_manifest = policy.get("dataset_manifest_sha256")
    if declared_manifest is not None and declared_manifest != manifest_sha256:
        raise ValueError("Prompt-pack dataset manifest hash does not match evaluation dataset")
    if policy.get("doccheck_policy", doccheck_policy) != doccheck_policy:
        raise ValueError("Prompt-pack doccheck policy differs from evaluation")
    arms = {}
    with budgeted_calls(budget) if budget is not None else nullcontext():
        for name, prompt_pack in (("baseline", None), ("packed", Path(pack_path).absolute())):
            arms[name] = runner(deepcopy(selected), model=model, seed=seed, prompt_pack=prompt_pack,
                                output_dir=output_dir / name, doccheck_policy=doccheck_policy)
    expected = [row["objective_id"] for row in selected]
    for result in arms.values():
        if sorted(row["objective_id"] for row in result["candidates"]) != expected:
            raise ValueError("Paired arms did not evaluate exactly the same held-out objectives")
    if pack_digest is not None and hashlib.sha256(pack_file.read_bytes()).hexdigest() != pack_digest:
        raise ValueError("Prompt pack changed during paired evaluation")
    baseline, packed = (summarize_arm(arms[name]) for name in ("baseline", "packed"))
    report = {"version": 1, "model": model, "seed": seed, "doccheck_policy": doccheck_policy,
              "objectives": expected, "full_gate_sample": 1, "council_seats": list(SEATS), "council_note": COUNCIL_NOTE,
              "baseline": baseline, "packed": packed, "canary": canary,
              "promotion": promotion_decision(baseline, packed, canary),
              "pairing": "Same writer selector, seed, objectives and frozen docs. Provider output determinism is not guaranteed.",
              "budget": budget.snapshot() if budget is not None else None, "dataset_manifest_sha256": manifest_sha256,
              "artifacts": {name: arms[name].get("artifacts", []) for name in arms}}
    report["pack_sha256"] = pack_digest
    report["frozen_inputs_sha256"] = hashlib.sha256(json.dumps(selected, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    # Generator external artifacts deliberately retain accepted=False. Health
    # prepare needs a genuinely accepted frozen source, not an evaluator arm.
    artifact = canary_artifact or "/ABS/ACCEPTED-FROZEN-ARTIFACT.json"
    report["canary_commands"] = canary_commands(artifact, output_dir)
    report["canary_instructions"] = ("Supply --canary-artifact with an accepted frozen corpus artifact. "
        "Replace /ABS/ACCEPTED-FROZEN-ARTIFACT.json if no artifact was supplied. Evaluator arms are "
        "not ingested and must not be used as accepted sources. Canary live calls need a separate "
        "coordinator-approved council-health budget; these printed commands are not executed here.")
    _write(output_dir / "report.json", report)
    (output_dir / "report.md").write_text(markdown_report(report))
    return report


def markdown_report(report):
    def percent(value):
        return "unknown" if value is None else f"{value * 100:.2f}%"
    lines = ["# Held-out prompt-pack evaluation", "", report["council_note"], "", PROMOTION_RULE, "",
             f"Writer: `{report['model']}`; seed: {report['seed']}; full-gate-sample=1.",
             report["pairing"], "", "| Metric | Baseline | Pack |", "| --- | ---: | ---: |"]
    for metric in ("doccheck_pass_rate", "doccheck_candidate_pass_rate", "council_pass_rate"):
        lines.append(f"| {metric} | {percent(report['baseline'][metric])} | {percent(report['packed'][metric])} |")
    for name in SEATS:
        lines.append(f"| {name} | {percent(report['baseline']['seat_pass_rates'][name])} | {percent(report['packed']['seat_pass_rates'][name])} |")
    for metric in ("accepted", "accepted_per_million_writer_tokens"):
        lines.append(f"| {metric} | {report['baseline'][metric]} | {report['packed'][metric]} |")
    lines.extend(["", "Writer tokens = actual provider input + output for plan, proof, draft and citation, including failed attempts. "
                  "Unknown usage is not estimated and blocks promotion. Council rates use fully judged candidates; "
                  "doccheck attempt and candidate rates use their respective denominators.", "",
                  "Promotion: " + ("ELIGIBLE" if report["promotion"]["promote"] else "BLOCKED")])
    lines.extend("- " + reason for reason in report["promotion"]["reasons"])
    lines.extend(["", "## Isolated canary commands (coordinator only)", "", report["canary_instructions"], "", "```sh", *report["canary_commands"], "```", ""])
    return "\n".join(lines)


def load_heldout_records(dataset_dir):
    """Validate the universal split, then select only eligible plan test IDs."""
    dataset_dir = Path(dataset_dir)
    manifest_bytes = (dataset_dir / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    splits = {name: set(manifest["splits"][name]) for name in ("train", "dev", "test")}
    if any(splits[a] & splits[b] for a, b in (("train", "dev"), ("train", "test"), ("dev", "test"))):
        raise ValueError("Universal dataset objective splits overlap")
    allowed = set(manifest.get("eligible_splits", {}).get("plan", {}).get("test", manifest["splits"]["test"]))
    if not allowed or not allowed <= splits["test"]:
        raise ValueError("Eligible test objectives must be a nonempty subset of universal test objectives")
    raw = (dataset_dir / "plan.test.json").read_bytes()
    declared_hash = manifest.get("files", {}).get("plan.test.json")
    if declared_hash is not None and declared_hash != hashlib.sha256(raw).hexdigest():
        raise ValueError("Held-out dataset file does not match manifest hash")
    records = json.loads(raw)
    if {row["objective_id"] for row in records} != allowed:
        raise ValueError("Eligible held-out objective manifest is incomplete")
    return records, hashlib.sha256(manifest_bytes).hexdigest()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datasets", type=Path, required=True)
    parser.add_argument("--prompt-pack", type=Path, required=True)
    parser.add_argument("--model", default="openrouter/deepseek/deepseek-v4.1-flash-1017")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--doccheck-policy", choices=("v5", "v6"), default="v5")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--prices", type=Path, required=True)
    parser.add_argument("--budget-usd", required=True)
    parser.add_argument("--canary-report", type=Path)
    parser.add_argument("--canary-artifact", type=Path, help="Accepted frozen source for printed isolated health commands")
    parser.add_argument("--coordinator-approved", action="store_true")
    args = parser.parse_args(argv)
    if not args.coordinator_approved:
        parser.error("Live evaluation requires --coordinator-approved; no model calls made")
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    from scripts.optimize.budget import SpendBudget
    from shared.prompt_pack import load_pack
    loaded_pack = load_pack(args.prompt_pack)
    try:
        records, manifest_hash = load_heldout_records(args.datasets)
    except (ValueError, KeyError, TypeError):
        parser.error("Held-out objective manifest or hashed dataset is empty, overlapping, or incomplete")
    declared_cert = loaded_pack["policy"].get("cert_id")
    if declared_cert is not None:
        records = [row for row in records if row["scope"].get("cert_id") == declared_cert]
        if not records:
            parser.error("No eligible held-out objectives match prompt-pack policy.cert_id")
    budget = SpendBudget(args.budget_usd, _read(args.prices), args.out.absolute().with_suffix(".budget.jsonl"))
    report = evaluate_pack(records, pack_path=args.prompt_pack, model=args.model, seed=args.seed,
                           output_dir=args.out, doccheck_policy=args.doccheck_policy, budget=budget,
                           canary=_read(args.canary_report) if args.canary_report else None, canary_artifact=args.canary_artifact,
                           manifest_sha256=manifest_hash)
    print(json.dumps({"report": str(args.out.absolute() / "report.json"), "promotion": report["promotion"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
