"""Offline never-stop contracts. All model, DB and subprocess outputs are synthetic."""
import hashlib
import json
import subprocess
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate
from scripts import run_domain_batch as batch
from shared.cert_context import load_cert_context
from shared.cli_models import CLIAuthError, CLIUsageLimitError, CodexModelRejectedError
from shared.decision_planner import DecisionVetoError
from test_pde_pipeline_integration import harness, plan, LIFECYCLE, SOURCE, question


@pytest.mark.parametrize("cert", [
    "machine-learning-engineer", "data-engineer", "cloud-engineer", "cloud-architect",
    "cloud-database-engineer", "cloud-developer", "cloud-devops-engineer",
    "cloud-digital-leader", "cloud-network-engineer", "cloud-security-engineer",
    "data-practitioner", "generative-ai-leader", "security-operations-engineer",
    "associate-google-workspace-administrator",
])
def test_quality_continuation_is_available_for_every_plannable_cert(harness, cert, monkeypatch):
    _, db, search, tmp_path = harness
    context = load_cert_context(cert)
    objective = next(obj["objective_id"] for domain in context["domains"].values()
                     for obj in domain["objectives"])
    search.return_value = []
    planner = Mock(side_effect=lambda scope, **kw: plan(scope, LIFECYCLE, "Synthetic frozen decision"))
    writer = Mock(side_effect=AssertionError("No writer after documentation veto"))
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "generate_question", writer)
    artifact = tmp_path / "cross-cert.json"
    result = CliRunner().invoke(generate.main, ["--cert", cert, "--n-questions", "1",
        "--objective", objective, "--continue-quality-rejections", "--model", "codex",
        "--judge-model", "external", "--artifact", str(artifact), "--no-doc-cache"])
    payload = json.loads(artifact.read_text())
    assert result.exit_code == 0, result.output
    candidate = payload["candidates"][0]
    assert candidate["error_class"] == "CandidateRejected"
    assert candidate["failure_stage"] == "documentation"
    assert "system_retries" not in candidate
    assert search.call_count == planner.call_count == 1
    writer.assert_not_called()
    db.assert_not_called()


def test_generator_retries_transport_twice_then_keeps_system_classification(harness):
    run, db, search, _ = harness
    search.side_effect = OSError("synthetic secret-bearing provider message")
    _, payload, result, planner, writer = run(flags=("--continue-quality-rejections",))
    assert result.exit_code == 1
    candidate = payload["candidates"][0]
    assert candidate["error_class"] == "OSError"
    assert not generate.is_quality_rejection(candidate)
    assert len(candidate["system_retries"]) == 2
    assert search.call_count == 3 and planner.call_count == 1
    assert "secret-bearing" not in json.dumps(candidate)
    writer.assert_not_called()
    db.assert_not_called()


def test_system_retry_budget_is_shared_across_candidate_stages():
    candidate = {}
    first = Mock(side_effect=[OSError(), "planned"])
    second = Mock(side_effect=[OSError(), "fetched"])
    third = Mock(side_effect=OSError())
    assert generate.retry_system_call(candidate, "decision_plan", first) == "planned"
    assert generate.retry_system_call(candidate, "documentation", second) == "fetched"
    with pytest.raises(OSError):
        generate.retry_system_call(candidate, "generation", third)
    assert first.call_count == second.call_count == 2 and third.call_count == 1
    assert [row["retry"] for row in candidate["system_retries"]] == [1, 2]


@pytest.mark.parametrize("error", [DecisionVetoError, CLIAuthError, CLIUsageLimitError, CodexModelRejectedError])
def test_decision_veto_quota_auth_and_model_policy_never_retry(error):
    operation = Mock(side_effect=error("synthetic stop"))
    entry = {}
    with pytest.raises(error):
        generate.retry_system_call(entry, "decision_plan", operation)
    assert operation.call_count == 1 and entry == {}


def _judge_fixture(tmp_path, *, ids=("failed", "rejected")):
    requests, verdicts = tmp_path / "batch.judge-requests", tmp_path / "batch.verdicts"
    requests.mkdir(); verdicts.mkdir(); (verdicts / ".failures").mkdir()
    for ident in ids:
        (requests / (ident + ".json")).write_text(json.dumps({"candidate_id": ident}))
    command = [batch.sys.executable, "scripts/judge_requests.py", "--requests", str(requests),
               "--verdicts", str(verdicts), "--parallel", "2", "--argon-gate"]
    return requests, verdicts, command


