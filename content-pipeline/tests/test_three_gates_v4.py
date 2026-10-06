"""Offline rules-v4 isolation, strictness, frozen-flow and repair contracts."""
from copy import deepcopy
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import ingest_external_verdicts as ingest, judge_requests as runner
from scripts import export_judge_requests as exporter, repair_candidates as repair
from shared import cli_models
from shared.external_judge import build_request, candidate_question
from shared.gates import (
    GATE_SIGNATURES, STYLE_CHECKS, EVIDENCE_CHECKS, build_gate_inputs,
    blind_choice_map, parse_gate_output, aggregate_gate_verdict, eligible_gate_repair,
)
from shared.quality_gate import judge_three_gates, QuestionQualitySignature
from test_external_ingest import case, save_input, saved
from test_generation_gate import QUESTION


def bundle(question=QUESTION):
    key = next(label for label, original in blind_choice_map(question).items() if original == "A")
    return {"blind_solver": {"verdict": "PASS", "choice": key, "confidence": .9,
                             "ambiguous_answers": False, "reason": "Synthetic unique choice"},
            "style": {"verdict": "PASS", "score": .9, "reason": "Synthetic meaningful decision",
                      **{name: True for name in STYLE_CHECKS}},
            "evidence": {"verdict": "PASS", "score": .9, "reason": "Synthetic complete support",
                         **{name: True for name in EVIDENCE_CHECKS}}}


@pytest.fixture
def v4(case):
    payload, entry = case[2], case[2]["candidates"][0]
    payload["external_judge_version"] = 2
    scope = payload["plan"][0]
    provenance = {
        "key_length_rank": scope["key_length_rank"],
        "decision_objective": {"objective_id": scope["objective_id"], "objective_text": scope["objective_text"]},
        "decision_plan": {"objective_id": scope["objective_id"], "engineering_decision": "Choose managed application serving",
                          "business_consequence": "Keep order updates reliable", "existing_system": "Order tracking application",
                          "decisive_constraints": ["Minimize infrastructure upkeep"], "best_action": QUESTION["correct_answer"],
                          "mistakes": [{"action": QUESTION[name], "scenario_reason": "Synthetic scenario mismatch"}
                                       for name in ("distractor_1", "distractor_2", "distractor_3")]},
        "decision_proof": {"passed": True, "supported": True, "uniquely_best": True,
                           "scenario_reasons_supported": True, "no_feature_gotchas": True,
                           "reason": "Synthetic frozen docs veto proof", "mechanical_check": {"passed": True, "errors": []},
                           "reasons": [{**{name: receipt[name] for name in ("option_label", "url", "quote")},
                                        "scenario_reason": "Synthetic scenario reason"} for receipt in entry["evidence"]]},
    }
    scope.update(deepcopy(provenance)); entry.update(deepcopy(provenance))
    request = build_request(entry["candidate_id"], payload["plan"][0], QUESTION, entry["sources"], entry["evidence"])
    case[6].write_text(json.dumps(request, ensure_ascii=False))
    entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    save_input(case)
    raw = bundle()
    (case[1] / (entry["candidate_id"] + ".json")).write_text(json.dumps(raw))
    return case, raw, request


def test_input_projections_have_no_key_rationale_docs_scope_or_other_gate():
    question = {**QUESTION, "private_token": "SECRET_PRIVATE_TOKEN",
                "correct_explanation": "SECRET_RATIONALE"}
    inputs = build_gate_inputs(question, "SECRET_SCOPE", "SECRET_DOCS", [{"quote": "SECRET_QUOTE"}],
                               style_reference="HELD_OUT_ONLY")
    assert set(inputs["blind_solver"]) == {"stem", "options"}
    assert set(inputs["style"]) == {"stem", "options", "style_reference"}
    assert inputs["style"]["style_reference"] == "HELD_OUT_ONLY"
    for name in ("blind_solver", "style"):
        prompt = cli_models.signature_prompt(GATE_SIGNATURES[name], inputs[name])
        for secret in ("SECRET_RATIONALE", "SECRET_SCOPE", "SECRET_DOCS", "SECRET_QUOTE", "SECRET_PRIVATE_TOKEN"):
            assert secret not in prompt
        assert "correct_answer" not in json.dumps(inputs[name])
    assert inputs["evidence"]["question_data"]["correct_explanation"] == "SECRET_RATIONALE"
    assert "private_token" not in inputs["evidence"]["question_data"]


