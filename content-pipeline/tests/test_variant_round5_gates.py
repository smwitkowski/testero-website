"""Offline round-5 policy binding; no model, network, database or production calls."""
from copy import deepcopy
import hashlib
import json

import pytest

from scripts import judge_requests as runner
from scripts.ingest_external_verdicts import _external_decision
from shared import cli_models
from shared.cli_models import output_model, signature_prompt, CLISchemaError
from shared.distractor_evidence import evidence_policy, verdict_with_policy
from shared.external_judge import build_request, canonical_sha256
from shared.gates import (gate_signatures, parse_gate_output, evaluate_gate,
                          aggregate_gate_verdict, build_gate_inputs)
from shared.objective_style import style_policy
from shared.quality_gate import QuestionQualitySignature
from test_generation_gate import QUESTION, URL, TEXT, QUOTES
from test_three_gates_v4 import bundle

BASELINES = {
    "4": {
        "blind_solver": {
            "instructions": "a717e09aeb38c4cda6472d334fd566e0f0c07c5abcddb194880c89fc9057d34e",
            "schema": "53fb42de270e7d2b81ab1c638e50a0b0bb159a9ab66c15425fbb01f1a0d11ce6"
        },
        "style": {
            "instructions": "4068ffd429d74a556f33ca76270984f1aacdb4e2de42e574a1067420f9e13f67",
            "schema": "a5a10103985a44bbbaf3b85321aa3ad6b657f2a81be6eb3b9d2178d7d6fb60c1"
        },
        "evidence": {
            "instructions": "a570f8566fa722c0b3504c3116436e374569beb796696a1b199550d7eb2a9e67",
            "schema": "855f937799bb99b5db6ddb85fa5a59743765d4309909a04eb6c3f0e8373696ea"
        }
    },
    "5": {
        "blind_solver": {
            "instructions": "a717e09aeb38c4cda6472d334fd566e0f0c07c5abcddb194880c89fc9057d34e",
            "schema": "53fb42de270e7d2b81ab1c638e50a0b0bb159a9ab66c15425fbb01f1a0d11ce6"
        },
        "style": {
            "instructions": "2b292b36801fa720f97f5191db85d5b0ad18c8be9efc2b6224b6fd316ae1f820",
            "schema": "3c10e1e7b61fdb86cfd875f2f509f22935174632d2c6f6c171cbaae9c0efe4c6"
        },
        "evidence": {
            "instructions": "a570f8566fa722c0b3504c3116436e374569beb796696a1b199550d7eb2a9e67",
            "schema": "855f937799bb99b5db6ddb85fa5a59743765d4309909a04eb6c3f0e8373696ea"
        }
    }
}

STYLE_NEW = ("moment_explains_discovery", "moment_fits_want", "no_unique_want_echo")
EVIDENCE_NEW = ("industry_realism", "distractor_industry_losing_premises")
ALLOWED = "machine-learning-engineer:standard:5.1:1"


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("No live model, retrieval or database calls")
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr(cli_models, "run_signature", forbidden)
    monkeypatch.setattr(cli_models, "run_claude_request", forbidden)
    monkeypatch.setattr("shared.argon_gate.run_argon", forbidden)
    monkeypatch.setattr("shared.doc_search.search_objective_docs", forbidden)
    monkeypatch.setattr("scripts.ingest_external_verdicts.database_client", forbidden)


def policy5_bundle():
    raw = bundle()
    raw["style"].update({name: True for name in STYLE_NEW})
    raw["evidence"].update({name: True for name in EVIDENCE_NEW})
    return raw


