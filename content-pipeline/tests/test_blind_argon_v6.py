"""Offline v6 blind Argon contracts and recorded-verdict replay; no model/DB IO."""
from copy import deepcopy
import hashlib
import json

import click
import pytest

from scripts import judge_requests as runner, ingest_external_verdicts as ingest
from shared import argon_gate as argon
from shared.cli_models import CLISchemaError
from shared.external_judge import (
    BLIND_ARGON_POLICY, build_request, canonical_sha256, require_publishable_request,
)
from shared.gates import blind_choice_map, evaluate_gate
from test_judge_short_circuit import DATA, request as replay_request
from test_pipeline_v5 import argon_case, prepare_v5
from test_three_gates_v4 import v4
from test_external_ingest import case, save_input, invoke


def v6_request(row):
    frozen = replay_request(row, False)
    frozen["execution_policy"] = BLIND_ARGON_POLICY
    frozen["argon"]["version"] = 3
    return frozen


def v6_argon():
    frozen, raw = argon_case()
    frozen["version"] = raw["version"] = 3
    raw["request_sha256"] = canonical_sha256(frozen)
    return frozen, raw


def test_learner_only_argon_prompt_has_only_shuffled_stem_and_choices(v4):
    case, _, _ = v4
    scope = case[2]["plan"][0]
    from shared.external_judge import candidate_question
    from shared.option_order import canonical_evidence
    question = candidate_question(case[2]["candidates"][0])
    frozen = build_request(case[2]["candidates"][0]["candidate_id"], scope, question,
        case[2]["candidates"][0]["sources"], canonical_evidence(case[2]["candidates"][0]),
        argon_gate=True, execution_policy=BLIND_ARGON_POLICY)
    require_publishable_request(frozen)
    blind = frozen["argon"]["calls"]["blind"]["judge_prompt"]
    user = blind.split("\n\nUSER:\n", 1)[1]
    assert "[[ ## stem ## ]]" in user and "[[ ## options ## ]]" in user
    assert not any(name in user for name in (
        "correct_answer", "correct_explanation", "domain_context", "documentation_context",
        "option_evidence", "objective_id", "style_reference"))
    for name in ("correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation"):
        if name in question:
            assert question[name] not in user
    original = dict(zip("ABCD", (question[n] for n in ("correct_answer", "distractor_1", "distractor_2", "distractor_3"))))
    options = json.JSONDecoder().raw_decode(user.split("[[ ## options ## ]]", 1)[1].lstrip())[0]
    assert options == {label: original[origin] for label, origin in blind_choice_map(question).items()}
    assert set(frozen["argon"]["calls"]) == {"blind", "review"}


@pytest.mark.parametrize("artifact", DATA, ids=lambda a: a["source"])
@pytest.mark.parametrize("sample", [1, 5])
def test_recorded_v1_verdicts_replay_through_v6_runner_and_ingest(tmp_path, monkeypatch, artifact, sample):
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    frozen_by_id, outputs, argon_outputs, called = {}, {}, {}, []
    for row in artifact["rows"]:
        frozen = v6_request(row)
        ident = row["candidate_id"]
        frozen_by_id[ident] = frozen
        for name, gate in frozen["gates"].items():
            gate["judge_prompt"] = ident + " " + gate["judge_prompt"]
            outputs[gate["judge_prompt"]] = (ident, name, row["verdict"][name])
        for name, gate in frozen["argon"]["calls"].items():
            gate["judge_prompt"] = ident + " argon." + name
            argon_outputs[gate["judge_prompt"]] = (ident, name, row["verdict"]["argon"][name])
        (requests / (ident + ".json")).write_text(json.dumps(frozen))
    def claude(model, prompt, schema):
        ident, name, raw = outputs[prompt]
        called.append((ident, name))
        return deepcopy(raw)
    def argon_call(name, gate):
        ident, expected_name, raw = argon_outputs[gate["judge_prompt"]]
        assert expected_name == name
        called.append((ident, "argon." + name))
        return deepcopy(raw)
    monkeypatch.setattr(runner.cli_models, "run_claude_request", claude)
    monkeypatch.setattr(argon, "run_call", argon_call)
    summary = runner.run_requests(requests, verdicts, argon_gate=True, parallel=1, full_gate_sample=sample)
    assert summary.completed == len(artifact["rows"]) and summary.failed == 0
    for ordinal, row in enumerate(sorted(artifact["rows"], key=lambda r: r["candidate_id"]), 1):
        ident = row["candidate_id"]
        previous = replay_request(row, False)["argon"]
        original = deepcopy(row["verdict"])
        original["argon"]["request_sha256"] = canonical_sha256(previous)
        old = ingest._external_decision(row["question"], {}, [], [], original, "codex",
            rules_version=5, argon_request=previous)
        frozen = frozen_by_id[ident]
        require_publishable_request(frozen)
        raw = json.loads((verdicts / (ident + ".json")).read_text())
        new = ingest._external_decision(row["question"], {}, [], [], raw, "codex",
            rules_version=5, argon_request=frozen["argon"])
        assert new.passed == old.passed
        sequence = [name for candidate, name in called if candidate == ident]
        expected = []
        for name in ("style", "evidence", "blind_solver"):
            expected.append(name)
            if ordinal % sample and not evaluate_gate(name, row["verdict"][name], row["question"])[0]:
                break
        if len(expected) == 3 and (ordinal % sample == 0 or all(
                evaluate_gate(name, row["verdict"][name], row["question"])[0] for name in expected)):
            expected.append("argon.blind")
            if ordinal % sample == 0 or evaluate_gate("blind_solver", row["verdict"]["argon"]["blind"], row["question"])[0]:
                expected.append("argon.review")
        assert sequence == expected
        if new.passed:
            assert set(raw["argon"]) == {"model", "version", "request_sha256", "blind", "review"}
            assert raw["blind_solver"]["confidence"] >= .8 and raw["argon"]["blind"]["confidence"] >= .8


