"""Offline PDE 5.3 policy, learner formatting and frozen-schema regression tests.

All scenarios and verdicts here are synthetic; no model quality is claimed.
"""
from copy import deepcopy
import hashlib
import json

import pytest

from scripts import judge_requests as runner
from shared import cli_models, cert_style
from shared.cert_style import check_cert_style, normalize_learner_prose
from shared.external_judge import build_request
from shared.gates import (
    gate_signatures, parse_gate_output, evaluate_gate, aggregate_gate_verdict,
    build_gate_inputs, blind_choice_map, eligible_gate_repair,
)
from shared.objective_style import style_policy, validate_style_policy, uses_pde_style
from shared.quality_gate import judge_three_gates
from test_generation_gate import QUESTION
from test_three_gates_v4 import bundle

PDE = style_policy("data-engineer:standard:2.1:1")
LEGACY = {**PDE, "version": "5.1"}
PMLE = style_policy("machine-learning-engineer:standard:2.1:1")


def question(words=60):
    stem = "Your team runs an order analysis pipeline in BigQuery. "
    # Mechanical boundary fixture, not a proposed authored exam question.
    stem += "observation " * (words - len(stem.split()) - 4)
    stem += "What should you do?"
    return {**QUESTION, "stem": stem}


def pde_bundle(q=None):
    q = question() if q is None else q
    return {**bundle(q), "style": {**bundle(q)["style"], "inference_required": True,
                                  "options_no_goal_restatement": True,
                                  "distractors_no_generic_filler": True}}


def request(q=None, *, policy=PDE, ident="candidate-1"):
    q = question() if q is None else q
    url, quote = "https://docs.cloud.google.com/dataflow/docs/overview", "Synthetic source proof."
    sources = [{"url": url, "requested_url": url, "text": quote, "retrieved_at": "2026-10-20T00:00:00Z",
                "text_sha256": hashlib.sha256(quote.encode()).hexdigest()}]
    evidence = [{"option_label": label, "url": url, "quote": quote} for label in "ABCD"]
    scope = {"cert_id": "data-engineer", "objective_id": PDE["objective_id"], "domain_prompt": "Synthetic objective"}
    if policy is not None:
        scope["style_policy"] = policy
    return build_request(ident, scope, q, sources, evidence)


def test_only_frozen_pde52_or_pde53_activates_tuning():
    assert PDE == {"version": "5.3", "objective_id": "data-engineer:standard:2.1:1", "allowance": None}
    assert PMLE["version"] == "5.1"
    assert uses_pde_style(PDE)
    assert not uses_pde_style(LEGACY) and not uses_pde_style(None) and not uses_pde_style(PMLE)
    assert validate_style_policy(LEGACY, PDE["objective_id"]) == LEGACY
    for broken in ({**PDE, "version": "5.4"}, {**PMLE, "version": "5.2"},
                   {**PDE, "extra": True}, {**PDE, "allowance": "general_ml_mlops"}):
        with pytest.raises(ValueError): uses_pde_style(broken)
    with pytest.raises(ValueError): validate_style_policy(PDE, "another:objective")
    with pytest.raises(ValueError): gate_signatures(4, style_policy=PDE)
    with pytest.raises(ValueError): gate_signatures(style_policy=PDE, cert_id="machine-learning-engineer")


@pytest.mark.parametrize("words,passed", [(29, False), (30, True), (39, True), (50, True), (60, True), (85, True), (86, False)])
def test_stem_hard_boundaries(words, passed):
    result = check_cert_style(question(words), style_policy=PDE)
    assert result["passed"] is passed
    assert result["metrics"]["stem_words"] == words
    assert result["metrics"]["short_stem"] is (30 <= words <= 50)
    assert check_cert_style(question(words), style_policy=LEGACY)["passed"]
    assert check_cert_style(question(words))["metrics"] == {"active": False}