def frozen_request(*, policy=5, mode="strict", short=True, context=False):
    scope = {"cert_id": "machine-learning-engineer", "objective_id": ALLOWED,
             "domain_prompt": "Frozen scope only", "variant_policy_version": policy}
    if mode == "consistent":
        scope["distractor_evidence"] = evidence_policy(mode)
    sources = [{"requested_url": URL, "url": URL, "text": TEXT,
                "retrieved_at": "2026-10-04T00:00:00+00:00",
                "text_sha256": hashlib.sha256(TEXT.encode()).hexdigest()}]
    evidence = [{"option_label": label, "url": URL, "quote": quote}
                for label, quote in zip("ABCD", QUOTES)]
    variant_context = ({"metadata": {"industry": "synthetic", "scenario_moment": "migration"},
                        "parent": {"question": QUESTION, "scope": {"decision_plan": {"decision": "Frozen parent plan"}}}}
                       if context else None)
    return build_request("candidate-a", scope, QUESTION, sources, evidence,
                         argon_gate=True, execution_policy="short_circuit_v1" if short else None,
                         variant_context=variant_context)


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_policy5_derived_schemas_require_new_booleans(mode):
    signatures = gate_signatures(5, variant_policy_version=5,
                                 distractor_evidence=evidence_policy(mode))
    raw = policy5_bundle()
    for name, fields in (("style", STYLE_NEW), ("evidence", EVIDENCE_NEW)):
        schema = output_model(signatures[name]).model_json_schema()
        assert set(fields) <= set(schema["required"])
        for field in fields:
            assert schema["properties"][field]["type"] == "boolean"
        assert parse_gate_output(name, raw[name], variant_policy_version=5) == raw[name]
    assert "wash count" in signatures["evidence"].instructions
    assert "temperature" in signatures["evidence"].instructions
    assert "vessel" in signatures["evidence"].instructions
    assert ("Distractor evidence consistent v1" in signatures["evidence"].instructions) == (mode == "consistent")


@pytest.mark.parametrize("mode", ["strict", "consistent"])
@pytest.mark.parametrize("name,field", [("style", name) for name in STYLE_NEW] +
                         [("evidence", name) for name in EVIDENCE_NEW])
@pytest.mark.parametrize("value", [False, None, "true", 1, "missing"])
def test_each_new_check_fails_closed_and_cannot_be_waived(mode, name, field, value):
    raw = policy5_bundle()
    if value == "missing":
        raw[name].pop(field)
    else:
        raw[name][field] = value
    frozen = deepcopy(raw)
    policy = evidence_policy(mode)
    kwargs = {"variant_policy_version": 5, "variant": True, "style_policy": style_policy(ALLOWED)}
    if value is False:
        result = aggregate_gate_verdict(QUESTION, verdict_with_policy(raw, policy),
                                       distractor_evidence=policy, **kwargs)
        assert not result.passed and field in result.reason
        assert not evaluate_gate(name, raw[name], QUESTION, **kwargs)[0]
    else:
        with pytest.raises(CLISchemaError):
            aggregate_gate_verdict(QUESTION, verdict_with_policy(raw, policy),
                                   distractor_evidence=policy, **kwargs)
        with pytest.raises(CLISchemaError):
            parse_gate_output(name, raw[name], variant_policy_version=5)
    assert raw == frozen


@pytest.mark.parametrize("policy", [None, 3, 4])
@pytest.mark.parametrize("version", [4, 5])
def test_historical_instructions_and_schema_byte_bindings_unchanged(policy, version):
    expected = BASELINES[str(version)]
    for name, signature in gate_signatures(version, variant_policy_version=policy).items():
        assert canonical_sha256(signature.instructions) == expected[name]["instructions"]
        assert canonical_sha256(output_model(signature).model_json_schema()) == expected[name]["schema"]
    raw = bundle(version=version)
    assert aggregate_gate_verdict(QUESTION, raw, version=version,
                                  variant_policy_version=policy).passed


@pytest.mark.parametrize("policy", [True, False, 0, 1, 2, 6, "5", {}, []])
def test_unknown_policy_rejected_by_all_public_gate_apis(policy):
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        gate_signatures(variant_policy_version=policy)
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        parse_gate_output("style", bundle()["style"], variant_policy_version=policy)
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        evaluate_gate("style", bundle()["style"], QUESTION, variant_policy_version=policy)
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        aggregate_gate_verdict(QUESTION, bundle(), variant_policy_version=policy)
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        frozen_request(policy=policy)
    with pytest.raises(ValueError, match="Unsupported variant policy"):
        build_gate_inputs(QUESTION, "", "", [], variant_policy_version=policy)


def test_policy5_requires_rules5_and_rejects_old_outputs():
    with pytest.raises(ValueError, match="requires rules-v5"):
        gate_signatures(4, variant_policy_version=5)
    with pytest.raises(CLISchemaError):
        aggregate_gate_verdict(QUESTION, bundle(), variant_policy_version=5)
    with pytest.raises(CLISchemaError):
        aggregate_gate_verdict(QUESTION, policy5_bundle())


