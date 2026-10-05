"""Offline one-attempt repair contracts. Mocked outputs do not measure judge quality."""
from copy import deepcopy
import fcntl
import hashlib
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import repair_candidates as repair
from scripts import ingest_external_verdicts as ingest
from scripts import export_judge_requests as exporter
from scripts import judge_requests as request_runner
from shared import cli_models
from shared.cert_context import plan_questions
from shared.doc_search import documentation_context
from shared.external_judge import (
    build_request, candidate_id, candidate_question, candidate_storage_id, canonical_sha256,
    eligible_repair_verdict, question_sha256, validate_candidate_records,
)
from shared.quality_gate import ACCURACY_CHECKS, QUESTION_FIELDS, QuestionQualitySignature
from test_external_ingest import case
from test_generation_gate import QUESTION, URL, QUOTES

REVISED = {**QUESTION,
    "stem": "A retailer's order tracking application provides delivery updates over HTTP. Customers check their orders throughout the day, so request volume changes as deliveries progress. Your developers have written the application code and want to run it with minimal infrastructure management. Which solution should you choose?",
    "distractor_1": "Use BigQuery batch processing for requests",
    "distractor_2": "Use Cloud Storage for storing objects",
    "distractor_3": "Use Compute Engine virtual machine instances",
}
ALLOWED = {"distractors_need_knowledge", "constraints_as_wants", "distractors_plausible", "decisions_not_syntax", "scenario_clear", "options_distinct_approaches"}


@pytest.fixture
def repairs(case, monkeypatch):
    raw = {**case[5], "verdict": "FAIL", "distractors_need_knowledge": False,
           "reason": "Synthetic supported knowledge-elimination defect"}
    verdict = case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")
    verdict.write_text(json.dumps(raw))
    case[5].clear()
    case[5].update(raw)
    revise = Mock(return_value=deepcopy(REVISED))
    cite = Mock(return_value={"evidence": [{"option_label": label, "url": URL, "quote": quote}
                                          for label, quote in zip("ABCD", QUOTES)]})
    monkeypatch.setattr(cli_models, "run_signature", revise)
    monkeypatch.setattr(repair, "cite_question", cite)
    monkeypatch.setattr(repair, "documentation_context", documentation_context)
    monkeypatch.setattr("shared.llm_generator.dspy.LM", Mock(side_effect=AssertionError("No live LM")))
    return case, revise, cite


def invoke(repairs, *flags):
    case = repairs[0]
    return CliRunner().invoke(repair.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), *flags])


def saved(repairs):
    return json.loads(repairs[0][0].read_text())


def child_path(repairs):
    case = repairs[0]
    return case[6].with_name(case[2]["candidates"][0]["candidate_id"] + "-r1.json")


@pytest.mark.parametrize("flag", ACCURACY_CHECKS)
def test_exact_only_allowed_false_flags_are_eligible(flag):
    raw = {"verdict": "FAIL", **{key: True for key in ACCURACY_CHECKS}, "score": .9, "reason": "Defect"}
    raw[flag] = False
    if flag in ALLOWED:
        eligible_repair_verdict(raw)
    else:
        with pytest.raises(ValueError):
            eligible_repair_verdict(raw)


