"""Offline v5/v6 replay of the all-true proof with decorated receipt labels.

This fixture contains the unchanged final plan/proof and quote-centered raw
excerpts from four fetched sources. These are synthetic context projections,
not full original fetched pages. Original provenance is retained as metadata.
"""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from shared.decision_planner import DecisionVetoError, verify_decision, writer_decision_context
from shared.evidence import check_evidence
from test_decision_first_v4 import pipeline


FIXTURE = Path(__file__).parent / "fixtures" / "doccheck" / "recorded-discard.json"
FLAGS = ("supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas")


@pytest.fixture
def recorded():
    return json.loads(FIXTURE.read_text())


def replay(recorded, proof, *, policy="v6"):
    scope = {**recorded["scope"], "doccheck_policy": policy}
    # The recorded v5 output predates v6's required failing-options field.
    # Supply that new field only in the replay; never alter recorded evidence.
    output = {**proof, "failing_options": []} if policy == "v6" else proof
    return verify_decision(scope, recorded["plan"], recorded["sources"],
                           model="offline-recorded", predictor=lambda **_: output)


def canonical_proof(recorded):
    proof = deepcopy(recorded["proof"])
    for label, row in zip("ABCD", proof["reasons"], strict=True):
        row["option_label"] = label
    return proof


def assert_rejected(recorded, proof):
    # Strict schema rejection and mechanical rejection must both fail closed.
    try:
        checked = replay(recorded, proof)
    except ValidationError as exc:
        assert all(error["type"] == "literal_error" and error["loc"][0] == "reasons"
                   and error["loc"][-1] == "option_label" for error in exc.errors())
        return
    assert checked["passed"] is False


def test_v5_recorded_all_true_semantics_do_not_override_invalid_receipt_labels(recorded):
    assert all(recorded["proof"][flag] is True for flag in FLAGS)
    assert recorded["proof"]["reason"].startswith("The plan is supported:")
    checked = replay(recorded, recorded["proof"], policy="v5")
    assert checked["mechanical_check"] == recorded["recorded_mechanical_check"]
    assert checked["passed"] is False
    with pytest.raises(DecisionVetoError, match="Unsupported decision"):
        writer_decision_context(recorded["scope"], recorded["plan"], checked)


def test_v6_recorded_decorated_labels_are_rejected_before_approval(recorded):
    original = deepcopy(recorded["proof"])
    with pytest.raises(ValidationError) as caught:
        replay(recorded, recorded["proof"])
    assert {error["loc"] for error in caught.value.errors()} == {
        ("reasons", index, "option_label") for index in range(4)}
    assert all(error["type"] == "literal_error" for error in caught.value.errors())
    assert recorded["proof"] == original


def test_v6_does_not_infer_labels_from_position(recorded):
    proof = canonical_proof(recorded)
    proof["reasons"].reverse()
    checked = replay(recorded, proof)
    assert [row["option_label"] for row in checked["reasons"]] == list("DCBA")
    assert checked["passed"] is True


@pytest.mark.parametrize("separator", ("-", "–", "—"))
def test_v6_rejects_decorations_without_normalizing_them(recorded, separator):
    proof = canonical_proof(recorded)
    for row in proof["reasons"]:
        row["option_label"] += f" {separator} Recorded action description"
    with pytest.raises(ValidationError) as caught:
        replay(recorded, proof)
    assert {error["loc"] for error in caught.value.errors()} == {
        ("reasons", index, "option_label") for index in range(4)}
    assert all(error["type"] == "literal_error" for error in caught.value.errors())


@pytest.mark.parametrize("policy", ("v5", "v6"))
def test_recorded_receipts_valid_when_only_labels_are_exact_abcd(recorded, policy):
    proof = canonical_proof(recorded)
    assert check_evidence(proof["reasons"], recorded["sources"])["passed"] is True
    checked = replay(recorded, proof, policy=policy)
    assert checked["mechanical_check"] == {"passed": True, "errors": []}
    assert checked["passed"] is True


@pytest.mark.parametrize("flag", FLAGS)
def test_v6_exact_labels_do_not_weaken_semantic_veto(recorded, flag):
    proof = canonical_proof(recorded)
    proof[flag] = False
    assert replay(recorded, proof)["passed"] is False


@pytest.mark.parametrize("mutation", ("duplicate_label", "missing_label", "unfetched_url", "invented_quote"))
def test_v6_exact_labels_do_not_weaken_receipt_gates(recorded, mutation):
    proof = canonical_proof(recorded)
    if mutation == "duplicate_label":
        proof["reasons"][1]["option_label"] = "A"
    elif mutation == "missing_label":
        proof["reasons"].pop()
    elif mutation == "unfetched_url":
        proof["reasons"][0]["url"] = "https://docs.cloud.google.com/not-fetched"
    else:
        proof["reasons"][0]["quote"] = "An invented quote that is absent from the fetched documentation."
    checked = replay(recorded, proof)
    assert checked["mechanical_check"]["passed"] is False
    assert checked["passed"] is False


