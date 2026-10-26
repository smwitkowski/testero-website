"""Offline source filtering, recurrence and card-boundary regressions."""
import hashlib
import json
import os
from pathlib import Path

import pytest

from scripts.optimize.build_planner_cards import (
    CUTOFF, collect_vetoes, recurring_claims, render_selection, validate_claim,
    lifecycle_facts, metadata_excluded, prompt_for, distill,
)
from shared.planner_cards import lint_card_text

OID = "machine-learning-engineer:standard:3.3:2"


def artifact(tmp_path, name="ordinary.json", *, ids=("one", "two", "three"), **extras):
    path = tmp_path / name
    payload = {"plan": [{"objective_id": OID, "objective_text": "TensorFlow distributed training", "services": ["TensorFlow"]}],
               "candidates": [{"candidate_id": cid, "objective_id": OID,
                 "decision_attempts": [{"proof": {"supported": False, "reason": "The docs do not establish TensorFlow synchronous gradient aggregation behavior."}}],
                 "external_verdict": {"reason": "COUNCIL SECRET DO NOT MINE"}} for cid in ids], **extras}
    path.write_text(json.dumps(payload))
    os.utime(path, (1792872000, 1792872000))  # safely before cutoff
    return path


def test_filters_cutoff_tags_ab_and_no_council(tmp_path):
    artifact(tmp_path)
    artifact(tmp_path, "night-experiment.json")
    artifact(tmp_path, "dsab-trial.json")
    artifact(tmp_path, "doccheck-ab-trial.json")
    artifact(tmp_path, "tagged.json", tags=["night-test"])
    artifact(tmp_path, "ab.json", ab_assignment={})
    late = artifact(tmp_path, "late.json")
    os.utime(late, (1792972800, 1792972800))  # cutoff equality
    rows, audit = collect_vetoes([tmp_path])
    assert len(rows) == 3
    assert "COUNCIL SECRET" not in json.dumps(rows)
    assert audit["filters"]["excluded_artifacts"] == 5
    assert audit["filters"]["postcutoff_artifacts"] == 1
    assert metadata_excluded({"ab_assignment": None})


def test_canary_objective_held_out_even_in_ordinary_file(tmp_path):
    artifact(tmp_path)
    artifact(tmp_path, "gold-holdout.json", ids=("gold-candidate",))
    rows, audit = collect_vetoes([tmp_path])
    assert not rows
    assert audit["heldout_objectives"] == [OID]


def test_explicit_postcutoff_and_malformed_timestamp_fail_closed(tmp_path):
    artifact(tmp_path, created_at="2026-10-26T00:00:00Z")
    artifact(tmp_path, "bad.json", created_at="not-a-timestamp")
    rows, audit = collect_vetoes([tmp_path])
    assert not rows
    assert audit["filters"]["invalid_timestamp"] == 1


def test_duplicate_retries_do_not_make_recurrence(tmp_path):
    artifact(tmp_path, ids=("same", "same", "same"))
    rows, _ = collect_vetoes([tmp_path])
    assert len(rows) == 1
    assert recurring_claims(rows) == []


def test_associations_validated_before_and_after_selection(tmp_path):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    claims = recurring_claims(rows)
    assert claims
    assert all(len(c["candidate_ids"]) == 3 for c in claims)
    item = {"claims": claims, "vetoes": rows, "lifecycle": [], "names": [], "veto_candidate_ids": ["one", "two", "three"]}
    selection = {"claim_ids": [claims[0]["claim_id"]], "lifecycle_ids": [], "name_ids": []}
    card = render_selection(selection, item)
    assert card["sha256"] == hashlib.sha256(card["text"].encode()).hexdigest()
    assert card["source_candidate_ids"] == ["one", "three", "two"]
    assert "The docs here do not establish" in card["text"]
    claims[0]["associations"][0]["candidate_id"] = "invented"
    with pytest.raises(ValueError, match="association"):
        render_selection(selection, item)


def test_unknown_selection_and_raw_reasons_never_sent(tmp_path):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    claims = recurring_claims(rows)
    item = {"claims": claims, "vetoes": rows, "lifecycle": [], "names": [], "veto_candidate_ids": ["one", "two", "three"]}
    prompt = prompt_for(OID, item)
    assert "COUNCIL SECRET" not in prompt
    assert "supported" not in prompt
    with pytest.raises(ValueError, match="Unknown"):
        render_selection({"claim_ids": ["invented"], "lifecycle_ids": [], "name_ids": []}, item)


@pytest.mark.parametrize("text", ["x" * 1201, "", "A council verdict", "The judge says", "A rubric", "supported", "A receipt", 'A "quote"', "A ‘quote’", "https://example.com/x"])
def test_card_lint_rejects_unsafe_material(text):
    with pytest.raises(ValueError):
        lint_card_text(text)


def test_card_lint_allows_coverage_apostrophe_and_source_id():
    text = "Coverage: The docs here don't describe TensorFlow's replication behavior.\nLifecycle: retired 2026-06-30 (page-ab12)."
    assert lint_card_text(text) == text


