"""Offline synthetic recovery; saved verdicts are fixtures, not model quality."""
import json
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import recover_pde_candidates as recovery
from scripts import ingest_external_verdicts as ingest
from shared.near_duplicates import comparison_row
from test_pde_pipeline_integration import harness, save_verdicts, distinct_specs, question, LIFECYCLE


def setup_case(harness, monkeypatch):
    run, db, _, tmp = harness
    monkeypatch.setattr(recovery, "PIPELINE", tmp)
    path, payload, result, _, _ = run()
    assert result.exit_code == 0, result.output
    verdicts = save_verdicts(path, payload)
    workspace = tmp / ".cache/generation/recover-test"
    return path, payload, verdicts, workspace, db


def hashes(paths):
    return {str(p): recovery._digest(p) for p in paths if p.is_file() and not p.name.endswith(".lock")}


def test_default_recovery_executes_real_gates_readonly_and_resumes(harness, monkeypatch):
    path, payload, verdicts, workspace, db = setup_case(harness, monkeypatch)
    source_files = [path, *path.with_suffix(".judge-requests").glob("*.json"), *verdicts.glob("*.json")]
    before = hashes(source_files)
    result = recovery.recover([path], workspace)
    assert result["dry_run"] and result["bank_basis"] == "historical_snapshots_dry_run_only"
    assert result["rolling_bank_count"] == 1
    copied = workspace / "1" / path.name
    current = json.loads(copied.read_text())
    assert current["candidates"][0]["publication_selected"] is True
    assert current["candidates"][0]["accepted"] is False
    assert current["existing_questions"] == payload["existing_questions"]
    result2 = recovery.recover([path], workspace)
    assert result2["artifacts"][0]["selected_ids"] == result["artifacts"][0]["selected_ids"]
    assert hashes(source_files) == before
    db.assert_not_called()


def test_cross_artifact_duplicate_cannot_escape_rolling_publication_bank(harness, monkeypatch):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    run = harness[0]
    changed_stem = payload["candidates"][0]["stem"].replace("supplier", "warehouse")
    path2, payload2, result, _, _ = run([(LIFECYCLE, question(stem=changed_stem))])
    assert result.exit_code == 0
    save_verdicts(path2, payload2)
    report = recovery.recover([path, path2], workspace)
    assert [r["selected_count"] for r in report["artifacts"]] == [1, 0]
    assert report["artifacts"][1]["incomplete_candidates"]
    assert report["rolling_bank_count"] == 1
    db.assert_not_called()


def test_request_and_verdict_tampering_fail_before_ingest(harness, monkeypatch):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    recovery.recover([path], workspace)
    request = workspace / "1" / payload["candidates"][0]["external_judge_request"]["path"]
    request.write_text("{}")
    with pytest.raises(ValueError, match="copy changed"):
        recovery.recover([path], workspace)
    db.assert_not_called()


def test_source_input_changed_cannot_resume_existing_workspace(harness, monkeypatch):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    recovery.recover([path], workspace)
    payload["seed"] = 1234
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="inputs changed"):
        recovery.recover([path], workspace)
    db.assert_not_called()


@pytest.mark.parametrize("change", ["unsafe_request", "bad_hash", "partial_journal", "foreign_cert"])
def test_bad_sources_fail_closed(harness, monkeypatch, change):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    entry = payload["candidates"][0]
    if change == "unsafe_request": entry["external_judge_request"]["path"] = "../escape.json"
    elif change == "bad_hash": entry["external_judge_request"]["sha256"] = "0" * 64
    elif change == "partial_journal": entry["persistence_status"] = "unknown"
    else: payload["cert_id"] = "machine-learning-engineer"
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError): recovery.recover([path], workspace)
    assert not workspace.exists()
    db.assert_not_called()


def test_no_source_or_workspace_symlinks(harness, monkeypatch):
    path, _, _, workspace, db = setup_case(harness, monkeypatch)
    linked = path.parent / "linked.json"
    linked.symlink_to(path)
    with pytest.raises(ValueError, match="symlinks"): recovery.recover([linked], workspace)
    with pytest.raises(ValueError, match="workspace"): recovery.recover([path], path.parent / "outside")
    db.assert_not_called()


def test_stale_bank_identity_without_journal_stops_recovery(harness, monkeypatch):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    entry = payload["candidates"][0]
    bank = path.parent / "bank.json"
    bank.write_text(json.dumps([{**entry, "status": "DRAFT"}]))
    with pytest.raises(ValueError, match="without its completed journal"):
        recovery.recover([path], workspace, existing_questions=bank)
    db.assert_not_called()