@pytest.mark.parametrize("change", ["pass", "uncertain", "no_false", "low_only", "wrong_type", "omitted", "extra", "wrapper", "nan", "score_bool", "reason_empty"])
def test_malformed_passing_uncertain_or_score_only_ineligible(repairs, change):
    case, revise, cite = repairs
    raw = deepcopy(case[5])
    if change == "pass": raw["verdict"] = "PASS"
    elif change == "uncertain": raw["verdict"] = "UNCERTAIN"
    elif change == "no_false": raw["distractors_need_knowledge"] = True
    elif change == "low_only": raw.update(verdict="PASS", distractors_need_knowledge=True, score=.2)
    elif change == "wrong_type": raw["scenario_clear"] = "true"
    elif change == "omitted": del raw["scenario_clear"]
    elif change == "extra": raw["unexpected"] = True
    elif change == "wrapper": raw = {"structured_output": raw}
    elif change == "nan": raw["score"] = float("nan")
    elif change == "score_bool": raw["score"] = True
    elif change == "reason_empty": raw["reason"] = " "
    (case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")).write_text(json.dumps(raw))
    before = case[0].read_bytes()
    result = invoke(repairs)
    assert result.exit_code == 0, result.output
    revise.assert_not_called()
    cite.assert_not_called()
    assert case[0].read_bytes() == before
    assert not child_path(repairs).exists()


def test_dry_run_inventory_no_calls_no_artifact_request_or_verdict_mutation(repairs):
    case, revise, cite = repairs
    originals = {p: p.read_bytes() for p in (case[0], case[6], next(case[1].glob("*.json")))}
    result = invoke(repairs, "--dry-run", "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["eligible"] == summary["selected"] == 1
    assert summary["attempted"] == summary["calls_started"] == 0
    revise.assert_not_called()
    cite.assert_not_called()
    case[4].assert_not_called()
    assert all(path.read_bytes() == content for path, content in originals.items())
    assert not child_path(repairs).exists()


def test_success_freezes_parent_A_plan_sources_and_publishes_current_request_once(repairs):
    case, revise, cite = repairs
    original = deepcopy(case[2]["candidates"][0])
    request_bytes = case[6].read_bytes()
    verdict_path = next(case[1].glob("*.json"))
    verdict_bytes = verdict_path.read_bytes()
    def revision(model, signature, inputs):
        journal = saved(repairs)["repair_attempts"][original["candidate_id"]]
        assert journal["status"] == "started" and journal["calls_started"] == 1
        assert journal["parent_entry_sha256"] == canonical_sha256(original)
        assert inputs["documentation_context"] == documentation_context(original["sources"])
        assert inputs["domain_context"] == case[2]["plan"][0]["domain_prompt"]
        assert json.loads(inputs["original_question"]) == QUESTION
        assert set(signature.output_fields) == set(QUESTION_FIELDS)
        assert set(signature.input_fields) == {"original_question", "reason", "domain_context", "documentation_context", "difficulty"}
        assert model == repair.REPAIR_MODEL
        return deepcopy(REVISED)
    def citation(question, sources, model):
        assert saved(repairs)["repair_attempts"][original["candidate_id"]]["calls_started"] == 2
        assert question == REVISED and sources == original["sources"] and model == repair.REPAIR_MODEL
        return {"evidence": [{"option_label": label, "url": URL, "quote": quote} for label, quote in zip("ABCD", QUOTES)]}
    revise.side_effect = revision
    cite.side_effect = citation
    result = invoke(repairs, "--candidate", original["candidate_id"], "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 0, result.output
    payload = saved(repairs)
    assert payload["candidates"][0] == original and payload["plan"] == case[2]["plan"]
    assert len(payload["candidates"]) == 2
    child = payload["candidates"][1]
    assert candidate_question(child) == REVISED
    assert child["sources"] == original["sources"]
    assert child["candidate_id"] == original["candidate_id"] + "-r1"
    assert child["index"] == original["index"] and child["key"] == "A"
    assert child["accepted"] is False and child["status"] == "awaiting_external_judge"
    assert child["awaiting_external_judge"] is True and not child["judge_verdict"]["passed"]
    assert "external_verdict" not in child
    assert child["repair"]["question_sha256"] == question_sha256(REVISED)
    assert child["repair"]["original_verdict"] == case[5]
    assert child["repair"]["original_verdict_sha256"] == canonical_sha256(case[5])
    assert candidate_storage_id(child, payload["plan"][0], REVISED) != child["candidate_id"]
    request = json.loads(child_path(repairs).read_text())
    assert request["verdict_schema"] == cli_models.output_model(QuestionQualitySignature).model_json_schema()
    assert child["external_judge_request"]["sha256"] == hashlib.sha256(child_path(repairs).read_bytes()).hexdigest()
    assert case[6].read_bytes() == request_bytes and verdict_path.read_bytes() == verdict_bytes
    validate_candidate_records(payload)
    assert ingest._validate_candidate(case[0], payload, child)[1] == REVISED
    # No second repair is admitted, even while awaiting the independent judge.
    again = invoke(repairs)
    assert again.exit_code == 0, again.output
    assert revise.call_count == cite.call_count == 1
    case[4].assert_not_called()


@pytest.mark.parametrize("kind", ["missing", "extra", "mistyped", "answer", "answer_cleaning", "schema", "style", "citation"])
def test_invalid_revision_or_citation_consumes_attempt_without_request(repairs, kind):
    case, revise, cite = repairs
    raw = deepcopy(REVISED)
    if kind == "missing": del raw["distractor_1"]
    elif kind == "extra": raw["unexpected"] = "new"
    elif kind == "mistyped": raw["stem"] = 123
    elif kind == "answer": raw["correct_answer"] += " now"
    elif kind == "answer_cleaning": raw["correct_answer"] = "**" + raw["correct_answer"] + "**"
    elif kind == "schema": raw["stem"] = "tiny?"
    elif kind == "style": raw["distractor_3"] += " and also provision extra replicas and add a complex expensive network topology"
    elif kind == "citation": cite.return_value = {"evidence": []}
    revise.return_value = raw
    result = invoke(repairs)
    assert result.exit_code == 1, result.output
    assert len(saved(repairs)["candidates"]) == 1
    assert saved(repairs)["repair_attempts"][case[2]["candidates"][0]["candidate_id"]]["status"] == "failed"
    assert not child_path(repairs).exists()
    assert cite.call_count == (1 if kind == "citation" else 0)
    again = invoke(repairs)
    assert again.exit_code == 0, again.output
    assert revise.call_count == 1


@pytest.mark.parametrize("error", [cli_models.CLIAuthError, cli_models.CLIUsageLimitError, cli_models.CodexModelRejectedError,
                                 cli_models.CLITimeoutError, cli_models.CLISchemaError, cli_models.CLIExitError])
def test_cli_errors_safe_consumed_no_retry(repairs, error):
    case, revise, cite = repairs
    revise.side_effect = error("SECRET_TOKEN full unsafe log")
    result = invoke(repairs)
    assert result.exit_code == 1
    assert "SECRET_TOKEN" not in result.output + case[0].read_text()
    journal = saved(repairs)["repair_attempts"][case[2]["candidates"][0]["candidate_id"]]
    assert journal["calls_started"] == 1 and journal["status"] in ("failed", "unknown")
    assert not child_path(repairs).exists()
    assert invoke(repairs).exit_code == 0
    assert revise.call_count == 1
    cite.assert_not_called()


@pytest.mark.parametrize("budget", [0, 1])
def test_conservative_budget_reserves_two_calls_before_parent_admission(repairs, budget):
    before = repairs[0][0].read_bytes()
    result = invoke(repairs, "--max-calls", str(budget))
    assert result.exit_code == 0, result.output
    repairs[1].assert_not_called()
    repairs[2].assert_not_called()
    assert repairs[0][0].read_bytes() == before


@pytest.mark.parametrize("kind", ["generation_runs", "external_run_journal", "persisted", "inserted", "accepted"])
def test_database_journals_and_states_refused_without_calls(repairs, kind):
    case = repairs[0]
    payload = deepcopy(case[2])
    if kind == "generation_runs": payload[kind] = {"domain": "uuid"}
    elif kind == "external_run_journal": payload[kind] = {"domain": {"status": "unknown"}}
    elif kind == "persisted": payload["candidates"][0]["persistence_status"] = "unknown"
    elif kind == "inserted": payload["candidates"][0]["inserted_question_id"] = "uuid"
    else: payload["candidates"][0]["accepted"] = True
    case[0].write_text(json.dumps(payload))
    before = case[0].read_bytes()
    assert invoke(repairs).exit_code == 1
    assert case[0].read_bytes() == before
    repairs[1].assert_not_called()
    case[4].assert_not_called()


@pytest.mark.parametrize("lock_target", ["artifact", "requests", "verdicts"])
def test_existing_shared_locks_prevent_simultaneous_calls(repairs, lock_target):
    case = repairs[0]
    if lock_target == "artifact": target = case[0].with_suffix(".json.lock")
    elif lock_target == "requests": target = case[6].parent / ".judge-requests.lock"
    else: target = case[1] / ".judge-requests.lock"
    with target.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = invoke(repairs)
        assert result.exit_code == 1
    repairs[1].assert_not_called()
    assert not child_path(repairs).exists()


def test_orphan_request_requires_manual_reconciliation_and_is_never_overwritten(repairs):
    child_path(repairs).write_text("orphan bytes")
    result = invoke(repairs)
    assert result.exit_code == 1 and "reconciliation" in result.output
    repairs[1].assert_not_called()
    assert child_path(repairs).read_text() == "orphan bytes"


def test_crash_after_consumption_never_clears_or_retries_parent(repairs):
    repairs[1].side_effect = KeyboardInterrupt()
    assert invoke(repairs).exit_code == 1
    record = next(iter(saved(repairs)["repair_attempts"].values()))
    assert record["status"] == "started" and record["calls_started"] == 1
    assert invoke(repairs).exit_code == 0
    assert repairs[1].call_count == 1


def test_publication_crash_retains_consumed_journal_and_orphan_no_second_call(repairs, monkeypatch):
    real_flush = repair._flush
    def flush(path, payload):
        if len(payload["candidates"]) > 1:
            raise OSError("SECRET_TOKEN disk log")
        real_flush(path, payload)
    monkeypatch.setattr(repair, "_flush", flush)
    result = invoke(repairs)
    assert result.exit_code == 1
    assert "SECRET_TOKEN" not in result.output + repairs[0][0].read_text()
    assert child_path(repairs).is_file()
    assert len(saved(repairs)["candidates"]) == 1
    assert invoke(repairs).exit_code == 0
    assert repairs[1].call_count == repairs[2].call_count == 1


def test_repaired_request_export_and_mock_ingest_store_content_uuid_not_r1_label(repairs):
    case = repairs[0]
    assert invoke(repairs).exit_code == 0
    payload = saved(repairs)
    parent_bytes = case[6].read_bytes()
    child = payload["candidates"][1]
    output = exporter.export_requests(case[0], force=True, verdicts=(case[1],))
    assert output["count"] == 1
    assert case[6].read_bytes() == parent_bytes
    # Force export quarantines child verdicts only; the original FAIL stays fixed.
    good = {**case[5], "verdict": "PASS", "distractors_need_knowledge": True}
    (case[1] / (child["candidate_id"] + ".json")).write_text(json.dumps(good))
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1])])
    assert result.exit_code == 0, result.output
    entry = saved(repairs)["candidates"][1]
    storage = child["repair"]["storage_question_id"]
    assert entry["inserted_question_id"] == storage and storage != child["candidate_id"]
    assert case[3].insert_question.call_args.args[0]["id"] == storage
    assert saved(repairs)["candidates"][0] == payload["candidates"][0]