def test_option_targets_reported_without_padding_or_new_hard_limits():
    q = question()
    for field, words in zip(cert_style.OPTION_FIELDS, [14, 15, 22, 23]):
        q[field] = "action " * words
    result = check_cert_style(q, style_policy=PDE)
    assert result["passed"]
    assert list(result["metrics"]["options_within_target"].values()) == [False, True, True, False]


@pytest.mark.parametrize("prompt", ["Choose two answers.", "Select 2 choices.", "Pick all applicable actions.",
                                    "Which two actions should you use?", "Choose the two best actions."])
def test_multiselect_is_not_supported(prompt):
    q = question(); q["stem"] += " " + prompt
    assert not check_cert_style(q, style_policy=PDE)["passed"]


def test_named_aliases_normalize_only_learner_prose_and_reject_residual_drift():
    q = question()
    q["stem"] = q["stem"].replace("BigQuery", "Managed Service for Apache Spark")
    q["correct_answer"] = "Use Cloud Bigtable for this workload."
    q["correct_explanation"] = "Managed Service for Apache Airflow runs the workflow."
    evidence = [{"quote": "Managed Service for Apache Spark", "url": "https://example.test/Cloud Bigtable"}]
    q["option_evidence"] = evidence
    q["source"] = {"text": "Managed Service for Apache Spark", "sha256": "unaltered"}
    q["distractor_1_explanation"] += " https://example.test/Managed-Service-for-Apache-Spark"
    original = deepcopy(q)
    assert not check_cert_style(q, style_policy=PDE)["passed"]
    normalized = normalize_learner_prose(q, style_policy=PDE)
    assert "Dataproc" in normalized["stem"] and "Managed Service" not in normalized["stem"]
    assert normalized["correct_answer"] == "Use Bigtable for this workload."
    assert normalized["correct_explanation"] == "Cloud Composer runs the workflow."
    assert normalized["option_evidence"] is evidence
    assert normalized["source"] == original["source"]
    assert normalized["distractor_1_explanation"] == original["distractor_1_explanation"]
    assert q == original and check_cert_style(normalized, style_policy=PDE)["passed"]
    assert normalize_learner_prose(q, style_policy=LEGACY) == q
    assert normalize_learner_prose(q, style_policy=PMLE) == q


def test_descriptive_phrases_and_brands_without_a_guide_canonical_are_not_rejected(monkeypatch):
    q = question(); q["correct_answer"] = "Use a managed service for distributed Spark processing and schedule the workflow."
    assert check_cert_style(q, style_policy=PDE)["passed"]
    # Alias cannot activate unless its exact canonical product is in guide objectives.
    monkeypatch.setattr(cert_style, "PDE_NAME_ALIASES", (("New Brand", "Absent Product", "https://example.test/name"),))
    q["correct_answer"] = "Use New Brand."
    assert normalize_learner_prose(q, style_policy=PDE) == q
    assert check_cert_style(q, style_policy=PDE)["passed"]


@pytest.mark.parametrize("field", cert_style.LEARNER_FIELDS)
def test_missing_learner_fields_fail_closed(field):
    q = question(); q.pop(field)
    assert not check_cert_style(q, style_policy=PDE)["passed"]


@pytest.mark.parametrize("check", ["inference_required", "options_no_goal_restatement"])
@pytest.mark.parametrize("defect", ["missing", "false", "string", "extra"])
def test_new_semantic_checks_are_mandatory_exact_booleans(check, defect):
    raw = pde_bundle()
    if defect == "missing": raw["style"].pop(check)
    elif defect == "false": raw["style"][check] = False
    elif defect == "string": raw["style"][check] = "true"
    else: raw["style"]["unexpected"] = True
    if defect == "false":
        result = aggregate_gate_verdict(question(), raw, style_policy=PDE)
        assert not result.passed and check in result.reason
    else:
        with pytest.raises(cli_models.CLISchemaError):
            aggregate_gate_verdict(question(), raw, style_policy=PDE)