def fake_client():
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "seeded-domain"}
    client.create_generation_run.side_effect = lambda row: {"id": row["id"]}
    client.insert_question.side_effect = lambda row: {"id": row["id"]}
    client.insert_answers_batch.return_value = [{"id": str(i)} for i in range(4)]
    client.insert_explanation.return_value = {"id": "explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = True
    return client


def test_write_optin_refreshes_bank_reuses_dryrun_and_never_reinserts(harness, monkeypatch):
    path, _, _, workspace, _ = setup_case(harness, monkeypatch)
    recovery.recover([path], workspace)
    monkeypatch.setenv("SUPABASE_URL", "https://fixture.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-not-secret")
    def export(url, key, exam, target):
        target.write_text("[]")
        return 0
    exported = Mock(side_effect=export)
    monkeypatch.setattr(recovery, "export_questions", exported)
    client = fake_client()
    monkeypatch.setattr(ingest, "database_client", Mock(return_value=client))
    report = recovery.recover([path], workspace, write=True)
    assert not report["dry_run"] and report["bank_basis"] == "fresh_coordinator_export"
    assert report["artifacts"][0]["selected_count"] == 1
    assert client.insert_question.call_count == 1
    assert client.insert_question.call_args.args[0]["status"] == "DRAFT"
    recovery.recover([path], workspace, write=True)
    assert client.insert_question.call_count == 1
    assert exported.call_count == 2


def test_write_needs_credentials_default_does_not_export(harness, monkeypatch):
    path, _, _, workspace, db = setup_case(harness, monkeypatch)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    exported = Mock(side_effect=AssertionError("No network"))
    monkeypatch.setattr(recovery, "export_questions", exported)
    recovery.recover([path], workspace)
    with pytest.raises(ValueError, match="credentials"):
        recovery.recover([path], workspace, write=True)
    exported.assert_not_called(); db.assert_not_called()


def test_cli_default_is_offline(harness, monkeypatch):
    path, _, _, workspace, db = setup_case(harness, monkeypatch)
    result = CliRunner().invoke(recovery.main, ["--artifact", str(path), "--workspace", str(workspace)])
    assert result.exit_code == 0, result.output
    assert "dry-run complete" in result.output
    db.assert_not_called()


def test_partial_write_stops_before_any_later_artifact(harness, monkeypatch):
    path, _, _, workspace, _ = setup_case(harness, monkeypatch)
    path2, payload2, result, _, _ = harness[0]()
    assert result.exit_code == 0
    save_verdicts(path2, payload2)
    monkeypatch.setenv("SUPABASE_URL", "https://fixture.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-not-secret")
    monkeypatch.setattr(recovery, "export_questions", lambda u, k, e, p: p.write_text("[]"))
    client = fake_client()
    client.insert_answers_batch.return_value = []
    monkeypatch.setattr(ingest, "database_client", Mock(return_value=client))
    with pytest.raises(ValueError, match="reconciliation"):
        recovery.recover([path, path2], workspace, write=True)
    assert client.insert_question.call_count == 1
    untouched = json.loads((workspace / "2" / path2.name).read_text())
    assert not untouched["candidates"][0].get("publication_selected")


def test_resumed_dryrun_clears_previous_selection_after_new_bank_duplicate(harness, monkeypatch):
    path, payload, _, workspace, db = setup_case(harness, monkeypatch)
    assert recovery.recover([path], workspace)["rolling_bank_count"] == 1
    bank = path.parent / "new-bank.json"
    row = {**payload["candidates"][0], "candidate_id": "separate-existing-bank-item", "status": "DRAFT"}
    bank.write_text(json.dumps([row]))
    report = recovery.recover([path], workspace, existing_questions=bank)
    assert report["artifacts"][0]["selected_count"] == 0
    copied = json.loads((workspace / "1" / path.name).read_text())
    assert copied["candidates"][0]["publication_selected"] is False
    db.assert_not_called()


def test_source_change_during_copy_fails_before_ingest(harness, monkeypatch):
    path, _, _, workspace, db = setup_case(harness, monkeypatch)
    manifest, _, files = recovery._inventory([path])
    path.write_text(path.read_text() + "\n")
    with pytest.raises(ValueError, match="changed while copying"):
        recovery._prepare(workspace, manifest, files)
    assert not (workspace / "sources.json").exists()
    db.assert_not_called()
