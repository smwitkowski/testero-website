"""Offline allowlisted projections of two real low-yield v5 batches."""
from copy import deepcopy
import json
from pathlib import Path
from collections import Counter

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from shared.cert_context import DEFAULT_CERT, plan_questions
from shared.decision_planner import plan_decision
from shared.near_duplicates import load_export, check_near_duplicate
from shared.yield_planning import existing_scenarios, ObjectiveRotation, MAX_SCENARIOS, SUMMARY_CHARS
from shared.batch_report import key_position_report

FIXTURES = Path(__file__).parent / "fixtures/yield"


def replay(name):
    return json.loads((FIXTURES / (name + ".json")).read_text())


def scope_for(ident):
    return plan_questions(DEFAULT_CERT, 1, objective_ids=[ident])[0]


@pytest.mark.parametrize("name", ["serving", "scaling"])
def test_planner_receives_prior_accepted_scenario_and_key_without_other_objectives(name, tmp_path):
    recorded = replay(name)
    accepted = next(row for row in recorded["candidates"] if row["accepted"])
    ident = accepted["objective_id"]
    keyed = next(option["text"] for option in accepted["options"] if option["label"] == accepted["key"])
    # Objective mapping comes from this recorded accepted candidate, not legacy bank guesses.
    export = tmp_path / "bank.json"
    export.write_text(json.dumps([{**accepted, "status": "ACTIVE"}]))
    bank = load_export(export)["questions"]
    assert bank[0]["objective_id"] == ident
    summaries = existing_scenarios(scope_for(ident), bank, [], ())
    inputs = []
    result = plan_decision(scope_for(ident), model="codex", existing_scenarios=summaries,
        predictor=lambda **kw: inputs.append(kw) or {"plan": accepted["decision_attempts"][-1]["plan"]})
    assert result["objective_id"] == ident
    prompt_rows = json.loads(inputs[0]["existing_scenarios"])
    assert prompt_rows == [{"stem_summary": accepted["stem"][:SUMMARY_CHARS],
                            "keyed_action": keyed[:SUMMARY_CHARS], "attribution": "selected_objective"}]
    other = {**bank[0], "objective_id": "other", "stem": "Different known objective scenario"}
    assert existing_scenarios(scope_for(ident), [other], []) == []
    # Objective attribution is only a planning hint: full-bank dedupe still rejects.
    assert not check_near_duplicate(accepted, [other | {"stem": accepted["stem"]}])["passed"]


def test_history_bound_batch_and_inflight_plans_and_unmapped_bank():
    recorded = replay("serving")
    accepted = next(row for row in recorded["candidates"] if row["accepted"])
    scope = scope_for(accepted["objective_id"])
    plan = accepted["decision_attempts"][-1]["plan"]
    bank = [{"id": str(i), "stem": str(i) + accepted["stem"] * 5,
             "key": plan["best_action"] * 5} for i in range(30)]
    summaries = existing_scenarios(scope, bank, [accepted], [plan])
    assert len(summaries) == MAX_SCENARIOS
    assert summaries[0]["stem_summary"] == plan["existing_system"][:SUMMARY_CHARS]
    assert summaries[1]["stem_summary"] == accepted["stem"][:SUMMARY_CHARS]
    assert all(len(value) <= SUMMARY_CHARS for row in summaries for value in row.values())
    duplicate = next(row for row in recorded["candidates"] if row.get("failure_stage") == "near_duplicate")
    assert not check_near_duplicate(duplicate, recorded["existing_questions"])["passed"]


