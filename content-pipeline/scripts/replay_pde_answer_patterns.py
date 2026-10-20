#!/usr/bin/env python3
"""Replay saved PDE repeats offline; never import a model or database client."""
import argparse
import hashlib
import json
from pathlib import Path

from shared.answer_patterns import check_answer_pattern

FIXTURE = Path(__file__).resolve().parents[1] / "tests/fixtures/pde_answer_pattern_repeats.json"
PROJECTION_FIELDS = ("candidate_id", "stem", "options", "key", "decision_plan", "accepted", "failure_stage")


def project_authored(candidate):
    """Keep authored comparison fields, without inventing persistence or status."""
    return {**{key: candidate[key] for key in PROJECTION_FIELDS if key in candidate},
            "cert_id": "data-engineer"}


def verify_sources(fixture, source_dir):
    """Check original bytes and exact saved projections; read sources only."""
    sources = {}
    for name, digest in fixture["sources"].items():
        path = source_dir / name
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError(f"Source hash mismatch: {name}")
        sources[name] = json.loads(raw)
    for record in fixture["pilot_authored"] + fixture["repeats"] + fixture["distinct_controls"]:
        candidate = sources[record["source"]]["candidates"][record["candidate_index"]]
        if project_authored(candidate) != record["question"]:
            raise ValueError(f"Authored projection mismatch: {record['source']}")
    bank = fixture["bank"]
    if sources[bank["source"]] != bank["questions"]:
        raise ValueError("Saved ACTIVE/DRAFT bank differs from frozen fixture")
    return sorted(sources)


def replay(fixture):
    """Compare the full saved bank plus every saved authored pilot question."""
    bank = fixture["bank"]["questions"]
    if any(row.get("status") not in ("ACTIVE", "DRAFT") for row in bank):
        raise ValueError("Replay bank must contain only saved ACTIVE/DRAFT rows")
    authored = [row["question"] for row in fixture["pilot_authored"]]
    # Actual exported rows win over authored projections of the same ID.
    bank_ids = {row["id"] for row in bank}
    combined = bank + [row for row in authored if row["candidate_id"] not in bank_ids]
    results = []
    for case in fixture["repeats"] + fixture["distinct_controls"]:
        result = check_answer_pattern(case["question"], combined, cert_id="data-engineer")
        saved_bank = check_answer_pattern(case["question"], bank, cert_id="data-engineer")
        plan = check_answer_pattern(case["question"]["decision_plan"], combined, cert_id="data-engineer")
        matched_ids = sorted({row["matched_id"] for row in result["matches"]})
        plan_ids = {row["matched_id"] for row in plan["matches"]}
        expected = case.get("expected_pilot_id")
        ok = (not result["errors"] and not plan["errors"]
              and (result["passed"] and plan["passed"] if expected is None else
                   not result["passed"] and expected in matched_ids
                   and not plan["passed"] and expected in plan_ids
                   and result["signature"]["mechanism"] == case["family"]
                   and plan["signature"]["mechanism"] == case["family"]))
        results.append({"case": case["name"], "candidate_id": case["question"]["candidate_id"],
                        "expected_pilot_id": expected, "expected_pilot_in_saved_bank": expected in bank_ids if expected else None,
                        "verified": ok, "combined_comparison": result, "saved_bank_only": saved_bank,
                        "decision_plan_comparison": plan})
    return {"offline_only": True, "claim": "Deterministic saved-artifact replay, not live bank coverage or model-quality evidence",
            "comparison_sets": {"saved_active_draft_bank": len(bank), "all_saved_authored_pilot": len(authored),
                                "combined_unique_questions": len(combined),
                                "authored_only_pilot_ids": sorted(row["candidate_id"] for row in authored if row["candidate_id"] not in bank_ids)},
            "sources": fixture["sources"], "passed": all(row["verified"] for row in results), "results": results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Optionally verify original saved artifact bytes read-only")
    parser.add_argument("--output", type=Path, help="Write replay JSON locally")
    args = parser.parse_args()
    raw = FIXTURE.read_bytes()
    fixture = json.loads(raw)
    verified_sources = verify_sources(fixture, args.source_dir) if args.source_dir else None
    report = replay(fixture)
    report.update(fixture_sha256=hashlib.sha256(raw).hexdigest(), verified_original_sources=verified_sources,
                  rule_module_sha256=hashlib.sha256((FIXTURE.parents[2] / "shared/answer_patterns.py").read_bytes()).hexdigest(),
                  replay_script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