@pytest.mark.parametrize("index", [2, 4, 8, 18, 21, 22, 26, 31, 32, 34, 41, 42])
def test_real_round4_raw_verdict_eligibility_replay(index):
    fixture = json.loads((Path(__file__).parent / "fixtures" / "round4_repair_failures.json").read_text())
    case = next(item for item in fixture["cases"] if item["index"] == index)
    # Recorded v2 eligibility is historical, not a v3 authorization. Never invent O5.
    assert "options_distinct_approaches" not in case["verdict"]
    with pytest.raises(ValueError):
        eligible_repair_verdict(case["verdict"])


def add_second_parent(repairs):
    case = repairs[0]
    payload = deepcopy(case[2])
    original = payload["candidates"][0]
    scope = plan_questions(payload["cert_id"], 2, objective_ids=[original["objective_id"]])[1]
    entry = deepcopy(original)
    entry.update({key: scope[key] for key in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment", "opening_style", "question_line")})
    entry.update(index=2, stem=original["stem"].replace("a retailer", "another retailer"))
    entry["candidate_id"] = candidate_id(2, scope, candidate_question(entry))
    destination = case[6].with_name(entry["candidate_id"] + ".json")
    destination.write_text(json.dumps(build_request(entry["candidate_id"], scope, candidate_question(entry), entry["sources"], entry["evidence"])))
    entry["external_judge_request"] = {"path": str(destination.relative_to(case[0].parent)), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
    (case[1] / (entry["candidate_id"] + ".json")).write_text(json.dumps(case[5]))
    payload["plan"].append(scope)
    payload["candidates"].append(entry)
    case[0].write_text(json.dumps(payload))
    return entry


@pytest.mark.parametrize("flags,expected", [(["--limit", "1", "--max-calls", "4"], 1),
                                          (["--limit", "2", "--max-calls", "3"], 1),
                                          (["--limit", "2", "--max-calls", "4"], 2)])
def test_two_parent_total_call_budget_and_candidate_limit(repairs, flags, expected):
    second = add_second_parent(repairs)
    repairs[1].side_effect = [deepcopy(REVISED), {**REVISED, "stem": REVISED["stem"].replace("A retailer's", "A different retailer's")}]
    result = invoke(repairs, *flags)
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["attempted"] == summary["repaired"] == expected
    assert summary["calls_started"] == 2 * expected
    assert repairs[1].call_count == repairs[2].call_count == expected
    assert len(saved(repairs)["repair_attempts"]) == expected
    if expected == 1:
        assert second["candidate_id"] not in saved(repairs)["repair_attempts"]


@pytest.mark.parametrize("error", [cli_models.CLIUsageLimitError, cli_models.CLIAuthError, cli_models.CodexModelRejectedError])
@pytest.mark.parametrize("stage", ["revision", "citation"])
def test_usage_auth_or_fixed_model_failure_stops_admitting_other_parents(repairs, error, stage):
    second = add_second_parent(repairs)
    (repairs[1] if stage == "revision" else repairs[2]).side_effect = error("SECRET_TOKEN raw logs")
    result = invoke(repairs, "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 1
    summary = json.loads(result.output)
    assert summary["stopped"] and summary["attempted"] == 1
    assert second["candidate_id"] not in saved(repairs)["repair_attempts"]
    assert repairs[1].call_count == 1
    assert repairs[2].call_count == (stage == "citation")
    assert "SECRET_TOKEN" not in result.output + repairs[0][0].read_text()


def test_repeatable_candidate_selection_repairs_requested_parent_only(repairs):
    second = add_second_parent(repairs)
    result = invoke(repairs, "--candidate", second["candidate_id"], "--candidate", second["candidate_id"], "--max-calls", "4")
    assert result.exit_code == 0, result.output
    assert set(saved(repairs)["repair_attempts"]) == {second["candidate_id"]}
    assert repairs[1].call_count == repairs[2].call_count == 1


def test_registered_verdict_directory_orphan_is_blocked_without_overwrite(repairs):
    case = repairs[0]
    custom = case[0].parent / "old-verdicts"
    custom.mkdir()
    ident = case[2]["candidates"][0]["candidate_id"]
    orphan = custom / (ident + "-r1.json")
    orphan.write_text("stale receipt")
    registry = case[6].parent / ".verdict-directories.json"
    registry.write_text(json.dumps({"version": 1, "directories": [str(custom)]}))
    result = invoke(repairs)
    assert result.exit_code == 1 and "reconciliation" in result.output
    repairs[1].assert_not_called()
    assert orphan.read_text() == "stale receipt"


def test_unknown_candidate_and_malformed_attempt_journal_block_before_calls(repairs):
    result = invoke(repairs, "--candidate", "missing-id")
    assert result.exit_code == 1
    payload = deepcopy(repairs[0][2])
    payload["repair_attempts"] = {payload["candidates"][0]["candidate_id"]: {"status": "unknown"}}
    repairs[0][0].write_text(json.dumps(payload))
    assert invoke(repairs).exit_code == 1
    repairs[1].assert_not_called()
    repairs[2].assert_not_called()


def test_repair_signature_includes_complete_current_style_and_no_judge_or_research_contract():
    from shared.question_style import STYLE_INSTRUCTIONS
    instructions = repair.RepairQuestionSignature.instructions
    assert STYLE_INSTRUCTIONS in instructions
    assert "correct_answer EXACTLY unchanged" in instructions
    assert "Self-check O3 separately for EACH distractor" in instructions
    assert "Do not research" in instructions and "call a judge" in instructions


@pytest.fixture
def mixed_completed(repairs):
    case = repairs[0]
    second = add_second_parent(repairs)
    first = case[2]["candidates"][0]
    good = {**case[5], "verdict": "PASS", "distractors_need_knowledge": True}
    (case[1] / (first["candidate_id"] + ".json")).write_text(json.dumps(good))
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1])])
    assert result.exit_code == 1  # The first is saved; the second raw FAIL remains rejected.
    payload = saved(repairs)
    assert payload["candidates"][0]["persistence_status"] == "complete"
    assert payload["generation_runs"] and payload["external_run_journal"]
    case[4].reset_mock()
    case[3].reset_mock()
    return repairs, second, payload


