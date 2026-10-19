"""Frozen prior family history through the existing variant lifecycle, offline."""
from copy import deepcopy
import json

import pytest
from test_variants import parents, generate, variant_for, verdict_for
from test_variant_report_eligibility import cohort
from scripts import variants_ab, generate_variants
from shared.variants import variant_duplicates, validate_variant
from shared.external_judge import canonical_sha256
from shared.near_duplicates import comparison_row


def test_prior_accepted_family_rows_affect_generation_and_frozen_replay(parents, tmp_path):
    old = generate(parents, tmp_path, enable_variants=True, predictor=variant_for)
    old_entry = old["candidates"][0]
    verdict_for(old_entry, tmp_path)
    history_path = tmp_path / "variants.json"
    assert old_entry["accepted"] is False
    artifact, bank, source, _ = parents
    new = generate_variants.generate([artifact], [source["candidates"][0]["candidate_id"]], bank,
        tmp_path / "new" / "variants.json", variants_per_parent=1, enable_variants=True,
        predictor=variant_for, prior_artifacts=[history_path])
    assert len(new["prior_variants"]["questions"]) == 1
    row = new["prior_variants"]["questions"][0]
    assert row["id"] == old_entry["candidate_id"]
    assert row["parent_question_id"] == old_entry["parent_question_id"]
    assert new["plan"][0]["industry"] != old["plan"][0]["industry"]
    entry = new["candidates"][0]
    assert entry["failure_stage"] == "near_duplicate"
    assert old_entry["candidate_id"] in {m["matched_id"] for m in entry["near_duplicate_check"]["family_matches"]}
    # Later replay is bound to local frozen rows, not a mutable prior path.
    history_path.unlink()
    validate_variant(new, entry)
    changed = deepcopy(new)
    changed["prior_variants"]["questions"][0]["stem"] += " changed"
    with pytest.raises(ValueError): validate_variant(changed, changed["candidates"][0])


def test_prior_industry_reuse_is_separate_from_family_stem_threshold(parents, tmp_path):
    payload = generate(parents, tmp_path, enable_variants=True, predictor=variant_for)
    entry = payload["candidates"][0]
    parent = payload["variant_parents"][entry["parent_question_id"]]
    row = {**comparison_row(entry), "id": "previous-run", "stem": "solar customer reports commissioning rooftop installations",
           "parent_question_id": entry["parent_question_id"], "industry": entry["variant"]["surface"]["industry"]}
    result = variant_duplicates(entry, [], parent, prior=[row])
    assert "previous-run" not in {m["matched_id"] for m in result["family_matches"]}
    assert result["prior_family_industry_reuse"] == ["previous-run"]
    assert result["passed"] is False
    assert result["reason"] == "Prior accepted family industry repeated"
    # Other families still use the unchanged strict non-family bank veto.
    other = {**row, **comparison_row(entry), "id": "other-parent", "parent_question_id": "different-parent"}
    assert variant_duplicates(entry, [], parent, prior=[other])["passed"] is False


@pytest.mark.parametrize("stale_stage", ["external_verdict", "judge", "near_duplicate"])
def test_missing_verdict_remains_eligible_after_saved_diagnostics(cohort, stale_stage):
    from test_variant_report_eligibility import write_verdict
    from shared.variant_eligibility import reviewed_siblings
    artifact, verdicts, payload = cohort
    survivor, pending = payload["candidates"]
    write_verdict(artifact, verdicts, survivor)
    before = variants_ab.report(artifact, verdicts)
    assert before["accepted_variant_ids"] == []
    pending.update(failure_stage=stale_stage, awaiting_external_judge=False,
                   judge_verdict={"passed":False}, near_duplicate_check={"passed":False})
    artifact.write_text(json.dumps(payload))
    siblings = reviewed_siblings(artifact, payload, verdicts)
    from shared.variants import eligible_sibling
    assert eligible_sibling(siblings[1])
    assert variants_ab.report(artifact, verdicts)["accepted_variant_ids"] == before["accepted_variant_ids"]


def test_missing_verdict_keeps_request_bearing_generation_reject_ineligible(cohort):
    from shared.variant_eligibility import reviewed_siblings
    from shared.variants import eligible_sibling
    artifact, verdicts, payload = cohort
    payload["candidates"][1].update(failure_stage="near_duplicate",status="generation_failed",
        awaiting_external_judge=False, near_duplicate_check={"passed":False})
    siblings = reviewed_siblings(artifact,payload,verdicts)
    assert not eligible_sibling(siblings[1])


def test_report_missing_verdict_eligibility_survives_dry_ingest(cohort, monkeypatch):
    import click
    from unittest.mock import Mock
    from scripts import ingest_external_verdicts as ingest
    from test_variant_report_eligibility import write_verdict
    from shared.variant_eligibility import reviewed_siblings
    from shared.variants import eligible_sibling
    artifact, verdicts, payload = cohort
    survivor, pending = payload["candidates"]
    write_verdict(artifact, verdicts, survivor)
    before = variants_ab.report(artifact, verdicts)
    assert before["accepted_variant_ids"] == []
    db = Mock(side_effect=AssertionError("No database"))
    monkeypatch.setattr(ingest, "database_client", db)
    with pytest.raises(click.ClickException, match="No passing candidates"):
        ingest.ingest(artifact, verdicts, dry_run=True)
    saved = json.loads(artifact.read_text())
    assert saved["candidates"][1]["failure_stage"] == "external_verdict"
    assert eligible_sibling(reviewed_siblings(artifact, saved, verdicts)[1])
    assert variants_ab.report(artifact, verdicts)["accepted_variant_ids"] == before["accepted_variant_ids"]
    db.assert_not_called()
