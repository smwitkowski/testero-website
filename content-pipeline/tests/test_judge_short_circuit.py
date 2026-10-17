"""Offline projection replay: real all-gate verdicts, no docs, transports or DB."""
import json
from pathlib import Path
import pytest
from scripts import judge_requests as runner
from scripts.ingest_external_verdicts import _external_decision
from shared import argon_gate as argon
from shared.cli_models import output_model
from shared.external_judge import canonical_sha256
from shared.gates import gate_signatures, evaluate_gate

DATA = json.loads((Path(__file__).parent / "fixtures/efficiency-judge-replay.json").read_text())

def request(row, modern):
    signatures = gate_signatures(5)
    gates = {name: {"judge_prompt": name, "verdict_schema": output_model(sig).model_json_schema()}
             for name, sig in signatures.items()}
    gates["evidence"]["judge_prompt"] = "evidence\n[[ ## question_data ## ]]\n" + json.dumps(row["question"])
    calls = {name: {"judge_prompt": name, "verdict_schema": output_model(sig).model_json_schema()}
             for name, sig in argon.SIGNATURES.items() if not modern or name == "review"}
    result = {"candidate_id": row["candidate_id"], "objective_id": "replay:standard:1.1:1",
              "gate_version": 5, "decision_provenance_sha256": "a" * 64,
              "gates": gates, "trimming": {}, "argon": {"model": argon.MODEL,
              "version": 2 if modern else 1, "calls": calls}}
    if modern:
        result["execution_policy"] = "short_circuit_v1"
    return result

@pytest.mark.parametrize("artifact", DATA, ids=lambda a: a["source"])
@pytest.mark.parametrize("sample", [1, 5])
def test_real_artifact_runner_and_ingest_replay(tmp_path, monkeypatch, artifact, sample):
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    requests = {}
    by_prompt = {}
    calls = []
    for row in artifact["rows"]:
        frozen = request(row, True)
        for name, gate in frozen["gates"].items():
            gate["judge_prompt"] = row["candidate_id"] + " " + gate["judge_prompt"]
            by_prompt[gate["judge_prompt"]] = (row, name)
        requests[row["candidate_id"]] = frozen
        (directory / (row["candidate_id"] + ".json")).write_text(json.dumps(frozen))
    def claude(model, prompt, schema):
        row, name = by_prompt[prompt]
        calls.append((row["candidate_id"], name))
        return row["verdict"][name]
    def review(frozen):
        # All rows have distinct review receipts; associate the frozen request by identity.
        ident = next(key for key, value in requests.items() if value["argon"] == frozen)
        return {"model": argon.MODEL, "version": 2, "request_sha256": canonical_sha256(frozen),
                "review": next(row["verdict"]["argon"]["review"] for row in artifact["rows"] if row["candidate_id"] == ident)}
    # Make projected review prompts unique, preserving original receipt fields.
    for ident, frozen in requests.items():
        frozen["argon"]["calls"]["review"]["judge_prompt"] = ident
        (directory / (ident + ".json")).write_text(json.dumps(frozen))
    monkeypatch.setattr(runner.cli_models, "run_claude_request", claude)
    monkeypatch.setattr(argon, "run_argon", review)
    summary = runner.run_requests(directory, verdicts, argon_gate=True, parallel=1, full_gate_sample=sample)
    assert summary.completed == len(artifact["rows"]) and summary.failed == 0
    for ordinal, row in enumerate(sorted(artifact["rows"], key=lambda r: r["candidate_id"]), 1):
        ident = row["candidate_id"]
        original_request = request(row, False)["argon"]
        original = json.loads(json.dumps(row["verdict"]))
        # Redacted request prompts cannot retain their original request digest.
        # Replay rebinds only this hash; source/request/verdict hashes remain in fixture provenance.
        original["argon"]["request_sha256"] = canonical_sha256(original_request)
        old = _external_decision(row["question"], {}, [], [], original, "codex", rules_version=5,
                                 argon_request=original_request)
        raw = json.loads((verdicts / (ident + ".json")).read_text())
        new = _external_decision(row["question"], {}, [], [], raw, "codex", rules_version=5,
                                 argon_request=requests[ident]["argon"])
        assert old.passed == new.passed
        expected = []
        for name in ("style", "evidence", "blind_solver"):
            expected.append(name)
            if ordinal % sample and not evaluate_gate(name, row["verdict"][name], row["question"])[0]:
                break
        assert [name for candidate, name in calls if candidate == ident] == expected
        if new.passed:
            assert raw["blind_solver"]["verdict"] == "PASS" and "review" in raw["argon"]