def test_symptom_infrastructure_vs_root_cause_policy_and_no_old_schema_waiver():
    signature = gate_signatures(style_policy=PDE)["style"]
    text = signature.instructions
    assert "root cause" in text and "existing infrastructure" in text and "best action" in text
    assert "inference_required" in signature.output_fields
    assert "inference_required" not in gate_signatures(style_policy=LEGACY)["style"].output_fields
    assert "inference_required" not in gate_signatures(cert_id="data-engineer")["style"].output_fields
    assert evaluate_gate("style", pde_bundle()["style"], question(), style_policy=PDE)[0]
    with pytest.raises(cli_models.CLISchemaError): parse_gate_output("style", bundle()["style"], style_policy=PDE)
    with pytest.raises(cli_models.CLISchemaError): parse_gate_output("style", pde_bundle()["style"], style_policy=LEGACY)
    assert parse_gate_output("style", bundle()["style"], style_policy=LEGACY)
    raw = pde_bundle(); raw["style"].update(verdict="FAIL", inference_required=False)
    eligible_gate_repair(raw, style_policy=PDE)
    with pytest.raises(cli_models.CLISchemaError): eligible_gate_repair(raw)


def test_reference_uses_only_aggregate_rules_no_pmle_examples_or_private_data():
    inputs = build_gate_inputs(question(), "PRIVATE_SCOPE", "PRIVATE_DOCUMENT", [{"quote": "PRIVATE_QUOTE"}], style_policy=PDE)
    ref = inputs["style"]["style_reference"]
    assert "30–85" in ref and "15–22" in ref and "85%" in ref and "20%" in ref
    assert "Approved item" not in ref and "Exemplar" not in ref
    assert "Dataproc" in ref and "root-cause diagnosis" in ref
    assert "PRIVATE_" not in json.dumps(inputs["style"])
    assert set(inputs["style"]) == {"stem", "options", "style_reference"}


def test_inline_calls_use_frozen_schema_and_cannot_accept_missing_check():
    raw = pde_bundle(); predictors = {name: (lambda data: lambda **_: data)(data) for name, data in raw.items()}
    args = dict(documentation_context="docs", model="claude", generator_model="codex",
                option_evidence=[{"quote": "proof"}], predictors=predictors, style_policy=PDE)
    assert judge_three_gates(question(), "scope", **args).passed
    raw["style"].pop("inference_required")
    assert not judge_three_gates(question(), "scope", **args).passed


def test_frozen_request_schema_execution_and_legacy_rebuild(monkeypatch, tmp_path):
    current, legacy, absent = request(), request(policy=LEGACY), request(policy=None)
    assert "inference_required" in current["gates"]["style"]["verdict_schema"]["required"]
    assert "inference_required" not in legacy["gates"]["style"]["verdict_schema"]["properties"]
    assert "inference_required" not in absent["gates"]["style"]["verdict_schema"]["properties"]
    assert current == request() and legacy == request(policy=LEGACY) and absent == request(policy=None)
    requests, verdicts = tmp_path/"requests", tmp_path/"verdicts"
    requests.mkdir(); path = requests/"candidate-1.json"
    path.write_text(json.dumps(current))
    outputs = pde_bundle(); calls = []
    def fake(model, prompt, schema):
        name = next(name for name, gate in current["gates"].items() if gate["verdict_schema"] == schema)
        assert prompt == current["gates"][name]["judge_prompt"]
        calls.append(name); return outputs[name]
    monkeypatch.setattr(cli_models, "run_claude_request", fake)
    assert runner.run_requests(requests, verdicts, parallel=1).completed == 1
    assert calls == ["blind_solver", "style", "evidence"]
    assert json.loads((verdicts/path.name).read_text()) == outputs


def test_tampered_frozen_policy_or_missing_check_block_runner_before_or_after_transport(monkeypatch, tmp_path):
    requests, verdicts = tmp_path/"requests", tmp_path/"verdicts"
    requests.mkdir(); path = requests/"candidate-1.json"
    current = request(); current["style_policy"] = LEGACY
    path.write_text(json.dumps(current))
    monkeypatch.setattr(cli_models, "run_claude_request", lambda *args: pytest.fail("No call for mismatched schema"))
    assert runner.run_requests(requests, verdicts).failed == 1
    current = request(); path.write_text(json.dumps(current))
    outputs = pde_bundle(); outputs["style"].pop("inference_required")
    def missing(model, prompt, schema):
        name = next(name for name, gate in current["gates"].items() if gate["verdict_schema"] == schema)
        return outputs[name]
    monkeypatch.setattr(cli_models, "run_claude_request", missing)
    assert runner.run_requests(requests, verdicts).failed == 1
    assert not (verdicts/path.name).exists()


