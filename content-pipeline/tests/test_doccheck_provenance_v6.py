"""Offline frozen doccheck propagation through real proof, admission and repairs.

Model semantics are synthetic. No network, model process or database is permitted.
"""
from copy import deepcopy
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts import ingest_external_verdicts as ingestion
from scripts import repair_candidates as repair
from scripts.pde_retry import run_retry_batch
from shared import cli_models
from shared.decision_planner import verify_decision
from shared.external_judge import candidate_question, candidate_storage_id, validate_decision_provenance, build_request
from shared.near_duplicates import comparison_row, load_export
from test_pde_pipeline_integration import (
    harness, RECEIPTS, distinct_specs, plan, proof, question, save_verdicts,
    verdict, verdict_with_policy,
)


def install_real_proof(monkeypatch):
    def verify(scope, proposed, sources, **kwargs):
        raw = proof(scope)
        for key in ("passed", "mechanical_check", "distractor_evidence"):
            raw.pop(key)
        if scope.get("doccheck_policy", "v5") == "v6":
            raw["failing_options"] = []
        return verify_decision(scope, proposed, sources,
                               predictor=lambda **_: raw, **kwargs)
    monkeypatch.setattr(generate, "verify_decision", verify)


@pytest.mark.parametrize("policy", ["v5", "v6"])
def test_real_proof_survives_external_admission(harness, monkeypatch, policy):
    run, db, _, _ = harness
    install_real_proof(monkeypatch)
    flags = () if policy == "v5" else ("--doccheck-policy", "v6")
    path, payload, result, _, _ = run(flags=flags)
    assert result.exit_code == 0, (result.output, result.exception)
    entry = payload["candidates"][0]
    assert entry["decision_proof"]["passed"] is True
    assert ("failing_options" in entry["decision_proof"]) is (policy == "v6")
    assert ("doccheck_policy" in payload) is (policy == "v6")
    ingestion._validate_candidate(path, payload, entry)
    summary = ingestion.ingest(path, save_verdicts(path, payload), dry_run=True)
    assert len(summary["selected_candidates"]) == 1
    db.assert_not_called()


@pytest.mark.parametrize("mutation", ["unknown", "scope", "entry", "missing_scope", "missing_entry", "missing_batch"])
def test_ingestion_rejects_mixed_or_unknown_frozen_policy(harness, monkeypatch, mutation):
    run, db, _, _ = harness
    install_real_proof(monkeypatch)
    _, payload, result, _, _ = run(flags=("--doccheck-policy", "v6"))
    assert result.exit_code == 0, result.output
    entry = payload["candidates"][0]
    if mutation == "unknown":
        payload["doccheck_policy"] = payload["plan"][0]["doccheck_policy"] = entry["doccheck_policy"] = "v7"
    elif mutation == "scope":
        payload["plan"][0]["doccheck_policy"] = "v5"
    elif mutation == "entry":
        entry["doccheck_policy"] = "v5"
    elif mutation == "missing_scope":
        payload["plan"][0].pop("doccheck_policy")
    elif mutation == "missing_entry":
        entry.pop("doccheck_policy")
    else:
        payload.pop("doccheck_policy")
    with pytest.raises(ValueError, match="[Dd]occheck"):
        ingestion._scope(payload, entry)
    db.assert_not_called()


def test_unknown_policy_cannot_validate_a_frozen_proof(harness, monkeypatch):
    run, db, _, _ = harness
    install_real_proof(monkeypatch)
    _, payload, result, _, _ = run(flags=("--doccheck-policy", "v6"))
    assert result.exit_code == 0, result.output
    scope = payload["plan"][0]
    scope["doccheck_policy"] = "v7"
    with pytest.raises(ValueError, match="Invalid frozen decision"):
        validate_decision_provenance(scope, payload["candidates"][0])
    db.assert_not_called()


def test_repair_child_keeps_policy_and_can_be_admitted(harness, monkeypatch):
    run, db, _, _ = harness
    install_real_proof(monkeypatch)
    path, payload, result, _, _ = run(flags=("--doccheck-policy", "v6"))
    assert result.exit_code == 0, result.output
    parent = payload["candidates"][0]
    revised = candidate_question(parent)
    revised["stem"] = revised["stem"].replace("supplier", "partner")
    assert revised != candidate_question(parent)
    revise = Mock(return_value=revised)
    cite = Mock(return_value={"evidence": deepcopy(RECEIPTS)})
    monkeypatch.setattr(cli_models, "run_signature", revise)
    monkeypatch.setattr(repair, "cite_question", cite)
    directory = save_verdicts(path, payload, failed=True)
    summary = repair.repair_candidates(path, directory, limit=1, max_calls=2, parallel=1)
    assert summary["repaired"] == 1, summary
    saved = json.loads(path.read_text())
    child = saved["candidates"][1]
    assert child["doccheck_policy"] == parent["doccheck_policy"] == "v6"
    assert child["decision_proof"] == parent["decision_proof"]
    ingestion._validate_candidate(path, saved, child)
    child_verdict = verdict_with_policy(verdict(candidate_question(child)), child["distractor_evidence"])
    (directory / (child["candidate_id"] + ".json")).write_text(json.dumps(child_verdict))
    admitted = ingestion.ingest(path, directory, dry_run=True)
    assert len(admitted["selected_candidates"]) == 1
    revise.assert_called_once()
    cite.assert_called_once()
    db.assert_not_called()