@pytest.mark.parametrize("sampled", [False, True])
def test_argon_blind_veto_short_circuits_only_unsampled_review(monkeypatch, sampled):
    frozen, raw = v6_argon()
    raw["blind"]["confidence"] = .79
    calls = []
    def replay(name, gate):
        calls.append(name)
        return raw[name]
    monkeypatch.setattr(argon, "run_call", replay)
    from test_external_generation import QUESTION
    result = argon.run_argon(frozen, question=QUESTION, full_review=sampled)
    assert calls == (["blind", "review"] if sampled else ["blind"])
    assert not argon.evaluate_argon(QUESTION, result, frozen)[0]


def test_argon_call_order_is_independent_of_json_key_order(monkeypatch):
    frozen, raw = v6_argon()
    frozen["calls"] = dict(reversed(list(frozen["calls"].items())))
    calls = []
    monkeypatch.setattr(argon, "run_call", lambda name, gate: (calls.append(name), raw[name])[1])
    argon.run_argon(frozen)
    assert calls == ["blind", "review"]


@pytest.mark.parametrize("defect", ["missing_blind", "low", "wrong", "ambiguous", "uncertain", "bool", "extra", "hash", "skip"])
def test_v3_cannot_approve_invalid_or_failing_blind(defect):
    frozen, raw = v6_argon()
    from test_external_generation import QUESTION
    if defect == "missing_blind": raw.pop("blind")
    elif defect == "low": raw["blind"]["confidence"] = .79
    elif defect == "wrong": raw["blind"]["choice"] = next(label for label, origin in blind_choice_map(QUESTION).items() if origin != "A")
    elif defect == "ambiguous": raw["blind"]["ambiguous_answers"] = True
    elif defect == "uncertain": raw["blind"]["verdict"] = "UNCERTAIN"
    elif defect == "bool": raw["blind"]["ambiguous_answers"] = "false"
    elif defect == "extra": raw["blind"]["extra"] = True
    elif defect == "hash": raw["request_sha256"] = "a" * 64
    elif defect == "skip": raw["review"] = {"status": "skipped", "reason": "prior_gate_failed", "gate": "argon.blind"}
    try:
        assert not argon.evaluate_argon(QUESTION, raw, frozen)[0]
    except (ValueError, CLISchemaError):
        pass


@pytest.mark.parametrize("mutation", ["old_policy", "old_argon", "no_argon", "no_blind", "bad_schema", "missing_gate", "canary"])
def test_publishing_policy_refuses_old_or_incomplete_requests(mutation):
    frozen = v6_request(DATA[0]["rows"][0])
    if mutation == "old_policy": frozen["execution_policy"] = "short_circuit_v1"
    elif mutation == "old_argon": frozen["argon"]["version"] = 1
    elif mutation == "no_argon": frozen.pop("argon")
    elif mutation == "no_blind": frozen["argon"]["version"] = 2; frozen["argon"]["calls"].pop("blind")
    elif mutation == "bad_schema": frozen["gates"]["blind_solver"]["verdict_schema"] = {}
    elif mutation == "missing_gate": frozen["gates"].pop("evidence")
    elif mutation == "canary": frozen["council_canary"] = True
    with pytest.raises(ValueError, match="Publishing requires"):
        require_publishable_request(frozen)


