"""Deterministic audit and grounded CLI orchestration stay read-only/offline."""
from copy import deepcopy
import hashlib
import importlib
import json
from pathlib import Path
import sys
from unittest.mock import Mock

import pytest
from scripts import audit_bank as audit
from shared.cert_context import load_cert_context

CONTEXT = load_cert_context()
FIRST_DOMAIN = next(iter(CONTEXT["domains"]))


def question(text, *, ident="question-1", status="ACTIVE", domain=FIRST_DOMAIN, answer=None):
    return {"id": ident, "status": status, "domain_code": domain, "stem": text,
            "answers": [{"choice_label": label, "choice_text": answer or text if label == "C" else "Other choice " + label,
                         "is_correct": label == "C", "explanation_text": "An existing explanation explaining this choice without changes."}
                        for label in "ABCD"], "explanation": None}


def objective_question(suffix, **kwargs):
    ident = f"machine-learning-engineer:standard:{suffix}"
    return question(audit.objective_scopes(CONTEXT)[ident]["objective_text"] + "?", **kwargs)


def test_exact_objective_match_deterministic_read_only_and_retired_excluded():
    export = {"questions": [objective_question("3.2:5"), objective_question("6.1:1", ident="retired", status="RETIRED")]}
    original = deepcopy(export)
    first = audit.audit_bank(export, CONTEXT)
    assert first == audit.audit_bank(export, CONTEXT)
    assert export == original and len(first["questions"]) == 1
    row = first["questions"][0]
    assert row["flag"] == "ok"
    assert row["best_current_objective_ids"] == ["machine-learning-engineer:standard:3.2:5"]
    assert row["current_matches"][0]["matched_terms"] == ["hyperparameter", "tune"]
    assert len(first["coverage"]) == 52
    assert sum(c["active_questions"] for c in first["coverage"]) == 1
    assert len(first["zero_coverage_objectives"]) == 51


def test_name_map_longest_match_citations_and_no_technical_url_rewrite():
    names = audit.stale_names("Vertex AI Pipelines and Vertex AI. VERTEX AI FEATURE STORE.")
    assert [m["old"] for m in names] == ["Vertex AI Feature Store", "Vertex AI Pipelines", "Vertex AI"]
    assert all(m["source_url"] == audit.GUIDE_URL and m["locator"] for m in names)
    assert all(m["transition_source_url"] == audit.CERT_URL for m in names)
    assert not audit.stale_names("Gemini Enterprise Agent Platform https://docs.cloud.google.com/vertex-ai/docs")
    # Aliases change lexical matching only, not the exported question.
    assert audit.tokens("Vertex AI Feature Store") == audit.tokens("Agent Platform Feature Store")


def test_distractors_and_explanations_scan_names_without_creating_coverage():
    q = objective_question("3.2:5")
    q["answers"][0]["choice_text"] = "Vertex AI Workbench and Model Armor"
    q["answers"][1]["explanation_text"] = "Use Agent Platform Feature Store for serving features."
    row = audit.audit_bank({"questions": [q]}, CONTEXT)["questions"][0]
    assert row["flag"] == "rename_only"
    assert row["best_current_objective_ids"] == ["machine-learning-engineer:standard:3.2:5"]
    assert row["stale_product_names"][0]["old"] == "Vertex AI Workbench"


def test_removed_residual_scope_and_moved_metadata_not_blind_old_domain_alias():
    removed = question(audit.REMOVED_SUBSECTIONS["1.3"][0] + "?")
    moved = objective_question("2.3:3", ident="moved", domain="AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES")
    report = audit.audit_bank({"questions": [removed, moved]}, CONTEXT)
    rows = {r["question_id"]: r for r in report["questions"]}
    assert rows["question-1"]["flag"] == "removed_topic"
    assert rows["question-1"]["historical_match"]["subsection"] == "1.3"
    assert rows["moved"]["best_current_objective_ids"] == ["machine-learning-engineer:standard:2.3:3"]
    assert rows["moved"]["flag"] == "ok"
    coverage = {c["objective_id"]: c["active_questions"] for c in report["coverage"]}
    assert coverage["machine-learning-engineer:standard:2.3:3"] == 1


def test_generic_or_unrelated_text_is_unmapped():
    for text in ("Choose the appropriate model using data?", "Basketball tickets stadium popcorn?", "Your team should decide when to proceed?"):
        row = audit.audit_bank({"questions": [question(text)]}, CONTEXT)["questions"][0]
        assert row["flag"] == "unmapped" and not row["best_current_objective_ids"]


