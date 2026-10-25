"""Replay recorded plans and unchanged seed prompts against objective corpora.

Live use requires coordinator approval. --replay-results is an explicitly marked
fixture-only report mode and never proves live transport fidelity.
"""
from __future__ import annotations

import argparse
from contextlib import nullcontext
import json
from pathlib import Path

from scripts.optimize.corpus import ranked_corpus_sources, validate_corpus


def fidelity_report(records, outcomes, *, student_model="codex", checker_model="codex", fixture=False):
    if len(records) != len(outcomes) or not records:
        raise ValueError("One complete replay and seed result is required per plan")
    rows = []
    for record, outcome in zip(records, outcomes):
        original = record.get("proof", {}).get("passed")
        if type(original) is not bool or any(type(outcome.get(k)) is not bool for k in ("replay_passed", "seed_passed")):
            raise ValueError("Fidelity requires explicit boolean recorded/replay/seed outcomes")
        rows.append({"objective_id": record["objective_id"], "source": record.get("source"),
                     "recorded_passed": original, **outcome,
                     "agreement": original == outcome["replay_passed"],
                     "corpus_sha256": record["objective_corpus"]["sha256"]})
    agreement = sum(row["agreement"] for row in rows) / len(rows)
    seed_rate = sum(row["seed_passed"] for row in rows) / len(rows)
    return {"version": 1, "mode": "offline-fixture" if fixture else "transport-replay",
            "count": len(rows), "student_model": student_model, "checker_model": checker_model,
            "checker_temperature": 0.0,
            "temperature_note": "Codex CLI exposes no temperature control; OpenRouter checker uses zero.",
            "verdict_agreement": agreement, "agreement_target": .85,
            "agreement_target_met": agreement >= .85, "seed_program_pass_rate": seed_rate,
            "seed_program_target": .4, "seed_program_note": "Approximate PMLE dev target, not a fabricated calibration.",
            "ready_for_optimization": not fixture and len(rows) >= 40 and agreement >= .85,
            "rows": rows}


def replay_fidelity(records, *, student_model="codex", checker_model="codex", verifier=None, student=None):
    """Serial production checker calls; injectable students/verifiers for tests."""
    from shared.decision_planner import planning_prompt, verify_decision
    from shared.cli_models import run_signature
    from shared.llm_generator import _predict_writer
    verifier = verify_decision if verifier is None else verifier
    def default_student(signature, inputs):
        if student_model == "codex" or student_model.startswith("codex/"):
            return run_signature(student_model, signature, inputs, reasoning_effort="high")
        return _predict_writer(signature, inputs, student_model)
    student = default_student if student is None else student
    outcomes = []
    for record in records:
        scope, corpus = record["scope"], record["objective_corpus"]
        validate_corpus(corpus, record["objective_id"])
        def check(plan):
            sources = ranked_corpus_sources(scope, plan, corpus)
            raw = verifier(scope, plan, sources, model=checker_model, reasoning_effort="medium",
                           stable_prefix=True, temperature=0.0)
            if type(raw.get("passed")) is not bool:
                raise ValueError("Checker did not return a boolean verdict")
            return raw["passed"]
        recorded = record.get("plan", record.get("outputs", {}).get("plan"))
        replay_passed = check(recorded)
        signature, _ = planning_prompt(scope, stable_prefix=True)
        generated = student(signature, record["inputs"])
        seed = generated["plan"] if isinstance(generated, dict) else generated.plan
        seed_passed = check(seed)
        outcomes.append({"replay_passed": replay_passed, "seed_passed": seed_passed})
    return fidelity_report(records, outcomes, student_model=student_model, checker_model=checker_model)


def load_records(directory, *, split="dev", cert_id="machine-learning-engineer", count=40, seed=42):
    from scripts.optimize.run_optimizer import load_splits, development_subset
    if type(count) is not int or count < 1:
        raise ValueError("Replay count must be positive")
    rows = load_splits(directory, "plan")[split]
    rows = [row for row in rows if row["scope"].get("cert_id") == cert_id]
    rows = development_subset(rows, count, seed)
    if len(rows) != count:
        raise ValueError("Not enough eligible recorded plans for requested fidelity count")
    for row in rows:
        validate_corpus(row.get("objective_corpus"), row["objective_id"])
    return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datasets", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--split", choices=("train", "dev"), default="dev")
    parser.add_argument("--cert-id", default="machine-learning-engineer")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--student-model", default="codex")
    parser.add_argument("--checker-model", default="codex")
    parser.add_argument("--replay-results", type=Path, help="Offline fixture outcomes; NOT live fidelity evidence")
    parser.add_argument("--coordinator-approved", action="store_true")
    parser.add_argument("--prices", type=Path)
    parser.add_argument("--budget-usd")
    args = parser.parse_args(argv)
    if not args.replay_results and not args.coordinator_approved:
        parser.error("Live fidelity requires --coordinator-approved; no model calls made")
    if args.out.exists():
        parser.error("Refusing to overwrite an existing fidelity report")
    records = load_records(args.datasets, split=args.split, cert_id=args.cert_id, count=args.count, seed=args.seed)
    if args.replay_results:
        report = fidelity_report(records, json.loads(args.replay_results.read_text()), fixture=True,
                                 student_model=args.student_model, checker_model=args.checker_model)
    else:
        from scripts.optimize.budget import SpendBudget, budgeted_calls, serial_dspy_execution
        paid = any(not (m == "codex" or m.startswith("codex/")) for m in (args.student_model, args.checker_model))
        if paid and (args.prices is None or args.budget_usd is None):
            parser.error("OpenRouter fidelity requires --prices and --budget-usd")
        budget = SpendBudget(args.budget_usd, json.loads(args.prices.read_text()), args.out.with_suffix(".budget.jsonl")) if paid else None
        with serial_dspy_execution(), budgeted_calls(budget) if budget is not None else nullcontext():
            report = replay_fidelity(records, student_model=args.student_model, checker_model=args.checker_model)
        report["budget"] = budget.snapshot() if budget is not None else None
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "rows"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
