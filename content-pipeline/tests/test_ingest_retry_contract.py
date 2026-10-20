"""Offline retry admission contracts; synthetic verdicts are not model-quality proof."""
from copy import deepcopy
import hashlib
import json
from unittest.mock import Mock

import click
import pytest

from scripts import ingest_external_verdicts as ingest
from shared.cert_context import plan_questions
from shared.cert_generation_policy import select_publication_products, generation_policy
from shared.external_judge import candidate_question, canonical_sha256
from shared.near_duplicates import comparison_row
from shared.option_order import balanced_order
from test_external_ingest import case, save_input
from test_pde_pipeline_integration import harness, save_verdicts, distinct_specs
from test_pde_recovery import fake_client


def setup(harness, specs=None, flags=()):
    path, payload, result, _, _ = harness[0](specs, flags=flags)
    assert result.exit_code == 0, result.output
    return path, payload, save_verdicts(path, payload)


def write_verdict(directory, entry, change):
    path = directory / (entry["candidate_id"] + ".json")
    raw = json.loads(path.read_text())
    change(raw)
    path.write_text(json.dumps(raw))


@pytest.mark.parametrize("gate", ["style", "evidence", "blind_solver"])
def test_all_quality_rejected_returns_empty_without_database(harness, gate):
    path, payload, directory = setup(harness)
    write_verdict(directory, payload["candidates"][0], lambda raw: raw[gate].update(verdict="FAIL"))
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert result["selected_candidates"] == []
    assert result["quality_rejections"]["count"] == 1
    assert result["quality_rejections"]["by_stage"] == {"judge": 1}
    harness[1].assert_not_called()


def test_legacy_default_still_raises_on_ordinary_quality_rejection(harness):
    path, payload, directory = setup(harness)
    write_verdict(directory, payload["candidates"][0], lambda raw: raw["style"].update(verdict="FAIL"))
    with pytest.raises(click.ClickException):
        ingest.ingest(path, directory, dry_run=True)
    harness[1].assert_not_called()


def test_quality_failure_does_not_block_other_accepted_rows(harness, monkeypatch):
    path, payload, directory = setup(harness, distinct_specs())
    failed = payload["candidates"][1]
    write_verdict(directory, failed, lambda raw: raw["evidence"].update(verdict="FAIL"))
    client = fake_client()
    factory = Mock(return_value=client)
    monkeypatch.setattr(ingest, "database_client", factory)
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert len(result["selected_candidates"]) == 2
    assert result["complete"] == 2 and result["quality_rejections"]["count"] == 1
    assert client.insert_question.call_count == 2
    assert failed["candidate_id"] not in [row["id"] for row in result["selected_candidates"]]
    assert all(call.args[0]["status"] == "DRAFT" for call in client.insert_question.call_args_list)


@pytest.mark.parametrize("damage", ["missing", "json", "schema", "request", "source", "journal", "run", "system"])
def test_bad_candidate_blocks_good_candidates_before_client_or_any_artifact_write(harness, damage):
    path, payload, directory = setup(harness, distinct_specs())
    bad = payload["candidates"][1]
    verdict = directory / (bad["candidate_id"] + ".json")
    if damage == "missing": verdict.unlink()
    elif damage == "json": verdict.write_text("{")
    elif damage == "schema": write_verdict(directory, bad, lambda raw: raw["style"].pop("inference_required"))
    elif damage == "request": bad["external_judge_request"]["sha256"] = "0" * 64
    elif damage == "source": bad["sources"][0]["text"] += "changed"
    elif damage == "journal": bad["persistence_status"] = "unknown"
    elif damage == "run": payload["external_run_journal"] = {"foreign": {"status": "unknown"}}
    else:
        bad.pop("external_judge_request")
        bad["awaiting_external_judge"] = False
        bad.update(failure_stage="mechanical", error_class="OSError", reason="Synthetic failure")
        bad["mechanical_check"] = {"passed": False, "errors": ["Synthetic failure"]}
    path.write_text(json.dumps(payload))
    before = path.read_bytes()
    with pytest.raises(click.ClickException):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()
    assert path.read_bytes() == before


def test_duplicate_does_not_hide_missing_or_malformed_verdict(harness, monkeypatch):
    path, payload, directory = setup(harness)
    monkeypatch.setattr(ingest, "check_near_duplicate", lambda *a, **kw: {"passed": False, "reason": "Duplicate"})
    (directory / (payload["candidates"][0]["candidate_id"] + ".json")).unlink()
    with pytest.raises(click.ClickException, match="preflight"):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