@pytest.mark.parametrize("name", ["serving", "scaling"])
def test_three_recorded_veto_attempts_feed_all_prior_reasons_and_never_write(name, monkeypatch, tmp_path):
    recorded = replay(name)
    veto = next(row for row in recorded["candidates"] if row.get("failure_stage") == "decision_veto")
    extra = next(row for row in recorded["candidates"] if row["objective_id"] != veto["objective_id"])
    # Third plan is a recorded real plan retargeted synthetically to this objective;
    # its recorded veto is not converted into support.
    attempts = deepcopy(veto["decision_attempts"] + [extra["decision_attempts"][0]])
    attempts[2]["plan"]["objective_id"] = veto["objective_id"]
    attempts[2]["proof"]["passed"] = False
    inputs = []
    def planned(scope, **kw):
        def predictor(**values):
            inputs.append(values)
            return {"plan": attempts[len(inputs) - 1]["plan"]}
        return plan_decision(scope, predictor=predictor, **kw)
    proofs = iter(row["proof"] for row in attempts)
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", planned)
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: next(proofs))
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [{"text": "Offline document"}])
    monkeypatch.setattr(generate, "documentation_context", lambda *a: "Offline documentation placeholder, not support")
    monkeypatch.setattr(generate, "generate_question", lambda *a, **kw: pytest.fail("Veto must block writer"))
    monkeypatch.setattr(generate, "database_client", lambda: pytest.fail("DB forbidden"))
    artifact = tmp_path / "batch.json"
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--n-questions", "1", "--objective", veto["objective_id"], "--artifact", str(artifact)])
    assert result.exit_code == 1
    assert len(inputs) == 3
    for index in (1, 2):
        feedback = json.loads(inputs[index]["replacement_feedback"])
        assert [row["veto_reason"] for row in feedback["previous_vetoes"]] == [row["proof"]["reason"] for row in attempts[:index]]
    entry = json.loads(artifact.read_text())["candidates"][0]
    assert entry["decision_attempt_count"] == 3
    assert entry["decision_veto_reasons"] == [row["proof"]["reason"] for row in attempts]
    assert entry["failure_stage"] == "decision_veto" and not entry["accepted"]
    assert "external_judge_request" not in entry


@pytest.mark.parametrize("name", ["serving", "scaling"])
def test_rotation_replays_failures_respects_fair_share_section_and_reservations(name):
    recorded = replay(name)
    ids = recorded["objective_ids"]
    plan = plan_questions(DEFAULT_CERT, 30, objective_ids=ids)
    code = plan[0]["domain_code"]
    rotation = ObjectiveRotation(plan, {code: ids})
    for item in plan[:len(ids)]:
        assert rotation.select(item, [])[0] == item["objective_id"]
    failed = next(row for row in recorded["outcomes"] if row["failure_stage"] == "decision_veto")
    # Exhaust the failed objective's three-slot fair share before requiring a retarget.
    rotation.admitted[failed["objective_id"]] = 3
    selected, fair = rotation.select(scope_for(failed["objective_id"]), recorded["outcomes"][:len(ids)])
    assert fair == 3 and selected != failed["objective_id"]
    assert selected in ids
    # Terminal near-duplicate outcomes have the same rotation policy; judge failures do not.
    failure_scope = scope_for(failed["objective_id"])
    rotation.admitted[failed["objective_id"]] = fair
    chosen, _ = rotation.select(failure_scope, [dict(failed, failure_stage="near_duplicate")])
    assert chosen != failed["objective_id"]
    chosen_again, _ = rotation.select(failure_scope, [dict(failed, failure_stage="near_duplicate")])
    assert chosen_again != chosen  # admission reservations distribute ties
    assert rotation.select(failure_scope, [dict(failed, failure_stage="judge")])[0] == failed["objective_id"]
    singleton = ObjectiveRotation([failure_scope] * 3, {code: [failed["objective_id"]]})
    assert singleton.select(failure_scope, [failed])[0] == failed["objective_id"]


@pytest.mark.parametrize("name,accepted,total,counts", [
    ("serving", 5, 16, {"A": 2, "B": 4, "C": 3, "D": 7}),
    ("scaling", 4, 12, {"A": 2, "B": 3, "C": 2, "D": 5}),
])
def test_real_key_report_excludes_rejected_candidates_without_weakening_cap(name, accepted, total, counts):
    rows = replay(name)["outcomes"]
    generated = key_position_report(rows)
    assert generated["count"] == total and generated["counts"] == counts
    assert generated["passed"] is False
    report = key_position_report([row for row in rows if row["accepted"]])
    assert report["count"] == accepted and report["passed"] is True and not report["enforced"]
    assert key_position_report([])["passed"] is None
    # Accepted skew still fails at the unchanged cap, not just generated skew.
    assert key_position_report([row for row in rows if row["accepted"] and row["key"] == "B"] * 10)["passed"] is False


