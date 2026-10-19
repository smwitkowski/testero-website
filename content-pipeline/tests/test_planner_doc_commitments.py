"""Offline contracts for opt-in, unverified planner documentation commitments."""
from copy import deepcopy

import pytest
from pydantic import ValidationError

from shared.decision_planner import plan_decision_with_commitments
from shared.cert_context import DEFAULT_CERT

OBJECTIVE = "b01be5c8-bfeb-4bfb-99ad-7ec2d0d24f65"

def decision(name="Choose managed serving for the delivery application"):
    return {
        "objective_id": OBJECTIVE, "engineering_decision": name,
        "business_consequence": "Customers can obtain current delivery updates",
        "existing_system": "The team already maintains HTTP application code",
        "decisive_constraints": ["Keep infrastructure management low"],
        "best_action": "Run the existing HTTP application on Cloud Run",
        "mistakes": [
            {"action": "Use BigQuery batch processing", "scenario_reason": "Offline execution does not run the HTTP handler"},
            {"action": "Use Cloud Storage object storage", "scenario_reason": "Stored objects do not execute application code"},
            {"action": "Use Compute Engine virtual machines", "scenario_reason": "The team maintains infrastructure unnecessarily"},
        ],
    }



def scope():
    return {"objective_id": OBJECTIVE, "domain_prompt": "Choose an HTTP serving platform", "cert_id": DEFAULT_CERT}



def output():
    return {"plan": decision(), "commitments": {
        "anchors": [{"option_label": label, "target_claim": (decision()["best_action"] if label == "A" else decision()["mistakes"][index - 1]["scenario_reason"]),
                     "support_claim": "Document behavior for " + label,
                     "url": "https://docs.cloud.google.com/run/docs/overview", "section": "Overview"}
                    for index, label in enumerate("ABCD")], "unresolved_issues": [],
    }}


def test_commitments_preserve_plan_and_are_separate_from_it():
    value = output()
    result = plan_decision_with_commitments(scope(), model="codex", predictor=lambda **_: value)
    assert result == value
    assert "commitments" not in result["plan"]


@pytest.mark.parametrize("mutation", ["missing_label", "extra_anchor", "empty_section", "objective", "duplicate_action"])
def test_commitments_fail_closed(mutation):
    value = deepcopy(output())
    if mutation == "missing_label":
        value["commitments"]["anchors"][-1]["option_label"] = "A"
    elif mutation == "extra_anchor":
        value["commitments"]["anchors"].append(value["commitments"]["anchors"][0])
    elif mutation == "empty_section":
        value["commitments"]["anchors"][0]["section"] = " "
    elif mutation == "objective":
        value["plan"]["objective_id"] = "wrong"
    else:
        value["plan"]["mistakes"][0]["action"] = value["plan"]["best_action"]
    with pytest.raises((ValueError, ValidationError)):
        plan_decision_with_commitments(scope(), model="codex", predictor=lambda **_: value)