def test_style_stays_blind_and_checks_all_choices_symmetrically():
    question = {**QUESTION, "correct_explanation": "PRIVATE_RATIONALE"}
    inputs = build_gate_inputs(question, "PRIVATE_SCOPE", "PRIVATE_DOCS", [],
                               style_reference="Public style rules")
    signature = gate_signatures(variant_policy_version=5)["style"]
    prompt = signature_prompt(signature, inputs["style"])
    assert set(signature.input_fields) == {"stem", "options", "style_reference"}
    assert set(inputs["style"]) == {"stem", "options", "style_reference"}
    for secret in ("PRIVATE_RATIONALE", "PRIVATE_SCOPE", "PRIVATE_DOCS", "correct_answer"):
        assert secret not in prompt
    assert "symmetrically" in signature.instructions and "Use SQL to create" in signature.instructions
    assert "Cost/latency" in signature.instructions and "scale growth" in signature.instructions
    assert "minimizing changes" in signature.instructions


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_request_freezes_policy5_schema_prompt_and_reader_binding(tmp_path, mode):
    request = frozen_request(mode=mode)
    assert request["variant_policy_version"] == 5 and request["variant_mode"] == 1
    path = tmp_path / "candidate-a.json"
    path.write_text(json.dumps(request))
    canonical = output_model(QuestionQualitySignature).model_json_schema()
    assert runner._read_request(path, "candidate-a", canonical) == request
    signatures = gate_signatures(variant_policy_version=5, distractor_evidence=evidence_policy(mode))
    for name, signature in signatures.items():
        assert request["gates"][name]["verdict_schema"] == output_model(signature).model_json_schema()
    legacy = frozen_request(policy=4, mode=mode)
    assert "variant_policy_version" not in legacy and "variant_mode" not in legacy
    assert request["gates"]["blind_solver"] == legacy["gates"]["blind_solver"]
    for name in ("style", "evidence"):
        bad = deepcopy(request)
        bad["gates"][name] = legacy["gates"][name]
        path.write_text(json.dumps(bad))
        with pytest.raises(runner.RequestValidationError):
            runner._read_request(path, "candidate-a", canonical)
        bad["gates"][name]["verdict_schema"] = request["gates"][name]["verdict_schema"]
        path.write_text(json.dumps(bad))
        with pytest.raises(runner.RequestValidationError, match="prompt differs"):
            runner._read_request(path, "candidate-a", canonical)


@pytest.mark.parametrize("value", [True, "5", 4, 6, None])
def test_frozen_request_rejects_unknown_or_mistyped_explicit_policy(tmp_path, value):
    request = frozen_request()
    request["variant_policy_version"] = value
    path = tmp_path / "candidate-a.json"
    path.write_text(json.dumps(request))
    with pytest.raises(runner.RequestValidationError, match="variant policy"):
        runner._read_request(path, "candidate-a", {})


@pytest.mark.parametrize("name,field", [("style", name) for name in STYLE_NEW] +
                         [("evidence", name) for name in EVIDENCE_NEW])
def test_ingester_uses_scope_policy_and_preserves_short_circuit(name, field):
    raw = policy5_bundle()
    scope = {"variant_policy_version": 5, "variant_origin": {"parent_question_id": "parent", "ordinal": 1}}
    assert _external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5).passed
    raw[name][field] = False
    result = _external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5)
    assert not result.passed and field in result.reason
    for skipped in (("evidence", "blind_solver") if name == "style" else ("blind_solver",)):
        raw[skipped] = {"status": "skipped", "reason": "prior_gate_failed", "gate": name}
    raw["argon"] = {"status": "skipped", "reason": "prior_gate_failed"}
    result = _external_decision(QUESTION, scope, [], [], raw, "codex", rules_version=5,
                                argon_request={"version": 2})
    assert not result.passed and result.reason == "Short circuit: " + name