@pytest.mark.parametrize("label", ("E - Invalid", "a - Lowercase", "A/B - Ambiguous", "B then A", "A-compact", "A - ", "A", ""))
def test_v6_invalid_or_duplicate_labels_are_not_repaired_by_position(recorded, label):
    proof = canonical_proof(recorded)
    # B is the correct label here. Even a valid A creates a duplicate.
    proof["reasons"][1]["option_label"] = label
    assert_rejected(recorded, proof)


def test_v6_veto_diagnostic_explains_all_true_mechanical_failure(recorded):
    from shared.decision_planner import decision_veto_reason
    failed = replay(recorded, recorded["proof"], policy="v5")
    reason = decision_veto_reason(failed)
    assert recorded["proof"]["reason"] in reason
    assert "Failed mechanical receipts" in reason
    assert all(error in reason for error in recorded["recorded_mechanical_check"]["errors"])
    assert "Failed semantic checks" not in reason


def test_v6_terminal_veto_includes_receipt_errors_and_never_discards_a_pass(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    from test_decision_first_v4 import decision, proof
    _, path, invoke = pipeline
    plans = iter([decision("First"), decision("Second"), decision("Third")])
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: next(plans))
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: {
        **proof(), "passed": False, "failing_options": [],
        "mechanical_check": {"passed": False, "errors": ["Option D: quote absent from supplied documentation context"]}})
    result = invoke("--doccheck-policy", "v6")
    assert result.exit_code != 0
    saved = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert saved["failure_stage"] == "decision_veto"
    assert "Failed mechanical receipts" in saved["error_message"]
    assert "Option D: quote absent" in saved["decision_veto_reasons"][-1]
    assert not saved.get("awaiting_external_judge")


def test_projected_fixture_retains_original_provenance_and_correct_excerpt_hashes(recorded):
    origin = recorded["recorded_from"]
    assert origin["source_artifact_sha256"] == "f6b0bec25cf033f2b3875f389f5f02cf31c46efc53916e002f87e2dceb7a44d9"
    projection = origin["projection"]
    assert projection["kind"] == "synthetic_context_projection"
    assert "not full original fetched sources" in projection["note"]
    expected_original_hashes = {'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-garden/deploy-and-inference-tutorial': '92bd97bee340c19b5cfd00c32082908eefeb3794f62fb42567488735e1c6fe24', 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/maas/use-open-models': '40993198a9f379cbae236293277c18fb64e0399e89b65bb38a1ee336d026a19a', 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/open-models/choose-serving-option': '6bac2563f7ab9565c8b73ffbffbbc549626bb6785bb964a2e8512986ae0b04fb', 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-garden/quickstart': 'ef828638a60f6e51d54f542c4c9cf6ef3dc4c58bfe79e16dcc578ca8b1fe9229'}
    metadata = {source["url"]: source for source in projection["sources"]}
    assert set(metadata) == set(expected_original_hashes)
    assert {source["url"] for source in recorded["sources"]} == set(metadata)
    for source in recorded["sources"]:
        original = metadata[source["url"]]
        assert original["original_text_sha256"] == expected_original_hashes[source["url"]]
        assert original["requested_url"] == source["requested_url"]
        assert original["retrieved_at"] == source["retrieved_at"]
        digest = hashlib.sha256(source["text"].encode()).hexdigest()
        assert digest == source["text_sha256"] == original["projected_text_sha256"]
        assert digest != original["original_text_sha256"]
        assert len(original["retained_offsets"]) == 1
        start, end = original["retained_offsets"][0]
        assert 0 <= start < end <= original["original_text_chars"]
        assert end - start == len(source["text"]) < 1000
        assert len(source["text"]) < original["original_text_chars"]


def test_v6_final_replacement_with_every_semantic_and_receipt_check_passes(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    from test_decision_first_v4 import decision, proof
    _, path, invoke = pipeline
    plans = iter([decision("First unsupported"), decision("Second unsupported"), decision()])
    outputs = iter([{**proof(False), "failing_options": []},
                    {**proof(False), "failing_options": []},
                    {**proof(True), "failing_options": []}])
    monkeypatch.setattr(generate, "plan_decision", lambda *a, **kw: next(plans))
    def real_verifier(*args, **kwargs):
        value = next(outputs)
        return verify_decision(*args, **kwargs, predictor=lambda **_: value)
    monkeypatch.setattr(generate, "verify_decision", real_verifier)
    result = invoke("--doccheck-policy", "v6")
    assert result.exit_code == 0, result.output
    entry = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert entry["decision_proof"]["passed"] is True
    assert entry["decision_proof"]["mechanical_check"] == {"passed": True, "errors": []}
    assert entry["awaiting_external_judge"] is True
    assert entry.get("error_class") is None