@pytest.mark.parametrize("refill", [False, True], ids=["default-one-wave", "canonical-comparator-two-waves"])
def test_pde_v6_policy_survives_default_or_isolated_resume(harness, monkeypatch, refill):
    """Default one-wave resume is real; two-wave resume isolates comparison order."""
    _, db, _, tmp_path = harness
    install_real_proof(monkeypatch)
    specs = distinct_specs()
    actions = [
        "Configure Cloud Storage object versioning and retain prior object generations for recovery from accidental replacement during ingestion.",
        "Deploy Dataflow streaming workers and aggregate event windows before loading operational messages into the reporting destination.",
        "Schedule Dataproc maintenance workflows and recreate temporary cluster resources before launching each scheduled transformation process.",
        "Apply BigQuery row access policies to reporting tables and assign regional analyst permissions through managed identity groups.",
    ]
    specs.append((actions, question(actions)))
    serial = [0]
    def planner(scope, **kwargs):
        serial[0] += 1
        return plan(scope, specs[serial[0] - 1][0], f"v6-attempt-{serial[0]}")
    def writer(context, *args, **kwargs):
        index = next(i for i in range(1, 5) if f"v6-attempt-{i}" in context)
        return {**deepcopy(specs[index - 1][1]), "evidence": deepcopy(RECEIPTS)}
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "generate_question", writer)
    artifact, export = tmp_path / "full.json", tmp_path / "bank.json"
    export.write_text("[]")
    commands = [["python", "generate", "--cert", "data-engineer", "--n-questions", "3",
                 "--model", "codex", "--judge-model", "external", "--parallel", "1",
                 "--no-doc-cache", "--artifact", str(artifact), "--existing-questions", str(export),
                 "--distractor-evidence", "consistent", "--doccheck-policy", "v6"],
                ["python", "judge", "--requests", "unused", "--verdicts", "unused"]]
    def execute(command):
        if command[1] == "generate":
            result = CliRunner().invoke(generate.main, command[2:])
            assert result.exit_code == 0, (result.output, result.exception)
        else:
            path = Path(command[command.index("--requests") + 1]).with_suffix(".json")
            payload = json.loads(path.read_text())
            directory = save_verdicts(path, payload)
            if path == artifact and refill:
                target = directory / (payload["candidates"][0]["candidate_id"] + ".json")
                raw = json.loads(target.read_text())
                raw["style"].update(verdict="FAIL", inference_required=False)
                target.write_text(json.dumps(raw))
    def storage_id(payload, entry):
        return candidate_storage_id(entry, ingestion._scope(payload, entry), candidate_question(entry))
    def canonical_comparison(entry):
        # This test isolates frozen doccheck propagation. Existing global option
        # balancing changes display order, so compare the same distractor set in
        # stable order instead of testing the separate positional snapshot issue.
        row = comparison_row(entry)
        return {**row, "distractors": sorted(row["distractors"])}
    kwargs = dict(retry_attempts=1, execute=execute, admit=ingestion.ingest,
                  load_bank=lambda p: load_export(p, cert_id="data-engineer")["questions"],
                  comparison=canonical_comparison if refill else comparison_row, storage_id=storage_id, write=False)
    report = run_retry_batch(artifact, export, commands, **kwargs)
    assert len(report["waves"]) == (2 if refill else 1)
    assert serial[0] == (4 if refill else 3)
    for wave in report["waves"]:
        payload = json.loads(Path(wave["artifact"]).read_text())
        assert payload["doccheck_policy"] == "v6"
        for scope in payload["plan"]:
            assert scope["doccheck_policy"] == "v6"
        for entry in payload["candidates"]:
            assert entry["doccheck_policy"] == "v6"
            assert entry["decision_proof"]["failing_options"] == []
    def no_new_work(command):
        pytest.fail("Resume must reuse frozen generation and verdicts")
    kwargs["execute"] = no_new_work
    resumed = run_retry_batch(artifact, export, commands, resume=True, **kwargs)
    assert resumed["balance_population_ids"] == report["balance_population_ids"]
    assert serial[0] == (4 if refill else 3)
    db.assert_not_called()


def test_doccheck_policy_does_not_change_council_prompt_or_schema_bytes(harness, monkeypatch):
    run, db, _, _ = harness
    install_real_proof(monkeypatch)
    _, payload, result, _, _ = run(flags=("--doccheck-policy", "v6"))
    assert result.exit_code == 0, result.output
    entry, scope = payload["candidates"][0], payload["plan"][0]
    requests = [build_request(entry["candidate_id"], {**scope, "doccheck_policy": policy},
                              candidate_question(entry), entry["sources"], RECEIPTS,
                              argon_gate=True, execution_policy=payload["execution_policy"])
                for policy in ("v5", "v6")]
    for key in ("gates", "argon"):
        assert json.dumps(requests[0][key], sort_keys=True).encode() == json.dumps(requests[1][key], sort_keys=True).encode()
    db.assert_not_called()
