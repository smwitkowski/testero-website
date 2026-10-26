"""Calibrate the frozen off-council critic on known historical council outcomes.

Use training objectives only. Live OpenRouter calls require coordinator approval
and a hard local budget. Fixture reports are marked and cannot activate a critic.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from scripts.optimize.corpus import digest
from scripts.optimize.plan_critic import (DEFAULT_CRITIC, PlanCriticSignature,
    calibration_report, critic_inputs, normalize_critic_model, parse_critic, run_critic)


def load_calibration_records(directory, *, count=200, cert_id="machine-learning-engineer", seed=42):
    from scripts.optimize.run_optimizer import load_splits
    if type(count) is not int or count < 2:
        raise ValueError("Calibration needs at least two historical plans")
    rows = load_splits(directory, "plan")["train"]
    unique, conflicts = {}, set()
    for row in rows:
        if row["scope"].get("cert_id") != cert_id or type(row.get("council_outcome")) is not bool:
            continue
        key = digest({"scope": row["scope"], "plan": row.get("plan", row["outputs"].get("plan"))})
        previous = unique.get(key)
        if previous is not None and previous["council_outcome"] != row["council_outcome"]:
            conflicts.add(key)
        unique.setdefault(key, row)
    groups = {label: sorted([(key, row) for key, row in unique.items()
                             if key not in conflicts and row["council_outcome"] is label],
                            key=lambda item: digest({"seed": seed, "plan": item[0]}))
              for label in (False, True)}
    if not all(groups.values()) or sum(map(len, groups.values())) < count:
        raise ValueError("Not enough unique train plans with both known council outcomes; no labels invented")
    selected = []
    # Alternate labels; use the remaining class only after one runs out.
    while len(selected) < count:
        for label in (False, True):
            if groups[label] and len(selected) < count:
                selected.append(groups[label].pop()[1])
    return selected


def calibrate_critic(records, *, model=DEFAULT_CRITIC, runner=None):
    """Run each historical plan once, withholding all labels from the critic."""
    model = normalize_critic_model(model)
    if any(type(row.get("council_outcome")) is not bool for row in records):
        raise ValueError("Unknown council outcomes cannot calibrate a critic")
    runner = run_critic if runner is None else runner
    predictions, audit = [], []
    for row in records:
        plan = row.get("plan", row.get("outputs", {}).get("plan"))
        inputs = critic_inputs(row["scope"], plan)
        result = parse_critic(runner(model, PlanCriticSignature, inputs), row["scope"])
        predictions.append(result["passed"])
        audit.append({"objective_id": row["objective_id"], "source": row.get("source"),
                      "plan_sha256": digest(plan), "council_outcome": row["council_outcome"],
                      "critic": result})
    report = calibration_report(records, predictions, model=model)
    report["historical_results"] = audit
    report["sha256"] = digest({k: v for k, v in report.items() if k != "sha256"})
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--datasets", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--count", type=int, default=200)
    parser.add_argument("--cert-id", default="machine-learning-engineer")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--critic-model", default=DEFAULT_CRITIC)
    parser.add_argument("--predictions", type=Path, help="Offline fixture booleans, never accepted as live calibration")
    parser.add_argument("--prices", type=Path)
    parser.add_argument("--budget-usd")
    parser.add_argument("--coordinator-approved", action="store_true")
    args = parser.parse_args(argv)
    if not args.predictions and not args.coordinator_approved:
        parser.error("Live critic calibration requires --coordinator-approved; no calls made")
    if args.out.exists():
        parser.error("Refusing to overwrite an existing critic calibration")
    model = normalize_critic_model(args.critic_model)
    records = load_calibration_records(args.datasets, count=args.count, cert_id=args.cert_id, seed=args.seed)
    if args.predictions:
        report = calibration_report(records, json.loads(args.predictions.read_text()), model=model, fixture=True)
    else:
        if args.prices is None or args.budget_usd is None:
            parser.error("Live critic calibration requires --prices and --budget-usd")
        from scripts.optimize.budget import SpendBudget, budgeted_calls, serial_dspy_execution
        budget = SpendBudget(args.budget_usd, json.loads(args.prices.read_text()), args.out.with_suffix(".budget.jsonl"))
        with serial_dspy_execution(), budgeted_calls(budget):
            report = calibrate_critic(records, model=model)
        report["budget"] = budget.snapshot()
        report["sha256"] = digest({k: v for k, v in report.items() if k != "sha256"})
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ("predictions", "historical_results")}, indent=2))
    return 0 if report["usable"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
