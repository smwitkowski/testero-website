"""Offline report diversity uses bound cohort judgments, not stale waiting flags."""
import json

import pytest

from scripts.export_judge_requests import export_requests
from scripts.variants_ab import report
from shared.argon_gate import MODEL
from shared.external_judge import candidate_question, canonical_sha256
from shared.near_duplicates import comparison_row, similarity
from test_three_gates_v4 import bundle
from test_variants import parents, variant_for, variants


@pytest.fixture
def cohort(parents, tmp_path):
    parent_artifact, bank, parent_payload, _ = parents
    artifact = tmp_path / "variants.json"
    def writer(inputs):
        question = variant_for(inputs)
        question["setting"] = question["industry"] + " photograph classification"
        return question
    payload = variants.generate(
        [parent_artifact], [parent_payload["candidates"][0]["candidate_id"]], bank,
        artifact, variants_per_parent=2, enable_variants=True, predictor=writer)
    assert len(payload["candidates"]) == 2
    # Model a fully generated awaiting cohort. Deliberately similar siblings
    # should be adjudicated by report only after their independent judgments.
    for entry in payload["candidates"]:
        assert entry["schema_check"]["passed"]
        entry.pop("failure_stage", None)
        entry.update(status="awaiting_external_judge", awaiting_external_judge=True,
                     near_duplicate_check={"passed": True}, accepted=False)
    artifact.write_text(json.dumps(payload))
    export_requests(artifact, force=True)
    payload = json.loads(artifact.read_text())
    a, b = map(comparison_row, payload["candidates"])
    assert similarity(a["stem"], a["key"], b["stem"], b["key"])["stem_score"] >= .45
    verdicts = tmp_path / "variants.verdicts"
    verdicts.mkdir(exist_ok=True)
    return artifact, verdicts, payload


def write_verdict(artifact, verdicts, entry, *, failed_gate=None):
    raw = bundle(candidate_question(entry))
    request = json.loads((artifact.parent / entry["external_judge_request"]["path"]).read_text())
    raw["argon"] = {
        "model": MODEL, "version": 2, "request_sha256": canonical_sha256(request["argon"]),
        "review": {"verdict": "PASS", "key_correct": True,
                   "other_defensible_option": False, "issues": [], "fix": "No changes needed"}}
    if failed_gate == "argon":
        raw["argon"]["review"].update(verdict="REVISE", issues=["Synthetic quality defect"],
                                       fix="Revise the scenario")
    elif failed_gate == "blind_solver":
        raw[failed_gate].update(verdict="FAIL", ambiguous_answers=True)
    elif failed_gate:
        raw[failed_gate].update(verdict="FAIL", score=.4, reason="Synthetic quality defect")
    (verdicts / (entry["candidate_id"] + ".json")).write_text(json.dumps(raw))


@pytest.mark.parametrize("failed_gate", ["style", "evidence", "blind_solver", "argon"])
@pytest.mark.parametrize("failed_index", [0, 1])
def test_quality_rejected_sibling_does_not_consume_report_slot(cohort, failed_gate, failed_index):
    artifact, verdicts, payload = cohort
    rejected = payload["candidates"][failed_index]
    survivor = payload["candidates"][1 - failed_index]
    for entry in payload["candidates"]:
        assert entry["awaiting_external_judge"] and "external_verdict" not in entry
        write_verdict(artifact, verdicts, entry,
                      failed_gate=failed_gate if entry is rejected else None)
    original = artifact.read_bytes()
    result = report(artifact, verdicts)
    assert result["errors"] == []
    assert result["accepted_variant_ids"] == [survivor["candidate_id"]]
    assert result["all_gate_passed"] == 1
    family = next(row for row in result["family_similarity"]
                  if row["candidate_id"] == survivor["candidate_id"])
    assert family["max_family_stem_similarity"] < .45
    assert all(result["gates"][gate]["measured"] == 2
               for gate in ("style", "evidence", "blind_solver", "argon"))
    assert artifact.read_bytes() == original