def test_generator_retargets_actual_scope_and_keeps_global_hints(monkeypatch, tmp_path):
    recorded = replay("serving")
    ids = recorded["objective_ids"][:2]
    initial = plan_questions(DEFAULT_CERT, 6, objective_ids=ids)
    recorded_veto = recorded["candidates"][0]["decision_attempts"]
    plans_seen = []
    def planned(scope, **kw):
        plans_seen.append(deepcopy(scope))
        # Always reuse this recorded unsupported plan; the repeat guard ends each
        # candidate without writer calls, allowing actual adaptive admission replay.
        return {**recorded_veto[0]["plan"], "objective_id": scope["objective_id"]}
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", planned)
    monkeypatch.setattr(generate, "verify_decision", lambda *a, **kw: recorded_veto[0]["proof"])
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [{"text": "Offline placeholder"}])
    monkeypatch.setattr(generate, "documentation_context", lambda *a: "Offline placeholder")
    monkeypatch.setattr(generate, "generate_question", lambda *a, **kw: pytest.fail("Veto blocks writer"))
    artifact = tmp_path / "rotation.json"
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--parallel", "1", "--n-questions", "6", "--objective", ids[0], "--objective", ids[1],
        "--artifact", str(artifact)])
    assert result.exit_code == 1
    payload = json.loads(artifact.read_text())
    assert len(payload["candidates"]) == 6
    assert Counter(row["domain_code"] for row in payload["plan"]) == Counter(row["domain_code"] for row in initial)
    for before, after, entry in zip(initial, payload["plan"], payload["candidates"]):
        assert after["objective_id"] == entry["objective_id"]
        assert after["objective_id"] in ids
        for field in ("opening_style", "question_line", "key_length_rank", "scenario_moment"):
            assert after[field] == before[field]
        assert after["objective_text"] in after["domain_prompt"]
        assert after["objective_id"] in after["domain_prompt"]
    # All objectives failed: fair admissions still spread six slots evenly.
    assert Counter(row["objective_id"] for row in payload["plan"]) == dict.fromkeys(ids, 3)


def test_generated_skew_is_informational_in_real_generation_pipeline(pipeline, monkeypatch):
    from shared.batch_report import key_position_report as report
    events, path, invoke = pipeline
    monkeypatch.setattr(generate, "key_position_report", lambda rows: report(list(rows) * 10))
    result = invoke()
    assert result.exit_code == 0, result.output
    payload = json.loads((path / "batch.json").read_text())
    assert payload["all_candidate_key_position_report"]["passed"] is False
    assert payload["key_position_report"]["passed"] is None
    assert "FAIL" not in result.output
    assert "Generated key positions (informational only)" in result.output



