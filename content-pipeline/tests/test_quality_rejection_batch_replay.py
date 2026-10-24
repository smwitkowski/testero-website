"""Recorded pilot replay. All model/service stages and DRAFT writes are local fakes."""
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import ingest_external_verdicts as ingest
from scripts import pipeline_nightly as nightly
from scripts import run_domain_batch as batch
from shared.external_judge import build_request, candidate_question, canonical_sha256
from test_pde_recovery import fake_client

FIXTURE = Path(__file__).parent / "fixtures/v6_mixed_pilot.json"


def stage_pilot(artifact, *, missing=False):
    """Rebuild request hashes after reducing the pilot's pages to cited quotes."""
    recorded = json.loads(FIXTURE.read_text())
    payload = deepcopy(recorded["artifact"])
    requests, verdicts = artifact.with_suffix(".judge-requests"), artifact.with_suffix(".verdicts")
    requests.mkdir(parents=True)
    verdicts.mkdir()
    for entry in payload["candidates"]:
        if not entry.get("awaiting_external_judge"):
            continue
        scope = payload["plan"][entry["index"] - 1]
        checked = ingest.check_evidence(ingest.canonical_evidence(entry), entry["sources"])
        assert checked["passed"], checked
        request = build_request(entry["candidate_id"], scope, candidate_question(entry),
                                entry["sources"], checked["options"],
                                doc_context_chars=payload["documentation_context_policy"]["max_chars"],
                                gate_version=payload["rules_version"], argon_gate=True,
                                execution_policy=payload["execution_policy"])
        request_path = requests / (entry["candidate_id"] + ".json")
        request_path.write_text(json.dumps(request))
        entry["external_judge_request"] = {
            "path": str(request_path.relative_to(artifact.parent)),
            "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest(),
        }
        raw = recorded["verdicts"][entry["candidate_id"]]
        if raw["argon"].get("version"):
            raw["argon"]["request_sha256"] = canonical_sha256(request["argon"])
        if not (missing and entry["index"] == 2):
            (verdicts / request_path.name).write_text(json.dumps(raw))
    artifact.write_text(json.dumps(payload))
    return payload, verdicts


@pytest.fixture
def replay(monkeypatch, tmp_path):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://fixture.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    monkeypatch.delenv("N", raising=False)
    monkeypatch.delenv("TESTERO_NIGHTLY_CONFIG", raising=False)
    monkeypatch.setattr(batch, "export_questions", Mock(return_value=0))
    client = fake_client()
    factory = Mock(return_value=client)
    monkeypatch.setattr(ingest, "database_client", factory)
    commands, ingestion_results = [], []
    state = {"missing": False}

    def execute(command, **kwargs):
        commands.append(command)
        if command[1] == "scripts/generate_all_domains.py":
            assert "--continue-quality-rejections" in command
            artifact = Path(command[command.index("--artifact") + 1])
            stage_pilot(artifact, missing=state["missing"])
        elif command[1] == "scripts/judge_requests.py":
            pass  # Frozen recorded verdicts replace all model calls.
        elif command[1] == "scripts/ingest_external_verdicts.py":
            result = CliRunner().invoke(ingest.main, command[2:])
            ingestion_results.append(result)
            if result.exit_code:
                raise subprocess.CalledProcessError(result.exit_code, command)
        else:
            pytest.fail("Unexpected external command")

    monkeypatch.setattr(batch.subprocess, "run", execute)
    return client, factory, commands, ingestion_results, state


def test_mixed_pilot_batch_exits_zero_and_records_complete(replay, tmp_path):
    client, factory, commands, results, _ = replay
    result_path = tmp_path / "result.json"
    result = CliRunner().invoke(batch.main, ["all", "mixed", "machine-learning-engineer",
        "--count", "3", "--nightly-result", str(result_path)])
    assert result.exit_code == 0, result.output
    assert results[0].exit_code == 0, results[0].output
    assert json.loads(result_path.read_text()) == {"schema": "nightly-stage-v1", "status": "complete"}
    saved = json.loads((tmp_path / ".cache/generation/machine-learning-engineer-v5-mixed.json").read_text())
    rejected, passed, vetoed = saved["candidates"]
    assert rejected["accepted"] is False and rejected["failure_stage"] == "judge"
    assert passed["accepted"] is True and passed["persistence_status"] == "complete"
    assert vetoed["accepted"] is False and vetoed["failure_stage"] == "decision_veto"
    assert client.insert_question.call_count == factory.call_count == 1
    assert client.insert_question.call_args.args[0]["status"] == "DRAFT"
    assert "--continue-quality-rejections" in commands[-1]
    assert (tmp_path / ".cache/generation/machine-learning-engineer-v5-mixed.accepted-ids").read_text() == passed["inserted_question_id"]