def test_same_artifact_verified_completed_runs_allow_failed_parent_repair_and_keep_all_ids(mixed_completed):
    repairs, second, before = mixed_completed
    case = repairs[0]
    result = invoke(repairs, "--dry-run", "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 0, result.output
    assert json.loads(result.output)["eligible"] == 1
    assert saved(repairs) == before
    case[4].assert_not_called()
    result = invoke(repairs, "--candidate", second["candidate_id"], "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 0, result.output
    after = saved(repairs)
    assert after["candidates"][:2] == before["candidates"]
    assert after["generation_runs"] == before["generation_runs"]
    assert after["external_run_journal"] == before["external_run_journal"]
    for code in before["generation_runs"]:
        assert ingest._run_id(before, code) == ingest._run_id(after, code)
    case[4].assert_not_called()
    assert not case[3].mock_calls
    child = after["candidates"][-1]
    (case[1] / (child["candidate_id"] + ".json")).write_text(json.dumps({**case[5], "verdict": "PASS", "distractors_need_knowledge": True}))
    result = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1])])
    assert result.exit_code == 0, result.output
    final = saved(repairs)
    assert final["candidates"][:2] == before["candidates"]
    assert final["generation_runs"] == before["generation_runs"]
    assert final["external_run_journal"] == before["external_run_journal"]
    case[3].create_generation_run.assert_not_called()
    assert case[3].insert_question.call_count == 1
    assert final["candidates"][-1]["inserted_question_id"] == child["repair"]["storage_question_id"]


