"""Offline frozen retry-source and quality-continuation contracts."""
from copy import deepcopy
from hashlib import sha256
import json
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts.ingest_external_verdicts import _scope
from shared.cert_context import plan_questions
from shared.cert_generation_policy import generation_policy
from shared.distractor_evidence import evidence_policy
from shared.retry_plan import load_frozen_retry_plan


def source_manifest(tmp_path, slots=None):
    plan = plan_questions("data-engineer", 40, seed=20)
    policy = evidence_policy("consistent")
    for scope in plan:
        scope["distractor_evidence"] = deepcopy(policy)
    source = {"cert_id": "data-engineer", "rules_version": 5, "judge_model": "external",
              "planned_count": 40, "plan": plan, "generation_policy": generation_policy("data-engineer"),
              "style_policy_version": plan[0]["style_policy"]["version"], "distractor_evidence": policy}
    path = tmp_path / "initial.json"
    path.write_text(json.dumps(source))
    manifest = {"version": 1, "cert_id": "data-engineer", "source_artifact": str(path),
                "source_sha256": sha256(path.read_bytes()).hexdigest(), "full_plan_count": 40,
                "slots": slots or [{"plan_slot": 40, "attempt": 2}, {"plan_slot": 13, "attempt": 2}]}
    frozen = tmp_path / "retry-plan.json"
    frozen.write_text(json.dumps(manifest))
    return source, path, manifest, frozen


def test_derive_exact_source_scopes_and_original_hint_ordinals(tmp_path):
    source, path, manifest, frozen = source_manifest(tmp_path)
    # Never reuse a failed candidate's proof as support for the replacement.
    source["plan"][39].update(decision_plan={"old": "decision"}, decision_proof={"passed": True},
                              decision_objective={"objective_id": source["plan"][39]["objective_id"],
                                                  "objective_text": source["plan"][39]["objective_text"]})
    path.write_text(json.dumps(source))
    manifest["source_sha256"] = sha256(path.read_bytes()).hexdigest()
    frozen.write_text(json.dumps(manifest))
    scopes, metadata = load_frozen_retry_plan(frozen, cert_id="data-engineer")
    expected = deepcopy(source["plan"][39])
    for field in ("decision_plan", "decision_proof", "decision_objective"):
        expected.pop(field)
    assert scopes[0] == expected
    assert scopes[1] == source["plan"][12]
    payload = {**source, "plan": scopes, "full_plan_count": 40, "retry_slots": metadata["slots"]}
    assert _scope(payload, {**scopes[0], "index": 1}) == scopes[0]
    assert _scope(payload, {**scopes[1], "index": 2}) == scopes[1]


@pytest.mark.parametrize("mutation", ["hash", "scope", "count", "duplicate", "slot", "attempt", "inline", "cert"])
def test_retry_source_rejects_changed_or_arbitrary_provenance(tmp_path, mutation):
    source, path, manifest, frozen = source_manifest(tmp_path)
    if mutation == "hash":
        path.write_text(path.read_text() + " ")
    elif mutation == "scope":
        source["plan"][39]["domain_prompt"] += " arbitrary override"
        path.write_text(json.dumps(source)); manifest["source_sha256"] = sha256(path.read_bytes()).hexdigest()
    elif mutation == "count": manifest["full_plan_count"] = 39
    elif mutation == "duplicate": manifest["slots"] *= 2
    elif mutation == "slot": manifest["slots"][0]["plan_slot"] = True
    elif mutation == "attempt": manifest["slots"][0]["attempt"] = 1
    elif mutation == "inline": manifest["slots"][0]["scope"] = source["plan"][39]
    elif mutation == "cert": manifest["cert_id"] = "cloud-engineer"
    frozen.write_text(json.dumps(manifest))
    with pytest.raises(ValueError):
        load_frozen_retry_plan(frozen, cert_id="data-engineer")