@pytest.mark.parametrize("mode", ["strict", "consistent"])
@pytest.mark.parametrize("name", ["style", "evidence"])
@pytest.mark.parametrize("missing", [False, True])
def test_runner_uses_frozen_policy_for_parsing_and_short_circuit(tmp_path, monkeypatch, mode, name, missing):
    request = frozen_request(mode=mode)
    directory, verdicts = tmp_path / "requests", tmp_path / "verdicts"
    directory.mkdir()
    (directory / "candidate-a.json").write_text(json.dumps(request))
    raw = policy5_bundle()
    field = (STYLE_NEW if name == "style" else EVIDENCE_NEW)[0]
    if missing:
        raw[name].pop(field)
    else:
        raw[name][field] = False
    seen = []
    def fake_claude(model, prompt, schema):
        gate = next(key for key, value in request["gates"].items() if value["judge_prompt"] == prompt)
        assert schema == request["gates"][gate]["verdict_schema"]
        seen.append(gate)
        return raw[gate]
    monkeypatch.setattr(cli_models, "run_claude_request", fake_claude)
    result = runner.run_requests(directory, verdicts, parallel=1, argon_gate=True, full_gate_sample=5)
    assert seen == (["style"] if name == "style" else ["style", "evidence"])
    if missing:
        assert result.failed == 1 and result.completed == 0
        failure = json.loads((verdicts / ".failures/candidate-a.json").read_text())
        assert failure["error_class"] == "CLISchemaError"
    else:
        assert result.completed == 1 and result.failed == 0
        saved = json.loads((verdicts / "candidate-a.json").read_text())
        assert saved["blind_solver"] == {"status": "skipped", "reason": "prior_gate_failed", "gate": name}
        assert saved["argon"] == {"status": "skipped", "reason": "prior_gate_failed"}


@pytest.mark.parametrize("score", [.55, .9])
def test_policy5_keeps_variant_boolean_waiver_rule(score):
    raw = policy5_bundle()
    raw["style"].update(verdict="FAIL", score=score, product_knowledge_hinge=False,
                        cloud_specific_alternative=False, generic_validation_key=True)
    kwargs = {"variant_policy_version": 5, "style_policy": style_policy(ALLOWED)}
    assert not aggregate_gate_verdict(QUESTION, raw, variant=True, **kwargs).passed
    assert aggregate_gate_verdict(QUESTION, raw, variant=False, **kwargs).passed


@pytest.mark.parametrize("stale_rejects", [False, True])
def test_direct_ingest_enforces_round5_length_batch_before_database(tmp_path, monkeypatch, stale_rejects):
    import click
    from scripts import ingest_external_verdicts as ingest
    from shared.cert_context import plan_questions
    from shared.option_order import store_options

    scope = plan_questions("machine-learning-engineer", 1, objective_ids=[ALLOWED])[0]
    scope.update(variant_policy_version=5, decision_objective={}, decision_plan={}, decision_proof={})
    question = {**QUESTION, "correct_answer": "Use Cloud Run managed service",
                "distractor_1": "Use BigQuery for batch analytics",
                "distractor_2": "Use Cloud Storage for objects",
                "distractor_3": "Use Compute Engine virtual machines"}
    evidence = [{"option_label": label, "url": URL, "quote": quote}
                for label, quote in zip("ABCD", QUOTES)]
    entry = {**scope, "candidate_id": "candidate-a", "index": 1, "stem": question["stem"],
             "sources": [], "accepted": False, "awaiting_external_judge": True,
             "external_judge_request": {"path": "requests/candidate-a.json", "sha256": "a" * 64}}
    store_options(entry, question, evidence)
    payload = {"cert_id": "machine-learning-engineer", "exam": "GCP_PM_ML_ENG",
               "model": "codex", "judge_model": "external", "external_judge_version": 2,
               "rules_version": 5, "difficulty": "MEDIUM", "generation_runs": {},
               "plan": [scope], "candidates": [entry],
               "existing_questions": {"sha256": None, "questions": []}}
    if stale_rejects:
        # Three stale longest-key PASS flags would falsely rescue one shortest
        # key: a 25% shortest fraction plus longest keys. None was judged here.
        for index in range(2, 5):
            stale_scope = {**scope, "key_length_rank": 4}
            stale = {**stale_scope, "candidate_id": f"stale-{index}", "index": index,
                     "stem": question["stem"], "sources": [], "accepted": True,
                     "awaiting_external_judge": False, "failure_stage": "schema",
                     "judge_verdict": {"passed": True}}
            store_options(stale, {**question, "correct_answer": "Use Cloud Run managed service now"}, evidence)
            payload["plan"].append(stale_scope)
            payload["candidates"].append(stale)
    artifact = tmp_path / "batch.json"
    artifact.write_text(json.dumps(payload))
    verdicts = tmp_path / "verdicts"
    verdicts.mkdir()
    raw = policy5_bundle()
    raw["blind_solver"] = bundle(question)["blind_solver"]
    (verdicts / "candidate-a.json").write_text(json.dumps(raw))
    # Isolate the batch gate: scope, provenance and duplication have separate tests.
    monkeypatch.setattr(ingest, "_scope", lambda payload, entry: scope)
    monkeypatch.setattr(ingest, "_validate_candidate", lambda *args: (scope, question, {"options": evidence}))
    monkeypatch.setattr(ingest, "check_near_duplicate", lambda *args, **kwargs: {"passed": True})
    populations = {}
    for name in ("balance_options", "key_position_report", "template_diversity_report"):
        original = getattr(ingest, name)
        def capture(entries, _name=name, _original=original):
            populations[_name] = [entry["candidate_id"] for entry in entries]
            return _original(entries)
        monkeypatch.setattr(ingest, name, capture)
    with pytest.raises(click.ClickException, match="Variant key-length batch report failed"):
        ingest.ingest(artifact, verdicts, dry_run=False)
    saved = json.loads(artifact.read_text())
    report = saved["variant_key_length_batch_report"]
    assert report["enforced"] and not report["passed"] and report["count"] == 1
    assert report["shortest_or_tied_count"] == 1 and report["unique_longest_count"] == 0
    assert saved["candidates"][0]["judge_verdict"]["passed"]
    assert saved["candidates"][0]["accepted"] is False
    assert all(ids == ["candidate-a"] for ids in populations.values())
    assert saved["key_position_report"]["count"] == 1
    # This objective's ML-practice allowance excludes it from template counting.
    assert saved["template_diversity_report"]["count"] == 0


