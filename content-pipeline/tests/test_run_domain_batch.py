"""Offline runner contracts; commands are inspected, never executed."""
from pathlib import Path
import pytest

from scripts import run_domain_batch as batch


@pytest.mark.parametrize("plan_only", [False, True])
def test_coordinator_commands_enable_safe_optimizations_only(monkeypatch, tmp_path, plan_only):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    _, export, commands = batch.batch_commands(
        "1.", "safe-defaults", "cloud-engineer", 4, 2, plan_only=plan_only,
    )
    generate = commands[0]
    assert "--doc-cache" in generate
    assert "--verify-stable-prefix" in generate
    assert "--no-doc-cache" not in generate
    assert "--no-verify-stable-prefix" not in generate
    assert all("--verify-retrieval" not in command for command in commands)
    assert ("--plan-only" in generate) is plan_only
    assert ("--existing-questions" in generate) is not plan_only
    if not plan_only:
        assert generate[generate.index("--existing-questions") + 1] == str(export)
        assert len(commands) == 3
    else:
        assert len(commands) == 1


@pytest.mark.parametrize("plan_only", [False, True])
def test_full_plan_is_one_artifact_with_unfiltered_weighted_budget(monkeypatch, tmp_path, plan_only):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    artifact, export, commands = batch.batch_commands(
        "all", "pde-full40", "data-engineer", 40, 3, plan_only=plan_only,
    )
    generate = commands[0]
    assert artifact == tmp_path / ".cache/generation/data-engineer-v5-pde-full40.json"
    assert export == tmp_path / ".cache/generation/data-engineer-v5-pde-full40.existing.json"
    assert generate[generate.index("--artifact") + 1] == str(artifact)
    assert generate[generate.index("--n-questions") + 1] == "40"
    assert not {"--objective", "--domain-code", "--subsection", "--section-allocation"} & set(generate)
    for flag, value in (("--model", "codex"), ("--judge-model", "external"),
                        ("--gen-effort", "high"), ("--cite-effort", "medium"),
                        ("--distractor-evidence", "consistent")):
        assert generate[generate.index(flag) + 1] == value
    assert {"--argon-gate", "--doc-cache", "--verify-stable-prefix"} <= set(generate)
    assert all("--verify-retrieval" not in command for command in commands)
    assert not any("publish" in arg for command in commands for arg in command)
    if plan_only:
        assert len(commands) == 1
        assert "--plan-only" in generate
        assert "--existing-questions" not in generate
    else:
        assert len(commands) == 3
        assert generate[generate.index("--existing-questions") + 1] == str(export)
        judge, ingest = commands[1:]
        assert judge[1] == "scripts/judge_requests.py"
        assert judge[judge.index("--judge-model") + 1] == "claude"
        assert "--argon-gate" in judge
        assert ingest == [batch.sys.executable, "scripts/ingest_external_verdicts.py",
                          "--artifact", str(artifact), "--verdicts", str(artifact.with_suffix("")) + ".verdicts",
                          "--continue-quality-rejections"]


@pytest.mark.parametrize("section,expected", [("all", "40"), ("1.", "30")])
def test_scope_specific_default_budget(monkeypatch, tmp_path, section, expected):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    _, _, commands = batch.batch_commands(section, "defaults", "data-engineer", None, 2, plan_only=True)
    command = commands[0]
    assert command[command.index("--n-questions") + 1] == expected
    assert ("--objective" in command) is (section != "all")


