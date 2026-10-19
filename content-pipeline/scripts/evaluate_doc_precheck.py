#!/usr/bin/env python3
"""Audit same-plan shadow decisions without treating missing metadata as a block."""
import hashlib
import json
from pathlib import Path
import click


def evaluate(path):
    raw = path.read_bytes()
    artifact = json.loads(raw)
    rows = []
    lineage_valid = True
    for index, candidate in enumerate(artifact.get("candidates", []), 1):
        judged_complete = (candidate.get("awaiting_external_judge") is False
                           and bool(candidate.get("external_judge_provenance"))
                           and isinstance(candidate.get("external_verdict"), dict)
                           and bool(candidate["external_verdict"])
                           and type(candidate.get("judge_verdict", {}).get("passed")) is bool)
        attempts = candidate.get("decision_attempts", [])
        survivors = [a for a in attempts if a.get("proof", {}).get("passed") is True]
        final_plan = candidate.get("decision_plan")
        candidate_lineage = (len(survivors) <= 1 and
                             (not survivors or (survivors[0] is attempts[-1] and
                              (final_plan is None or survivors[0].get("plan") == final_plan))))
        lineage_valid = lineage_valid and candidate_lineage
        for attempt in attempts:
            check, proof = attempt.get("doc_precheck"), attempt.get("proof")
            measured = (isinstance(check, dict) and check.get("shadow") is True
                        and type(check.get("passed")) is bool and isinstance(proof, dict)
                        and type(proof.get("passed")) is bool)
            rows.append({"candidate_index": index, "attempt": attempt.get("attempt"),
                         "measured": measured,
                         "would_block": not check["passed"] if measured else None,
                         "full_verifier_pass": proof["passed"] if measured else None,
                         "eventual_accepted": candidate.get("accepted") is True,
                         "judge_passed": judged_complete and candidate.get("judge_verdict", {}).get("passed") is True,
                         "independent_judge_recorded": judged_complete})
    measured = [r for r in rows if r["measured"]]
    vetoes = [r for r in measured if not r["full_verifier_pass"]]
    passes = [r for r in measured if r["full_verifier_pass"]]
    # Only the full-verifier survivor that was actually written/judged belongs
    # to the eventual-pass denominator, never prior vetoes of that candidate.
    accepted = [r for r in passes if r["eventual_accepted"]]
    judged = [r for r in passes if r["judge_passed"]]
    def rate(group):
        return sum(r["would_block"] for r in group) / len(group) if group else None
    catch, false_block = rate(vetoes), rate(judged)
    return {"version": 1, "artifact": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
            "attempts": len(rows), "measured_shadow_attempts": len(measured),
            "unmeasured_attempts": len(rows)-len(measured), "full_verifier_vetoes": len(vetoes),
            "full_verifier_passes": len(passes), "eventual_accepted_plans": len(accepted),
            "judge_passed_plans": len(judged), "veto_catch": catch,
            "false_block_full_verifier_passes": rate(passes), "false_block_eventual_accepted": rate(accepted),
            "false_block_judge_passes": rate(judged),
            "complete_shadow_coverage": len(measured) == len(rows) and bool(rows),
            "lineage_valid": lineage_valid,
            "complete_independent_judge_coverage": bool(passes) and all(r["independent_judge_recorded"] for r in passes),
            "targets_observed": (catch >= .40 and false_block <= .05)
                                if catch is not None and false_block is not None and len(measured) == len(rows)
                                and lineage_valid and all(r["independent_judge_recorded"] for r in passes) else None,
            "target_false_block_cohort": "independent_judge_passed_survivors",
            "rollout_authorized": False,
            "limits": "Descriptive calibration, no uncertainty bounds or held-out semantic noninferiority. Missing commitments are unmeasured. accepted is DRAFT insertion, not publication.",
            "rows": rows}


@click.command()
@click.option("--artifact", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--output", type=click.Path(path_type=Path))
def main(artifact, output):
    report = evaluate(artifact)
    text = json.dumps(report, indent=2) + "\n"
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(text)
    click.echo(text)


if __name__ == "__main__":
    main()