def _failure(requests, verdicts, ident="failed", **changes):
    record = {"candidate_id": ident, "error_class": "CLITimeoutError", "sub_call": "claude.style",
              "quality_rejected": False,
              "request_sha256": hashlib.sha256((requests / (ident + ".json")).read_bytes()).hexdigest()}
    record.update(changes)
    (verdicts / ".failures" / (ident + ".json")).write_text(json.dumps(record))


@pytest.mark.parametrize("recover", [False, True])
def test_judge_retries_only_system_candidate_twice_without_rerolling_rejection(tmp_path, recover):
    requests, verdicts, command = _judge_fixture(tmp_path)
    (verdicts / "rejected.json").write_text('{"verdict":"FAIL"}')
    _failure(requests, verdicts)
    seen = []
    def execute(args):
        seen.append(args)
        if recover and len(seen) == 3:
            (verdicts / "failed.json").write_text('{"verdict":"PASS"}')
            (verdicts / ".failures/failed.json").unlink()
            return
        raise subprocess.CalledProcessError(1, args)
    assert batch.judge_with_system_retries(command, execute) is recover
    assert len(seen) == 3
    assert seen[0] == command
    assert seen[1:] == [command + ["--candidate-id", "failed"]] * 2
    assert (verdicts / "rejected.json").read_text() == '{"verdict":"FAIL"}'


@pytest.mark.parametrize("changes", [
    {"quality_rejected": True}, {"quality_rejected": None},
    {"sub_call": "request_validation"}, {"sub_call": "verdict_publication"},
    {"sub_call": "argon.validation"}, {"candidate_id": "foreign"},
    {"error_class": "CLIUsageLimitError"}, {"error_class": "CLIAuthError"},
])
def test_quality_known_failure_and_non_system_failures_never_retry(tmp_path, changes):
    requests, verdicts, command = _judge_fixture(tmp_path, ids=("failed",))
    _failure(requests, verdicts, **changes)
    execute = Mock(side_effect=subprocess.CalledProcessError(1, command))
    assert batch.judge_with_system_retries(command, execute) is False
    assert execute.call_count == 1


def test_retry_requires_unchanged_frozen_request(tmp_path):
    requests, verdicts, _ = _judge_fixture(tmp_path, ids=("failed",))
    _failure(requests, verdicts)
    (requests / "failed.json").write_text("changed")
    with pytest.raises(ValueError, match="frozen"):
        batch.retryable_judge_ids(requests, verdicts)


def test_successful_targeted_retry_does_not_hide_other_failed_candidate(tmp_path):
    requests, verdicts, command = _judge_fixture(tmp_path)
    _failure(requests, verdicts)
    _failure(requests, verdicts, "rejected", quality_rejected=True)
    calls = []
    def execute(args):
        calls.append(args)
        if len(calls) == 1:
            raise subprocess.CalledProcessError(1, args)
        (verdicts / "failed.json").write_text("{}")
    assert batch.judge_with_system_retries(command, execute) is False
    assert len(calls) == 2


@pytest.mark.parametrize("generator_failed,judge_failed,ingest_failed", [
    (True, False, False), (True, True, True), (False, True, True), (False, False, False),
])
def test_nonzero_generation_still_judges_then_ingests_and_records_partial_drafts(
        monkeypatch, tmp_path, generator_failed, judge_failed, ingest_failed):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    monkeypatch.delenv("N", raising=False)
    monkeypatch.setattr(batch, "export_questions", Mock(return_value=0))
    calls = []
    def execute(command, **kwargs):
        calls.append(command[1])
        assert kwargs["env"]["PYTHON_DOTENV_DISABLED"] == "1"
        base = tmp_path / ".cache/generation/machine-learning-engineer-v5-survivors"
        if command[1] == "scripts/generate_all_domains.py":
            assert "--continue-quality-rejections" in command
            base.with_suffix(".json").write_text(json.dumps({"candidates": [
                {"accepted": False, "candidate_id": "ready"}]}))
            base.with_suffix(".judge-requests").mkdir()
            (base.with_suffix(".judge-requests") / "ready.json").write_text("{}")
            if generator_failed:
                raise subprocess.CalledProcessError(1, command)
        elif command[1] == "scripts/judge_requests.py":
            base.with_suffix(".verdicts").mkdir()
            if judge_failed:
                raise subprocess.CalledProcessError(1, command)
            (base.with_suffix(".verdicts") / "ready.json").write_text("{}")
        else:
            base.with_suffix(".json").write_text(json.dumps({"candidates": [
                {"accepted": True, "inserted_question_id": "stored-draft"}]}))
            if ingest_failed:
                raise subprocess.CalledProcessError(1, command)
    monkeypatch.setattr(batch.subprocess, "run", execute)
    result = CliRunner().invoke(batch.main, ["all", "survivors", "machine-learning-engineer", "--count", "2"])
    assert (result.exit_code != 0) is (generator_failed or judge_failed or ingest_failed), result.output
    assert calls == ["scripts/generate_all_domains.py", "scripts/judge_requests.py", "scripts/ingest_external_verdicts.py"]
    assert "Stored 1 DRAFT" in result.output
    assert (tmp_path / ".cache/generation/machine-learning-engineer-v5-survivors.accepted-ids").read_text() == "stored-draft"
    assert "No later stage was run" not in result.output


