"""Offline source filtering, recurrence and card-boundary regressions."""
import hashlib
import json
import os
from pathlib import Path

import pytest

from scripts.optimize.build_planner_cards import (
    CUTOFF, collect_vetoes, recurring_claims, render_selection, validate_claim,
    lifecycle_facts, metadata_excluded, prompt_for, distill, absence_spans,
    render_semantic_selection, validate_semantic_claim, prepare, sanitized_context, GAP,
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
    from scripts.optimize.components import _FORBIDDEN
    assert not _FORBIDDEN.search(prompt)
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


def semantic_item(rows):
    return {"claims": [], "vetoes": rows, "absence_spans": absence_spans(rows),
            "lifecycle": [], "names": [], "veto_candidate_ids": sorted({r["candidate_id"] for r in rows})}


def semantic_choice(item):
    return {"status": "card", "reason": None, "coverage": [{
        "text": "The docs here do not establish TensorFlow synchronous gradient aggregation behavior.",
        "source_span_ids": [s["source_span_id"] for s in item["absence_spans"]]}],
        "lifecycle_ids": [], "name_ids": []}


def mock_cli(monkeypatch, responses):
    calls = []
    class Result:
        returncode = 0
        stdout = "--tools --safe-mode"
        stderr = ""
    def run(command, **kwargs):
        if "--help" in command:
            return Result()
        calls.append((command, kwargs))
        response = next(responses)
        if isinstance(response, BaseException):
            raise response
        result = Result()
        if response == "fail":
            result.returncode = 1
            result.stdout = "private diagnostic must not persist"
            result.stderr = "not stored in plaintext"
        elif response == "bad_json":
            result.stdout = "private malformed payload"
        else:
            result.stdout = json.dumps({"is_error": False, "result": json.dumps(response)})
        return result
    monkeypatch.setattr("scripts.optimize.build_planner_cards.shutil.which", lambda _: "/fake/claude")
    monkeypatch.setattr("scripts.optimize.build_planner_cards.subprocess.run", run)
    return calls


def test_retry_backoff_exhaustion_and_resume_budget(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    calls = mock_cli(monkeypatch, iter(["fail"] * 3))
    waits = []
    result = distill(prepared, tmp_path / "out", sleeper=waits.append, clock=lambda: 100)
    assert result["objectives"] == {}
    assert waits == [30, 60]
    assert len(calls) == 3
    outcomes = json.loads((tmp_path / "out/outcomes.json").read_text())
    assert outcomes["complete"]
    assert outcomes["outcomes"][OID]["status"] == "failed_after_retries"
    assert distill(prepared, tmp_path / "out", sleeper=waits.append) == result
    assert len(calls) == 3
    assert "--tools" in calls[0][0] and "--strict-mcp-config" in calls[0][0]
    retained = "".join(p.read_text() for p in (tmp_path / "out").rglob("*.json"))
    assert "private diagnostic" not in retained and "not stored in plaintext" not in retained


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
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    monkeypatch.setenv("CLAUDECODE", "test-parent")
    monkeypatch.setenv("CLAUDE_CODE_ENTRYPOINT", "test-entrypoint")
    monkeypatch.setenv("PLANNER_TEST_AUTH", "test-authorized-session")
    calls = mock_cli(monkeypatch, iter([semantic_choice(item)]))
    result = distill(prepared, tmp_path / "out")
    assert OID in result["objectives"] and len(calls) == 1
    env = calls[0][1]["env"]
    assert "CLAUDECODE" not in env and "CLAUDE_CODE_ENTRYPOINT" not in env
    assert env["PLANNER_TEST_AUTH"] == os.environ["PLANNER_TEST_AUTH"]
    assert env["PYTHON_DOTENV_DISABLED"] == "1"
    assert distill(prepared, tmp_path / "out") == result
    assert len(calls) == 1


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


@pytest.mark.parametrize("reason", [
    "The provided pages leave synchronous gradient aggregation unverified.",
    "The documentation has insufficient evidence for TensorFlow synchronous replication.",
    "The claim that TensorFlow aggregates gradients is not substantiated by the supplied sources.",
    "The retrieved docs lack explicit documentation of TensorFlow synchronous replication.",
    "TensorFlow synchronous replication is unsupported by the provided documentation.",
])
def test_broad_absence_extraction(reason):
    rows = [{"candidate_id": "one", "reason": reason}]
    spans = absence_spans(rows)
    assert len(spans) == 1
    assert spans[0]["context"] == reason
    assert spans[0]["text"] == reason


def test_semantic_grouping_does_not_require_common_ngram():
    rows = [{"candidate_id": "one", "reason": "The docs do not establish TensorFlow synchronous gradient aggregation behavior."},
            {"candidate_id": "two", "reason": "The provided pages leave synchronized gradient collection in TensorFlow unverified."},
            {"candidate_id": "three", "reason": "The documentation does not show a TensorFlow replication capability."}]
    item = semantic_item(rows)
    selection = semantic_choice(item)
    selection["coverage"][0]["source_span_ids"] = [s["source_span_id"] for s in item["absence_spans"] if s["candidate_id"] != "three"]
    assert render_semantic_selection(selection, item)["sha256"]


def test_full_context_tampering_and_repeated_candidate_rejected():
    reason = "The docs do not establish TPUStrategy synchronous replication together with batch splitting. TensorFlow exclusion applies only to Multislice, not single-slice training."
    rows = [{"candidate_id": cid, "reason": reason} for cid in ["one", "two", "three"]]
    item = semantic_item(rows)
    selection = semantic_choice(item)
    selection["coverage"][0]["text"] = "The docs here do not establish TPUStrategy synchronous replication together with batch splitting for TensorFlow single-slice training; Multislice exclusions do not rule out single-slice training."
    assert render_semantic_selection(selection, item)
    item["absence_spans"][0]["context"] = "No exception"
    with pytest.raises(ValueError, match="context"):
        render_semantic_selection(selection, item)


def test_entity_only_semantic_coverage_rejected():
    rows = [{"candidate_id": cid, "reason": "The docs do not establish TensorFlow synchronous gradient aggregation behavior."} for cid in ["one", "two", "three"]]
    item = semantic_item(rows)
    choice = semantic_choice(item)
    choice["coverage"][0]["text"] = "The docs here do not establish Agent Platform RAG Engine specifically."
    with pytest.raises(ValueError, match="predicate"):
        render_semantic_selection(choice, item)


def test_prepare_all_three_veto_objectives_even_without_safe_material(tmp_path):
    artifact(tmp_path)
    path = tmp_path / "ordinary.json"
    payload = json.loads(path.read_text())
    other = OID + "-other"
    payload["plan"].append({"objective_id": other, "objective_text": "No gap", "services": []})
    payload["candidates"] += [{"objective_id": other, "candidate_id": cid,
        "decision_attempts": [{"proof": {"supported": False, "reason": "A unique opaque reason " + cid}}]} for cid in ["four", "five", "six"]]
    path.write_text(json.dumps(payload)); os.utime(path, (1792872000, 1792872000))
    corpus = tmp_path / "corpus.json"; corpus.write_text("{}")
    result = prepare([tmp_path], corpus)
    assert set(result["objectives"]) == {OID, other}
    assert result["objectives"][other]["absence_spans"] == []


def test_complete_outcomes_continue_after_failure_and_permanent_no_card(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    oid2, oid3 = OID + "x", OID + "y"
    no_card = {"status": "no_card", "reason": "no_safe_recurring_claim_or_lifecycle", "coverage": [], "lifecycle_ids": [], "name_ids": []}
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item, oid2: item, oid3: item}}
    calls = mock_cli(monkeypatch, iter(["fail", "bad_json", "fail", no_card, semantic_choice(item)]))
    result = distill(prepared, tmp_path / "out", sleeper=lambda _: None, clock=lambda: 100)
    assert set(result["objectives"]) == {oid3}
    outcomes = json.loads((tmp_path / "out/outcomes.json").read_text())
    assert outcomes["complete"] and set(outcomes["outcomes"]) == set(prepared["objectives"])
    assert [outcomes["outcomes"][i]["status"] for i in [OID, oid2, oid3]] == ["failed_after_retries", "no_card", "card"]
    assert len(calls) == 5


def test_resume_interrupted_attempt_and_changed_input_rejection(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    calls = mock_cli(monkeypatch, iter([KeyboardInterrupt(), semantic_choice(item)]))
    with pytest.raises(KeyboardInterrupt):
        distill(prepared, tmp_path / "out", clock=lambda: 100)
    waits = []
    result = distill(prepared, tmp_path / "out", sleeper=waits.append, clock=lambda: 100)
    assert OID in result["objectives"] and len(calls) == 2 and waits == [30]
    prepared["cutoff"] = "2026-10-25T00:00:00Z"
    with pytest.raises(ValueError, match="Frozen"):
        distill(prepared, tmp_path / "out")


def test_strict_input_hygiene_sanitizes_full_context_but_not_other_fields(tmp_path):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    for row in rows:
        row["reason"] += ' The judge says supported, council rubric receipts. See https://example.com/x "quoted".'
        row["plan"] = "PRIVATE PLAN MUST NOT SEND"
    item = semantic_item(rows)
    prompt = prompt_for(OID, item)
    material = json.loads(prompt.split("Material:\n", 1)[1])
    rendered = json.dumps(material)
    from scripts.optimize.components import _FORBIDDEN
    from scripts.optimize.build_planner_cards import INTERNAL
    assert not _FORBIDDEN.search(rendered) and not INTERNAL.search(rendered)
    assert "PRIVATE PLAN" not in prompt and "COUNCIL SECRET" not in prompt
    assert "https://" not in prompt and "quoted" in prompt
    assert all("[internal term omitted]" in s["context"] for s in material["absence_material"])



def test_timeout_and_lint_failures_retry_then_succeed(tmp_path, monkeypatch):
    import subprocess
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    invalid = semantic_choice(item)
    invalid["coverage"][0]["text"] = "The docs here do not establish the judge scoring behavior."
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    calls = mock_cli(monkeypatch, iter([subprocess.TimeoutExpired("claude", 1), invalid, semantic_choice(item)]))
    waits = []
    result = distill(prepared, tmp_path / "out", sleeper=waits.append, clock=lambda: 100)
    state = json.loads((tmp_path / "out/run-state.json").read_text())
    assert OID in result["objectives"] and len(calls) == 3
    assert waits == [30, 60]
    assert [a.get("category") for a in state["attempts"][OID]][:2] == ["timeout", "invalid_json_or_source_lint"]


def test_semantic_claim_requires_two_distinct_candidates():
    rows = [{"candidate_id": "same", "reason": "The docs do not establish TensorFlow synchronous gradient aggregation behavior. The docs also do not show TensorFlow synchronous replication behavior."}]
    item = semantic_item(rows)
    choice = semantic_choice(item)["coverage"][0]
    with pytest.raises(ValueError, match="two distinct candidates"):
        validate_semantic_claim(choice, item)


def test_heldout_plan_scope_excludes_objective_everywhere(tmp_path):
    artifact(tmp_path)
    path = artifact(tmp_path, "heldout-scope.json")
    payload = json.loads(path.read_text())
    payload["plan"][0]["cohort"] = "gold"
    path.write_text(json.dumps(payload)); os.utime(path, (1792872000, 1792872000))
    rows, audit = collect_vetoes([tmp_path])
    assert not rows and audit["heldout_objectives"] == [OID]


def test_permanent_no_card_is_resumed_without_more_calls(tmp_path, monkeypatch):
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    choice = {"status": "no_card", "reason": "no_safe_recurring_claim_or_lifecycle", "coverage": [], "lifecycle_ids": [], "name_ids": []}
    calls = mock_cli(monkeypatch, iter([choice]))
    assert distill(prepared, tmp_path / "out")["objectives"] == {}
    assert distill(prepared, tmp_path / "out")["objectives"] == {}
    assert len(calls) == 1



def test_incidental_lifecycle_does_not_force_card():
    item = {"claims": [], "vetoes": [], "absence_spans": [], "names": [],
            "veto_candidate_ids": ["one", "two", "three"],
            "lifecycle": [{"fact_id": "life-incidental", "source_page_id": "page-incidental",
                           "text": "Incidental feature retired 2026-06-30."}]}
    choice = {"status": "no_card", "reason": "no_safe_recurring_claim_or_lifecycle",
              "coverage": [], "lifecycle_ids": [], "name_ids": []}
    assert render_semantic_selection(choice, item) is None
    assert "exact objective" in prompt_for(OID, item)



def test_prompt_includes_exact_objective_scope_not_plan_fields():
    item = {"vetoes": [{"objective_text": "Optimize distributed TensorFlow training", "reason": "do not send raw", "plan": "PRIVATE"}],
            "absence_spans": [], "lifecycle": [], "names": []}
    prompt = prompt_for(OID, item)
    assert "Optimize distributed TensorFlow training" in prompt
    assert "PRIVATE" not in prompt and "do not send raw" not in prompt



def test_static_failure_diagnostics_do_not_persist_messages(tmp_path, monkeypatch):
    from scripts.optimize.build_planner_cards import safe_exception_diagnostic
    assert safe_exception_diagnostic(ValueError("private account string"), "selection_json") == {
        "stage": "selection_json", "exception_class": "ValueError", "reason": "unclassified_validation_error"}
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    invalid = semantic_choice(item)
    invalid["coverage"][0]["text"] = "The docs here do not establish the judge scoring behavior."
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    mock_cli(monkeypatch, iter(["bad_json", invalid, semantic_choice(item)]))
    distill(prepared, tmp_path / "out", sleeper=lambda _: None, clock=lambda: 100)
    state = json.loads((tmp_path / "out/run-state.json").read_text())
    attempts = state["attempts"][OID]
    assert attempts[0]["diagnostic"] == {"stage": "wrapper_json", "exception_class": "JSONDecodeError", "reason": "json_decode_error"}
    assert attempts[1]["diagnostic"]["reason"] == "card_evaluation_vocabulary"
    assert attempts[1]["format_flags"]["result_type"] == "string"
    assert not attempts[1]["format_flags"]["markdown_fence_seen"]
    retained = "".join(p.read_text() for p in (tmp_path / "out").rglob("*.json"))
    assert "private malformed payload" not in retained and "private account string" not in retained


def test_json_fence_behavior_not_changed_by_diagnostics(tmp_path, monkeypatch):
    # Diagnostics reveal unsupported formatting but deliberately do not fix it.
    from scripts.optimize.build_planner_cards import safe_exception_diagnostic
    with pytest.raises(json.JSONDecodeError) as error:
        json.loads('  ```json\n{}\n```  ')
    assert safe_exception_diagnostic(error.value, "selection_json")["reason"] == "json_decode_error"



def test_rejected_selection_capture_is_strict_bounded_and_diagnostic_only(tmp_path, monkeypatch):
    from copy import deepcopy
    from scripts.optimize.build_planner_cards import rejected_selection_is_safe
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    valid = semantic_choice(item)
    assert rejected_selection_is_safe(valid)
    unsafe = deepcopy(valid); unsafe["provider_error"] = "private"
    assert not rejected_selection_is_safe(unsafe)
    unsafe = deepcopy(valid); unsafe["coverage"][0]["text"] = "x" * 4001
    assert not rejected_selection_is_safe(unsafe)
    unsafe = deepcopy(valid); unsafe["coverage"][0]["source_span_ids"] = ["x" * 129]
    assert not rejected_selection_is_safe(unsafe)
    unsafe = deepcopy(valid); unsafe["coverage"][0]["extra"] = "private"
    assert not rejected_selection_is_safe(unsafe)
    bad_prefix = deepcopy(valid)
    bad_prefix["coverage"][0]["text"] = "Docs do not establish TensorFlow synchronous replication behavior."
    bad_predicate = deepcopy(valid)
    bad_predicate["coverage"][0]["text"] = "The docs here do not establish Agent Platform RAG Engine."
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    mock_cli(monkeypatch, iter([bad_prefix, bad_predicate, valid]))
    distill(prepared, tmp_path / "out", sleeper=lambda _: None, clock=lambda: 100)
    state = json.loads((tmp_path / "out/run-state.json").read_text())
    attempts = state["attempts"][OID]
    assert [a["diagnostic"]["reason"] for a in attempts[:2]] == ["coverage_prefix", "coverage_predicate"]
    assert attempts[0]["coverage_flags"][0]["prefix_valid"] is False
    assert attempts[1]["coverage_flags"][0]["predicate_present"] is False
    for attempt, original in zip(attempts, [bad_prefix, bad_predicate]):
        assert json.loads((tmp_path / "out" / attempt["rejected_selection_path"]).read_text()) == original
    assert len(list((tmp_path / "out").rglob("*.rejected-selection.json"))) == 2



def test_batch_forecasting_is_predicate_but_entity_alone_is_not():
    from scripts.optimize.build_planner_cards import PREDICATE
    assert PREDICATE.search("batch forecasting with Agent Platform AutoML")
    rows = [{"candidate_id": cid, "reason": "The docs do not establish batch forecasting with Agent Platform AutoML."} for cid in ["one", "two", "three"]]
    item = semantic_item(rows)
    choice = semantic_choice(item)
    choice["coverage"][0]["text"] = "The docs here do not establish batch forecasting with Agent Platform AutoML."
    assert render_semantic_selection(choice, item)
    choice["coverage"][0]["text"] = "The docs here do not establish Agent Platform AutoML."
    with pytest.raises(ValueError, match="predicate"):
        render_semantic_selection(choice, item)


def test_changed_input_resume_keeps_frozen_audit_bytes(tmp_path, monkeypatch):
    from copy import deepcopy
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    calls = mock_cli(monkeypatch, iter([semantic_choice(item)]))
    out = tmp_path / "out"
    distill(prepared, out)
    # Even noncanonical JSON formatting must remain unchanged on resume.
    audit = out / "audit.json"
    audit.write_text(json.dumps(prepared, indent=4) + "\n")
    before = audit.read_bytes()
    distill(prepared, out)
    assert audit.read_bytes() == before
    changed = deepcopy(prepared)
    changed["objectives"][OID]["names"] = [{"name_id": "name-other", "text": "Other"}]
    with pytest.raises(ValueError, match="Frozen input"):
        distill(changed, out)
    assert audit.read_bytes() == before and len(calls) == 1


def test_prepare_only_does_not_clobber_run_audit(tmp_path, monkeypatch):
    from scripts.optimize.build_planner_cards import main
    out = tmp_path / "out"; out.mkdir()
    (out / "run-state.json").write_text("{}")
    audit = out / "audit.json"; audit.write_text("original frozen bytes")
    def never_prepare(*args, **kwargs):
        raise AssertionError("prepare must not run")
    monkeypatch.setattr("scripts.optimize.build_planner_cards.prepare", never_prepare)
    with pytest.raises(ValueError, match="Prepare-only"):
        main(["--prepare-only", "--output-dir", str(out)])
    assert audit.read_text() == "original frozen bytes"


def test_missing_cli_still_freezes_audit_bound_to_state(tmp_path, monkeypatch):
    from scripts.optimize.build_planner_cards import sha
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    monkeypatch.setattr("scripts.optimize.build_planner_cards.shutil.which", lambda _: None)
    with pytest.raises(ValueError, match="unavailable"):
        distill(prepared, tmp_path / "out")
    frozen = json.loads((tmp_path / "out/audit.json").read_text())
    state = json.loads((tmp_path / "out/run-state.json").read_text())
    assert frozen == prepared
    assert sha(json.dumps(frozen, sort_keys=True, ensure_ascii=False)) == state["input_sha256"]
    assert state["attempts"] == {} and state["outcomes"] == {}


def test_main_changed_input_cannot_clobber_frozen_audit(tmp_path, monkeypatch):
    from copy import deepcopy
    from scripts.optimize.build_planner_cards import main
    artifact(tmp_path)
    rows, _ = collect_vetoes([tmp_path])
    item = semantic_item(rows)
    prepared = {"version": 1, "cutoff": CUTOFF, "objectives": {OID: item}}
    mock_cli(monkeypatch, iter([semantic_choice(item)]))
    out = tmp_path / "out"
    distill(prepared, out)
    before = (out / "audit.json").read_bytes()
    changed = deepcopy(prepared); changed["cutoff"] = "2026-10-25T00:00:00Z"
    monkeypatch.setattr("scripts.optimize.build_planner_cards.prepare", lambda *args, **kwargs: changed)
    with pytest.raises(ValueError, match="Frozen input"):
        main(["--output-dir", str(out)])
    assert (out / "audit.json").read_bytes() == before