def test_only_active_current_matches_count_coverage():
    report = audit.audit_bank({"questions": [objective_question("3.2:5", status="DRAFT")]}, CONTEXT)
    assert report["questions"][0]["flag"] == "ok"
    assert all(c["active_questions"] == 0 for c in report["coverage"])


def test_all_best_score_ties_are_reported_and_counted():
    context = deepcopy(CONTEXT)
    domain = context["domains"][FIRST_DOMAIN]
    a, b = domain["objectives"][:2]
    a["objective_text"] = b["objective_text"] = "Zebra apparatus laser calibration"
    report = audit.audit_bank({"questions": [question("Zebra apparatus laser calibration?")]}, context)
    assert set(report["questions"][0]["best_current_objective_ids"]) == {a["objective_id"], b["objective_id"]}
    assert sum(c["active_questions"] for c in report["coverage"]) == 2


def test_exact_original_text_and_correct_label_projection():
    q = objective_question("3.2:5")
    q["answers"][2]["choice_text"] = "  **Existing marked answer.**  "
    before = deepcopy(q)
    native, labels = audit.bank_question_data(q)
    assert native["stem"] == q["stem"]
    assert native["correct_answer"] == "  **Existing marked answer.**  "
    assert labels == {"A": "C", "B": "A", "C": "B", "D": "D"}
    assert native["distractor_1"] == q["answers"][0]["choice_text"]
    assert q == before


@pytest.mark.parametrize("defect", ["missing_option", "multiple_correct", "duplicate_label"])
def test_malformed_bank_options_are_not_silently_projected(defect):
    q = objective_question("3.2:5")
    if defect == "missing_option": q["answers"].pop()
    elif defect == "multiple_correct": q["answers"][0]["is_correct"] = True
    else: q["answers"][0]["choice_label"] = "C"
    with pytest.raises(ValueError): audit.bank_question_data(q)


@pytest.fixture
def export_file(tmp_path, monkeypatch):
    source = tmp_path / "bank.export.json"
    source.write_text(json.dumps({"questions": [objective_question("3.2:5", ident=str(i)) for i in range(12)]}))
    monkeypatch.setattr(audit, "ARTIFACT_ROOT", tmp_path / "artifacts")
    return source


def test_offline_cli_never_imports_live_services_and_preserves_export(export_file, monkeypatch):
    before = export_file.read_bytes()
    # Even importing the live module would break this deterministic invocation.
    monkeypatch.setitem(sys.modules, "shared.bank_grounding", None)
    monkeypatch.setitem(sys.modules, "shared.llm_generator", None)
    monkeypatch.setitem(sys.modules, "shared.supabase_client", None)
    assert audit.main(["--input", str(export_file)]) == 0
    assert export_file.read_bytes() == before
    report = json.loads((audit.ARTIFACT_ROOT / "bank.export-audit.json").read_text())
    assert report["input_sha256"] == hashlib.sha256(before).hexdigest()
    summary = (audit.ARTIFACT_ROOT / "bank.export-audit.md").read_text()
    assert "Total" in summary and "Zero ACTIVE coverage" in summary and "not" in summary


def test_grounded_cli_limit_model_defaults_fail_exit_and_strict_json(export_file, monkeypatch):
    from shared import bank_grounding
    before = export_file.read_bytes()
    recheck = Mock(return_value={"passed": False, "reasons": ["Recorded rejection"],
                               "citation_attempts": [{"evidence": [{"quote": float("inf")}]}]})
    monkeypatch.setattr(bank_grounding, "check_existing_question", recheck)
    assert audit.main(["--input", str(export_file), "--grounded", "--limit", "10"]) == 1
    first = (audit.ARTIFACT_ROOT / "bank.export-grounded.json").read_text()
    report = json.loads(first, parse_constant=lambda value: pytest.fail("Nonfinite JSON"))
    assert len(report["results"]) == recheck.call_count == 10
    assert all(call.kwargs == {"model": audit.DEFAULT_GENERATOR_MODEL, "judge_model": audit.DEFAULT_JUDGE_MODEL}
               for call in recheck.call_args_list)
    assert report["results"][0]["citation_attempts"][0]["evidence"][0]["quote"] == {"__nonfinite_float__": "Infinity"}
    assert audit.main(["--input", str(export_file), "--grounded", "--limit", "10"]) == 1
    assert first == (audit.ARTIFACT_ROOT / "bank.export-grounded.json").read_text()
    assert export_file.read_bytes() == before


