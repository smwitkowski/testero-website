"""Offline replay and fail-closed v5 safeguards; no live services."""
from copy import deepcopy
from itertools import combinations
import json
from pathlib import Path
from unittest.mock import Mock

import pytest
from shared.option_order import store_options, canonical_evidence, option_order
from shared.external_judge import candidate_question, candidate_id, canonical_sha256
from shared.near_duplicates import check_near_duplicate, comparison_row, similarity, load_export
from shared.batch_report import key_position_report, template_diversity_report
from shared.argon_gate import build_argon_request, evaluate_argon, run_argon, MODEL
from shared import argon_gate
from shared.gates import blind_choice_map, aggregate_gate_verdict
from shared.cli_models import CLISchemaError
from scripts import judge_requests, ingest_external_verdicts as ingest
from test_external_generation import QUESTION, receipts, source
from test_three_gates_v4 import bundle

FIXTURES = Path(__file__).parent / "fixtures"


def test_shuffle_replay_preserves_key_rationales_receipts_and_length():
    scope = {"objective_id": "objective", "guide_sha256": "a" * 64}
    positions = set()
    for i in range(100):
        entry = {"candidate_id": candidate_id(i, scope, QUESTION), "stem": QUESTION["stem"]}
        store_options(entry, QUESTION, receipts())
        original = deepcopy(entry)
        assert candidate_question(entry) == QUESTION
        assert canonical_evidence(entry) == receipts()
        assert entry["option_order"] == option_order(entry["candidate_id"])
        assert entry["options"]["ABCD".index(entry["key"])]["text"] == QUESTION["correct_answer"]
        assert entry["rationales"][entry["key"]] == QUESTION["correct_explanation"]
        store_options(entry, QUESTION, receipts())
        assert entry == original
        positions.add(entry["key"])
    assert positions == set("ABCD")
    entry["key"] = next(label for label in "ABCD" if label != entry["key"])
    with pytest.raises(ValueError): candidate_question(entry)
    with pytest.raises(ValueError): canonical_evidence(entry)


def test_key_position_report_boundary_and_failure():
    rows = [{"options": [{}], "key": label} for label in "AAAABBCCDD"]
    assert key_position_report(rows)["passed"]
    assert key_position_report(rows)["counts"] == {"A": 4, "B": 2, "C": 2, "D": 2}
    assert not key_position_report(rows + [{"options": [{}], "key": "A"}])["passed"]
    assert key_position_report([])["passed"] is None


def test_dedupe_calibration_only_known_batch8_pair_flagged():
    rows = json.loads((FIXTURES / "batch7-8-dedupe.json").read_text())["questions"]
    assert len(rows) == 18
    scores = []
    flagged = []
    for a, b in combinations(rows, 2):
        result = check_near_duplicate(a, [comparison_row(b)])
        scores.append(similarity(a["stem"], comparison_row(a)["key"], b["stem"], comparison_row(b)["key"])["score"])
        if not result["passed"]:
            flagged.append({a["candidate_id"], b["candidate_id"]})
    assert len(scores) == 153
    assert flagged == [{"420f7f83-b69a-5c8e-9621-b293c171fedc", "2db303eb-0a41-5cfc-adda-14ce797de603-r1"}]
    assert sorted(scores)[-1] == pytest.approx(.23880597014925373)
    assert sorted(scores)[-2] == pytest.approx(.16216216216216217)


def test_export_active_draft_and_fail_closed(tmp_path):
    rows = json.loads((FIXTURES / "batch7-8-dedupe.json").read_text())["questions"]
    path = tmp_path / "bank.json"
    path.write_text(json.dumps({"questions": [{**rows[0], "status": "ACTIVE"}, {**rows[1], "status": "DRAFT"}, {"id": "retired", "status": "RETIRED"}]}))
    bank = load_export(path)
    assert len(bank["questions"]) == 2 and len(bank["sha256"]) == 64
    assert not check_near_duplicate(rows[0], bank["questions"])["passed"]
    assert check_near_duplicate(rows[0], bank["questions"], exclude=(rows[0]["candidate_id"],))["passed"]
    path.write_text(json.dumps([{**rows[0], "status": "ACTIVE", "key": "missing"}]))
    with pytest.raises(ValueError): load_export(path)
    with pytest.raises(ValueError): similarity("", "key", "stem", "key")


