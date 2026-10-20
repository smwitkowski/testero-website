"""Offline saved-system-failure resume safety; synthetic outputs are not quality proof."""
from copy import deepcopy
import json
from unittest.mock import Mock

import click
from httpx import ReadTimeout
import pytest

from scripts import generate_pmle_questions as generate
from scripts import ingest_external_verdicts as ingest
from test_pde_pipeline_integration import harness, save_verdicts, distinct_specs, SOURCE
from test_pde_recovery import fake_client


def saved_timeout_case(harness, *, only_timeout=False):
    run, _, search, _ = harness
    search.side_effect = [ReadTimeout("synthetic-private-provider-body"), [deepcopy(SOURCE)], [deepcopy(SOURCE)]]
    specs = None if only_timeout else distinct_specs()
    path, payload, result, _, _ = run(specs)
    assert result.exit_code == 1
    failed = payload["candidates"][0]
    assert failed["failure_stage"] == "documentation" and failed["error_class"] == "ReadTimeout"
    assert generate.is_quality_rejection(failed) is False
    assert generate.is_acknowledgeable_system_failure(failed) is True
    directory = save_verdicts(path, payload)
    return path, payload, directory, failed["candidate_id"]


def acknowledge(path, directory, ident, **kwargs):
    return ingest.ingest(path, directory, continue_quality_rejections=True,
                         acknowledged_system_failure_ids=[ident], **kwargs)


@pytest.mark.parametrize("strict", [False, True])
def test_saved_timeout_remains_fatal_without_explicit_acknowledgment(harness, strict):
    path, _, directory, _ = saved_timeout_case(harness)
    before = path.read_bytes()
    with pytest.raises(click.ClickException):
        ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=strict)
    if strict:
        assert path.read_bytes() == before
    harness[1].assert_not_called()


def test_explicit_saved_timeout_stays_rejected_while_good_rows_are_selected(harness, capsys):
    path, payload, directory, ident = saved_timeout_case(harness)
    original = deepcopy(payload["candidates"][0])
    assert ingest.saved_system_failure_ids(payload) == frozenset({ident})
    assert ingest.validate_acknowledged_system_failures(payload, [ident]) == frozenset({ident})
    result = acknowledge(path, directory, ident, dry_run=True)
    assert len(result["selected_candidates"]) == 2
    assert ident not in {row["id"] for row in result["selected_candidates"]}
    assert result["quality_rejections"]["count"] == 0
    assert result["acknowledged_system_failures"] == {"count": 1, "candidates": [
        {"candidate_id": ident, "stage": "documentation", "error_class": "ReadTimeout"}]}
    saved = json.loads(path.read_text())["candidates"][0]
    assert saved == original
    assert not saved["accepted"] and "external_judge_request" not in saved
    assert "synthetic-private-provider-body" not in capsys.readouterr().out
    # A second replay still needs the same explicit acknowledgment.
    with pytest.raises(click.ClickException, match="preflight"):
        ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True)
    harness[1].assert_not_called()


def test_acknowledged_timeout_alone_returns_empty_retryable_selection(harness):
    path, _, directory, ident = saved_timeout_case(harness, only_timeout=True)
    result = acknowledge(path, directory, ident, dry_run=True)
    assert result["selected_candidates"] == []
    assert result["quality_rejections"]["count"] == 0
    assert result["acknowledged_system_failures"]["count"] == 1
    harness[1].assert_not_called()


def test_mock_write_never_inserts_acknowledged_failure(harness, monkeypatch):
    path, _, directory, ident = saved_timeout_case(harness)
    dry = acknowledge(path, directory, ident, dry_run=True)
    ids = [row["id"] for row in dry["selected_candidates"]]
    client = fake_client()
    monkeypatch.setattr(ingest, "database_client", Mock(return_value=client))
    result = acknowledge(path, directory, ident, expected_selected_ids=ids)
    assert result["complete"] == 2
    assert {call.args[0]["id"] for call in client.insert_question.call_args_list} == set(ids)
    assert ident not in ids
    failed = json.loads(path.read_text())["candidates"][0]
    assert failed["accepted"] is False and "persistence_status" not in failed
    # Completed journal replay validates stored strict PASS and does not reinsert.
    acknowledge(path, directory, ident, expected_selected_ids=[])
    assert client.insert_question.call_count == 2


@pytest.mark.parametrize("bad_ids", ["one-id", [True], ["unknown"], [""], None, ["same", "same"]])
def test_invalid_acknowledgment_ids_fail_before_writes(harness, bad_ids):
    path, _, directory, _ = saved_timeout_case(harness)
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="Acknowledged"):
        ingest.ingest(path, directory, continue_quality_rejections=True,
                     acknowledged_system_failure_ids=bad_ids)
    assert path.read_bytes() == before
    harness[1].assert_not_called()


def test_acknowledgment_requires_strict_quality_continuation(harness):
    path, _, directory, ident = saved_timeout_case(harness)
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="requires strict"):
        ingest.ingest(path, directory, dry_run=True, acknowledged_system_failure_ids=[ident])
    assert path.read_bytes() == before
    harness[1].assert_not_called()