def test_lifecycle_requires_date_and_page_hash_before_cutoff():
    sentence = "Vertex AI Vision is deprecated as of June 15, 2026 and reaches End of Life on September 30, 2026."
    source = {"text": sentence, "text_sha256": hashlib.sha256(sentence.encode()).hexdigest(),
              "url": "https://docs.cloud.google.com/vision-ai/docs/overview", "retrieved_at": "2026-10-25T23:00:00Z"}
    facts = lifecycle_facts({"sources": [source]}, {"vision", "vertex"})
    assert len(facts) == 1 and "2026-09-30" in facts[0]["text"]
    assert facts[0]["source_span"] == sentence
    assert facts[0]["source_page_id"].startswith("page-")
    source["retrieved_at"] = CUTOFF
    assert lifecycle_facts({"sources": [source]}, {"vision", "vertex"}) == []
    source["retrieved_at"] = "2026-10-25T23:00:00Z"
    source["text_sha256"] = "wrong"
    with pytest.raises(ValueError, match="hash"):
        lifecycle_facts({"sources": [source]}, {"vision", "vertex"})


def test_at_most_one_call_after_failure(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    claims = recurring_claims(rows)
    item = {"claims": claims, "vetoes": rows, "lifecycle": [], "names": [], "veto_candidate_ids": ["one", "two", "three"]}
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    calls = []
    class Result:
        returncode = 0
        stdout = "--tools --safe-mode"
        stderr = ""
    def run(command, **kwargs):
        if "--help" in command:
            return Result()
        calls.append(command)
        result = Result()
        result.returncode = 1
        result.stderr = "not stored in plaintext"
        return result
    monkeypatch.setattr("scripts.optimize.build_planner_cards.shutil.which", lambda _: "/fake/claude")
    monkeypatch.setattr("scripts.optimize.build_planner_cards.subprocess.run", run)
    with pytest.raises(ValueError, match="no retry"):
        distill(prepared, tmp_path / "out")
    with pytest.raises(ValueError, match="already attempted"):
        distill(prepared, tmp_path / "out")
    assert len(calls) == 1
    assert "--tools" in calls[0] and "--strict-mcp-config" in calls[0]


def test_partial_product_name_is_not_a_shared_claim():
    rows = [{"candidate_id": "one", "reason": "The docs do not establish PyTorch FSDP support on Compute Engine GPUs."},
            {"candidate_id": "two", "reason": "The docs do not establish TensorFlow model parallelism on Compute Engine GPUs."}]
    assert not recurring_claims(rows)


def test_lifecycle_does_not_turn_legacy_name_into_retirement():
    sentence = "Feature Store (Legacy) stores features. Last updated October 25, 2026."
    source = {"text": sentence, "text_sha256": hashlib.sha256(sentence.encode()).hexdigest(),
              "url": "https://docs.cloud.google.com/vertex-ai/docs/featurestore/overview", "retrieved_at": "2026-10-25T23:00:00Z"}
    assert lifecycle_facts({"sources": [source]}, {"feature", "store", "legacy"}) == []


def test_current_names_omit_retired_capability_before_generic_alias():
    from scripts.optimize.build_planner_cards import current_names
    rows = [{"objective_text": "Vision work", "reason": "Vertex AI Vision is retired", "services": ["Vertex AI Vision", "Vertex AI Workbench"]}]
    lexicon = {"products": [{"old": "Vertex AI", "new": "Agent Platform", "status": "renamed"},
                           {"old": "Vertex AI Workbench", "new": "Agent Platform Workbench", "status": "renamed"}],
               "planner_products": [{"old": "Vertex AI Vision", "status": "retired"}]}
    names = {r["text"] for r in current_names(rows, lexicon)}
    assert "Agent Platform Vision" not in names
    assert "Vertex AI Vision" not in names
    assert "Agent Platform Workbench" in names


def test_shared_object_does_not_merge_different_predicates():
    rows = [{"candidate_id": "one", "reason": "The docs do not establish invoking the Kubernetes training operator from a pipeline."},
            {"candidate_id": "two", "reason": "The docs do not establish that the Kubernetes training operator requires adaptation."}]
    assert not recurring_claims(rows)


def test_unattributed_lifecycle_sentence_is_not_a_fact():
    sentence = "On February 17, 2027, the capability will be fully sunset and APIs will no longer be available."
    source = {"text": sentence, "text_sha256": hashlib.sha256(sentence.encode()).hexdigest(),
              "url": "https://docs.cloud.google.com/vertex-ai/docs/release-notes", "retrieved_at": "2026-10-25T23:00:00Z"}
    assert lifecycle_facts({"sources": [source]}, {"capability", "available"}) == []


def test_successful_cli_call_filters_nested_flags_but_keeps_auth(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    claims = recurring_claims(rows)
    item = {"claims": claims, "vetoes": rows, "lifecycle": [], "names": [], "veto_candidate_ids": ["one", "two", "three"]}
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    monkeypatch.setenv("CLAUDECODE", "test-parent")
    monkeypatch.setenv("CLAUDE_CODE_ENTRYPOINT", "test-entrypoint")
    monkeypatch.setenv("PLANNER_TEST_AUTH", "test-authorized-session")
    captured = []
    class Result:
        returncode = 0
        stdout = "--tools --safe-mode"
        stderr = ""
    def run(command, **kwargs):
        if "--help" in command:
            return Result()
        captured.append(kwargs["env"])
        result = Result()
        selection = {"claim_ids": [claims[0]["claim_id"]], "lifecycle_ids": [], "name_ids": []}
        result.stdout = json.dumps({"is_error": False, "result": json.dumps(selection)})
        return result
    monkeypatch.setattr("scripts.optimize.build_planner_cards.shutil.which", lambda _: "/fake/claude")
    monkeypatch.setattr("scripts.optimize.build_planner_cards.subprocess.run", run)
    result = distill(prepared, tmp_path / "out")
    assert OID in result["objectives"]
    assert len(captured) == 1
    assert "CLAUDECODE" not in captured[0] and "CLAUDE_CODE_ENTRYPOINT" not in captured[0]
    assert captured[0]["PLANNER_TEST_AUTH"] == os.environ["PLANNER_TEST_AUTH"]
    assert captured[0]["PYTHON_DOTENV_DISABLED"] == "1"
    # Replaying an already frozen objective consumes no second completion.
    assert distill(prepared, tmp_path / "out") == result
    assert len(captured) == 1


def test_entity_only_rag_anchor_rejected():
    rows = [{"candidate_id": "one", "reason": "The docs do not verify Agent Platform RAG Engine specifically."},
            {"candidate_id": "two", "reason": "The docs do not verify Agent Platform RAG Engine specifically."}]
    assert recurring_claims(rows) == []


def test_lifecycle_only_requires_fact_and_three_veto_candidates():
    item = {"claims": [], "vetoes": [], "names": [], "veto_candidate_ids": ["one", "two", "three"],
            "lifecycle": [{"fact_id": "life-one", "source_page_id": "page-one", "text": "Imagen endpoint discontinued; deadline 2026-06-30."}]}
    selection = {"claim_ids": [], "lifecycle_ids": ["life-one"], "name_ids": []}
    card = render_selection(selection, item)
    assert "Coverage: No reliable recurring coverage claim retained." in card["text"]
    assert card["source_page_ids"] == ["page-one"]
    with pytest.raises(ValueError, match="reliable claim"):
        render_selection({**selection, "lifecycle_ids": []}, item)
    item["veto_candidate_ids"] = ["one", "two"]
    with pytest.raises(ValueError, match="three"):
        render_selection(selection, item)


def test_tpu_replication_retains_compound_single_slice_context():
    rows = [{"candidate_id": "one", "reason": "The docs do not verify TPUStrategy's synchronous replication and batch splitting. General TPU scaling cannot establish it. TensorFlow exclusion applies to Multislice, not the proposed single slice."},
            {"candidate_id": "two", "reason": "The docs do not establish TPUStrategy's synchronous replication and gradient aggregation. JAX Multislice cannot substantiate the TensorFlow single-slice decision."}]
    claims = recurring_claims(rows)
    assert len(claims) == 1
    assert "single-slice" in claims[0]["text"]
    assert "together with" in claims[0]["text"]
    assert "batch-splitting or gradient-aggregation" in claims[0]["text"]
    assert "does not rule out single-slice training" in claims[0]["text"]
    rows[1]["reason"] = "The docs do not establish TPUStrategy's synchronous replication."
    assert recurring_claims(rows) == []


def test_safety_rerender_removes_entity_claim_without_model_call(tmp_path):
    from scripts.optimize.build_planner_cards import safety_rerender
    item = {"claims": [], "vetoes": [{"candidate_id": "one", "reason": "The docs do not verify Agent Platform RAG Engine specifically."},
                                      {"candidate_id": "two", "reason": "The docs do not verify Agent Platform RAG Engine specifically."}],
            "names": [], "veto_candidate_ids": ["one", "two", "three"],
            "lifecycle": [{"fact_id": "life-one", "source_page_id": "page-one", "text": "Imagen endpoint discontinued; deadline 2026-06-30."}]}
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    frozen = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: {"text": "old entity-only text", "sha256": "old-hash"}}}
    selections = {OID: {"claim_ids": ["unsafe-entity"], "lifecycle_ids": ["life-one"], "name_ids": []}}
    revised, _, revised_selections, audit = safety_rerender(prepared, frozen, selections)
    assert len(revised["objectives"]) == 1
    assert revised_selections[OID]["claim_ids"] == []
    assert audit["model_calls"] == 0
    assert audit["revisions"][0]["old_sha256"] == "old-hash"
    assert audit["revisions"][0]["removed_claim_ids"] == ["unsafe-entity"]
    assert frozen["objectives"][OID]["text"] == "old entity-only text"