def test_generator_failure_without_request_directory_does_not_judge(monkeypatch, tmp_path):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    monkeypatch.setattr(batch, "export_questions", Mock(return_value=0))
    execute = Mock(side_effect=subprocess.CalledProcessError(1, ["fixture"]))
    monkeypatch.setattr(batch.subprocess, "run", execute)
    result = CliRunner().invoke(batch.main, ["all", "no-requests", "cloud-engineer"])
    assert result.exit_code == 1 and execute.call_count == 1


def test_recovered_documentation_transport_does_not_regenerate_decision(harness):
    run, db, search, _ = harness
    search.side_effect = [OSError("synthetic timeout"), OSError("synthetic timeout"), [SOURCE]]
    _, payload, result, planner, writer = run(flags=("--continue-quality-rejections",))
    assert result.exit_code == 0, result.output
    candidate = payload["candidates"][0]
    assert candidate["awaiting_external_judge"] is True
    assert len(candidate["system_retries"]) == 2
    assert search.call_count == 3 and planner.call_count == writer.call_count == 1
    db.assert_not_called()


def test_exhausted_system_candidate_does_not_stop_other_candidate(harness):
    run, db, search, _ = harness
    search.side_effect = [OSError(), OSError(), OSError(), [SOURCE]]
    _, payload, result, planner, writer = run(
        specs=[(LIFECYCLE, question()), (LIFECYCLE, question())],
        flags=("--continue-quality-rejections",))
    assert result.exit_code == 1
    failed, ready = payload["candidates"]
    assert failed["error_class"] == "OSError" and len(failed["system_retries"]) == 2
    assert ready["awaiting_external_judge"] is True
    assert search.call_count == 4 and planner.call_count == 2 and writer.call_count == 1
    db.assert_not_called()


def test_incomplete_pde_wave_judges_ready_requests_before_frozen_admission_stops(monkeypatch, tmp_path):
    from scripts import pde_retry
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    monkeypatch.setattr(batch, "export_questions", Mock(return_value=0))
    calls = []
    def launch(command, **kwargs):
        calls.append(command[1])
        if command[1] == "scripts/generate_all_domains.py":
            artifact = tmp_path / ".cache/generation/data-engineer-v5-partial.json"
            artifact.write_text(json.dumps({"planned_count": 2, "candidates": [{"candidate_id": "ready"}]}))
            requests = artifact.with_suffix(".judge-requests")
            requests.mkdir(); (requests / "ready.json").write_text("{}")
            raise subprocess.CalledProcessError(1, command)
        verdicts = tmp_path / ".cache/generation/data-engineer-v5-partial.verdicts"
        verdicts.mkdir(); (verdicts / "ready.json").write_text("{}")
    monkeypatch.setattr(batch.subprocess, "run", launch)
    def frozen_retry(artifact, export, commands, **kwargs):
        kwargs["execute"](commands[0])
        # Real PDE checks complete slots before it can admit any candidate.
        assert calls == ["scripts/generate_all_domains.py", "scripts/judge_requests.py"]
        # A later ordinary judge dispatch must not grant another retry budget.
        kwargs["execute"](commands[1])
        assert len(calls) == 2
        raise ValueError("Generation did not finish every planned candidate")
    monkeypatch.setattr(pde_retry, "run_retry_batch", frozen_retry)
    result = CliRunner().invoke(batch.main, ["all", "partial", "data-engineer", "--count", "2"])
    assert result.exit_code == 1
    assert "scripts/ingest_external_verdicts.py" not in calls