@pytest.mark.parametrize("sibling_verdict", ["missing", "pass"])
def test_still_eligible_sibling_consumes_report_slot(cohort, sibling_verdict):
    artifact, verdicts, payload = cohort
    survivor, sibling = payload["candidates"]
    write_verdict(artifact, verdicts, survivor)
    if sibling_verdict == "pass":
        write_verdict(artifact, verdicts, sibling)
    result = report(artifact, verdicts)
    assert result["errors"] == []
    # The first candidate loses to the eligible sibling. If that sibling has
    # its own PASS, the first rejection must not then veto it in turn.
    expected_ids = [sibling["candidate_id"]] if sibling_verdict == "pass" else []
    assert result["accepted_variant_ids"] == expected_ids
    family = next(row for row in result["family_similarity"]
                  if row["candidate_id"] == survivor["candidate_id"])
    assert family["max_family_stem_similarity"] >= .45
    if sibling_verdict == "pass":
        later_family = next(row for row in result["family_similarity"]
                            if row["candidate_id"] == sibling["candidate_id"])
        assert later_family["max_family_stem_similarity"] < .45
    expected_measured = 2 if sibling_verdict == "pass" else 1
    assert all(result["gates"][gate]["measured"] == expected_measured
               for gate in ("style", "evidence", "blind_solver", "argon"))


def test_generation_rejected_sibling_does_not_consume_report_slot(cohort):
    artifact, verdicts, payload = cohort
    survivor, rejected = payload["candidates"]
    rejected.update(status="generation_failed", failure_stage="near_duplicate",
                    awaiting_external_judge=False, near_duplicate_check={"passed": False})
    artifact.write_text(json.dumps(payload))
    write_verdict(artifact, verdicts, survivor)
    result = report(artifact, verdicts)
    assert result["errors"] == []
    assert result["accepted_variant_ids"] == [survivor["candidate_id"]]


def test_report_and_dry_ingest_keep_survivor_before_later_style_failure(cohort, monkeypatch):
    from unittest.mock import Mock
    import click
    from scripts import ingest_external_verdicts as ingest
    from shared.option_order import canonical_evidence

    artifact, verdicts, payload = cohort
    survivor, rejected = payload["candidates"]
    write_verdict(artifact, verdicts, survivor)
    write_verdict(artifact, verdicts, rejected, failed_gate="style")
    before = report(artifact, verdicts)
    assert before["accepted_variant_ids"] == [survivor["candidate_id"]]
    database = Mock(side_effect=AssertionError("No database in dry-run integration"))
    monkeypatch.setattr(ingest, "database_client", database)

    # Ingest records the partial result, then signals the rejected candidate.
    with pytest.raises(click.ClickException, match="Some candidates were not persisted; inspect the artifact"):
        ingest.ingest(artifact, verdicts, dry_run=True)

    saved = json.loads(artifact.read_text())
    passed, failed = saved["candidates"]
    assert passed["candidate_id"] == survivor["candidate_id"]
    assert passed["judge_verdict"]["passed"] is True
    assert passed["status"] == "external_judge_passed"
    assert "failure_stage" not in passed
    assert passed["grounding"]["parent_question_id"] == survivor["parent_question_id"]
    assert passed["grounding"]["variant"] == passed["variant"]
    assert passed["grounding"]["gate_verdicts"]["style"]["verdict"] == "PASS"
    assert canonical_evidence(passed) == saved["variant_parents"][passed["parent_question_id"]]["evidence"]
    assert passed["grounding"]["evidence"] == passed["evidence"]
    assert failed["candidate_id"] == rejected["candidate_id"]
    assert failed["judge_verdict"]["passed"] is False
    assert failed.get("failure_stage")
    assert "grounding" not in failed
    assert all(entry["accepted"] is False and "persistence_status" not in entry
               for entry in saved["candidates"])
    assert json.loads((verdicts / (failed["candidate_id"] + ".json")).read_text())["style"]["verdict"] == "FAIL"
    assert report(artifact, verdicts)["accepted_variant_ids"] == before["accepted_variant_ids"]
    database.assert_not_called()
