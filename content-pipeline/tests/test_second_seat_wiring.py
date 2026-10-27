"""Offline second-seat configuration wiring; synthetic verdicts are not quality proof."""
from copy import deepcopy
import json
from pathlib import Path
from unittest.mock import Mock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate, ingest_external_verdicts as ingest
from scripts import recouncil, run_domain_batch as batch
from shared.argon_gate import CODEX_MODEL, MODEL
from shared.external_judge import canonical_sha256
from shared.option_order import canonical_evidence
from test_pde_pipeline_integration import harness, save_verdicts
from test_recouncil import case, verdict


def add_second_seat_verdict(question, request, raw):
    from shared.gates import blind_choice_map
    key = next(label for label, original in blind_choice_map(question).items() if original == "A")
    raw["argon"] = {
        "model": request["argon"]["model"], "version": request["argon"]["version"],
        "request_sha256": canonical_sha256(request["argon"]),
        "blind": {"verdict": "PASS", "choice": key, "confidence": .9,
                  "ambiguous_answers": False, "reason": "Synthetic unique answer"},
        "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False,
                   "issues": [], "fix": "No changes needed"}}
    return raw


@pytest.mark.parametrize("transport", [None, "openrouter", "codex"])
def test_generation_freezes_only_nondefault_policy_and_ingests(harness, transport):
    flags = ["--argon-gate"]
    if transport is not None:
        flags += ["--second-seat-transport", transport]
    path, payload, result, _, _ = harness[0](flags=flags)
    assert result.exit_code == 0, result.output
    assert ("second_seat_transport" in payload) is (transport == "codex")
    entry = payload["candidates"][0]
    request = json.loads((path.parent / entry["external_judge_request"]["path"]).read_text())
    assert request["argon"]["model"] == (CODEX_MODEL if transport == "codex" else MODEL)
    scope, question, _ = ingest._validate_candidate(path, payload, entry)
    directory = save_verdicts(path, payload)
    verdict_path = directory / (entry["candidate_id"] + ".json")
    raw = add_second_seat_verdict(question, request, json.loads(verdict_path.read_text()))
    verdict_path.write_text(json.dumps(raw))
    assert ingest._external_decision(question, scope, entry["sources"], canonical_evidence(entry), raw,
                                    payload["model"], gate_version=2, rules_version=5,
                                    argon_request=request["argon"]).passed
    result = ingest.ingest(path, directory, dry_run=True, continue_quality_rejections=True)
    assert len(result["selected_candidates"]) == 1
    harness[1].assert_not_called()


def test_ingestion_rejects_artifact_transport_or_declared_model_mismatch(harness):
    path, payload, result, _, _ = harness[0](flags=["--argon-gate", "--second-seat-transport", "codex"])
    assert result.exit_code == 0, result.output
    entry = payload["candidates"][0]
    payload["second_seat_transport"] = "openrouter"
    with pytest.raises(ingest.CandidateValidationError, match="External request differs"):
        ingest._validate_candidate(path, payload, entry)
    with pytest.raises(ValueError, match="Second-seat model differs"):
        ingest._argon_request(path, entry, payload)
    payload["second_seat_transport"] = "codex"
    scope, question, _ = ingest._validate_candidate(path, payload, entry)
    request = json.loads((path.parent / entry["external_judge_request"]["path"]).read_text())
    raw = add_second_seat_verdict(question, request, {})
    bad_request = {**request["argon"], "model": "codex/not-the-frozen-model"}
    with pytest.raises(ValueError):
        ingest._external_decision(question, scope, entry["sources"], canonical_evidence(entry), raw,
                                 payload["model"], gate_version=2, argon_request=bad_request)
    # Codex second seats never remove the independent Claude requirement.
    with pytest.raises(ValueError):
        ingest._external_decision(question, scope, entry["sources"], canonical_evidence(entry), raw,
                                 "claude", gate_version=2, argon_request=request["argon"])


@pytest.mark.parametrize("transport", ["openrouter", "codex"])
@pytest.mark.parametrize("plan_only", [False, True])
def test_batch_propagates_only_nondefault_to_generation_and_judges(monkeypatch, tmp_path, transport, plan_only):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    _, _, commands = batch.batch_commands("all", "transport", "data-engineer", 4, 2,
                                          plan_only=plan_only, second_seat_transport=transport)
    for command in commands[:1 if plan_only else 2]:
        if transport == "codex":
            assert command[command.index("--second-seat-transport") + 1] == "codex"
        else:
            assert "--second-seat-transport" not in command
    if not plan_only:
        assert "--second-seat-transport" not in commands[-1]


