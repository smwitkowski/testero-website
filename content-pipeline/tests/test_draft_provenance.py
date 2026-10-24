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
            return SimpleNamespace(execute=lambda: SimpleNamespace(data={"question_id":args["p_question_id"], "outcome":"retired", "changed":True}))
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
