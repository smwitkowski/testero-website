#!/usr/bin/env python3
"""Offline, analyst-annotated claim support recall over ALL recorded plans."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.doc_retrieval import RetrievalSession, RetrievalConfig, DEFAULT_CONFIG, DEFAULT_CONTEXT_CHARS
from shared.decision_planner import verification_prompt, evidence_missing_veto
from shared.cli_models import signature_prompt

ROOT = Path(__file__).resolve().parents[1]


def implementation_sha256():
    paths = [Path(__file__), ROOT / "shared/doc_claims.py", ROOT / "shared/doc_retrieval.py",
             ROOT / "shared/decision_planner.py", ROOT / "shared/cli_models.py",
             ROOT / "scripts/generate_pmle_questions.py", ROOT / "shared/call_logging.py",
             ROOT / "shared/external_judge.py"]
    return hashlib.sha256(b"".join(path.read_bytes() for path in paths)).hexdigest()


def plan_fields(plan):
    return {"best_action": plan["best_action"], **{
        f"decisive_constraints.{i}": text for i, text in enumerate(plan["decisive_constraints"])}, **{
        f"{label}.{field}": mistake[field] for label, mistake in zip("BCD", plan["mistakes"])
        for field in ("action", "scenario_reason")}}


def normalized_field(field):
    import re
    if field.startswith("best_action."):
        return "best_action"
    field = re.sub(r"decisive_constraints\[(\d+)\]", r"decisive_constraints.\1", field)
    match = re.fullmatch(r"mistakes(?:\[(\d+)\]|\.(\d+))\.(action|scenario_reason)", field)
    if match:
        index = int(match[1] or match[2])
        if index < 3:
            return f"{'BCD'[index]}.{match[3]}"
    return field


def evaluate(artifacts, ledger, *, config=DEFAULT_CONFIG, budget=DEFAULT_CONTEXT_CHARS):
    attempts, prompts, no_sources = {}, [], []
    for arm, artifact in artifacts.items():
        session = RetrievalSession(config)
        for candidate in artifact["candidates"]:
            scope = artifact["plan"][candidate["index"] - 1]
            if scope["objective_id"] != candidate["objective_id"]:
                raise ValueError("Frozen scope differs from candidate objective")
            scope = {**scope, "distractor_evidence": candidate.get("distractor_evidence", scope.get("distractor_evidence"))}
            escalation_counted = False
            for attempt in candidate["decision_attempts"]:
                if not attempt.get("plan"):
                    continue
                key = (arm, candidate["index"], attempt["attempt"])
                if key in attempts:
                    raise ValueError("Duplicate recorded attempt")
                fields = plan_fields(attempt["plan"])
                selected = None
                for source in attempt.get("sources", []):
                    if hashlib.sha256(source["text"].encode()).hexdigest() != source["text_sha256"]:
                        raise ValueError("Full-source SHA-256 mismatch")
                if not attempt.get("sources"):
                    no_sources.append({"arm": arm, "candidate_index": candidate["index"],
                                       "attempt": attempt["attempt"], "reason": "no fetched sources"})
                else:
                    selected = session.prepare(scope, attempt["plan"], attempt["sources"], budget=budget)
                    before = len(signature_prompt(*verification_prompt(scope, attempt["plan"], attempt["sources"])))
                    after = len(signature_prompt(*verification_prompt(scope, attempt["plan"], selected["sources"],
                                              retrieval=selected, stable_prefix=True)))
                    escalation = not escalation_counted and evidence_missing_veto(attempt.get("proof", {}))
                    escalation_counted |= escalation
                    prompts.append({"arm": arm, "candidate_index": candidate["index"], "attempt": attempt["attempt"],
                                    "full_estimated_tokens": math.ceil(before / 4), "cheap_estimated_tokens": math.ceil(after / 4),
                                    "historical_missing_evidence_proxy": escalation})
                attempts[key] = (attempt, selected, fields)
    rows, identities, covered = [], set(), set()
    for claim in ledger:
        for name in ("claim_id", "field", "claim_text"):
            if not isinstance(claim.get(name), str) or not claim[name].strip():
                raise ValueError(f"Claim requires nonempty {name}")
        if claim.get("kind") not in {"documentation", "scenario", "judgment"} or claim.get("label") not in {"supported", "not_found", "partial", "contradicted"}:
            raise ValueError("Invalid claim kind or label")
        if any(type(claim.get(name)) is not int or claim[name] < 1 for name in ("candidate_index", "attempt")):
            raise ValueError("Invalid claim attempt identity")
        key = (claim["arm"], claim["candidate_index"], claim["attempt"])
        if key not in attempts:
            raise ValueError("Claim refers to unknown attempt")
        identity = (*key, claim["claim_id"])
        if identity in identities:
            raise ValueError("Duplicate claim ID within attempt")
        identities.add(identity)
        attempt, selected, fields = attempts[key]
        field = normalized_field(claim["field"])
        if field in fields:
            covered.add((*key, field))
        elif field not in {"existing_system", "mistakes.batch.scenario_reason", "mistakes.online.action"}:
            raise ValueError("Claim refers to unknown plan field")
        supports = claim.get("supports", [])
        if not isinstance(supports, list):
            raise ValueError("Claim supports must be a list")
        found = []
        for support in supports:
            start, end, text = support.get("start"), support.get("end"), support.get("text")
            sources = [source for source in attempt.get("sources", []) if source["url"] == support.get("url")
                       and source["text_sha256"] == support.get("source_sha256")]
            if (type(start) is not int or type(end) is not int or not isinstance(text, str) or not text.strip()
                    or not sources or any(not (0 <= start < end <= len(source["text"]))
                        or source["text"][start:end] != text for source in sources)):
                raise ValueError(f"Invalid full-source support annotation: {claim['claim_id']}")
            found.append(selected is not None and any(chunk.url == support["url"] and chunk.source_sha256 == support["source_sha256"]
                             and chunk.start <= start and chunk.end >= end for chunk in selected["chunks"]))
        eligible = claim["kind"] == "documentation" and claim["label"] == "supported"
        if eligible and not supports:
            raise ValueError("Supported documentation claim has no exact evidence span")
        retrieved = bool(found) and all(found)
        rows.append({**claim, "eligible": eligible, "retrieved": retrieved, "all_supports_retrieved": retrieved})
    summaries = {}
    for arm in artifacts:
        population = [row for row in rows if row["arm"] == arm and row["eligible"]]
        recovered = sum(row["retrieved"] for row in population)
        summaries[arm] = {"claims": len(population), "recovered": recovered,
                          "recall": recovered / len(population) if population else None}
    denominator = sum(row["eligible"] for row in rows)
    recovered = sum(row["eligible"] and row["retrieved"] for row in rows)
    expected = {(*key, field) for key, (_, _, fields) in attempts.items() for field in fields}
    annotated = {(row["arm"], row["candidate_index"], row["attempt"]) for row in rows}
    complete = set(attempts) == annotated
    field_complete = expected == covered
    return {"implementation_sha256": implementation_sha256(), "config": config.__dict__, "budget_chars": budget,
            "method": "Analyst calibration using exact immutable-page spans; every supplied support span is required. Claims never enter retrieval.",
            "complete_attempt_coverage": complete, "complete_field_coverage": field_complete,
            "semantic_completeness_assured": False, "attempt_count": len(attempts),
            "source_attempt_count": len(attempts) - len(no_sources), "no_source_attempts": no_sources,
            "annotated_attempt_count": len(annotated),
            "missing_fields": [{"arm": key[0], "candidate_index": key[1], "attempt": key[2], "field": key[3]}
                               for key in sorted(expected - covered)],
            "claims": denominator, "recovered": recovered, "claim_support_recall": recovered / denominator if denominator else None,
            "gate_passed": complete and field_complete and denominator > 0 and recovered / denominator >= .95
                           and all(value["recall"] is not None and value["recall"] >= .95 for value in summaries.values()),
            "by_arm": summaries, "rows": rows, "prompt_estimates": prompts,
            "caveat": "Analyst calibration only: field coverage does not assure semantic completeness, correct analyst labels, held-out quality, or provider token measurement."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--treatment", required=True, type=Path)
    parser.add_argument("--ledger", action="append", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--config", type=Path)
    parser.add_argument("--budget-chars", type=int, default=DEFAULT_CONTEXT_CHARS)
    args = parser.parse_args()
    paths = {"baseline": args.baseline, "treatment": args.treatment}
    ledger = []
    for path in args.ledger:
        annotated = json.loads(path.read_text())
        ledger.extend(annotated if isinstance(annotated, list) else annotated.get("claims", annotated.get("ledger", [])))
    report = evaluate({arm: json.loads(path.read_bytes()) for arm, path in paths.items()}, ledger,
                      config=RetrievalConfig(**json.loads(args.config.read_text())) if args.config else DEFAULT_CONFIG,
                      budget=args.budget_chars)
    report["artifacts"] = {arm: hashlib.sha256(path.read_bytes()).hexdigest() for arm, path in paths.items()}
    report["ledgers"] = {str(path): hashlib.sha256(path.read_bytes()).hexdigest() for path in args.ledger}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ("rows", "prompt_estimates")}, indent=2))


if __name__ == "__main__":
    main()