@pytest.mark.parametrize("gate", ["near_duplicate", "answer_pattern"])
def test_valid_duplicate_is_quality_only(harness, monkeypatch, gate):
    path, _, directory = setup(harness)
    function = "check_near_duplicate" if gate == "near_duplicate" else "check_answer_pattern"
    original = getattr(ingest, function)
    def check(candidate, bank, **kwargs):
        if candidate.get("candidate_id"):
            return {"passed": False, "reason": "Synthetic ordinary duplicate"}
        return original(candidate, bank, **kwargs)
    monkeypatch.setattr(ingest, function, check)
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert result["selected_candidates"] == []
    assert result["quality_rejections"]["by_stage"] == {gate: 1}
    harness[1].assert_not_called()


@pytest.mark.parametrize("stage,check", [("near_duplicate_plan", "near_duplicate_plan_check"),
    ("answer_pattern", "answer_pattern_plan_check"), ("mechanical", "mechanical_check"), ("schema", "schema_check")])
def test_affirmative_generation_quality_failure_is_retryable(harness, stage, check):
    path, payload, directory = setup(harness)
    entry = payload["candidates"][0]
    entry.pop("external_judge_request")
    entry.update(awaiting_external_judge=False, failure_stage=stage, reason="Synthetic quality veto", error_class="CandidateRejected")
    entry[check] = {"passed": False, "errors": [] if stage == "answer_pattern" else ["Synthetic quality veto"]}
    if stage == "mechanical": entry["citation_attempts"] = [{"mechanical_check": entry[check]}]
    path.write_text(json.dumps(payload))
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert result["selected_candidates"] == []
    assert result["quality_rejections"]["by_stage"] == {stage: 1}
    harness[1].assert_not_called()


def test_decision_veto_requires_affirmative_failed_proof(harness):
    path, payload, directory = setup(harness)
    entry = payload["candidates"][0]
    entry.pop("external_judge_request")
    entry.update(awaiting_external_judge=False, failure_stage="decision_veto", reason="Synthetic veto", error_class="DecisionVetoError",
                 decision_attempts=[{"proof": {"passed": False, "reason": "Synthetic unsupported decision"}}])
    path.write_text(json.dumps(payload))
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert result["quality_rejections"]["by_stage"] == {"decision_veto": 1}
    entry["decision_attempts"][0]["proof"]["passed"] = True
    path.write_text(json.dumps(payload))
    with pytest.raises(click.ClickException, match="preflight"):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


@pytest.mark.parametrize("selection", [[], ["foreign-id"]])
def test_changed_expected_selection_fails_before_client(harness, selection):
    path, _, directory = setup(harness)
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="Selected storage IDs changed"):
        ingest.ingest(path, directory, continue_quality_rejections=True, expected_selected_ids=selection)
    harness[1].assert_not_called()
    assert before == path.read_bytes()


def test_exact_expected_storage_selection_allows_mock_write(harness, monkeypatch):
    path, _, directory = setup(harness)
    selected = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True)["selected_candidates"]
    ids = [row["id"] for row in selected]
    client = fake_client()
    monkeypatch.setattr(ingest, "database_client", Mock(return_value=client))
    result = ingest.ingest(path, directory, continue_quality_rejections=True, expected_selected_ids=ids)
    assert result["complete"] == 1
    assert client.insert_question.call_args.args[0]["id"] == ids[0]


def test_large_original_plan_budget_survives_single_candidate_wave(harness):
    path, payload, directory = setup(harness)
    bank = [{"id": f"bank-{i}", "cert_id": "data-engineer", "stem": "Historical independent processing scenario",
             "key": "Run Dataproc scheduled transformations", "distractors": ["Archive objects in Cloud Storage", "Index Cloud SQL transaction tables", "Create Spanner regional replicas"]} for i in range(16)]
    result = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True, full_plan_count=60, publication_bank=bank)
    assert len(result["selected_candidates"]) == 1
    assert result["product_share_report"]["denominator"] == 60
    assert result["product_share_report"]["max_per_product"] == 24
    harness[1].assert_not_called()