def test_serial_retarget_publishes_request_for_actual_objective(monkeypatch, tmp_path):
    from test_external_generation import QUESTION, source, receipts
    from test_decision_first_v4 import decision, proof
    from shared.external_judge import candidate_id, candidate_question
    recorded = replay("serving")
    ids = recorded["objective_ids"][:2]
    calls = Counter()
    inputs = []
    def planned(scope, **kw):
        calls[scope["objective_id"]] += 1
        inputs.append((deepcopy(scope), deepcopy(kw)))
        plan = decision("Unsupported" if scope["objective_id"] == ids[0] else "Supported " + str(calls[scope["objective_id"]]))
        plan["objective_id"] = scope["objective_id"]
        return plan
    def verified(scope, plan, *a, **kw):
        passing = scope["objective_id"] != ids[0]
        return {**proof(passing), "passed": passing, "mechanical_check": {"passed": passing, "errors": []}}
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_decision", planned)
    monkeypatch.setattr(generate, "verify_decision", verified)
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [source()])
    write_count = 0
    def writer(*a, **kw):
        nonlocal write_count
        write_count += 1
        # Public recorded stem provides a materially different context; this is
        # infrastructure replay, not a factual support claim for synthetic options.
        stem = QUESTION["stem"] if write_count == 1 else next(row["stem"] for row in recorded["candidates"] if row["accepted"])
        return {**QUESTION, "stem": stem}
    monkeypatch.setattr(generate, "generate_question", writer)
    monkeypatch.setattr(generate, "cite_question", lambda *a, **kw: {"evidence": receipts()})
    artifact = tmp_path / "retarget.json"
    result = CliRunner().invoke(generate.main, ["--model", "codex", "--judge-model", "external",
        "--parallel", "1", "--n-questions", "3", "--objective", ids[0], "--objective", ids[1],
        "--artifact", str(artifact)])
    assert result.exit_code == 1  # first veto is not waived
    payload = json.loads(artifact.read_text())
    scope = payload["plan"][2]
    assert payload["candidates"][2]["objective_rotation"] == {"from": ids[0], "to": ids[1], "fair_share": 2}
    from scripts.ingest_external_verdicts import _scope
    assert _scope(payload, payload["candidates"][2]) == scope
    assert scope["objective_id"] == ids[1]
    assert scope["services"] == scope_for(ids[1])["services"]
    assert scope["objective_text"] == scope_for(ids[1])["objective_text"]
    # Accepted decision request at index 2 is frozen for its actual scope.
    entry = payload["candidates"][1]
    assert entry["candidate_id"] == candidate_id(2, payload["plan"][1], candidate_question(entry))
    request = json.loads((tmp_path / entry["external_judge_request"]["path"]).read_text())
    assert request["objective_id"] == ids[1]
    assert inputs[-1][1]["existing_scenarios"]  # prior committed sibling shown
    rotated = payload["candidates"][2]
    assert rotated["near_duplicate_check"]["passed"] is True
    assert rotated["awaiting_external_judge"] is True
    assert rotated["candidate_id"] == candidate_id(3, scope, candidate_question(rotated))
    rotated_request = json.loads((tmp_path / rotated["external_judge_request"]["path"]).read_text())
    assert rotated_request["objective_id"] == ids[1]


def test_unknown_hints_are_labelled_and_zero_overlap_omitted():
    scope = scope_for(replay("serving")["objective_ids"][0])
    unrelated = {"id": "unknown", "stem": "Unrelated zebra habitats", "key": "Count striped animals"}
    assert existing_scenarios(scope, [unrelated], []) == []
    related = {**unrelated, "stem": scope["objective_text"]}
    rows = existing_scenarios(scope, [related], [])
    assert rows[0]["attribution"] == "unmapped_export_hint"


@pytest.mark.parametrize("stored", [True, False])
def test_final_report_tracks_successfully_persisted_failed_drafts(pipeline, monkeypatch, stored):
    from unittest.mock import Mock
    from shared.gates import aggregate_gate_verdict
    from test_three_gates_v4 import bundle
    from test_external_generation import QUESTION
    events, path, invoke = pipeline
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "domain"}
    client.create_generation_run.return_value = {"id": "run"}
    client.update_generation_run.return_value = True
    monkeypatch.setattr(generate, "database_client", lambda: client)
    raw = bundle(QUESTION)
    raw["evidence"]["evidence_supported"] = False
    raw["evidence"]["verdict"] = "FAIL"
    judge = aggregate_gate_verdict(QUESTION, raw)
    assert not judge.passed
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: judge)
    monkeypatch.setattr(generate, "persist_candidate", lambda *a, **kw: stored)
    result = invoke("--judge-model", "claude")
    assert result.exit_code == 1
    payload = json.loads((path / "batch.json").read_text())
    entry = payload["candidates"][0]
    assert entry["accepted"] is False and entry["persisted"] is stored
    assert payload["key_position_report"]["count"] == int(stored)
    assert payload["write_key_position_report"]["count"] == 1

from test_decision_first_v4 import pipeline