def _short_requests(directory):
    """Use recorded gate outputs, with Argon omitted to isolate sampling."""
    row = DATA[0]["rows"][0]
    outputs = {}
    for ident in ("candidate-a", "candidate-b"):
        frozen = request(row, True)
        frozen.pop("argon")
        frozen["candidate_id"] = ident
        for name, gate in frozen["gates"].items():
            gate["judge_prompt"] = ident + " " + gate["judge_prompt"]
            outputs[gate["judge_prompt"]] = row["verdict"][name]
        (directory / (ident + ".json")).write_text(json.dumps(frozen))
    return outputs


@pytest.mark.parametrize("change", ["interval", "cohort"])
def test_sampling_policy_rejects_resume_changes(tmp_path, monkeypatch, change):
    import click
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    outputs = _short_requests(directory)
    calls = []
    def backend(model, prompt, schema):
        calls.append(prompt)
        return outputs[prompt]
    monkeypatch.setattr(runner.cli_models, "run_claude_request", backend)
    runner.run_requests(directory, verdicts, parallel=1, full_gate_sample=2)
    before = list(calls)
    policy = (verdicts / ".sampling/policy.json").read_bytes()
    interval = 1 if change == "interval" else 2
    if change == "cohort":
        (directory / "candidate-a.json").unlink()
    with pytest.raises(click.ClickException, match="Sampling cohort or interval changed"):
        runner.run_requests(directory, verdicts, parallel=1, full_gate_sample=interval)
    assert calls == before
    assert (verdicts / ".sampling/policy.json").read_bytes() == policy


def test_candidate_filter_preserves_full_directory_sampling(tmp_path, monkeypatch):
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    outputs = _short_requests(directory)
    monkeypatch.setattr(runner.cli_models, "run_claude_request", lambda model, prompt, schema: outputs[prompt])
    first = runner.run_requests(directory, verdicts, candidate_ids=("candidate-a",), full_gate_sample=2)
    assert first.completed == 1
    policy = json.loads((verdicts / ".sampling/policy.json").read_text())
    assert policy == {"full_gate_sample": 2, "candidate_ids": ["candidate-a", "candidate-b"],
                      "sampled_ids": ["candidate-b"]}
    second = runner.run_requests(directory, verdicts, candidate_ids=("candidate-b",), full_gate_sample=2)
    assert second.completed == 1
    raw = json.loads((verdicts / "candidate-b.json").read_text())
    assert all("status" not in raw[name] for name in ("style", "evidence", "blind_solver"))


def test_question_marker_inside_docs_does_not_override_user_question(tmp_path, monkeypatch):
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    row = DATA[0]["rows"][0]
    frozen = request(row, True)
    frozen.pop("argon")
    frozen["candidate_id"] = "candidate-a"
    frozen["gates"]["evidence"]["judge_prompt"] = (
        "SYSTEM: quoted marker [[ ## question_data ## ]] invalid system data"
        "\n\nUSER:\n[[ ## question_data ## ]]\n" + json.dumps(row["question"])
        + "\n[[ ## documentation_context ## ]]\nAn example includes [[ ## question_data ## ]] not JSON")
    by_prompt = {gate["judge_prompt"]: row["verdict"][name] for name, gate in frozen["gates"].items()}
    (directory / "candidate-a.json").write_text(json.dumps(frozen))
    monkeypatch.setattr(runner.cli_models, "run_claude_request", lambda model, prompt, schema: by_prompt[prompt])
    result = runner.run_requests(directory, verdicts, full_gate_sample=1)
    assert result.completed == 1 and result.failed == 0
    raw = json.loads((verdicts / "candidate-a.json").read_text())
    assert raw == {name: row["verdict"][name] for name in ("style", "evidence", "blind_solver")}


def test_skip_marker_cannot_approve():
    from shared.gates import aggregate_gate_verdict
    row = DATA[0]["rows"][0]
    raw = {name: {"status": "skipped", "reason": "prior_gate_failed", "gate": "style"}
           for name in ("style", "evidence", "blind_solver")}
    with pytest.raises(ValueError):
        aggregate_gate_verdict(row["question"], raw)