def test_cli_dispatch_accepts_new_exact_schema_without_live_process(monkeypatch):
    calls = []
    monkeypatch.setattr(cli_models, "_run_cli", lambda model, prompt, schema, signature, **kw: calls.append(signature) or {"synthetic": True})
    for signature in [gate_signatures(style_policy=PDE)["style"]]:
        assert cli_models.run_claude_request("claude", "frozen", cli_models.output_model(signature).model_json_schema()) == {"synthetic": True}
    assert len(calls) == 1


@pytest.mark.parametrize("policy,cert,expected", [
    (None, None, "37d39323daa209542b480662a8155342f3f48e11bd0b9a17e43e0cbf788fa993"),
    (PMLE, "machine-learning-engineer", "37d39323daa209542b480662a8155342f3f48e11bd0b9a17e43e0cbf788fa993"),
    (LEGACY, "data-engineer", "6b79970c4236aa80280951f6d5b197c1a2474b0434f1a35a5a9c336250efc921"),
])
def test_baseline_prompt_and_schema_bytes_unchanged(policy, cert, expected):
    # Hashes computed from origin/main shared/gates.py using this exact public
    # synthetic fixture/input JSON; covers all three full prompts and schemas.
    inputs = build_gate_inputs(QUESTION, "SCOPE", "DOCS", [{"quote": "PROOF"}], style_policy=policy)
    signatures = gate_signatures(cert_id=cert, style_policy=policy)
    frozen = {name: {"schema": cli_models.output_model(signature).model_json_schema(),
                     "prompt": cli_models.signature_prompt(signature, inputs[name])}
              for name, signature in signatures.items()}
    encoded = json.dumps(frozen, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()
    assert hashlib.sha256(encoded).hexdigest() == expected


def test_legacy_policy_does_not_override_historical_signature_certificate_selection():
    from shared.gates import GATE_SIGNATURES
    assert gate_signatures(style_policy=LEGACY)["style"] is GATE_SIGNATURES["style"]
    assert gate_signatures(cert_id="GCP_PM_ML_ENG", style_policy=PMLE)["style"] is GATE_SIGNATURES["style"]


@pytest.mark.parametrize("policy,active", [(PDE, True), (LEGACY, False), (PMLE, False)])
def test_sensitive_data_product_name_follows_current_guide_only_for_new_pde(policy, active):
    original = question()
    original["correct_answer"] = "Use Sensitive Data Protection to mask the selected identifiers before distributing the dataset to the partner team."
    original["evidence"] = [{"quote": "Sensitive Data Protection", "url": "https://example.com/Sensitive-Data-Protection"}]
    original["sources"] = [{"text": "Sensitive Data Protection"}]
    normalized = normalize_learner_prose(original, style_policy=policy)
    assert normalized["evidence"] == original["evidence"]
    assert normalized["sources"] == original["sources"]
    if active:
        assert "Cloud DLP" in normalized["correct_answer"]
        assert "Sensitive Data Protection" not in normalized["correct_answer"]
        assert not check_cert_style(original, style_policy=policy)["passed"]
        assert check_cert_style(normalized, style_policy=policy)["passed"]
    else:
        assert normalized == original


def test_validator_short_stem_is_only_a_frozen_pde_allowance():
    from shared.validator import validate_question
    q = question(30)
    assert not any("word count" in error for error in validate_question(q, style_policy=PDE).errors)
    for policy in (None, LEGACY, PMLE):
        assert any("between 40 and 130" in error for error in validate_question(q, style_policy=policy).errors)