@pytest.mark.parametrize("damage", [
    {"awaiting_external_judge": True}, {"external_judge_request": None},
    {"external_verdict": {}}, {"external_judge_provenance": "external"},
    {"persistence_status": "unknown"}, {"inserted_question_id": "foreign"},
    {"persistence_validation_failed": False}, {"accepted": True}, {"status": "external_judge_rejected"},
    {"error_class": "ValueError"}, {"error_class": "CandidateRejected"},
    {"failure_stage": "schema"}, {"failure_stage": "external_request"},
    {"failure_stage": "external_verdict"}, {"failure_stage": "persistence"},
    {"failure_stage": "mechanical"}, {"sources": []}, {"stem": "Written content"},
    {"decision_attempts": []}, {"judge_verdict": {"passed": True}},
])
def test_acknowledgment_cannot_relabel_judged_or_local_integrity_failures(harness, damage):
    path, payload, directory, ident = saved_timeout_case(harness)
    payload["candidates"][0].update(damage)
    path.write_text(json.dumps(payload))
    before = path.read_bytes()
    assert ingest.saved_system_failure_ids(payload) == frozenset()
    with pytest.raises(click.ClickException, match="Acknowledged"):
        acknowledge(path, directory, ident, dry_run=True)
    assert path.read_bytes() == before
    harness[1].assert_not_called()


@pytest.mark.parametrize("state", ["awaiting", "judged", "quality_veto"])
def test_other_candidate_ids_never_qualify(harness, state):
    path, payload, directory, _ = saved_timeout_case(harness)
    other = payload["candidates"][1]
    if state == "judged":
        other.update(awaiting_external_judge=False, judge_verdict={"passed": False, "score": 0, "reason": "FAIL", "model": "external"})
    elif state == "quality_veto":
        other.pop("external_judge_request")
        other.update(awaiting_external_judge=False, error_class="CandidateRejected", failure_stage="schema")
    path.write_text(json.dumps(payload))
    with pytest.raises(click.ClickException, match="Acknowledged"):
        acknowledge(path, directory, other["candidate_id"], dry_run=True)
    harness[1].assert_not_called()


@pytest.mark.parametrize("damage", ["request", "missing_verdict", "verdict_schema", "source", "journal", "scope", "batch_stop"])
def test_acknowledged_failure_never_bypasses_other_candidates_strict_gates(harness, damage):
    path, payload, directory, ident = saved_timeout_case(harness)
    other = payload["candidates"][1]
    verdict_path = directory / (other["candidate_id"] + ".json")
    if damage == "request": other["external_judge_request"]["sha256"] = "0" * 64
    elif damage == "missing_verdict": verdict_path.unlink()
    elif damage == "verdict_schema": verdict_path.write_text("{}")
    elif damage == "source": other["sources"][0]["text"] += "tampered"
    elif damage == "journal": other["persistence_status"] = "unknown"
    elif damage == "scope": other["objective_id"] = "foreign-objective"
    else: payload["batch_stop"] = {"error_class": "CLIAuthError", "index": 1}
    path.write_text(json.dumps(payload))
    before = path.read_bytes()
    with pytest.raises(click.ClickException):
        acknowledge(path, directory, ident, dry_run=True)
    assert path.read_bytes() == before
    harness[1].assert_not_called()


@pytest.mark.parametrize("stage", ["report_exception", "report_blocker", "flush_exception"])
def test_acknowledged_failure_does_not_bypass_report_or_disk_failures(harness, monkeypatch, stage):
    path, _, directory, ident = saved_timeout_case(harness)
    if stage == "report_exception":
        monkeypatch.setattr(ingest, "option_length_report", Mock(side_effect=RuntimeError("Synthetic report failure")))
        expected = RuntimeError
    elif stage == "report_blocker":
        monkeypatch.setattr(ingest, "template_diversity_report", lambda rows: {"passed": False})
        expected = click.ClickException
    else:
        monkeypatch.setattr(ingest, "_flush", Mock(side_effect=OSError("Synthetic flush failure")))
        expected = OSError
    with pytest.raises(expected):
        acknowledge(path, directory, ident)
    harness[1].assert_not_called()


def test_retained_prior_documentation_does_not_disguise_the_later_search_timeout(harness):
    path, payload, directory, ident = saved_timeout_case(harness)
    failed = payload["candidates"][0]
    prior = deepcopy(failed["decision_attempts"][0])
    prior.update(sources=[deepcopy(SOURCE)], proof={"passed": False, "reason": "Prior decision veto"})
    failed["decision_attempts"].insert(0, prior)
    failed["sources"] = deepcopy(prior["sources"])
    path.write_text(json.dumps(payload))
    assert generate.is_acknowledgeable_system_failure(failed)
    result = acknowledge(path, directory, ident, dry_run=True)
    assert len(result["selected_candidates"]) == 2
    assert json.loads(path.read_text())["candidates"][0] == failed
    failed["sources"][0]["text"] += "unmatched tampering"
    assert generate.is_acknowledgeable_system_failure(failed) is False
    harness[1].assert_not_called()