@pytest.mark.parametrize("saved,selected", [(None, "codex"), ("codex", "openrouter"), ("unknown", "codex")])
def test_resume_cannot_change_second_seat_configuration(monkeypatch, tmp_path, saved, selected):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    artifact = tmp_path / ".cache/generation/data-engineer-v5-resume.json"
    artifact.parent.mkdir(parents=True)
    payload = {"cert_id": "data-engineer", "planned_count": 1, "plan": [{}]}
    if saved is not None:
        payload["second_seat_transport"] = saved
    artifact.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="Second-seat transport differs"):
        batch.batch_commands("all", "resume", "data-engineer", 1, 2,
                             resume=artifact, second_seat_transport=selected)


@pytest.mark.parametrize("transport", ["openrouter", "codex"])
def test_batch_plan_only_cli_propagates_flag(monkeypatch, tmp_path, transport):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    launch = Mock()
    monkeypatch.setattr(batch.subprocess, "run", launch)
    result = CliRunner().invoke(batch.main, ["all", "offline", "data-engineer", "--plan-only",
                                            "--second-seat-transport", transport])
    assert result.exit_code == 0, result.output
    command = launch.call_args.args[0]
    assert ("--second-seat-transport" in command) is (transport == "codex")


@pytest.mark.parametrize("artifact_present", [False, True])
def test_recouncil_uses_selected_transport_for_receipts_and_full_sources(case, artifact_present):
    row, artifact, _ = case
    artifact = artifact if artifact_present else None
    default = recouncil.prepare_question(row, artifact)
    explicit_default = recouncil.prepare_question(row, artifact, second_seat_transport="openrouter")
    assert default == explicit_default
    prepared = recouncil.prepare_question(row, artifact, second_seat_transport="codex")
    assert "request" in prepared, prepared
    assert prepared["request"]["argon"]["model"] == CODEX_MODEL
    assert prepared["request_sha256"] != default["request_sha256"]
    expected = deepcopy(default["request"])
    expected["argon"]["model"] = CODEX_MODEL
    assert prepared["request"] == expected  # Prompts, schemas and pass policy remain frozen.
    raw = verdict(prepared)
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "restore"
    raw["argon"]["model"] = MODEL
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "quarantined"


@pytest.mark.parametrize("module", [generate, batch, recouncil])
def test_cli_rejects_unknown_second_seat_transport(module):
    result = CliRunner().invoke(module.main, ["--second-seat-transport", "unknown"])
    assert result.exit_code != 0
    assert "Invalid value for '--second-seat-transport'" in result.output


@pytest.mark.parametrize("ready", [False, True])
def test_codex_restore_requires_selected_health_and_custom_pause(case, monkeypatch, tmp_path, ready):
    from shared import council_configuration as health
    row, _, _ = case
    output = tmp_path / "recouncil"
    prepared = recouncil.prepare_question(row, second_seat_transport="codex")
    verdicts = tmp_path / "verdicts"
    verdicts.mkdir()
    (verdicts / (prepared["request"]["candidate_id"] + ".json")).write_text(json.dumps(verdict(prepared)))
    state = tmp_path / "tools/council-health.json"
    check = Mock(side_effect=None if ready else ValueError("Selected council is not ready"))
    monkeypatch.setattr(health, "require_ready", check)
    client = Mock()
    client.rpc.return_value.execute.return_value.data = {"changed": True}
    result = recouncil.run_recouncil([row], output, verdict_dir=verdicts, apply=True,
                                     client=client, second_seat_transport="codex", health_state=state)
    check.assert_called_once_with(state=state, pause=state.with_name("PIPELINE_PAUSED"), second_seat_transport="codex")
    assert bool(client.rpc.call_count) is ready
    assert result["questions"][0]["outcome"] == ("restore" if ready else "quarantined")


def test_recouncil_refuses_to_replace_frozen_other_transport_request(case, tmp_path):
    row, _, _ = case
    output = tmp_path / "recouncil"
    original = recouncil.run_recouncil([row], output)
    assert "request_sha256" in original["questions"][0]
    request_path = next((output / "judge-requests").glob("*.json"))
    before = request_path.read_bytes()
    changed = recouncil.run_recouncil([row], output, second_seat_transport="codex")
    assert changed["questions"][0]["outcome"] == "quarantined"
    assert request_path.read_bytes() == before
