"""Offline historical acceptance and frozen dedupe snapshot tests."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path

import pytest

from shared.external_judge import canonical_sha256
from shared.variant_history import load_prior_variants, validate_prior_variants, HISTORY_NOTE
from test_variants import parents, generate, variant_for, verdict_for


@pytest.fixture
def prior(parents, tmp_path, monkeypatch):
    from shared import variants
    original_scope = variants.variant_scope
    monkeypatch.setattr(variants, "variant_scope", lambda scope, parent, ordinal, **kwargs:
                        original_scope(scope, parent, ordinal, policy_version=3))
    payload = generate(parents, tmp_path, enable_variants=True, predictor=variant_for)
    entry = payload["candidates"][0]
    assert entry.get("external_judge_request"), entry
    verdicts = verdict_for(entry, tmp_path)
    return tmp_path / "variants.json", payload, entry, verdicts


def _write(path, payload):
    path.write_text(json.dumps(payload))


def _resign(history):
    history["snapshot_sha256"] = canonical_sha256({key: history[key] for key in ("artifacts", "questions")})


def test_empty_history_is_frozen_without_importing_report(monkeypatch):
    import sys
    monkeypatch.setitem(sys.modules, "scripts.variants_ab", None)
    result = load_prior_variants(())
    assert result["artifacts"] == result["questions"] == []
    assert validate_prior_variants(result) is result
    json.dumps(result, allow_nan=False)


def test_load_replays_actual_gates_not_candidate_flags_or_report(prior):
    path, payload, entry, verdicts = prior
    assert entry["accepted"] is False
    path.with_suffix(".report.json").write_text(json.dumps({"accepted_variant_ids": ["forged-id"]}))
    result = load_prior_variants([path])
    assert len(result["questions"]) == 1
    row = result["questions"][0]
    artifact = result["artifacts"][0]
    assert row["id"] == entry["candidate_id"]
    assert row["parent_question_id"] == entry["parent_question_id"]
    assert row["industry"] == entry["variant"]["surface"]["industry"]
    assert row["source_artifact_path"] == artifact["path"] == str(path)
    assert row["source_artifact_sha256"] == artifact["sha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
    assert artifact["accepted_variant_ids"] == [row["id"]]
    judgment = artifact["judgments"][0]
    assert judgment["accepted"] is True
    assert judgment["verdict_sha256"] == hashlib.sha256((verdicts / (row["id"] + ".json")).read_bytes()).hexdigest()
    assert "historical v5.1 allowance waiver" in artifact["note"]
    assert validate_prior_variants(json.loads(json.dumps(result))) == result


@pytest.mark.parametrize("gate", ["style", "evidence", "blind_solver", "argon"])
def test_accepted_flags_and_forged_report_cannot_override_failed_gate(prior, gate):
    path, payload, entry, verdicts = prior
    entry["accepted"] = True
    _write(path, payload)
    path.with_suffix(".report.json").write_text(json.dumps({"accepted_variant_ids": [entry["candidate_id"]]}))
    verdict = verdicts / (entry["candidate_id"] + ".json")
    raw = json.loads(verdict.read_text())
    if gate == "argon":
        raw[gate]["review"]["verdict"] = "REVISE"
        raw[gate]["review"]["issues"] = ["Needs repair"]
    else:
        raw[gate]["verdict"] = "FAIL"
    _write(verdict, raw)
    result = load_prior_variants([path])
    assert result["questions"] == []
    assert result["artifacts"][0]["accepted_variant_ids"] == []


def test_missing_saved_verdict_blocks_history_instead_of_silently_losing_rows(prior):
    path, _, entry, verdicts = prior
    (verdicts / (entry["candidate_id"] + ".json")).unlink()
    with pytest.raises(ValueError, match="regular, non-symlink"):
        load_prior_variants([path])


@pytest.mark.parametrize("defect", ["request_hash", "question", "parent_context", "docs", "schema", "argon_hash"])
def test_hash_bound_requests_and_actual_inputs_are_rechecked(prior, defect):
    path, payload, entry, verdicts = prior
    request_path = path.parent / entry["external_judge_request"]["path"]
    request = json.loads(request_path.read_text())
    if defect == "request_hash":
        request["candidate_id"] = "changed"
    elif defect == "question":
        request["gates"]["blind_solver"]["judge_prompt"] = request["gates"]["blind_solver"]["judge_prompt"].replace(entry["stem"], "A different question")
    elif defect == "parent_context":
        request["gates"]["evidence"]["judge_prompt"] = request["gates"]["evidence"]["judge_prompt"].replace("Frozen parent:", "Changed parent:")
    elif defect == "docs":
        request["gates"]["evidence"]["judge_prompt"] = request["gates"]["evidence"]["judge_prompt"].replace("[[ ## documentation_context ## ]]\n", "[[ ## documentation_context ## ]]\nChanged docs. ")
        request["argon"]["calls"]["review"]["judge_prompt"] = request["argon"]["calls"]["review"]["judge_prompt"].replace("[[ ## documentation_context ## ]]\n", "[[ ## documentation_context ## ]]\nChanged docs. ")
    elif defect == "schema":
        request["gates"]["style"]["verdict_schema"] = {}
    else:
        raw_path = verdicts / (entry["candidate_id"] + ".json")
        raw = json.loads(raw_path.read_text())
        raw["argon"]["request_sha256"] = "0" * 64
        _write(raw_path, raw)
    _write(request_path, request)
    if defect != "request_hash":
        entry["external_judge_request"]["sha256"] = hashlib.sha256(request_path.read_bytes()).hexdigest()
        _write(path, payload)
    with pytest.raises(ValueError):
        load_prior_variants([path])


@pytest.mark.parametrize("defect", ["parent_hash", "decision", "receipts", "industry", "origin"])
def test_parent_decision_receipts_and_surface_are_rechecked(prior, defect):
    path, payload, entry, _ = prior
    if defect == "parent_hash":
        entry["variant"]["parent_snapshot_sha256"] = "0" * 64
    elif defect == "decision":
        entry["decision_plan"]["best_action"] += " changed"
    elif defect == "receipts":
        entry["evidence"][0]["quote"] = "Not in source"
    elif defect == "industry":
        entry["variant"]["surface"]["industry"] = "different industry"
    else:
        entry["variant"]["ordinal"] += 1
    _write(path, payload)
    with pytest.raises(ValueError):
        load_prior_variants([path])


def test_mechanical_generation_flags_cannot_override_actual_bank_duplicate(prior):
    from shared.near_duplicates import comparison_row
    path, payload, entry, _ = prior
    payload["existing_questions"]["questions"].append({**comparison_row(entry), "id": "new-bank-copy"})
    entry["near_duplicate_check"] = {"passed": True}
    _write(path, payload)
    assert load_prior_variants([path])["questions"] == []


def test_historical_sibling_cohort_includes_rejected_written_siblings(prior):
    path, payload, entry, _ = prior
    sibling = deepcopy(entry)
    sibling["candidate_id"] = "written-rejected-sibling"
    sibling["index"] = 2
    sibling["schema_check"] = {"passed": False}
    sibling["accepted"] = False
    sibling.pop("external_judge_request")
    payload["plan"].append(deepcopy(payload["plan"][0]))
    payload["candidates"].append(sibling)
    _write(path, payload)
    assert load_prior_variants([path])["questions"] == []


def test_historical_option_rules_are_not_reapplied(prior, monkeypatch):
    path, _, _, _ = prior
    # New validation is intentionally NOT the old policy's source of truth.
    monkeypatch.setattr("shared.variants.option_rewrite_check", lambda *args: {"passed": False})
    monkeypatch.setattr("shared.variants.frozen_industry", lambda *args: (_ for _ in ()).throw(AssertionError("No new allocator")))
    assert len(load_prior_variants([path])["questions"]) == 1


def test_frozen_validation_never_rereads_source_paths(prior, monkeypatch):
    path, _, _, _ = prior
    result = load_prior_variants([path])
    monkeypatch.setattr(Path, "read_bytes", lambda *args: (_ for _ in ()).throw(AssertionError("No disk reads")))
    monkeypatch.setattr(Path, "read_text", lambda *args: (_ for _ in ()).throw(AssertionError("No disk reads")))
    assert validate_prior_variants(result) == result


@pytest.mark.parametrize("defect", ["stem", "industry", "source_hash", "accepted_ids", "judgment_hash", "missing_row"])
def test_accidental_frozen_history_edits_are_detected(prior, defect):
    path, _, _, _ = prior
    result = load_prior_variants([path])
    if defect in ("stem", "industry"):
        result["questions"][0][defect] += " changed"
    elif defect == "source_hash":
        result["artifacts"][0]["sha256"] = "0" * 64
    elif defect == "accepted_ids":
        result["artifacts"][0]["accepted_variant_ids"] = []
    elif defect == "judgment_hash":
        result["artifacts"][0]["judgments"][0]["verdict_sha256"] = "0" * 64
    else:
        result["questions"] = []
    with pytest.raises(ValueError, match="hash mismatch"):
        validate_prior_variants(result)


@pytest.mark.parametrize("defect", ["missing_industry", "missing_row", "foreign_row", "accepted_ids", "relative_source", "bad_judgment_hash", "duplicate_artifact", "duplicate_row"])
def test_resigned_but_inconsistent_frozen_history_is_rejected(prior, defect):
    path, _, _, _ = prior
    result = load_prior_variants([path])
    if defect == "missing_industry":
        del result["questions"][0]["industry"]
    elif defect == "missing_row":
        result["questions"] = []
    elif defect == "foreign_row":
        result["questions"][0]["id"] = "foreign"
    elif defect == "accepted_ids":
        result["artifacts"][0]["accepted_variant_ids"] = []
    elif defect == "relative_source":
        result["artifacts"][0]["path"] = "relative.json"
    elif defect == "bad_judgment_hash":
        result["artifacts"][0]["judgments"][0]["request_sha256"] = "not-a-digest"
    elif defect == "duplicate_artifact":
        result["artifacts"].append(deepcopy(result["artifacts"][0]))
    else:
        result["questions"].append(deepcopy(result["questions"][0]))
    _resign(result)
    with pytest.raises(ValueError):
        validate_prior_variants(result)


def test_repeated_paths_relative_paths_and_single_string_are_rejected(prior):
    path, _, _, _ = prior
    for paths in ([path, path], [Path("relative.json")], str(path)):
        with pytest.raises(ValueError):
            load_prior_variants(paths)


def test_duplicate_json_keys_are_rejected(prior):
    path, _, _, _ = prior
    path.write_text('{"variant_mode":1,"variant_mode":1}')
    with pytest.raises(ValueError, match="Duplicate history JSON key"):
        load_prior_variants([path])


def test_historical_style_waiver_keeps_then_accepted_scenarios(request, tmp_path, monkeypatch):
    import test_variants
    original_plan = test_variants.plan_questions
    monkeypatch.setattr(test_variants, "plan_questions", lambda cert, n, **kwargs: original_plan(
        cert, n, objective_ids=["machine-learning-engineer:standard:5.1:1"]))
    parent_fixture = request.getfixturevalue("parents")
    from shared import variants
    original_scope = variants.variant_scope
    monkeypatch.setattr(variants, "variant_scope", lambda scope, parent, ordinal, **kwargs:
                        original_scope(scope, parent, ordinal, policy_version=3))
    payload = generate(parent_fixture, tmp_path, enable_variants=True, predictor=variant_for)
    entry = payload["candidates"][0]
    assert entry["style_policy"]["allowance"] == "general_ml_mlops"
    verdicts = verdict_for(entry, tmp_path)
    raw_path = verdicts / (entry["candidate_id"] + ".json")
    raw = json.loads(raw_path.read_text())
    raw["style"].update(verdict="FAIL", score=.55, product_knowledge_hinge=False,
                        cloud_specific_alternative=False, generic_validation_key=True)
    _write(raw_path, raw)
    result = load_prior_variants([tmp_path / "variants.json"])
    assert result["artifacts"][0]["accepted_variant_ids"] == [entry["candidate_id"]]
    assert "not publication approval" in HISTORY_NOTE


def test_valid_historical_short_circuit_cannot_be_accepted(prior):
    path, _, entry, verdicts = prior
    raw_path = verdicts / (entry["candidate_id"] + ".json")
    raw = json.loads(raw_path.read_text())
    raw["style"]["verdict"] = "FAIL"
    raw["evidence"] = raw["blind_solver"] = {
        "status": "skipped", "reason": "prior_gate_failed", "gate": "style"}
    raw["argon"] = {"status": "skipped", "reason": "prior_gate_failed"}
    _write(raw_path, raw)
    assert load_prior_variants([path])["questions"] == []


def test_argon_skip_after_three_passing_gates_is_rejected(prior):
    path, _, entry, verdicts = prior
    raw_path = verdicts / (entry["candidate_id"] + ".json")
    raw = json.loads(raw_path.read_text())
    raw["argon"] = {"status": "skipped", "reason": "prior_gate_failed"}
    _write(raw_path, raw)
    with pytest.raises(ValueError, match="skip cannot approve"):
        load_prior_variants([path])


def test_identical_accepted_ids_keep_each_artifacts_provenance(prior, tmp_path):
    import shutil
    path, _, entry, verdicts = prior
    other = tmp_path / "other"
    other.mkdir()
    shutil.copytree(path.parent / entry["external_judge_request"]["path"].split("/")[0],
                    other / entry["external_judge_request"]["path"].split("/")[0])
    shutil.copytree(verdicts, other / verdicts.name)
    shutil.copyfile(path, other / path.name)
    result = load_prior_variants([path, other / path.name])
    assert len(result["artifacts"]) == len(result["questions"]) == 2
    assert {row["id"] for row in result["questions"]} == {entry["candidate_id"]}
    assert len({row["source_artifact_path"] for row in result["questions"]}) == 2
    validate_prior_variants(result)
    result["questions"][1]["stem"] += " Changed content."
    _resign(result)
    with pytest.raises(ValueError, match="Conflicting"):
        validate_prior_variants(result)


def test_unsafe_artifact_and_request_symlinks_are_rejected(prior, tmp_path):
    path, _, entry, _ = prior
    alias = tmp_path / "alias.json"
    alias.symlink_to(path)
    with pytest.raises(ValueError, match="non-symlink"):
        load_prior_variants([alias])
    request_path = tmp_path / entry["external_judge_request"]["path"]
    actual = request_path.with_suffix(".saved")
    request_path.rename(actual)
    request_path.symlink_to(actual)
    with pytest.raises(ValueError, match="Unsafe historical request path"):
        load_prior_variants([path])


def test_round4_style_waiver_failure_is_not_a_historical_acceptance(request, tmp_path, monkeypatch):
    import test_variants
    original_plan = test_variants.plan_questions
    monkeypatch.setattr(test_variants, "plan_questions", lambda cert, n, **kwargs: original_plan(
        cert, n, objective_ids=["machine-learning-engineer:standard:5.1:1"]))
    parent_fixture = request.getfixturevalue("parents")
    payload = generate(parent_fixture, tmp_path, enable_variants=True, predictor=variant_for)
    entry = payload["candidates"][0]
    assert payload["plan"][0]["variant_policy_version"] == 4
    verdicts = verdict_for(entry, tmp_path)
    raw_path = verdicts / (entry["candidate_id"] + ".json")
    raw = json.loads(raw_path.read_text())
    raw["style"].update(verdict="FAIL", score=.55, product_knowledge_hinge=False,
                        cloud_specific_alternative=False, generic_validation_key=True)
    _write(raw_path, raw)
    result = load_prior_variants([tmp_path / "variants.json"])
    assert result["questions"] == []
    assert result["artifacts"][0]["accepted_variant_ids"] == []
    assert result["artifacts"][0]["policy"] == "frozen_v5_round4_history_v1"


def test_round4_current_replay_works_with_lazy_report_import(parents, tmp_path):
    payload = generate(parents, tmp_path, enable_variants=True, predictor=variant_for)
    entry = payload["candidates"][0]
    verdict_for(entry, tmp_path)
    result = load_prior_variants([tmp_path / "variants.json"])
    assert result["artifacts"][0]["accepted_variant_ids"] == [entry["candidate_id"]]
    assert result["artifacts"][0]["policy"] == "frozen_v5_round4_history_v1"


def test_mixed_historical_presentation_policies_fail_closed(prior):
    path, payload, _, _ = prior
    extra = deepcopy(payload["plan"][0])
    extra["variant_policy_version"] = 4
    payload["plan"].append(extra)
    _write(path, payload)
    with pytest.raises(ValueError, match="Mixed or unsupported"):
        load_prior_variants([path])