def argon_case():
    request = build_argon_request(QUESTION, {"domain_prompt": "scope"}, "docs", receipts())
    key = next(label for label, origin in blind_choice_map(QUESTION).items() if origin == "A")
    raw = {"model": MODEL, "version": 1, "request_sha256": canonical_sha256(request),
           "blind": {"verdict": "PASS", "choice": key, "confidence": .99, "ambiguous_answers": False, "reason": "Synthetic mapped blind replay"},
           "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False, "issues": [], "fix": "No changes needed"}}
    return request, raw


def test_argon_recorded_review_shape_replay():
    request, raw = argon_case()
    rows = json.loads((FIXTURES / "argon-review-replay.json").read_text())["reviews"]
    results = []
    for row in rows:
        raw["review"] = row
        try:
            results.append(evaluate_argon(QUESTION, raw, request)[0])
        except CLISchemaError:
            # Actual recorded fixes exceeding strict local bound are rejected, not truncated.
            results.append(False)
    assert len(results) == 10
    assert results[0] and not results[2] and not results[4]
    original = json.loads((Path(__file__).parents[1] / "calibration/argon-review-r8-2026-10-13.json").read_text())
    with pytest.raises(CLISchemaError): evaluate_argon(QUESTION, original, request)


@pytest.mark.parametrize("defect", ["missing", "extra", "bool", "wrong_model", "hash", "version", "wrong_key", "ambiguous", "low", "nonfinite", "reject", "revise", "key_false", "second", "issues", "fix", "long_fix"])
def test_argon_fail_closed(defect):
    request, raw = argon_case()
    if defect == "missing": del raw["blind"]
    elif defect == "extra": raw["unexpected"] = True
    elif defect == "bool": raw["review"]["key_correct"] = "true"
    elif defect == "wrong_model": raw["model"] = "other"
    elif defect == "hash": raw["request_sha256"] = "a" * 64
    elif defect == "version": raw["version"] = True
    elif defect == "wrong_key": raw["blind"]["choice"] = next(label for label, origin in blind_choice_map(QUESTION).items() if origin != "A")
    elif defect == "ambiguous": raw["blind"]["ambiguous_answers"] = True
    elif defect == "low": raw["blind"]["confidence"] = .79
    elif defect == "nonfinite": raw["blind"]["confidence"] = float("nan")
    elif defect in ("reject", "revise"): raw["review"]["verdict"] = defect.upper()
    elif defect == "key_false": raw["review"]["key_correct"] = False
    elif defect == "second": raw["review"]["other_defensible_option"] = True
    elif defect == "issues": raw["review"]["issues"] = ["Substantive defect"]
    elif defect == "fix": raw["review"]["fix"] = " "
    else: raw["review"]["fix"] = "x" * 301
    try: assert not evaluate_argon(QUESTION, raw, request)[0]
    except (ValueError, CLISchemaError): pass


def test_argon_runner_two_separate_calls_and_no_leakage(monkeypatch):
    request, raw = argon_case()
    calls = []
    def replay(name, gate):
        calls.append((name, gate))
        return raw[name]
    monkeypatch.setattr(argon_gate, "run_call", replay)
    result = run_argon(request)
    assert evaluate_argon(QUESTION, result, request)[0]
    assert [name for name, _ in calls] == ["blind", "review"]
    assert "correct_answer" not in calls[0][1]["judge_prompt"]
    assert "correct_explanation" not in calls[0][1]["judge_prompt"]
    monkeypatch.setattr(argon_gate, "run_call", Mock(side_effect=CLISchemaError("Malformed output")))
    with pytest.raises(argon_gate.ArgonCallError) as failure: run_argon(request)
    assert failure.value.call == "blind" and isinstance(failure.value.error, CLISchemaError)


def test_four_gate_aggregate_requires_argon_and_every_claude_gate():
    request, argon = argon_case()
    raw = {**bundle(QUESTION), "argon": argon}
    kwargs = {"gate_version": 2, "rules_version": 5, "argon_request": request}
    assert ingest._external_decision(QUESTION, {}, [], [], raw, "codex", **kwargs).passed
    for name in ("blind_solver", "style", "evidence", "argon"):
        broken = deepcopy(raw); del broken[name]
        with pytest.raises((ValueError, CLISchemaError)): ingest._external_decision(QUESTION, {}, [], [], broken, "codex", **kwargs)
    raw["style"]["cloud_specific_alternative"] = False
    assert not ingest._external_decision(QUESTION, {}, [], [], raw, "codex", **kwargs).passed


def test_template_cap_does_not_waive_product_knowledge():
    rows = [{"judge_verdict": {"passed": True}, "external_verdict": {"style": {"generic_validation_key": i == 0}}} for i in range(5)]
    assert template_diversity_report(rows)["passed"]
    rows[1]["external_verdict"]["style"]["generic_validation_key"] = True
    assert not template_diversity_report(rows)["passed"]
    raw = bundle(QUESTION)
    raw["style"]["product_knowledge_hinge"] = False
    assert not aggregate_gate_verdict(QUESTION, raw).passed


from test_three_gates_v4 import v4
from test_external_ingest import case, save_input, saved, invoke
from click.testing import CliRunner
from shared.external_judge import build_request
import hashlib


def prepare_v5(case, *, argon=False):
    payload = case[2]
    payload.update(rules_version=5, existing_questions={"sha256": None, "questions": []}, argon_gate=argon)
    entry = payload["candidates"][0]
    question = candidate_question(entry)
    evidence = canonical_evidence(entry)
    store_options(entry, question, evidence)
    request = build_request(entry["candidate_id"], payload["plan"][0], question, entry["sources"], evidence, argon_gate=argon)
    case[6].write_text(json.dumps(request))
    entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    raw = bundle(question)
    if argon:
        _, raw_argon = argon_case()
        raw_argon["request_sha256"] = canonical_sha256(request["argon"])
        raw["argon"] = raw_argon
    (case[1] / case[6].name).write_text(json.dumps(raw))
    save_input(case)
    return request, raw


def test_real_ingest_small_batch_report_is_informational(v4):
    case, _, _ = v4
    prepare_v5(case)
    result = invoke(case)
    assert result.exit_code == 0, result.output
    payload = saved(case)
    assert payload["key_position_report"]["count"] == 1
    assert payload["key_position_report"]["passed"] is True
    assert payload["key_position_report"]["enforced"] is False


def test_real_ingest_export_duplicate_blocks_before_database(v4):
    case, _, _ = v4
    prepare_v5(case)
    entry = case[2]["candidates"][0]
    row = comparison_row(entry)
    case[2]["existing_questions"] = {"sha256": "a" * 64, "questions": [{**row, "id": "existing-question"}]}
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 1
    case[4].assert_not_called()
    recorded = saved(case)["candidates"][0]
    assert recorded["failure_stage"] == "near_duplicate"
    assert recorded["near_duplicate_check"]["matches"][0]["matched_id"] == "existing-question"


@pytest.mark.parametrize("defect", ["missing", "model", "hash", "revise"])
def test_argon_completed_journal_replay_blocks_tampered_receipts(v4, monkeypatch, defect):
    case, _, _ = v4
    request, raw = prepare_v5(case, argon=True)
    # Isolate receipt replay from the separately tested batch report.
    monkeypatch.setattr(ingest, "key_position_report", lambda rows: {"count": len(rows), "counts": {k: 0 for k in "ABCD"}, "passed": True})
    result = invoke(case)
    assert result.exit_code == 0, result.output
    payload = saved(case)
    entry = payload["candidates"][0]
    assert entry["persistence_status"] == "complete"
    received = entry["external_verdict"]
    if defect == "missing": del received["argon"]
    elif defect == "model": received["argon"]["model"] = "other"
    elif defect == "hash": received["argon"]["request_sha256"] = "a" * 64
    else: received["argon"]["review"]["verdict"] = "REVISE"
    case[2].clear(); case[2].update(payload)
    save_input(case)
    case[3].reset_mock(); case[4].reset_mock()
    result = invoke(case)
    assert result.exit_code == 1
    assert saved(case)["candidates"][0]["persistence_validation_failed"]
    case[4].assert_not_called()
    case[3].insert_question.assert_not_called()


def test_runner_optional_argon_flag_cannot_bypass_frozen_policy(v4, monkeypatch):
    from scripts import judge_requests as runner
    from shared import cli_models
    case, _, _ = v4
    request, raw = prepare_v5(case, argon=True)
    outputs = case[0].parent / "runner-verdicts"
    calls = Mock(side_effect=lambda model, prompt, schema: next(raw[name] for name, gate in request["gates"].items() if gate["judge_prompt"] == prompt))
    monkeypatch.setattr(cli_models, "run_claude_request", calls)
    monkeypatch.setattr(argon_gate, "run_argon", lambda frozen: raw["argon"])
    summary = runner.run_requests(case[6].parent, outputs)
    assert summary.failed == 1
    calls.assert_not_called()
    summary = runner.run_requests(case[6].parent, outputs, argon_gate=True)
    assert summary.completed == 1 and calls.call_count == 3
    assert json.loads((outputs / case[6].name).read_text()) == raw


def test_persisted_shuffle_preserves_every_stored_field(v4, monkeypatch):
    case, _, _ = v4
    prepare_v5(case)
    monkeypatch.setattr(ingest, "key_position_report", lambda rows: {"count": len(rows), "counts": {k: 0 for k in "ABCD"}, "passed": True})
    result = invoke(case)
    assert result.exit_code == 0, result.output
    entry = saved(case)["candidates"][0]
    answers = case[3].insert_answers_batch.call_args.args[0]
    for option in entry["options"]:
        row = next(row for row in answers if row["choice_label"] == option["label"])
        assert row["choice_text"] == option["text"]
        assert row["explanation_text"] == entry["rationales"][option["label"]]
        assert row["is_correct"] == (option["label"] == entry["key"])
    assert case[3].insert_explanation.call_args.args[0]["explanation_text"] == "\n\n".join(f"{label}: {text}" for label, text in entry["rationales"].items())


from test_decision_first_v4 import pipeline
from scripts import generate_pmle_questions as generate


def test_inline_batch_report_blocks_question_writes(pipeline, monkeypatch):
    events, path, invoke_pipeline = pipeline
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.return_value = {"id": "run"}
    client.update_generation_run.return_value = True
    monkeypatch.setattr(generate, "database_client", lambda: client)
    # Exercise the real N>=10 blocking report through this one-row write harness.
    monkeypatch.setattr(generate, "key_position_report", lambda rows: key_position_report(list(rows) * 10))
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: aggregate_gate_verdict(QUESTION, bundle(QUESTION)))
    result = invoke_pipeline("--judge-model", "claude")
    assert result.exit_code == 1 and "Key-position batch report failed" in result.output
    client.insert_question.assert_not_called()


