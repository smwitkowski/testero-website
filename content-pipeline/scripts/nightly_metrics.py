"""Offline observed nightly metrics. Missing/short-circuited seats are not votes."""
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path

from scripts.nightly_budget import instant, week_start


def batch_metrics(artifact, verdicts, publication):
    from scripts.ingest_external_verdicts import _scope
    from shared.external_judge import candidate_question
    from shared.distractor_evidence import verdict_gates
    from shared.gates import parse_gate_output, evaluate_gate
    from shared.argon_gate import evaluate_argon
    payload = json.loads(Path(artifact).read_text())
    candidates = payload["candidates"]
    complete = unanimous = passed = incomplete = 0
    for entry in candidates:
        try:
            if not entry.get("external_judge_request"):
                continue
            scope = _scope(payload, entry)
            question = candidate_question(entry)
            request = json.loads((Path(artifact).parent / entry["external_judge_request"]["path"]).read_text())
            raw = json.loads((Path(verdicts)/(entry["candidate_id"]+".json")).read_text())
            gates = verdict_gates(raw, request.get("distractor_evidence"))
            votes = []
            for name in ("style", "evidence", "blind_solver"):
                parse_gate_output(name, gates[name], version=5, style_policy=scope.get("style_policy"))
                votes.append(evaluate_gate(name, gates[name], question, version=5,
                                           style_policy=scope.get("style_policy"))[0])
            # Argon vote combines its independent blind+review result.
            votes.append(evaluate_argon(question, gates["argon"], request["argon"])[0])
            complete += 1
            unanimous += len(set(votes)) == 1
            passed += all(votes)
        except Exception:
            incomplete += 1
    return {"candidates": len(candidates), "artifact_accepted": sum(e.get("accepted") is True for e in candidates),
            "persisted_drafts": sum(e.get("persistence_status") == "complete" for e in candidates),
            "complete_council_candidates": complete, "incomplete_or_short_circuited": incomplete,
            "unanimous_all_pass": passed, "agreement_denominator": complete,
            "agreement_rate": unanimous/complete if complete else None,
            "agreement_definition": "Four gate decisions: Claude blind, style, evidence, combined Argon blind+review; complete verdicts only",
            "published": publication["published"], "would_publish": publication["would_publish"]}


def observed_week(state_dir, current, now):
    reports = {}
    for path in Path(state_dir).glob("*/checkpoint.json"):
        prior = json.loads(path.read_text())
        at = instant(prior["at"])
        if week_start(now) <= at <= now:
            reports[prior["at"]] = prior
    reports[current["at"]] = current
    batches = [b.get("metrics", {}) for r in reports.values() for b in r.get("batches", [])]
    keys = ("candidates", "artifact_accepted", "persisted_drafts", "complete_council_candidates", "unanimous_all_pass", "published")
    counts = {key: sum(b.get(key, 0) for b in batches) for key in keys}
    paid = sum(Decimal(v) for v in current["budget"]["weekly_usd"].values())
    yields = [b["persisted_drafts"]/b["candidates"] for r in sorted(reports.values(), key=lambda r:r["at"])
              for batch in r.get("batches", []) for b in [batch.get("metrics", {})] if b.get("candidates", 0) > 0]
    return {"observed_nights": len(reports), "funnel": counts,
            "last_two_observed_batch_yields": yields[-2:],
            "low_yield_two_batches": len(yields) >= 2 and all(y < .15 for y in yields[-2:]),
            "cost_usd_per_observed_published": str(paid/counts["published"]) if counts["published"] else None,
            "note": "Observed local report denominator, not full DB publication count; missing nights are not zero."}