def test_grounded_cli_all_pass_exit_and_unmapped_skip(export_file, monkeypatch):
    from shared import bank_grounding
    recheck = Mock(return_value={"passed": True, "reasons": []})
    monkeypatch.setattr(bank_grounding, "check_existing_question", recheck)
    assert audit.main(["--input", str(export_file), "--grounded", "--limit", "2"]) == 0
    assert recheck.call_count == 2
    export_file.write_text(json.dumps({"questions": [question("Bananas basketball tickets stadium?")]}))
    recheck.reset_mock()
    assert audit.main(["--input", str(export_file), "--grounded", "--limit", "1"]) == 1
    recheck.assert_not_called()
    result = json.loads((audit.ARTIFACT_ROOT / "bank.export-grounded.json").read_text())["results"][0]
    assert not result["passed"] and result["reasons"] == ["No mapped current objective"]


@pytest.mark.parametrize("flags", [["--limit", "0"], ["--grounded", "--model", "unknown/custom"],
                                  ["--grounded", "--judge-model", audit.DEFAULT_GENERATOR_MODEL]])
def test_cli_bad_limits_and_models_fail_before_services(export_file, monkeypatch, flags):
    read = Mock(side_effect=AssertionError("Input must not be read"))
    monkeypatch.setattr(Path, "read_text", read)
    with pytest.raises(SystemExit) as exc: audit.main(["--input", str(export_file), *flags])
    assert exc.value.code == 2
    read.assert_not_called()


def test_real_export_reproducibility_when_available():
    path = audit.PIPELINE_ROOT / ".cache/bank/pmle-bank-2026-10-04.json"
    if not path.exists(): pytest.skip("Ignored live export not shipped with tests")
    before = path.read_bytes()
    export = json.loads(before)
    first = audit.audit_bank(export, CONTEXT)
    second = audit.audit_bank(export, CONTEXT)
    assert first == second and path.read_bytes() == before
    assert first["input_status_counts"] == {"ACTIVE": 145, "DRAFT": 140, "RETIRED": 58}
    assert len(first["questions"]) == 285
    assert sum(sum(c.values()) for c in first["counts_by_domain_flag"].values()) == 285
    assert len(first["coverage"]) == 52
    rows = {r["question_id"]: r for r in first["questions"]}
    # Real reviewer-found modal-word and generic single-term false positives.
    assert "machine-learning-engineer:standard:3.2:6" not in rows["f7eb866b-21f3-4820-a223-a63a10a8cdcb"]["best_current_objective_ids"]
    assert "machine-learning-engineer:standard:3.2:6" not in rows["30e49593-05df-4d37-9010-74191fd6d85c"]["best_current_objective_ids"]
    assert "machine-learning-engineer:standard:1.1:4" not in rows["0f701a7e-671a-47d9-b711-7fc230c68cfa"]["best_current_objective_ids"]
    assert rows["2d933c01-2046-46ad-8d77-32b50545e7cf"]["flag"] == "rename_only"
    assert rows["79d1b459-2dff-46c9-a940-c25f3816f48d"]["flag"] == "rename_only"


def test_grounded_empty_sample_writes_current_empty_report(export_file, monkeypatch):
    from shared import bank_grounding
    export_file.write_text(json.dumps({"questions": []}))
    audit.ARTIFACT_ROOT.mkdir()
    output = audit.ARTIFACT_ROOT / "bank.export-grounded.json"
    output.write_text('{"results": [{"passed": true}]}')
    forbidden = Mock(side_effect=AssertionError("No questions"))
    monkeypatch.setattr(bank_grounding, "check_existing_question", forbidden)
    assert audit.main(["--input", str(export_file), "--grounded"]) == 1
    assert json.loads(output.read_text())["results"] == []
    forbidden.assert_not_called()


def test_automl_training_survives_removed_standalone_subsection():
    q = question("Train a tabular classification model using AutoML?")
    row = audit.audit_bank({"questions": [q]}, CONTEXT)["questions"][0]
    assert row["flag"] == "ok"
    assert row["best_current_objective_ids"] == ["machine-learning-engineer:standard:1.1:4"]
    assert not row["historical_match"]