@pytest.mark.parametrize("corruption", ["foreign_run", "unknown_run", "partial", "unknown", "failed_validation", "accepted_false", "wrong_uuid", "invalid_stored_verdict", "request_changed"])
def test_completed_state_exception_never_allows_partial_unknown_or_invalid_states(mixed_completed, corruption):
    repairs, _, before = mixed_completed
    payload = deepcopy(before)
    entry = payload["candidates"][0]
    code = entry["domain_code"]
    if corruption == "foreign_run": payload["generation_runs"][code] = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    elif corruption == "unknown_run": payload["external_run_journal"][code]["status"] = "unknown"
    elif corruption == "partial": entry["persistence_status"] = "failed_partial"
    elif corruption == "unknown": entry["persistence_status"] = "unknown"
    elif corruption == "failed_validation": entry["persistence_validation_failed"] = True
    elif corruption == "accepted_false": entry["accepted"] = False
    elif corruption == "wrong_uuid": entry["inserted_question_id"] = "wrong"
    elif corruption == "invalid_stored_verdict": entry["external_verdict"]["evidence_supported"] = False
    elif corruption == "request_changed": repairs[0][6].write_text("broken")
    repairs[0][0].write_text(json.dumps(payload))
    bytes_before = repairs[0][0].read_bytes()
    result = invoke(repairs, "--limit", "2", "--max-calls", "4")
    assert result.exit_code == 1, result.output
    repairs[1].assert_not_called()
    repairs[2].assert_not_called()
    repairs[0][4].assert_not_called()
    assert repairs[0][0].read_bytes() == bytes_before