@pytest.mark.parametrize("where", ["artifact", "candidate", "directory", "ancestor", "request_directory"])
@pytest.mark.parametrize("dry_run", [False, True])
def test_canary_ingest_refuses_before_db_or_artifact_mutation(case, where, dry_run, request):
    path, verdicts, payload, _, factory, _, request_path = case
    if where == "artifact": payload["council_canary"] = True
    elif where == "candidate": payload["candidates"][0]["council_canary"] = True
    else:
        directory = {"directory": path.parent, "ancestor": path.parent.parent,
                     "request_directory": request_path.parent}[where]
        marker = directory / ".council-canaries"
        request.addfinalizer(lambda: marker.unlink(missing_ok=True))
        marker.touch()
    save_input(case)
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="[Cc]anar"):
        ingest.ingest(path, verdicts, dry_run=dry_run)
    factory.assert_not_called()
    assert path.read_bytes() == before
    with pytest.raises(click.ClickException, match="Strict ingestion preflight failed"):
        ingest._strict_preflight(path, verdicts, payload)


@pytest.mark.parametrize("version", [1, 2])
def test_old_frozen_argon_request_still_evaluates_but_never_meets_publish_policy(version):
    row = DATA[0]["rows"][0]
    frozen = replay_request(row, version == 2)
    raw = deepcopy(row["verdict"])
    raw["argon"]["version"] = version
    raw["argon"]["request_sha256"] = canonical_sha256(frozen["argon"])
    if version == 2:
        raw["argon"].pop("blind")
    ingest._external_decision(row["question"], {}, [], [], raw, "codex", rules_version=5, argon_request=frozen["argon"])
    with pytest.raises(ValueError):
        require_publishable_request(frozen)


@pytest.mark.parametrize("prior_veto", ["none", "style", "argon.blind"])
def test_sampled_system_error_preserves_prior_quality_veto(tmp_path, monkeypatch, prior_veto):
    from test_external_generation import QUESTION
    from test_three_gates_v4 import bundle
    row = {"candidate_id": "candidate-a", "question": QUESTION}
    frozen = v6_request(row)
    requests, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    requests.mkdir()
    (requests / "candidate-a.json").write_text(json.dumps(frozen))
    raw = bundle(QUESTION)
    if prior_veto == "style":
        raw["style"]["current_names"] = False
    def claude(model, prompt, schema):
        name = next(name for name, gate in frozen["gates"].items() if gate["judge_prompt"] == prompt)
        if name == "evidence" and prior_veto != "argon.blind":
            raise runner.cli_models.CLITimeoutError("secret timeout body")
        return raw[name]
    _, argon_raw = v6_argon()
    argon_raw["blind"]["confidence"] = .79
    def argon_call(name, gate):
        if name == "review":
            raise RuntimeError("secret provider response")
        return argon_raw[name]
    monkeypatch.setattr(runner.cli_models, "run_claude_request", claude)
    monkeypatch.setattr(argon, "run_call", argon_call)
    summary = runner.run_requests(requests, verdicts, argon_gate=True, parallel=1, full_gate_sample=1)
    assert summary.failed == 1
    record = json.loads((verdicts / ".failures/candidate-a.json").read_text())
    assert record["quality_rejected"] is (prior_veto != "none")
    assert "secret" not in json.dumps(record)
    assert not (verdicts / "candidate-a.json").exists()


@pytest.mark.parametrize("policy", ["short_circuit_v1", BLIND_ARGON_POLICY])
@pytest.mark.parametrize("blind_passes", [True, False])
def test_versioned_requests_rebuild_and_real_ingest_remain_draft_only(v4, policy, blind_passes):
    from shared.external_judge import candidate_question
    from shared.option_order import canonical_evidence
    case, _, _ = v4
    _, raw = prepare_v5(case, argon=True)
    payload, entry = case[2], case[2]["candidates"][0]
    payload["execution_policy"] = policy
    question = candidate_question(entry)
    frozen = build_request(entry["candidate_id"], payload["plan"][0], question, entry["sources"],
        canonical_evidence(entry), argon_gate=True, execution_policy=policy)
    case[6].write_text(json.dumps(frozen))
    entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    raw["argon"]["version"] = frozen["argon"]["version"]
    raw["argon"]["request_sha256"] = canonical_sha256(frozen["argon"])
    if policy == "short_circuit_v1":
        raw["argon"].pop("blind")
        with pytest.raises(ValueError):
            require_publishable_request(frozen)
    else:
        require_publishable_request(frozen)
        if not blind_passes:
            raw["argon"]["blind"]["confidence"] = .79
    (case[1] / case[6].name).write_text(json.dumps(raw))
    save_input(case)
    ingest._strict_preflight(case[0], case[1], payload)
    result = invoke(case, "--dry-run")
    passes = policy == "short_circuit_v1" or blind_passes
    assert result.exit_code == (0 if passes else 1), result.output
    case[4].assert_not_called()
    saved = json.loads(case[0].read_text())
    entry = saved["candidates"][0]
    assert entry["judge_verdict"]["passed"] is passes
    assert entry["accepted"] is False and "inserted_question_id" not in entry