def test_product_cap_all_rejected_remains_retryable(harness):
    path, _, directory = setup(harness)
    bank = [{"id": f"bank-{i}", "cert_id": "data-engineer", "stem": "Historical independent processing scenario",
             "key": "Run Dataproc scheduled transformations", "distractors": ["Archive objects in Cloud Storage", "Index Cloud SQL transaction tables", "Create Spanner regional replicas"]} for i in range(16)]
    result = ingest.ingest(path, directory, continue_quality_rejections=True, publication_bank=bank)
    assert result["selected_candidates"] == [] and result["cap_vetoed"] == 1
    assert result["quality_rejections"]["by_stage"] == {"product_share": 1}
    harness[1].assert_not_called()


def test_batch_report_failure_still_blocks_all_writes(harness, monkeypatch):
    path, _, directory = setup(harness)
    monkeypatch.setattr(ingest, "template_diversity_report", lambda rows: {"passed": False})
    with pytest.raises(click.ClickException, match="batch report failed"):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


def test_report_system_error_still_blocks_all_writes(harness, monkeypatch):
    path, _, directory = setup(harness)
    monkeypatch.setattr(ingest, "option_length_report", Mock(side_effect=RuntimeError("Synthetic report failure")))
    with pytest.raises(RuntimeError, match="Synthetic report failure"):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


def test_artifact_flush_failure_still_blocks_all_writes(harness, monkeypatch):
    path, _, directory = setup(harness)
    monkeypatch.setattr(ingest, "_flush", Mock(side_effect=OSError("Synthetic disk failure")))
    with pytest.raises(OSError): ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


def test_historical_v1_quality_fail_can_continue_offline(case):
    raw = deepcopy(case[5]); raw["verdict"] = "FAIL"
    (case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")).write_text(json.dumps(raw))
    result = ingest.ingest(case[0], case[1], continue_quality_rejections=True)
    assert result["quality_rejections"]["count"] == 1 and result["selected_candidates"] == []
    case[4].assert_not_called()


@pytest.mark.parametrize("count", [0, -1, True, "60", 1.5])
def test_product_selection_rejects_bad_full_plan_count(count):
    with pytest.raises(ValueError, match="positive integer"):
        select_publication_products([], [], full_plan_count=count)


def test_product_selection_full_plan_budget_and_legacy_default():
    rows = [{"id": f"row-{i}", "best_action": "Use BigQuery for analytical processing", "score": .9} for i in range(20)]
    old = select_publication_products(rows, [])
    full = select_publication_products(rows, [], full_plan_count=60)
    assert len(old["selected_indices"]) == 16 and old["report"]["denominator"] == 40
    assert len(full["selected_indices"]) == 20 and full["report"]["denominator"] == 60


def test_retry_scope_reconstructs_original_global_slot_not_local_index():
    full = plan_questions("data-engineer", 60)
    for original in (2, 17, 40, 60):
        scope = full[original - 1]
        payload = {"cert_id": "data-engineer", "plan": [scope], "style_policy_version": scope["style_policy"]["version"],
                   "generation_policy": generation_policy("data-engineer"), "rules_version": 5, "full_plan_count": 60,
                   "retry_slots": [{"plan_slot": original, "attempt": 2}]}
        assert ingest._scope(payload, {**scope, "index": 1}) == scope
        payload["retry_slots"][0]["plan_slot"] = 1
        with pytest.raises(ValueError): ingest._scope(payload, {**scope, "index": 1})


def test_aggregate_balance_report_describes_planned_not_persisted_population(harness):
    path, payload, directory = setup(harness)
    ident = payload["candidates"][0]["candidate_id"]
    population = [ident, *[f"foreign-wave-{i}" for i in range(12)]]
    result = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True,
                           expected_selected_ids=[ident], balance_population_ids=population)
    saved = json.loads(path.read_text())
    assert saved["run_key_position_report"]["count"] == 13
    assert saved["run_key_position_report"]["passed"] is True
    assert saved["run_key_position_report"]["persisted"] is False
    assert saved["key_position_report"]["aggregate_blocker"] is False
    assert result["selected_candidates"][0]["id"] == ident
    harness[1].assert_not_called()


