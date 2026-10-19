"""Offline conservative analyst-calibration validation."""
from copy import deepcopy
import pytest
from scripts import replay_claim_support as replay
from test_decision_first_v4 import decision, scope, proof
from test_external_generation import source


def fixture():
    page = source()
    artifact = {"plan": [scope()], "candidates": [{"index": 1, "objective_id": scope()["objective_id"],
        "decision_attempts": [{"attempt": 1, "plan": decision(), "sources": [page], "proof": proof()}]}]}
    ledger = [{"arm": "baseline", "candidate_index": 1, "attempt": 1, "claim_id": str(i),
               "field": field, "claim_text": text, "kind": "scenario", "label": "supported", "supports": []}
              for i, (field, text) in enumerate(replay.plan_fields(decision()).items())]
    ledger[0].update(kind="documentation", supports=[{"url": page["url"], "source_sha256": page["text_sha256"],
        "start": 0, "end": 10, "text": page["text"][:10]}])
    return {"baseline": artifact}, ledger


def test_field_inventory_not_just_attempt_inventory():
    artifacts, ledger = fixture()
    report = replay.evaluate(artifacts, ledger)
    assert report["gate_passed"] is True
    assert report["semantic_completeness_assured"] is False
    reduced = replay.evaluate(artifacts, ledger[:1])
    assert reduced["complete_attempt_coverage"] is True
    assert reduced["complete_field_coverage"] is False
    assert reduced["gate_passed"] is False


@pytest.mark.parametrize("mutation", ["duplicate", "empty", "kind", "label", "negative", "boolean", "outside", "hash"])
def test_invalid_ledger_and_spans_fail_closed(mutation):
    artifacts, ledger = fixture()
    span = ledger[0]["supports"][0]
    if mutation == "duplicate": ledger.append(deepcopy(ledger[0]))
    elif mutation == "empty": ledger[0]["claim_text"] = " "
    elif mutation == "kind": ledger[0]["kind"] = "guess"
    elif mutation == "label": ledger[0]["label"] = "yes"
    elif mutation == "negative": span.update(start=-1, end=0, text="")
    elif mutation == "boolean": span.update(start=False)
    elif mutation == "outside": span.update(end=10**9)
    else: artifacts["baseline"]["candidates"][0]["decision_attempts"][0]["sources"][0]["text"] += "tampered"
    with pytest.raises(ValueError): replay.evaluate(artifacts, ledger)


def test_conjunctive_support_requires_every_span(monkeypatch):
    artifacts, ledger = fixture()
    span = ledger[0]["supports"][0]
    page = artifacts["baseline"]["candidates"][0]["decision_attempts"][0]["sources"][0]
    ledger[0]["supports"].append({**span, "start": 10, "end": 20, "text": page["text"][10:20]})
    original = replay.RetrievalSession.prepare
    def narrowed(self, *args, **kwargs):
        from dataclasses import replace
        selected = original(self, *args, **kwargs)
        selected["chunks"] = [replace(selected["chunks"][0], start=0, end=10, text=page["text"][:10])]
        return selected
    monkeypatch.setattr(replay.RetrievalSession, "prepare", narrowed)
    report = replay.evaluate(artifacts, ledger)
    assert report["rows"][0]["retrieved"] is False
    assert report["gate_passed"] is False


def test_no_source_plans_are_counted_and_field_aliases_normalize():
    artifacts, ledger = fixture()
    candidate = artifacts["baseline"]["candidates"][0]
    candidate["decision_attempts"].append({"attempt": 2, "plan": decision()})
    report = replay.evaluate(artifacts, ledger)
    assert report["attempt_count"] == 2
    assert report["source_attempt_count"] == 1
    assert len(report["no_source_attempts"]) == 1
    assert report["complete_attempt_coverage"] is False
    assert report["gate_passed"] is False
    assert replay.normalized_field("mistakes[0].action") == "B.action"
    assert replay.normalized_field("decisive_constraints[1]") == "decisive_constraints.1"
    assert replay.normalized_field("best_action.prerequisite") == "best_action"
