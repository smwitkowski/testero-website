"""Frozen smoke3 artifacts plus synthetic call failures; never live models/DB."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest
from scripts import judge_requests as runner, ingest_external_verdicts as ingest
from shared import argon_gate, cli_models
from shared.external_judge import candidate_question
from shared.near_duplicates import check_near_duplicate
from shared.option_order import canonical_evidence
from shared.gates import STYLE_CHECKS, EVIDENCE_CHECKS
from test_decision_first_v4 import pipeline
from scripts import generate_pmle_questions as generate

FIXTURES = Path(__file__).parent / "fixtures"
REQUEST = json.loads((FIXTURES / "v5-smoke3-argon-request.json").read_text())
IDENT = REQUEST["candidate_id"]


def outputs():
    return {
        "claude.blind_solver": {"verdict": "PASS", "choice": "A", "confidence": .9, "ambiguous_answers": False, "reason": "Synthetic blind output"},
        "claude.evidence": {"verdict": "PASS", "score": .9, "reason": "Synthetic evidence output", **{k: True for k in EVIDENCE_CHECKS}},
        "claude.style": {"verdict": "PASS", "score": .9, "reason": "Synthetic style output", **{k: True for k in STYLE_CHECKS}, "generic_validation_key": False},
        "argon.blind": {"verdict": "PASS", "choice": "A", "confidence": .9, "ambiguous_answers": False, "reason": "Synthetic blind output"},
        "argon.review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False, "issues": [], "fix": "No changes needed"},
    }


@pytest.mark.parametrize("failed_call", ["claude.blind_solver", "claude.evidence", "claude.style", "argon.blind", "argon.review"])
def test_recorded_request_subcall_failure_and_candidate_only_resume(monkeypatch, tmp_path, failed_call, capsys):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir(); verdicts.mkdir()
    raw_bytes = (FIXTURES / "v5-smoke3-argon-request.json").read_bytes()
    (requests / (IDENT + ".json")).write_bytes(raw_bytes)
    other = deepcopy(REQUEST); other["candidate_id"] = "other-completed"
    (requests / "other-completed.json").write_text(json.dumps(other))
    completed_bytes = b'{"immutable": "existing verdict"}\n'
    (verdicts / "other-completed.json").write_bytes(completed_bytes)
    calls = []
    replay = outputs()
    fail = True
    def call(name):
        calls.append(name)
        if fail and name == failed_call:
            raise RuntimeError("SECRET provider body Bearer sensitive sk-sensitive prompt echoed")
        return replay[name]
    def claude(model, prompt, schema):
        name = next(k for k,v in REQUEST["gates"].items() if v["judge_prompt"] == prompt)
        assert schema == REQUEST["gates"][name]["verdict_schema"]
        return call("claude." + name)
    def argon(name, gate):
        assert gate == REQUEST["argon"]["calls"][name]
        return call("argon." + name)
    monkeypatch.setattr(cli_models, "run_claude_request", claude)
    monkeypatch.setattr(argon_gate, "run_call", argon)
    summary = runner.run_requests(requests, verdicts, argon_gate=True, parallel=1)
    assert summary.failed == 1 and summary.skipped == 1 and summary.completed == 0
    failure_path = verdicts / ".failures" / (IDENT + ".json")
    record = json.loads(failure_path.read_text())
    assert record["sub_call"] == failed_call and record["error_class"] == "RuntimeError"
    assert record["request_sha256"] == hashlib.sha256(raw_bytes).hexdigest()
    assert failed_call in record["message"]
    assert "SECRET" not in failure_path.read_text() + capsys.readouterr().out
    assert not (verdicts / (IDENT + ".json")).exists()
    # Retry all subcalls of only the failed candidate, never rerun a completed one.
    fail = False; calls.clear()
    result = CliRunner().invoke(runner.main, ["--requests", str(requests), "--verdicts", str(verdicts),
            "--argon-gate", "--candidate-id", IDENT, "--parallel", "1"])
    assert result.exit_code == 0, result.output
    assert calls == ["claude.blind_solver", "claude.style", "claude.evidence", "argon.blind", "argon.review"]
    assert not failure_path.exists()
    assert (verdicts / "other-completed.json").read_bytes() == completed_bytes
    saved = json.loads((verdicts / (IDENT + ".json")).read_text())
    assert saved["argon"]["request_sha256"]
    assert runner.run_requests(requests, verdicts, argon_gate=True).skipped == 2
    assert len(calls) == 5


def test_recorded_generation_rejects_keep_true_stage_at_ingest(monkeypatch, tmp_path):
    recorded = json.loads((FIXTURES / "v5-smoke3-candidate-failures.json").read_text())
    payload = recorded["payload"]
    payload["candidates"] = recorded["candidates"]
    candidate = next(row for row in payload["candidates"] if row["index"] == 3)
    assert candidate["decision_proof"]["passed"] is True
    duplicate = check_near_duplicate(candidate, payload["existing_questions"]["questions"])
    assert duplicate["passed"] is False
    assert duplicate["matches"][0]["score"] == .25
    assert candidate_question(candidate) and canonical_evidence(candidate)
    artifact = tmp_path / "batch.json"; artifact.write_text(json.dumps(payload))
    verdicts = tmp_path / "verdicts"; verdicts.mkdir()
    monkeypatch.setattr(ingest, "database_client", Mock(side_effect=AssertionError("No DB")))
    result = CliRunner().invoke(ingest.main, ["--artifact", str(artifact), "--verdicts", str(verdicts), "--dry-run"])
    assert result.exit_code == 1 and "No passing candidates" in result.output
    saved = json.loads(artifact.read_text())
    assert [row["failure_stage"] for row in saved["candidates"]] == ["decision_veto", "near_duplicate", "decision_veto", "decision_veto"]
    assert all(row["error_class"] and row["error_message"] == row["reason"] for row in saved["candidates"])
    assert saved["candidates"][1]["near_duplicate_check"] == duplicate
    before = deepcopy(saved["candidates"])
    CliRunner().invoke(ingest.main, ["--artifact", str(artifact), "--verdicts", str(verdicts), "--dry-run"])
    assert json.loads(artifact.read_text())["candidates"] == before


def test_generation_veto_records_specific_safe_message(pipeline, monkeypatch):
    events, path, invoke = pipeline
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: {"passed": False,
        "reason": "Unsupported capability", "mechanical_check": {"passed": False, "errors": []}})
    # Distinct plans allow the actual two-attempt veto branch.
    original = generate.plan_decision; count = 0
    def planned(*a, **kw):
        nonlocal count
        plan = original(*a, **kw); count += 1
        return {**plan, "engineering_decision": "Decision " + str(count)}
    monkeypatch.setattr(generate, "plan_decision", planned)
    result = invoke()
    assert result.exit_code == 1
    row = json.loads((path / "batch.json").read_text())["candidates"][0]
    assert row["failure_stage"] == "decision_veto" and row["error_class"] == "DecisionVetoError"
    assert "Unsupported capability" in row["error_message"] and row["error_message"] == row["reason"]


def test_invalid_candidate_selection_calls_no_backend(monkeypatch, tmp_path):
    requests = tmp_path / "requests"; requests.mkdir()
    monkeypatch.setattr(cli_models, "run_claude_request", Mock(side_effect=AssertionError("No calls")))
    result = CliRunner().invoke(runner.main, ["--requests", str(requests), "--verdicts", str(tmp_path / "verdicts"), "--candidate-id", "missing"])
    assert result.exit_code == 1 and "no frozen request" in result.output


from test_external_ingest import case, invoke, save_input, saved


def test_ingest_records_local_validation_class_stage_and_message(case):
    entry = case[2]["candidates"][0]
    entry["external_judge_request"]["sha256"] = "a" * 64
    save_input(case)
    result = invoke(case, "--dry-run")
    assert result.exit_code == 1
    record = saved(case)["candidates"][0]
    assert record["failure_stage"] == "external_request"
    assert record["error_class"] == "ValueError"
    assert record["error_message"] == "External judge request hash mismatch"
    case[4].assert_not_called()


def test_truncated_argon_review_records_subcall_without_body(monkeypatch, tmp_path):
    from shared.llm_limits import MaxTokensTruncation
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    (requests / (IDENT + ".json")).write_text(json.dumps(REQUEST))
    replay = outputs()
    monkeypatch.setattr(cli_models, "run_claude_request", lambda model, prompt, schema:
        replay["claude." + next(k for k,v in REQUEST["gates"].items() if v["judge_prompt"] == prompt)])
    def call(name, gate):
        if name == "review":
            raise MaxTokensTruncation({"raw_response": "SECRET provider completion"})
        return replay["argon.blind"]
    monkeypatch.setattr(argon_gate, "run_call", call)
    assert runner.run_requests(requests, verdicts, argon_gate=True).failed == 1
    record = json.loads((verdicts / ".failures" / (IDENT + ".json")).read_text())
    assert record["sub_call"] == "argon.review"
    assert record["error_class"] == "MaxTokensTruncation"
    assert record["message"] == "argon.review: LM completion reached its token limit"
    assert "SECRET" not in json.dumps(record)


def test_publication_failure_remains_resumable(monkeypatch, tmp_path):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    (requests / (IDENT + ".json")).write_text(json.dumps(REQUEST))
    replay = outputs()
    monkeypatch.setattr(cli_models, "run_claude_request", lambda model, prompt, schema:
        replay["claude." + next(k for k,v in REQUEST["gates"].items() if v["judge_prompt"] == prompt)])
    monkeypatch.setattr(argon_gate, "run_call", lambda name, gate: replay["argon." + name])
    publish = runner._publish
    def failed(path, payload, **kwargs):
        if path == verdicts / (IDENT + ".json"):
            raise OSError("SECRET storage error")
        return publish(path, payload, **kwargs)
    monkeypatch.setattr(runner, "_publish", failed)
    assert runner.run_requests(requests, verdicts, argon_gate=True).failed == 1
    record = json.loads((verdicts / ".failures" / (IDENT + ".json")).read_text())
    assert record["sub_call"] == "verdict_publication" and record["error_class"] == "OSError"
    assert "SECRET" not in json.dumps(record)
    monkeypatch.setattr(runner, "_publish", publish)
    assert runner.run_requests(requests, verdicts, argon_gate=True, candidate_ids=(IDENT,)).completed == 1