def test_inline_generic_template_cap_blocks_question_writes(pipeline, monkeypatch):
    events, path, invoke_pipeline = pipeline
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.return_value = {"id": "run"}
    client.update_generation_run.return_value = True
    monkeypatch.setattr(generate, "database_client", lambda: client)
    raw = bundle(QUESTION); raw["style"]["generic_validation_key"] = True
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: aggregate_gate_verdict(QUESTION, raw))
    result = invoke_pipeline("--judge-model", "claude")
    assert result.exit_code == 1 and "Template-diversity" in result.output
    client.insert_question.assert_not_called()



def test_argon_rejects_same_vendor_generator():
    request, raw = argon_case()
    outputs = {**bundle(QUESTION), "argon": raw}
    with pytest.raises(ValueError):
        ingest._external_decision(QUESTION, {}, [], [], outputs,
            "openrouter/google/gemini-3.8-flash", gate_version=2, rules_version=5, argon_request=request)



def test_historical_v4_reference_preserves_original_default():
    from shared.question_style import RULES_V4_STYLE_INSTRUCTIONS, RULES_V4_STYLE_RULES, STYLE_INSTRUCTIONS
    from shared.gates import V4_ADDITIONS
    assert RULES_V4_STYLE_INSTRUCTIONS.endswith(V4_ADDITIONS)
    assert RULES_V4_STYLE_RULES in RULES_V4_STYLE_INSTRUCTIONS
    assert "Rules v5" not in RULES_V4_STYLE_INSTRUCTIONS
    assert "Rules v5" in STYLE_INSTRUCTIONS