def test_runner_full40_plan_only_runs_real_offline_planner(monkeypatch, tmp_path):
    import json
    from collections import Counter

    from click.testing import CliRunner
    from scripts import generate_pmle_questions as generate
    from shared.cert_context import CERTS_DIR, load_cert_context
    from shared.cert_generation_policy import generation_policy
    from shared.doc_context_budget import DEFAULT_DOC_CONTEXT_CHARS

    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path / ".cache/generation")
    monkeypatch.delenv("N", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    def forbidden(*args, **kwargs):
        raise AssertionError("Plan-only must not export, search documentation, construct clients or run models")
    monkeypatch.setattr(batch, "export_questions", forbidden)
    monkeypatch.setattr(generate, "database_client", forbidden)
    monkeypatch.setattr(generate, "search_objective_docs", forbidden)
    monkeypatch.setattr(generate, "plan_decision", forbidden)
    monkeypatch.setattr(generate, "generate_question", forbidden)
    monkeypatch.setattr(generate, "judge_question", forbidden)
    calls = []
    def execute_plan(command, **kwargs):
        calls.append(command)
        assert command[1] == "scripts/generate_all_domains.py"
        assert "--plan-only" in command
        assert kwargs["env"]["PYTHON_DOTENV_DISABLED"] == "1"
        assert kwargs["cwd"] == tmp_path
        result = CliRunner().invoke(generate.main, command[2:])
        assert result.exit_code == 0, result.output
    monkeypatch.setattr(batch.subprocess, "run", execute_plan)
    guide_path = CERTS_DIR / "data-engineer.json"
    guide_bytes = guide_path.read_bytes()
    result = CliRunner().invoke(batch.main, ["all", "offline40", "data-engineer", "--plan-only"])
    assert result.exit_code == 0, result.output
    assert len(calls) == 1
    files = list((tmp_path / ".cache/generation").iterdir())
    assert len(files) == 1
    payload = json.loads(files[0].read_text())
    assert payload["planned_count"] == 40
    assert payload["plan_only"] is True and payload["dry_run"] is True
    assert payload["candidates"] == [] and payload["generation_runs"] == {}
    assert payload["requested_objective_ids"] == [] and payload["section_allocation"] is None
    assert payload["existing_questions"] == {"sha256": None, "questions": []}
    plan = payload["plan"]
    assert len(plan) == 40
    assert list(Counter(row["domain_code"] for row in plan).values()) == [9, 10, 8, 6, 7]
    topics = {row["required_topic_id"]: row for row in plan if row["required_topic_id"]}
    policy = generation_policy("data-engineer")
    assert len(topics) == 9
    assert set(topics) == {topic["id"] for topic in policy["required_topics"]}
    for topic in policy["required_topics"]:
        row = topics[topic["id"]]
        assert row["objective_id"] in topic["objective_ids"]
        assert topic["guidance"] == row["required_topic_guidance"]
        assert topic["guidance"] in row["domain_prompt"]
    report = payload["topic_plan_report"]
    assert report["status"] == "complete"
    assert all(topic["planned_count"] == 1 for topic in report["topics"])
    assert report["coverage_basis"] == "planned_topic_hints_only"
    context = load_cert_context("data-engineer")
    assert {row["guide_sha256"] for row in plan} == {context["guide_sha256"]}
    assert payload["generation_policy"] == policy
    assert guide_path.read_bytes() == guide_bytes
    assert payload["documentation_context_policy"] == {"version": 1, "max_chars": DEFAULT_DOC_CONTEXT_CHARS}
    assert payload["gen_effort"] == "high" and payload["cite_effort"] == "medium"
    assert payload["argon_gate"] is True
    assert payload["distractor_evidence"]["mode"] == "consistent"


@pytest.mark.parametrize("section", ["ALL", "all.", "0.", "99.", "1", "../all"])
def test_invalid_sections_still_fail_closed(monkeypatch, tmp_path, section):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    with pytest.raises(ValueError, match="Section"):
        batch.batch_commands(section, "invalid", "data-engineer", 40, 2, plan_only=True)


@pytest.mark.parametrize("suffix", [".json", ".existing.json", ".judge-requests", ".verdicts", ".accepted-ids", ".json.calls.jsonl"])
def test_full_plan_keeps_existing_artifact_and_sidecar_protection(monkeypatch, tmp_path, suffix):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    existing = tmp_path / ".cache/generation" / ("data-engineer-v5-reused" + suffix)
    existing.parent.mkdir(parents=True)
    existing.touch()
    with pytest.raises(ValueError, match="new tag"):
        batch.batch_commands("all", "reused", "data-engineer", 40, 2, plan_only=True)


def test_full_pde_runner_routes_through_bounded_retry_admission(monkeypatch, tmp_path):
    from click.testing import CliRunner
    from scripts import pde_retry
    from scripts import ingest_external_verdicts as ingestion

    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    monkeypatch.delenv("N", raising=False)
    exported = []
    def export(*args):
        exported.append(args)
        return 0
    monkeypatch.setattr(batch, "export_questions", export)
    received = []
    def retry(artifact, export, commands, **kwargs):
        received.append((artifact, export, commands, kwargs))
        assert kwargs["retry_attempts"] == 4
        assert callable(kwargs["admit"]) and callable(kwargs["execute"])
        return {"waves": [{"selected_ids": ["draft-1", "draft-2"]}], "topics": [], "sections": []}
    monkeypatch.setattr(pde_retry, "run_retry_batch", retry)
    def forbidden(*args, **kwargs):
        raise AssertionError("Fixture runner must not access DB")
    monkeypatch.setattr(ingestion, "database_client", forbidden)
    result = CliRunner().invoke(batch.main, ["all", "bounded", "data-engineer", "--count", "40", "--retry-attempts", "4"])
    assert result.exit_code == 0, result.output
    assert len(exported) == 1 and len(received) == 1
    assert "Stored 2 DRAFT questions" in result.output
    accepted = tmp_path / ".cache/generation/data-engineer-v5-bounded.accepted-ids"
    assert accepted.read_text() == "draft-1\ndraft-2"


def _saved_resume(tmp_path, monkeypatch, *, count=40):
    import json
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    artifact = tmp_path / ".cache/generation/data-engineer-v5-saved.json"
    artifact.parent.mkdir(parents=True)
    artifact.write_text(json.dumps({"cert_id": "data-engineer", "planned_count": count,
                                    "plan": [{"objective_id": "fixture"}] * count,
                                    "requested_objective_ids": []}))
    artifact.with_suffix(".existing.json").write_text("[]")
    artifact.with_suffix(".retry-report.json").write_text("{}")
    artifact.with_name(artifact.stem + "-retry1.json").write_text("{}")
    return artifact


def test_resume_builds_commands_for_saved_location_without_fresh_collision_bypass(monkeypatch, tmp_path):
    artifact = _saved_resume(tmp_path, monkeypatch, count=42)
    target, export, commands = batch.batch_commands("all", "saved", "data-engineer", None, 2, resume=artifact)
    assert target == artifact
    assert export == artifact.with_suffix(".existing.json")
    assert commands[0][commands[0].index("--n-questions") + 1] == "42"
    with pytest.raises(ValueError, match="new tag"):
        batch.batch_commands("all", "saved", "data-engineer", 42, 2)


@pytest.mark.parametrize("section,cert,tag,count,plan_only", [
    ("1.", "data-engineer", "saved", 40, False),
    ("all", "cloud-engineer", "saved", 40, False),
    ("all", "data-engineer", "other", 40, False),
    ("all", "data-engineer", "saved", 41, False),
    ("all", "data-engineer", "saved", 40, True),
])
def test_resume_rejects_scope_count_and_mode_changes(monkeypatch, tmp_path, section, cert, tag, count, plan_only):
    artifact = _saved_resume(tmp_path, monkeypatch)
    with pytest.raises(ValueError):
        batch.batch_commands(section, tag, cert, count, 2, plan_only=plan_only, resume=artifact)


def test_resume_requires_saved_bank_export(monkeypatch, tmp_path):
    artifact = _saved_resume(tmp_path, monkeypatch)
    artifact.with_suffix(".existing.json").unlink()
    with pytest.raises(ValueError, match="saved bank"):
        batch.batch_commands("all", "saved", "data-engineer", 40, 2, resume=artifact)


@pytest.mark.parametrize("write", [False, True])
def test_resume_cli_preserves_export_and_requires_explicit_write(monkeypatch, tmp_path, write):
    from click.testing import CliRunner
    from scripts import pde_retry
    artifact = _saved_resume(tmp_path, monkeypatch)
    monkeypatch.delenv("N", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture-only")
    def forbidden(*args, **kwargs):
        raise AssertionError("Resume must not replace the original bank export")
    monkeypatch.setattr(batch, "export_questions", forbidden)
    seen = []
    def retry(target, export, commands, **kwargs):
        seen.append(kwargs)
        assert target == artifact
        assert kwargs["resume"] is True
        assert kwargs["write"] is write
        assert kwargs["acknowledge_saved_system_failures"] is True
        return {"waves": [{"selected_ids": ["draft-fixture"]}], "topics": [], "sections": []}
    monkeypatch.setattr(pde_retry, "run_retry_batch", retry)
    args = ["all", "saved", "data-engineer", "--resume", str(artifact), "--acknowledge-saved-system-failures"]
    if write:
        args += ["--write"]
    result = CliRunner().invoke(batch.main, args)
    assert result.exit_code == 0, result.output
    assert len(seen) == 1
    accepted = artifact.with_suffix(".accepted-ids")
    assert accepted.exists() is write
    if write:
        assert accepted.read_text() == "draft-fixture"
        assert "Stored 1 DRAFT" in result.output
    else:
        assert "no DRAFT writes" in result.output


def test_saved_system_failure_acknowledgment_cannot_enable_fresh_run(monkeypatch, tmp_path):
    from click.testing import CliRunner
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.delenv("N", raising=False)
    result = CliRunner().invoke(batch.main, ["all", "fresh", "data-engineer", "--acknowledge-saved-system-failures"])
    assert result.exit_code != 0
    assert not (tmp_path / ".cache").exists()


def test_resume_write_requires_coordinator_credentials_before_any_job(monkeypatch, tmp_path):
    from click.testing import CliRunner
    from scripts import pde_retry
    artifact = _saved_resume(tmp_path, monkeypatch)
    monkeypatch.delenv("N", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    def forbidden(*args, **kwargs):
        raise AssertionError("Missing coordinator credentials must stop before jobs")
    monkeypatch.setattr(pde_retry, "run_retry_batch", forbidden)
    result = CliRunner().invoke(batch.main, ["all", "saved", "data-engineer", "--resume", str(artifact), "--write"])
    assert result.exit_code != 0
    assert not artifact.with_suffix(".accepted-ids").exists()


def test_resume_rejects_symlink_bank(monkeypatch, tmp_path):
    artifact = _saved_resume(tmp_path, monkeypatch)
    export = artifact.with_suffix(".existing.json")
    real = tmp_path / "bank.json"
    export.replace(real)
    export.symlink_to(real)
    with pytest.raises(ValueError, match="saved bank"):
        batch.batch_commands("all", "saved", "data-engineer", 40, 2, resume=artifact)


def test_resume_requires_artifact_owning_pipeline_for_future_generation(monkeypatch, tmp_path):
    artifact = _saved_resume(tmp_path, monkeypatch)
    monkeypatch.setattr(batch, "PIPELINE", tmp_path / "other-checkout")
    with pytest.raises(ValueError, match="artifact-owning"):
        batch.batch_commands("all", "saved", "data-engineer", 40, 2, resume=artifact)


@pytest.mark.parametrize("error_class,partial", [("CandidateRejected", True), ("CLIAuthError", False),
                                               ("CLIUsageLimitError", False), ("BudgetError", True),
                                               ("RateLimitError", False), ("UnrecognizedError", False)])
def test_nightly_typed_result_only_ordinary_failures_can_continue(monkeypatch, tmp_path, error_class, partial):
    import json
    import subprocess
    from click.testing import CliRunner
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "fixture")
    monkeypatch.delenv("N", raising=False)
    monkeypatch.setattr(batch, "export_questions", lambda *_: 0)
    seen = []
    def launch(command, **kwargs):
        seen.append(command)
        if command[1] == "scripts/generate_all_domains.py":
            artifact = Path(command[command.index("--artifact") + 1])
            artifact.write_text(json.dumps({"candidates": [{"error_class": error_class, "failure_stage": "generation", "accepted": False}]}))
            requests = artifact.with_suffix(".judge-requests")
            requests.mkdir()
            (requests / "candidate.json").write_text("{}")
            raise subprocess.CalledProcessError(1, command)
        if command[1] == "scripts/judge_requests.py":
            verdicts = Path(command[command.index("--verdicts") + 1])
            verdicts.mkdir()
            (verdicts / "candidate.json").write_text("{}")
    monkeypatch.setattr(batch.subprocess, "run", launch)
    result_path = tmp_path / "result.json"
    result = CliRunner().invoke(batch.main, ["1.", "night", "machine-learning-engineer", "--nightly-result", str(result_path)])
    assert result.exit_code != 0
    assert json.loads(result_path.read_text()) == {"schema": "nightly-stage-v1", "status": "partial" if partial else "hard_stop"}
    assert len(seen) == (3 if partial else 1)


def test_nightly_outcome_unknown_persistence_never_ordinary(tmp_path):
    import json
    from scripts.nightly_outcome import ordinary_failure
    artifact = tmp_path / "artifact.json"
    artifact.write_text(json.dumps({"candidates": [{"error_class": "CandidateRejected", "failure_stage": "persistence"}]}))
    assert not ordinary_failure(["python", "scripts/generate_all_domains.py", "--artifact", str(artifact)])