def test_plan_only_retry_is_offline_and_preserves_required_topics(tmp_path, monkeypatch):
    source, _, manifest, frozen = source_manifest(tmp_path)
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    for name in ("database_client", "plan_decision", "search_objective_docs", "verify_decision", "generate_question"):
        monkeypatch.setattr(generate, name, Mock(side_effect=AssertionError("No services permitted")))
    artifact = tmp_path / "retry.json"
    result = CliRunner().invoke(generate.main, ["--cert", "data-engineer", "--n-questions", "2",
        "--frozen-plan", str(frozen), "--continue-quality-rejections", "--plan-only", "--model", "codex",
        "--judge-model", "external", "--artifact", str(artifact), "--distractor-evidence", "consistent"])
    assert result.exit_code == 0, (result.output, result.exception)
    payload = json.loads(artifact.read_text())
    assert payload["retry_slots"] == manifest["slots"]
    assert payload["full_plan_count"] == 40
    assert payload["plan"] == [source["plan"][39], source["plan"][12]]
    assert payload["candidates"] == [] and payload["generation_runs"] == {}


@pytest.mark.parametrize("stage", sorted(generate.QUALITY_REJECTION_STAGES))
def test_only_explicit_quality_vetoes_continue(stage):
    assert generate.is_quality_rejection({"failure_stage": stage, "error_class": "CandidateRejected"})
    for error in ("CLIExitError", "ValueError", "GenerationOutputError", "MaxTokensTruncation", "CLIUsageLimitError"):
        assert not generate.is_quality_rejection({"failure_stage": stage, "error_class": error})
    assert generate.is_quality_rejection({"failure_stage": "decision_veto", "error_class": "DecisionVetoError"})
    assert not generate.is_quality_rejection({"failure_stage": "external_request", "error_class": "CandidateRejected"})


# Reuse the explicit synthetic model-stage fixture; no CLI or HTTP can run.
from test_pde_pipeline_integration import harness, LIFECYCLE, question, save_verdicts
from scripts import ingest_external_verdicts as ingest


def test_initial_quality_veto_continues_but_still_fails_strict_default(harness):
    run, db, _, tmp_path = harness
    bank = tmp_path / "repeat-bank.json"
    bank.write_text(json.dumps([{"id": "prior", "cert_id": "data-engineer", "status": "DRAFT",
        "stem": "A different original enterprise scenario", "key": "A",
        "options": [{"label": label, "text": action} for label, action in zip("ABCD", LIFECYCLE)]}]))
    path, payload, result, _, writer = run(flags=("--existing-questions", str(bank), "--continue-quality-rejections"))
    assert result.exit_code == 0, (result.output, result.exception)
    assert payload["candidates"][0]["failure_stage"] == "answer_pattern"
    directory = save_verdicts(path, payload)
    summary = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True)
    assert summary["selected_candidates"] == []
    assert summary["quality_rejections"]["by_stage"] == {"answer_pattern": 1}
    writer.assert_not_called(); db.assert_not_called()


def test_unsupported_docs_are_quality_veto_without_guessing_evidence(harness):
    run, db, search, _ = harness
    search.return_value = []
    path, payload, result, _, writer = run(flags=("--continue-quality-rejections",))
    assert result.exit_code == 0, (result.output, result.exception)
    entry = payload["candidates"][0]
    assert entry["failure_stage"] == "documentation" and entry["error_class"] == "CandidateRejected"
    assert entry["decision_attempts"][-1]["documentation_check"]["passed"] is False
    summary = ingest.ingest(path, save_verdicts(path, payload), dry_run=True, continue_quality_rejections=True)
    assert summary["selected_candidates"] == []
    assert summary["quality_rejections"]["by_stage"] == {"documentation": 1}
    writer.assert_not_called(); db.assert_not_called()


def test_transport_exception_at_documentation_stage_is_not_quality(harness):
    run, db, search, _ = harness
    search.side_effect = OSError("synthetic service transport failure")
    path, payload, result, _, writer = run(flags=("--continue-quality-rejections",))
    assert result.exit_code == 1
    entry = payload["candidates"][0]
    assert entry["failure_stage"] == "documentation" and entry["error_class"] == "OSError"
    with pytest.raises(__import__("click").ClickException, match="preflight"):
        ingest.ingest(path, save_verdicts(path, payload), dry_run=False, continue_quality_rejections=True)
    writer.assert_not_called(); db.assert_not_called()