def test_deterministic_label_mapping_not_all_A_and_ignores_rationales():
    mapping = blind_choice_map(QUESTION)
    assert mapping == blind_choice_map(QUESTION)
    assert mapping == blind_choice_map({**QUESTION, "correct_explanation": "different"})
    assert set(mapping) == set(mapping.values()) == set("ABCD")
    positions = {next(label for label, origin in blind_choice_map({**QUESTION, "stem": QUESTION["stem"] + str(i)}).items()
                      if origin == "A") for i in range(30)}
    assert positions == set("ABCD")


@pytest.mark.parametrize("name", GATE_SIGNATURES)
@pytest.mark.parametrize("defect", ["missing", "extra", "wrong_type", "uncertain", "low", "false", "bad_reason", "range"])
def test_each_gate_fails_closed_no_averaging(name, defect):
    raw = bundle()
    data = raw[name]
    numeric = "confidence" if name == "blind_solver" else "score"
    check = "ambiguous_answers" if name == "blind_solver" else next(iter(STYLE_CHECKS if name == "style" else EVIDENCE_CHECKS))
    if defect == "missing": del data[check]
    elif defect == "extra": data["unexpected"] = True
    elif defect == "wrong_type": data[check] = "true"
    elif defect == "uncertain": data["verdict"] = "UNCERTAIN"
    elif defect == "low": data[numeric] = .79
    elif defect == "false": data[check] = True if name == "blind_solver" else False
    elif defect == "bad_reason": data["reason"] = ""
    else: data[numeric] = 1.1
    try:
        decision = aggregate_gate_verdict(QUESTION, raw)
    except (ValueError, cli_models.CLISchemaError):
        return
    assert not decision.passed


def test_blind_wrong_key_ambiguity_and_legacy_are_never_three_gate_pass():
    raw = bundle()
    raw["blind_solver"]["choice"] = next(label for label, origin in blind_choice_map(QUESTION).items() if origin != "A")
    result = aggregate_gate_verdict(QUESTION, raw)
    assert not result.passed and "wrong key" in result.reason
    raw = bundle(); raw["blind_solver"]["ambiguous_answers"] = True
    assert not aggregate_gate_verdict(QUESTION, raw).passed
    with pytest.raises(ValueError): aggregate_gate_verdict(QUESTION, raw["evidence"])
    assert aggregate_gate_verdict(QUESTION, bundle()).passed


def test_inline_three_independent_calls_and_fail_closed(monkeypatch):
    seen = {}
    raw = bundle()
    def fake(model, signature, inputs):
        name = next(name for name, expected in GATE_SIGNATURES.items() if signature == expected)
        seen[name] = inputs
        return raw[name]
    monkeypatch.setattr(cli_models, "run_signature", fake)
    result = judge_three_gates(QUESTION, "scope", documentation_context="docs", model="claude",
                               generator_model="codex", option_evidence=[{"quote": "proof"}])
    assert result.passed and set(seen) == set(GATE_SIGNATURES)
    assert set(seen["blind_solver"]) == {"stem", "options"}
    assert "question_data" not in seen["style"]
    assert not judge_three_gates(QUESTION, "scope", documentation_context="docs", model="claude",
                                 generator_model="claude", option_evidence=[{}]).passed


def test_v4_dry_ingestion_preserves_raw_bundle_and_never_writes(v4):
    case, raw, request = v4
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert result.exit_code == 0, result.output
    entry = saved(case)["candidates"][0]
    assert entry["external_verdict"] == raw and entry["judge_verdict"]["passed"]
    assert entry["grounding"]["gate_version"] == 4
    assert entry["grounding"]["gate_verdicts"] == raw
    assert not entry["accepted"]
    case[4].assert_not_called()
    assert set(request) == {"candidate_id", "objective_id", "gate_version", "decision_provenance_sha256", "gates", "trimming"}