def test_missing_passing_verdict_still_fails_batch_before_database(replay, tmp_path):
    client, factory, _, results, state = replay
    state["missing"] = True
    result_path = tmp_path / "result.json"
    result = CliRunner().invoke(batch.main, ["all", "missing", "machine-learning-engineer",
        "--count", "3", "--nightly-result", str(result_path)])
    assert result.exit_code != 0
    assert results[0].exit_code != 0
    assert "Strict ingestion preflight failed" in results[0].output
    assert json.loads(result_path.read_text())["status"] == "hard_stop"
    factory.assert_not_called()
    client.insert_question.assert_not_called()


def test_blocked_persistence_still_fails_batch(replay, tmp_path):
    client, _, _, results, _ = replay
    client.insert_answers_batch.return_value = []
    result_path = tmp_path / "result.json"
    result = CliRunner().invoke(batch.main, ["all", "blocked", "machine-learning-engineer",
        "--count", "3", "--nightly-result", str(result_path)])
    assert result.exit_code != 0
    assert results[0].exit_code != 0
    assert "blocked 1" in results[0].output
    assert json.loads(result_path.read_text())["status"] == "hard_stop"


def test_ingest_cli_keeps_legacy_rejection_default(tmp_path, monkeypatch):
    artifact = tmp_path / "legacy.json"
    _, verdicts = stage_pilot(artifact)
    factory = Mock(side_effect=AssertionError("Dry-run must not construct a DB client"))
    monkeypatch.setattr(ingest, "database_client", factory)
    result = CliRunner().invoke(ingest.main, ["--artifact", str(artifact), "--verdicts", str(verdicts), "--dry-run"])
    assert result.exit_code != 0
    assert "Some candidates were not persisted" in result.output
    factory.assert_not_called()


@pytest.mark.parametrize("publication_live", [False, True], ids=["shadow", "live-command-only"])
def test_nightly_proceeds_to_publish_after_recorded_quality_outcomes(replay, tmp_path, monkeypatch, publication_live):
    _, _, _, ingestion_results, _ = replay
    now = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
    snapshot = {"complete": True, "captured_at": now.isoformat(), "questions": []}
    planned = {"coverage": [], "batches": [{"cert": "machine-learning-engineer", "section": "all", "count": 3}]}
    monkeypatch.setattr(nightly, "plan", lambda *_a, **_k: planned)
    monkeypatch.setattr(nightly, "PIPELINE", tmp_path)
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: snapshot)
    monkeypatch.setattr(nightly, "publications_today", lambda *_: 0)
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    tools = tmp_path / "tools"
    tools.mkdir()
    if publication_live:
        (tools / "PUBLISH_LIVE").touch()
    seen = []

    def execute(command, output=None):
        seen.append(command)
        if "scripts.run_domain_batch" in command:
            result = CliRunner().invoke(batch.main, command[3:])
            assert result.exit_code == 0, result.output
            return result.exit_code
        if "scripts.publish_batch" in command:
            # Observe dispatch only: neither shadow DB reads nor live writes occur.
            Path(command[command.index("--report") + 1]).write_text(json.dumps({"published": 0, "would_publish": 1}))
        if output:
            Path(output).write_text(json.dumps({"complete": True, "pages": []}))
        return 0

    report = nightly.nightly({"calls_root": str(tmp_path / "calls"), "health_artifacts": ["fake.json"],
        "gold_artifacts": ["fake.json"]}, coverage=snapshot, tools=tools,
        state_dir=tmp_path / "state", now=now, live=True, execute=execute, client=object())
    assert report["status"] == "complete", report
    assert not report.get("publishing_disabled", False)
    publications = [command for command in seen if "scripts.publish_batch" in command]
    assert len(publications) == 1
    assert ("--apply" in publications[0]) is publication_live
    assert ("--read-db" in publications[0]) is not publication_live
    assert ingestion_results[0].exit_code == 0
    batch_result = tmp_path / "state/20261024/night-20261024-1.batch.json"
    assert json.loads(batch_result.read_text())["status"] == "complete"