@pytest.mark.parametrize("damage", [False, True])
def test_argon_quality_failure_is_retryable_but_bad_provenance_blocks(harness, damage):
    path, payload, directory = setup(harness, flags=("--argon-gate",))
    entry = payload["candidates"][0]
    request = json.loads((path.parent / entry["external_judge_request"]["path"]).read_text())["argon"]
    from shared.argon_gate import MODEL
    def add_argon(raw):
        raw["argon"] = {"model": MODEL, "version": request["version"],
                        "request_sha256": "0" * 64 if damage else canonical_sha256(request),
                        "review": {"verdict": "REJECT", "key_correct": False, "other_defensible_option": False,
                                   "issues": ["Synthetic independent content defect"], "fix": "Replace the action"}}
    write_verdict(directory, entry, add_argon)
    if damage:
        with pytest.raises(click.ClickException, match="preflight"):
            ingest.ingest(path, directory, continue_quality_rejections=True)
    else:
        result = ingest.ingest(path, directory, continue_quality_rejections=True)
        assert result["selected_candidates"] == [] and result["quality_rejections"]["by_stage"] == {"judge": 1}
    harness[1].assert_not_called()


def test_no_docs_explicit_evidence_veto_is_retryable(harness):
    path, payload, directory = setup(harness)
    entry = payload["candidates"][0]
    entry.pop("external_judge_request")
    entry.update(awaiting_external_judge=False, failure_stage="documentation", error_class="CandidateRejected",
                 decision_attempts=[{"sources": [], "documentation_check": {"passed": False, "reason": "No official documentation"}}])
    path.write_text(json.dumps(payload))
    result = ingest.ingest(path, directory, continue_quality_rejections=True)
    assert result["selected_candidates"] == []
    assert result["quality_rejections"]["by_stage"] == {"documentation": 1}
    harness[1].assert_not_called()


@pytest.mark.parametrize("bad_ids", [["same", "same"], [True], "not-a-list"])
def test_bad_aggregate_population_blocks_before_client(harness, bad_ids):
    path, _, directory = setup(harness)
    with pytest.raises(click.ClickException):
        ingest.ingest(path, directory, continue_quality_rejections=True, balance_population_ids=bad_ids)
    harness[1].assert_not_called()


def test_strict_selection_uses_repair_storage_id_not_repair_candidate_label(harness, monkeypatch):
    # Storage IDs are deliberately a separate interface from candidate labels.
    path, payload, directory = setup(harness)
    original = ingest.candidate_storage_id
    ident = payload["candidates"][0]["candidate_id"]
    def storage(entry, scope, question):
        result = original(entry, scope, question)
        return "stable-storage-id" if result == ident else result
    monkeypatch.setattr(ingest, "candidate_storage_id", storage)
    result = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True,
                           expected_selected_ids=["stable-storage-id"])
    assert result["selected_candidates"][0]["id"] == "stable-storage-id"
    with pytest.raises(click.ClickException, match="Selected storage IDs changed"):
        ingest.ingest(path, directory, continue_quality_rejections=True, expected_selected_ids=[ident])
    harness[1].assert_not_called()


def test_answer_pattern_provenance_error_is_not_ordinary_quality(harness, monkeypatch):
    path, _, directory = setup(harness)
    monkeypatch.setattr(ingest, "check_answer_pattern", lambda *a, **kw:
        {"passed": False, "reason": "Missing comparison provenance", "errors": [{"reason": "Malformed comparison"}]})
    with pytest.raises(click.ClickException, match="integrity"):
        ingest.ingest(path, directory, continue_quality_rejections=True)
    harness[1].assert_not_called()


def test_full_run_balancing_does_not_falsely_block_skewed_wave(harness, monkeypatch):
    from scripts import generate_pmle_questions as generate
    from test_pde_pipeline_integration import LIFECYCLE, question, STEM
    # Deliberately isolate label reporting from repeated-answer gates in this test.
    for module in (generate, ingest):
        monkeypatch.setattr(module, "check_answer_pattern", lambda *a, **kw: {"passed": True})
    nouns = ["supplier", "retailer", "factory", "hospital", "warehouse", "university",
             "distributor", "insurer", "publisher", "bank", "manufacturer", "agency"]
    specs = [(LIFECYCLE, question(stem=STEM.replace("supplier", noun))) for noun in nouns]
    path, payload, directory = setup(harness, specs)
    ids = [entry["candidate_id"] for entry in payload["candidates"]]
    population = [value for ident in ids for value in (ident, ident + "-x1", ident + "-x2", ident + "-x3")]
    result = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True,
                           expected_selected_ids=ids, balance_population_ids=population)
    saved = json.loads(path.read_text())
    assert len(result["selected_candidates"]) == 12
    assert saved["key_position_report"]["passed"] is False
    assert saved["key_position_report"]["aggregate_blocker"] is False
    assert saved["run_key_position_report"]["passed"] is True
    assert saved["run_key_position_report"]["count"] == 48
    harness[1].assert_not_called()