def test_safe_generation_diagnostic_counts_system_errors_without_provider_bodies(harness):
    run, _, search, _ = harness
    search.side_effect = ReadTimeout("never-print-this-provider-body")
    _, payload, result, _, _ = run()
    assert result.exit_code == 1
    assert "quality vetoes=0; system errors=1" in result.output
    assert '"failure_stage": "documentation"' in result.output
    assert '"error_class": "ReadTimeout"' in result.output
    assert payload["candidates"][0]["candidate_id"] in result.output
    assert "never-print-this-provider-body" not in result.output
    assert generate.is_quality_rejection(payload["candidates"][0]) is False


def test_failure_diagnostics_are_bounded_categorical_only():
    bad = {"candidate_id": "provider body", "failure_stage": "provider body", "error_class": "bad class body"}
    report = generate.generation_failure_summary([bad] * 25)
    assert report == {"quality_vetoes": 0, "system_errors": 25, "omitted": 5,
                      "candidates": [{"candidate_id": "unknown", "failure_stage": "unknown", "error_class": "unknown"}] * 20}


@pytest.mark.parametrize("damage", [None, "extra", "missing", "digest", "body", "symlink", "candidate_scope"])
def test_saved_request_only_preflight_runs_native_proofs_without_verdicts(harness, damage):
    path, payload, directory, _ = saved_timeout_case(harness)
    for verdict in directory.iterdir():
        verdict.unlink()
    request = path.parent / payload["candidates"][1]["external_judge_request"]["path"]
    if damage == "extra": (request.parent / "extra.json").write_text("{}")
    elif damage == "missing": request.unlink()
    elif damage == "digest": payload["candidates"][1]["external_judge_request"]["sha256"] = "0" * 64
    elif damage == "body": request.write_text("{}")
    elif damage == "symlink":
        linked = path.parent / "copied.json"
        linked.write_bytes(request.read_bytes())
        request.unlink()
        request.symlink_to(linked)
    elif damage == "candidate_scope": payload["candidates"][0]["objective_id"] = "foreign"
    if damage:
        with pytest.raises(ValueError, match="Saved judge requests"):
            ingest.validate_saved_judge_requests(path, payload)
    else:
        assert ingest.validate_saved_judge_requests(path, payload) is None
    harness[1].assert_not_called()


@pytest.mark.parametrize("sidecar", ["normal", "foreign_file", "bad_registry", "duplicate_registry", "outside_registry", "symlink_lock", "directory_lock"])
def test_saved_request_preflight_validates_only_known_runner_sidecars(harness, sidecar):
    path, payload, _, _ = saved_timeout_case(harness)
    requests = path.with_suffix(".judge-requests")
    lock = requests / ".judge-requests.lock"
    registry = requests / ".verdict-directories.json"
    lock.touch()
    registry.write_text(json.dumps({"version": 1, "directories": [str(path.with_suffix(".verdicts"))]}))
    if sidecar == "foreign_file": (requests / ".unexpected").touch()
    elif sidecar == "bad_registry": registry.write_text("{}")
    elif sidecar == "duplicate_registry": registry.write_text(json.dumps({"version": 1, "directories": [str(path.parent)] * 2}))
    elif sidecar == "outside_registry": registry.write_text(json.dumps({"version": 1, "directories": [str(path.parent.parent)]}))
    elif sidecar == "symlink_lock":
        lock.unlink()
        lock.symlink_to(path)
    elif sidecar == "directory_lock":
        lock.unlink()
        lock.mkdir()
    if sidecar == "normal":
        assert ingest.validate_saved_judge_requests(path, payload) is None
    else:
        with pytest.raises(ValueError, match="Saved judge requests"):
            ingest.validate_saved_judge_requests(path, payload)
    harness[1].assert_not_called()


@pytest.mark.parametrize("damage", ["no_ack", "schema_error", "report_error", "unknown", "batch_stop", "scope"])
def test_saved_generation_preflight_stops_unknown_or_unacknowledged_errors(harness, damage):
    _, payload, _, ident = saved_timeout_case(harness)
    ids = [ident]
    if damage == "no_ack": ids = []
    elif damage == "schema_error": payload["candidates"][0].update(failure_stage="schema", error_class="ValueError")
    elif damage == "report_error": payload["candidates"][0].update(failure_stage="report", error_class="RuntimeError")
    elif damage == "unknown": payload["candidates"][0]["error_class"] = "UnknownSystemError"
    elif damage == "batch_stop": payload["batch_stop"] = {"error_class": "CLIAuthError"}
    elif damage == "scope": payload["candidates"][0]["objective_id"] = "foreign"
    with pytest.raises(ValueError):
        ingest.validate_saved_generation_failures(payload, ids)
    harness[1].assert_not_called()


def test_saved_generation_preflight_with_exact_ack_has_no_side_effects(harness):
    _, payload, _, ident = saved_timeout_case(harness)
    before = deepcopy(payload)
    assert ingest.validate_saved_generation_failures(payload, [ident]) is None
    assert payload == before
    assert ingest.saved_generation_system_failures(payload) == [
        {"candidate_id": ident, "failure_stage": "documentation", "error_class": "ReadTimeout"}]
    harness[1].assert_not_called()
