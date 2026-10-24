from datetime import datetime, timezone
import json
from types import SimpleNamespace
from pathlib import Path

import pytest
from scripts import draft_provenance as provenance


def row(**kwargs):
    return {"id": "legacy", "exam": "GCP_PM_ML_ENG", "status": "DRAFT", "created_at": "2026-10-03T23:59:59Z",
            "generation_run_id": None, "review_status": "UNREVIEWED", "content_sha256": "hash", **kwargs}


def test_exact_cutoff_and_artifact_groups():
    rows = provenance.draft_rows([row(), row(id="new", created_at="2026-10-04T00:00:00Z"), row(id="live",status="ACTIVE")])
    report = provenance.report(rows, {"new"})
    assert report["total_drafts"] == 2
    assert {g["created_bucket"] for g in report["groups"]} == {"before", "on_or_after"}
    assert any(g["local_artifact_exists"] and g["created_bucket"] == "on_or_after" for g in report["groups"])


def test_artifact_lookup_uses_only_persisted_id_links(tmp_path):
    (tmp_path / "machine-learning-engineer-v5-test.json").write_text(json.dumps({"candidates": [{"candidate_id":"not-a-db-id"}, {"inserted_question_id":"persisted"}]}))
    assert provenance.artifact_ids(tmp_path) == {"persisted"}


def test_retire_uses_atomic_guards_and_d025_reason():
    calls = []
    class Client:
        def rpc(self, name, args):
            calls.append((name,args))
            return SimpleNamespace(execute=lambda: SimpleNamespace(data={"question_id":args["p_question_id"], "outcome":"changed", "changed":True, "revision":1, "content_sha256":"a"*64}))
    selected = [row(), row(id="new",created_at=provenance.CUTOFF), row(id="live",status="ACTIVE"), row(id="beta",exam="data-engineer")]
    assert provenance.retire(Client(), selected) == ["legacy"]
    name,args = calls[0]
    assert name == "retire_question" and args["p_reason"] == "D-025 legacy"
    assert args["p_payload"] == {"expected_status":"DRAFT", "expected_exam":"GCP_PM_ML_ENG", "expected_created_before":provenance.CUTOFF}


@pytest.mark.parametrize("response", [None, [], {}, {"changed":True}, {"question_id":"legacy", "changed":False,"outcome":"retired"}])
def test_unknown_rpc_result_stops(response):
    class Client:
        def rpc(self,*_):
            return SimpleNamespace(execute=lambda: SimpleNamespace(data=response))
    with pytest.raises(ValueError):
        provenance.retire(Client(), [row()])


def test_provenance_sql_readonly_no_migration():
    sql = (Path(__file__).parents[1]/"sql/draft_provenance.sql").read_text()
    assert "BEGIN READ ONLY" in sql and "ROLLBACK" in sql
    assert "jsonb_array_elements_text(:'artifact_ids'::jsonb)" in sql
    assert "q.status = 'DRAFT'" in sql


def test_duplicate_and_bad_dates_fail_closed():
    with pytest.raises(ValueError):
        provenance.draft_rows([row(),row()])
    with pytest.raises(ValueError):
        provenance.draft_rows([row(created_at="missing")])


def test_artifacts_do_not_require_historical_filename_pattern(tmp_path):
    (tmp_path/"recovered-artifact.json").write_text(json.dumps({"candidates":[{"inserted_question_id":"saved"}]}))
    assert provenance.artifact_ids(tmp_path) == {"saved"}


def test_missing_artifact_root_does_not_claim_absence(tmp_path):
    with pytest.raises(ValueError):
        provenance.artifact_ids(tmp_path/"absent")


def test_retirement_journal_keeps_success_before_unknown_response(tmp_path):
    path = tmp_path/"retirement.json"
    calls = []
    class Client:
        def rpc(self,name,args):
            calls.append(args["p_question_id"])
            if len(calls) == 1:
                data = {"question_id":"legacy","revision":1,"content_sha256":"a"*64,"changed":True,"outcome":"changed"}
            else:
                data = None
            return SimpleNamespace(execute=lambda:SimpleNamespace(data=data))
    with pytest.raises(ValueError,match="Unknown"):
        provenance.retire(Client(),[row(),row(id="second"),row(id="third")],journal_path=path)
    saved = json.loads(path.read_text())
    assert saved["retired"] == ["legacy"]
    assert saved["status"] == "stopped_reconcile"
    assert [a["status"] for a in saved["attempts"]] == ["retired","unknown"]
    assert calls == ["legacy","second"]
    with pytest.raises(ValueError,match="Existing"):
        provenance.retire(Client(),[row(id="third")],journal_path=path)
    assert calls == ["legacy","second"]


def test_rpc_sql_outcome_contract_is_changed_not_action_name():
    sql = (Path(__file__).parents[2]/"supabase/migrations/20261025100000_pipeline_v6_publication.sql").read_text()
    assert "v_outcome TEXT := 'changed'" in sql
    assert "'changed',v_changed,'outcome',v_outcome" in sql
