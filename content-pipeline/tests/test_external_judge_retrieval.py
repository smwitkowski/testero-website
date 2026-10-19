"""Offline frozen-proof validation with optional retrieval v3 provenance."""
from copy import deepcopy

import pytest

from shared.doc_retrieval import RetrievalSession
from shared.external_judge import validate_decision_provenance
from test_decision_first_v4 import decision, proof, scope
from test_external_generation import source


def frozen(retrieval=True):
    frozen_scope = scope()
    plan = decision()
    value = {**proof(), "passed": True, "mechanical_check": {"passed": True, "errors": []}}
    if retrieval:
        value["retrieval"] = RetrievalSession().prepare(frozen_scope, plan, [source()])["metadata"]
    frozen_scope.update(decision_plan=plan, decision_proof=value,
                        decision_objective={"objective_id": frozen_scope["objective_id"],
                                            "objective_text": frozen_scope["objective_text"]})
    entry = deepcopy(frozen_scope)
    entry["sources"] = [source()]
    return frozen_scope, entry


@pytest.mark.parametrize("retrieval", [False, True])
def test_baseline_and_retrieval_proofs_validate_offline(retrieval):
    validate_decision_provenance(*frozen(retrieval))


@pytest.mark.parametrize("mutation", ["extra", "version", "config", "tokens", "hash", "chunks", "claims", "reference"])
def test_malformed_retrieval_metadata_fails_closed(mutation):
    frozen_scope, entry = frozen()
    metadata = frozen_scope["decision_proof"]["retrieval"]
    if mutation == "extra":
        metadata["unknown"] = True
    elif mutation == "version":
        metadata["version"] = True
    elif mutation == "config":
        metadata["config"]["top_k"] = True
    elif mutation == "tokens":
        metadata["estimated_doc_tokens"] += 1
    elif mutation == "hash":
        metadata["objective_prefix_sha256"] = "invalid"
    elif mutation == "chunks":
        metadata["chunk_ids"] = ["invalid"]
    elif mutation == "claims":
        metadata["claims"][0]["claim"]["text"] = "Changed plan claim"
    else:
        metadata["claims"][0]["chunk_ids"] = ["f" * 24]
    entry["decision_proof"] = deepcopy(frozen_scope["decision_proof"])
    with pytest.raises(ValueError, match="Invalid frozen decision"):
        validate_decision_provenance(frozen_scope, entry)


@pytest.mark.parametrize("mutation", ["unknown", "boolean", "receipt", "mechanical", "mismatch"])
def test_retrieval_does_not_relax_core_proof_checks(mutation):
    frozen_scope, entry = frozen()
    value = frozen_scope["decision_proof"]
    if mutation == "unknown":
        value["unknown"] = True
    elif mutation == "boolean":
        value["supported"] = "true"
    elif mutation == "receipt":
        value["reasons"][0]["quote"] = "Not in frozen fetched text"
    elif mutation == "mechanical":
        value["mechanical_check"]["passed"] = False
    entry["decision_proof"] = deepcopy(value)
    if mutation == "mismatch":
        entry["decision_proof"]["retrieval"]["budget_chars"] += 1
    with pytest.raises(ValueError, match="Invalid frozen decision"):
        validate_decision_provenance(frozen_scope, entry)