@pytest.mark.parametrize("gate_version,rules_version", [(1, 5), (2, 4)])
def test_ingester_cannot_apply_policy5_to_legacy_gate_versions(gate_version, rules_version):
    with pytest.raises(ValueError, match="requires rules-v5"):
        _external_decision(QUESTION, {"variant_policy_version": 5}, [], [], bundle(), "codex",
                           gate_version=gate_version, rules_version=rules_version)


@pytest.mark.parametrize("policy", [3, 4])
@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_frozen_historical_parent_request_entire_binding_unchanged(policy, mode):
    # Recorded from HEAD's pre-round5 build_request, including frozen parent context.
    expected = {'3': {'strict': '9d91f325e1ceaea8520c4013dc9793a81f6c0efbcb781dc35aacbb5fb3b1900d', 'consistent': '3582a061ef89a592832c73b32827170a545073c48593d1f144e3d779cfeeed5b'}, '4': {'strict': 'b5a4eaee288fa6af4068d4df127763ad443b524bbb99511acea2178f36251c88', 'consistent': 'a8cdaba95b17cca5f544c14f71098316f5dcb0bd3739b995f14dd99486f4dbed'}}
    request = frozen_request(policy=policy, mode=mode, context=True)
    assert canonical_sha256(request) == expected[str(policy)][mode]
    assert (request.get("variant_mode") == 1) == (policy == 4)
    assert "variant_policy_version" not in request


@pytest.mark.parametrize("policy", [None, 3, 4, 5])
def test_policy5_only_style_reference_removes_legacy_length_clash_without_key_leak(policy):
    from shared.gates import default_style_reference
    inputs = build_gate_inputs(QUESTION, "PRIVATE_SCOPE", "PRIVATE_DOCS", [],
                               variant_policy_version=policy)
    reference = inputs["style"]["style_reference"]
    if policy == 5:
        assert "Rank 4 must be uniquely longest" in reference
        assert "The key must never be uniquely\nlongest." not in reference
        assert "Rank 4 should tie one other option" not in reference
        assert "At most 25% of a batch" in reference
        assert "shorter than A" not in reference
        assert "the ranked option" in reference
        assert "Review all shuffled choices symmetrically" in reference
    else:
        assert reference == default_style_reference()
        assert "Rank 4 should tie one other option" in reference


@pytest.mark.parametrize("policy", [3, 4, 5])
def test_claude_and_argon_style_references_use_frozen_scope_policy(policy):
    request = frozen_request(policy=policy, context=True)
    for prompt in (request["gates"]["style"]["judge_prompt"],
                   request["argon"]["calls"]["review"]["judge_prompt"]):
        if policy == 5:
            assert "Rank 4 must be uniquely longest" in prompt
            assert "The key must never be uniquely\nlongest." not in prompt
            assert "Rank 4 should tie one other option" not in prompt
            assert "shorter than A" not in prompt
        else:
            assert "Rank 4 should tie one other option" in prompt