def test_v4_cannot_ingest_one_legacy_verdict(v4):
    case, _, _ = v4
    (case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")).write_text(json.dumps(case[5]))
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert result.exit_code == 1
    case[4].assert_not_called()
    assert not saved(case)["candidates"][0]["judge_verdict"]["passed"]


def test_v4_runner_three_verbatim_calls_and_raw_bundle(monkeypatch, v4):
    case, raw, request = v4
    calls = []
    destination = case[0].parent / "new-verdicts"
    def fake(model, prompt, schema):
        name = next(name for name, gate in request["gates"].items() if gate["verdict_schema"] == schema)
        assert prompt == request["gates"][name]["judge_prompt"]
        calls.append(name)
        return raw[name]
    monkeypatch.setattr(cli_models, "run_claude_request", fake)
    summary = runner.run_requests(case[6].parent, destination, parallel=1)
    assert summary.completed == 1 and calls == list(GATE_SIGNATURES)
    assert json.loads((destination / case[6].name).read_text()) == raw
    assert runner.run_requests(case[6].parent, destination).skipped == 1
    assert len(calls) == 3


def test_cli_transport_dispatches_each_strict_schema_without_live_calls(monkeypatch):
    calls = []
    def fake(model, prompt, schema, signature, **kwargs):
        calls.append(signature)
        return {"synthetic": True}
    monkeypatch.setattr(cli_models, "_run_cli", fake)
    for signature in GATE_SIGNATURES.values():
        schema = cli_models.output_model(signature).model_json_schema()
        cli_models.run_claude_request("claude", "frozen", schema)
    assert calls == list(GATE_SIGNATURES.values())
    with pytest.raises(cli_models.CLISchemaError): cli_models.run_claude_request("claude", "frozen", {})


def test_v4_export_preserves_frozen_bundle_and_verdict_conflict(v4):
    case, _, _ = v4
    result = CliRunner().invoke(exporter.main, ["--artifact", str(case[0]), "--verdicts", str(case[1])])
    assert result.exit_code == 1  # Existing verdict cannot be silently reused.
    result = CliRunner().invoke(exporter.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--force"])
    assert result.exit_code == 0, result.output
    assert json.loads(case[6].read_text())["gate_version"] == 4
    assert not list(case[1].glob("*.json"))
    assert list(case[1].glob(".export-quarantine-*/*.json"))


def test_v4_repair_requires_strict_supported_evidence_and_a_FAIL():
    raw = bundle()
    with pytest.raises(ValueError): eligible_gate_repair(raw)
    raw["style"].update(verdict="FAIL", decision_level=False)
    eligible_gate_repair(raw)
    for check in EVIDENCE_CHECKS:
        broken = deepcopy(raw); broken["evidence"][check] = False
        with pytest.raises(ValueError): eligible_gate_repair(broken)
    broken = deepcopy(raw); del broken["evidence"]["scenario_relevant"]
    with pytest.raises(cli_models.CLISchemaError): eligible_gate_repair(broken)
    broken = deepcopy(raw); broken["evidence"]["verdict"] = "UNCERTAIN"
    with pytest.raises(ValueError): eligible_gate_repair(broken)


@pytest.mark.parametrize("version", [1, 2])
def test_repair_inventory_blocks_cross_version_before_journal_or_calls(v4, version):
    case, raw, _ = v4
    if version == 1:
        # Rebuild exact historical request and clear v4 provenance; wrong bundle remains.
        scope = case[2]["plan"][0]
        for name in ("decision_objective", "decision_plan", "decision_proof"):
            scope.pop(name, None); case[2]["candidates"][0].pop(name, None)
        case[2]["external_judge_version"] = 1
        entry = case[2]["candidates"][0]
        req = build_request(entry["candidate_id"], scope, QUESTION, entry["sources"], entry["evidence"],
                            signature=QuestionQualitySignature)
        case[6].write_text(json.dumps(req))
        entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
        save_input(case)
        raw["style"].update(verdict="FAIL", decision_level=False)
    else:
        raw = {**case[5], "verdict": "FAIL", "distractors_need_knowledge": False}
    (case[1] / case[6].name).write_text(json.dumps(raw))
    before = case[0].read_bytes()
    result = CliRunner().invoke(repair.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["eligible"] == 0
    assert case[0].read_bytes() == before
    assert "repair_attempts" not in saved(case)


def test_artifact_level_lineage_rejects_wrong_version_before_storage_helper(v4):
    from shared.external_judge import eligible_repair_verdict
    raw = bundle(); raw["style"].update(verdict="FAIL", decision_level=False)
    with pytest.raises(ValueError): eligible_repair_verdict(raw, gate_version=1)
    legacy = {**v4[0][5], "verdict": "FAIL", "distractors_need_knowledge": False}
    with pytest.raises(ValueError): eligible_repair_verdict(legacy, gate_version=2)


@pytest.mark.parametrize("field", ["decision_objective", "decision_plan", "decision_proof", "key_length_rank"])
def test_missing_frozen_v4_decision_provenance_blocks_ingest_before_client(v4, field):
    case, _, _ = v4
    case[2]["plan"][0].pop(field)
    case[2]["candidates"][0].pop(field)
    save_input(case)
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert result.exit_code == 1
    case[4].assert_not_called()


@pytest.mark.parametrize("defect", ["objective", "untyped", "unsupported", "quote", "rank"])
def test_invalid_frozen_v4_decision_proof_blocks_before_any_calls(v4, defect):
    case, _, _ = v4
    scope = case[2]["plan"][0]
    if defect == "objective": scope["decision_plan"]["objective_id"] = "another:objective"
    elif defect == "untyped": scope["decision_plan"]["decisive_constraints"] = "not a list"
    elif defect == "unsupported": scope["decision_proof"]["supported"] = False
    elif defect == "quote": scope["decision_proof"]["reasons"][0]["quote"] = "Never fetched"
    else: scope["key_length_rank"] = True
    case[2]["candidates"][0].update({name: deepcopy(scope[name]) for name in
                                    ("decision_plan", "decision_proof", "key_length_rank")})
    save_input(case)
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert result.exit_code == 1
    case[4].assert_not_called()



def test_v4_one_attempt_repair_keeps_provenance_and_requires_fresh_three_gates(monkeypatch, v4):
    from test_repair_candidates import REVISED
    from shared.external_judge import candidate_storage_id
    case, raw, _ = v4
    raw["style"].update(verdict="FAIL", decision_level=False, reason="Synthetic overly narrow decision")
    (case[1] / case[6].name).write_text(json.dumps(raw))
    original_question = candidate_question(case[2]["candidates"][0])
    original_request = case[6].read_bytes()
    original_entry = deepcopy(case[2]["candidates"][0])
    seen = []
    def revise(model, signature, inputs, **kwargs):
        seen.append(inputs)
        assert "Verified decision plan" in inputs["domain_context"]
        assert "Key length rank hint" in inputs["domain_context"]
        assert json.loads(inputs["reason"]) == raw
        return deepcopy(REVISED)
    monkeypatch.setattr(cli_models, "run_signature", revise)
    monkeypatch.setattr(repair, "cite_question", lambda *args, **kwargs: {
        "evidence": [{name: receipt[name] for name in ("option_label", "url", "quote")}
                     for receipt in original_entry["evidence"]]})
    flags = ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--parallel", "1"]
    result = CliRunner().invoke(repair.main, flags)
    assert result.exit_code == 0, result.output
    payload = saved(case)
    parent, child = payload["candidates"]
    assert parent == original_entry and case[6].read_bytes() == original_request
    assert child["candidate_id"] == parent["candidate_id"] + "-r1"
    assert candidate_question(child)["correct_answer"] == original_question["correct_answer"]
    for name in ("decision_plan", "decision_proof", "decision_objective", "key_length_rank"):
        assert child[name] == parent[name] == payload["plan"][0][name]
    assert candidate_storage_id(child, payload["plan"][0], candidate_question(child)) != parent["candidate_id"]
    assert payload["repair_attempts"][parent["candidate_id"]]["calls_started"] == 2
    again = CliRunner().invoke(repair.main, flags)
    assert again.exit_code == 0 and len(seen) == 1
    dry_flags = ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"]
    missing = CliRunner().invoke(ingest.main, dry_flags)
    assert missing.exit_code == 1  # Mechanical repair is not a judge approval.
    fresh = bundle(candidate_question(child))
    (case[1] / (child["candidate_id"] + ".json")).write_text(json.dumps(fresh))
    good = CliRunner().invoke(ingest.main, dry_flags)
    assert good.exit_code == 0, good.output
    case[4].assert_not_called()


def test_known_frozen_v3_scope_removes_only_exact_rank_hint(case):
    scope = case[2]["plan"][0]
    scope.pop("key_length_rank")
    case[2]["candidates"][0].pop("key_length_rank")
    scope["domain_prompt"] = scope["domain_prompt"].split("\nKey length rank hint:", 1)[0]
    assert ingest._scope(case[2], case[2]["candidates"][0]) == scope
    scope["domain_prompt"] += " changed old instructions"
    with pytest.raises(ValueError): ingest._scope(case[2], case[2]["candidates"][0])



def test_consistent_decision_provenance_tamper_is_bound_by_frozen_request(v4):
    case, _, _ = v4
    for target in (case[2]["plan"][0], case[2]["candidates"][0]):
        target["decision_plan"]["business_consequence"] = "Tampered but still typed consequence"
    save_input(case)
    with pytest.raises(ValueError, match="External request differs"):
        ingest._validate_candidate(case[0], case[2], case[2]["candidates"][0])


@pytest.mark.parametrize("digest", [None, "0" * 63, "A" * 64, "0" * 65, 1])
def test_runner_rejects_malformed_provenance_digest_before_calls(v4, monkeypatch, digest):
    case, _, request = v4
    request["decision_provenance_sha256"] = digest
    case[6].write_text(json.dumps(request))
    calls = Mock(side_effect=AssertionError("No invalid request calls"))
    monkeypatch.setattr(cli_models, "run_claude_request", calls)
    summary = runner.run_requests(case[6].parent, case[0].parent / "new-invalid-results")
    assert summary.failed == 1
    calls.assert_not_called()


@pytest.mark.parametrize("name", GATE_SIGNATURES)
def test_all_v4_reason_bounds_are_enforceable_in_exported_schema(name):
    schema = cli_models.output_model(GATE_SIGNATURES[name]).model_json_schema()
    assert schema["properties"]["reason"]["minLength"] == 1
    assert schema["properties"]["reason"]["maxLength"] == 300
    raw = bundle()[name]; raw["reason"] = "x" * 301
    with pytest.raises(cli_models.CLISchemaError): parse_gate_output(name, raw)
    assert "maxLength" not in cli_models.output_model(QuestionQualitySignature).model_json_schema()["properties"]["reason"]


def test_generic_style_clarification_does_not_waive_checks_or_names():
    from shared.gates import StyleCriticSignature
    text = StyleCriticSignature.instructions
    assert "At most ONE minor-variant pair" in text
    assert "not automatically trivia" in text
    assert "not wants themselves" in text
    assert "current_names" in StyleCriticSignature.output_fields
    raw = bundle(); raw["style"]["current_names"] = False
    assert not aggregate_gate_verdict(QUESTION, raw).passed



def test_metadata_schema_fix_preserves_all_historical_cli_signature_schemas():
    from pydantic import ConfigDict, Field, create_model
    from shared.quality_gate import RULES_V2_QUALITY_SIGNATURE, LEGACY_ROUND4_QUALITY_SIGNATURE
    from shared.llm_generator import (PmleQuestionSignature, CitationSignature, QuestionCorrectionSignature,
                                      FactualCorrectionSignature, GapAnalysisSignature)
    signatures = [QuestionQualitySignature, RULES_V2_QUALITY_SIGNATURE, LEGACY_ROUND4_QUALITY_SIGNATURE,
                  PmleQuestionSignature, CitationSignature, repair.RepairQuestionSignature,
                  QuestionCorrectionSignature, FactualCorrectionSignature, GapAnalysisSignature]
    for signature in signatures:
        fields = {}
        for name, field in signature.output_fields.items():
            annotation = list[cli_models.StrictOptionEvidence] if name == "evidence" else field.annotation
            description = field.description or (field.json_schema_extra or {}).get("desc", "")
            fields[name] = (annotation, Field(description=description))
        previous = create_model(signature.__name__ + "CLIOutput", __config__=ConfigDict(strict=True, extra="forbid"),
                                **fields).model_json_schema()
        assert previous == cli_models.output_model(signature).model_json_schema()
