"""Source-hashed saved PDE regressions; all tests are offline."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

import pytest

from scripts.replay_pde_answer_patterns import FIXTURE, project_authored, replay, verify_sources
from scripts.run_domain_batch import export_questions
from shared.answer_patterns import check_answer_pattern
from shared.near_duplicates import comparison_row, load_export


@pytest.fixture
def saved():
    return json.loads(FIXTURE.read_text())


def test_saved_replay_catches_three_repeats_and_preserves_two_distinct_decisions(saved):
    report = replay(saved)
    assert report["passed"]
    assert report["comparison_sets"] == {
        "saved_active_draft_bank": 14, "all_saved_authored_pilot": 21,
        "combined_unique_questions": 22,
        "authored_only_pilot_ids": sorted(record["question"]["candidate_id"] for record in saved["pilot_authored"]
                                        if record["question"]["candidate_id"] not in {row["id"] for row in saved["bank"]["questions"]}),
    }
    for row in report["results"][:3]:
        result = row["combined_comparison"]
        assert not result["passed"] and not result["errors"]
        assert len(result["matches"]) == 1
        assert result["matches"][0]["method"] == "canonical"
        assert result["matches"][0]["matched_id"] == row["expected_pilot_id"]
        scores = result["matches"][0]["distractor_scores"]
        assert scores[0] < 0.55 and scores[1:] == [1.0, 1.0]
    assert all(row["combined_comparison"]["passed"] for row in report["results"][3:])
    # Exported-bank coverage is a separate, smaller claim, not fabricated persistence.
    assert all(not row["saved_bank_only"]["passed"] for row in report["results"][:2])
    reservation = report["results"][2]
    assert reservation["saved_bank_only"]["passed"]
    assert reservation["expected_pilot_in_saved_bank"] is False
    pilot = next(record["question"] for record in saved["pilot_authored"]
                 if record["question"]["candidate_id"] == reservation["expected_pilot_id"])
    assert pilot["accepted"] is False and pilot["failure_stage"] == "judge"
    assert "status" not in pilot


def test_source_hashes_and_projections_are_frozen(saved):
    assert len(saved["sources"]) >= 8
    assert all(re.fullmatch(r"[0-9a-f]{64}", digest) for digest in saved["sources"].values())
    for record in saved["pilot_authored"] + saved["repeats"] + saved["distinct_controls"]:
        assert record["source"] in saved["sources"]
        assert type(record["candidate_index"]) is int
        assert project_authored(record["question"]) == record["question"]
    assert saved["bank"]["source"] in saved["sources"]


def test_original_source_verification_rejects_changed_bytes_before_projection(tmp_path):
    path = tmp_path / "source.json"
    path.write_text('{"candidates": []}')
    fixture = {"sources": {path.name: hashlib.sha256(path.read_bytes()).hexdigest()},
               "pilot_authored": [], "repeats": [], "distinct_controls": [],
               "bank": {"source": "bank.json", "questions": []}}
    bank = tmp_path / "bank.json"
    bank.write_text("[]")
    fixture["sources"][bank.name] = hashlib.sha256(bank.read_bytes()).hexdigest()
    assert verify_sources(fixture, tmp_path) == ["bank.json", "source.json"]
    path.write_text('{"candidates": []} ')
    with pytest.raises(ValueError, match="Source hash mismatch"):
        verify_sources(fixture, tmp_path)


@pytest.mark.parametrize("case_index", [0, 1, 2])
def test_written_options_plan_and_export_projection_all_catch_saved_repeat(saved, case_index):
    case = saved["repeats"][case_index]
    pilot = next(record["question"] for record in saved["pilot_authored"]
                 if record["question"]["candidate_id"] == case["expected_pilot_id"])
    projected = comparison_row(pilot, cert_id="data-engineer")
    projected["cert_id"] = "data-engineer"
    for candidate in [case["question"], case["question"]["decision_plan"]]:
        for prior in [pilot, pilot["decision_plan"], projected]:
            result = check_answer_pattern(candidate, [prior], cert_id="data-engineer")
            assert not result["passed"] and not result["errors"]
            assert result["signature"]["mechanism"] == case["family"]
    reordered = deepcopy(case["question"])
    reordered["options"].reverse()
    assert not check_answer_pattern(reordered, [projected], cert_id="data-engineer")["passed"]


@pytest.mark.parametrize("status", ["ACTIVE", "DRAFT"])
def test_complete_paginated_export_keeps_pilot_bank_rows_through_veto(saved, tmp_path, status):
    rows = deepcopy(saved["bank"]["questions"])
    for row in rows:
        row["status"] = status
    calls = []
    def fetch(params):
        calls.append(params)
        assert params["status"] == "in.(ACTIVE,DRAFT)" and params["exam"] == "eq.data-engineer"
        # Server caps below requested limit; do not stop on a short nonempty page.
        return rows[params["offset"]:params["offset"] + 3]
    path = tmp_path / "all-bank.json"
    assert export_questions("https://fixture.supabase.co", "unused", "data-engineer", path, fetch=fetch) == len(rows)
    bank = load_export(path, cert_id="data-engineer")
    assert len(bank["questions"]) == 14 and len(calls) == 6
    for case in saved["repeats"][:2]:
        result = check_answer_pattern(case["question"], bank["questions"], cert_id="data-engineer")
        assert not result["passed"] and not result["errors"]
        assert case["expected_pilot_id"] in {row["matched_id"] for row in result["matches"]}


@pytest.mark.parametrize("case_index", [0, 1, 2])
def test_new_families_still_require_two_matched_distractors(saved, case_index):
    case = saved["repeats"][case_index]
    pilot = next(record["question"] for record in saved["pilot_authored"]
                 if record["question"]["candidate_id"] == case["expected_pilot_id"])
    changed = deepcopy(case["question"])
    unrelated = iter(["Run the scheduled job in a different region.",
                      "Store archived files in Cloud Storage.",
                      "Apply access policies to the reporting dataset."])
    for option in changed["options"]:
        if option["label"] != changed["key"]:
            option["text"] = next(unrelated)
    assert check_answer_pattern(changed, [pilot], cert_id="data-engineer")["passed"]


@pytest.mark.parametrize("case_index", [0, 1, 2])
@pytest.mark.parametrize("prefix", ["Do not ", "Avoid ", "Never "])
def test_new_positive_families_never_match_negated_decisions(saved, case_index, prefix):
    case = saved["repeats"][case_index]
    opposite = deepcopy(case["question"])
    for option in opposite["options"]:
        if option["label"] == opposite["key"]:
            option["text"] = prefix + option["text"]
    assert check_answer_pattern(opposite, [case["question"]], cert_id="data-engineer")["passed"]


def test_join_family_requires_explicit_row_expansion_scenario(saved):
    case = deepcopy(saved["repeats"][1]["question"])
    case["stem"] = "You use BigQuery to calculate differences between sensor readings for a daily report."
    result = check_answer_pattern(case, [], cert_id="data-engineer")
    assert result["signature"]["mechanism"] is None


def test_reservation_assignment_to_data_project_is_not_execution_project_isolation(saved):
    original = saved["repeats"][2]["question"]
    different = deepcopy(original)
    for option in different["options"]:
        if option["label"] == different["key"]:
            option["text"] = option["text"].replace("operations project", "central data project")
    result = check_answer_pattern(different, [original], cert_id="data-engineer")
    assert result["passed"]
    assert result["signature"]["mechanism"] == "reservation_storage_project_assignment"


def test_nested_no_shuffle_effect_exception_does_not_disable_action_negation(saved):
    p = deepcopy(saved["repeats"][0]["question"]["decision_plan"])
    p["mistakes"][0]["action"] = "Never keep separate tables and cluster both by claim_id to guarantee that their joins require no shuffle."
    signature = check_answer_pattern(p, [], cert_id="data-engineer")["signature"]
    alternative = next(row for row in signature["distractors"] if "shuffle" in row["tokens"])
    assert alternative["has_contrast"] and alternative["archetype"] is None
