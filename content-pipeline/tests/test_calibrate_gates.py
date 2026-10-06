"""Isolated calibration replay, leakage boundaries and pre-call budget tests."""
import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from scripts import calibrate_gates as calibration
from shared import gates


def item(round_name="r1", verdict="ok", stem="You need to predict fraud."):
    return {"round": round_name, "founder_verdict": verdict, "founder_note": "SECRET_FOUNDER_NOTE",
            "stem": stem, "objective": "fraud", "options": [
                {"text": text, "correct": i == 0} for i, text in enumerate(["Train classifier", "Cluster", "Summarize", "Translate"])]}


def question():
    return calibration.canonical_question(item(), None)[0]


def valid_raw(name, q):
    if name == "blind_solver":
        choice = next(label for label, original in gates.blind_choice_map(q).items() if original == "A")
        return {"verdict": "PASS", "choice": choice, "confidence": .9, "ambiguous_answers": False, "reason": "Unique decision"}
    checks = gates.STYLE_CHECKS if name == "style" else gates.EVIDENCE_CHECKS
    return {"verdict": "PASS", "score": .9, "reason": "Supported decision", **dict.fromkeys(checks, True)}


def test_holdout_whole_round_and_labels_never_in_examples():
    items = [item("r1"), item("r1", stem="SAME_ROUND"), item("r2", stem="GOOD_OTHER"),
             item("r2", "flag", stem="FLAGGED_OTHER")]
    reference, examples = calibration.heldout_style(items, "r1", "RULES")
    assert len(examples) == 1
    assert "GOOD_OTHER" in reference
    for forbidden in ("SAME_ROUND", "FLAGGED_OTHER", "founder_verdict", "founder_note", "SECRET_FOUNDER_NOTE", '"correct"'):
        assert forbidden not in reference
    assert set(examples[0]) == {"stem", "options"}


def test_projection_and_evidence_skip_no_fabrication():
    source = item()
    learner = calibration.learner_item(source)
    assert set(learner) == {"stem", "options"}
    sources, evidence, skip = calibration.frozen_evidence(None, list(range(4)))
    assert sources == evidence == []
    assert "No exact" in skip


def test_exact_match_requires_all_ordered_options():
    reviewed = item()
    entry = {"stem": reviewed["stem"], "options": [{"text": o["text"]} for o in reviewed["options"]], "index": 1}
    art = [("frozen.json", {"candidates": [entry], "plan": [{}]})]
    assert calibration.matching_entry(reviewed, art)
    entry["options"][1]["text"] = "Almost the same"
    assert calibration.matching_entry(reviewed, art) is None


def test_source_hash_mismatch_skips_evidence():
    match = ("frozen", {"sources": [{"text": "real passage", "text_sha256": "bad"}], "evidence": []}, {})
    assert "hash mismatch" in calibration.frozen_evidence(match, list(range(4)))[2]


def test_parallel_budget_never_overbooks_and_resumes(tmp_path):
    budget = calibration.CallBudget(tmp_path, 3)
    def reserve(i):
        try:
            return budget.reserve("baseline", i, "style", "a" * 64)
        except calibration.BudgetExhausted:
            return None
    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(reserve, range(12)))
    assert sorted(r for r in results if r is not None) == [1, 2, 3]
    assert budget.counts()["remaining"] == 0
    assert calibration.CallBudget(tmp_path, 3).counts()["reserved"] == 3
    with pytest.raises(ValueError):
        calibration.CallBudget(tmp_path, 4)


def prepared_item():
    return {"item_id": 1, "round": "r1", "founder": "ok", "question": question(),
            "requests": {g: {"prompt": g, "schema": {}, "input_sha256": g} for g in calibration.GATES},
            "evidence_skip": None, "capture": "frozen.json", "exemplar_count": 1,
            "exemplar_sha256": "a" * 64, "source_sha256": ["b" * 64]}


def test_reservation_on_disk_before_backend_and_sanitized_report(tmp_path):
    prepared = prepared_item()
    budget = calibration.CallBudget(tmp_path / "budget", 3)
    seen = []
    def backend(model, prompt, schema):
        assert any(r["event"] == "reserved" and r["gate"] == prompt for r in budget.records())
        seen.append(prompt)
        return valid_raw(prompt, prepared["question"])
    report = calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=backend)
    assert set(seen) == set(calibration.GATES)
    assert report["all_gates_totals"]["retained_ok"] == 1
    assert report["call_budget"]["reserved"] == report["call_budget"]["completed"] == 3
    assert "SECRET_FOUNDER_NOTE" not in json.dumps(report)
    assert prepared["question"]["stem"] not in json.dumps(report)
    # Resume never makes a fourth call and never accepts mutated prompt bindings.
    calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=lambda *args: pytest.fail("resume call"))
    prepared["requests"]["style"]["input_sha256"] = "changed"
    with pytest.raises(ValueError, match="changed"):
        calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=backend)


def test_usage_limit_stops_new_admission_and_counts_attempt(tmp_path):
    from shared.cli_models import CLIUsageLimitError
    budget = calibration.CallBudget(tmp_path / "budget", 6)
    def fail(*args):
        raise CLIUsageLimitError("unsafe logs must not appear")
    report = calibration.run([prepared_item()], tmp_path / "baseline", budget, "baseline", live=True, parallel=1, backend=fail)
    assert budget.counts()["reserved"] == budget.counts()["failed"] == 1
    assert report["items"][0]["gates"]["style"]["status"] == "SKIP"
    assert "unsafe logs" not in json.dumps(report)


def test_no_live_means_no_calls_and_skips_not_rejections(tmp_path):
    budget = calibration.CallBudget(tmp_path / "budget", 3)
    report = calibration.run([prepared_item()], tmp_path / "baseline", budget, "baseline", backend=lambda *a: pytest.fail("offline call"))
    assert budget.counts()["reserved"] == 0
    assert report["items"][0]["all_gates"] == "SKIP"
    assert report["all_gates_totals"]["rejected_flagged"] == 0


def test_prepare_does_not_leak_notes_keys_or_same_round(monkeypatch):
    from shared import question_style
    monkeypatch.setattr(question_style, "STYLE_RULES", "ONLY_RULES")
    reviewed = [item("r1", stem="You need to predict fraud."),
                item("r1", stem="SAME_ROUND_SENTINEL"), item("r2", stem="OTHER_OK_SENTINEL"),
                item("r2", "flag", stem="OTHER_FLAG_SENTINEL")]
    prepared = calibration.prepare(reviewed, [])
    blind = prepared[0]["requests"]["blind_solver"]["prompt"]
    style = prepared[0]["requests"]["style"]["prompt"]
    for forbidden in ("SECRET_FOUNDER_NOTE", "founder_verdict", "founder_note", '"correct":', "SAME_ROUND_SENTINEL", "OTHER_FLAG_SENTINEL"):
        assert forbidden not in blind
        assert forbidden not in style
    assert "OTHER_OK_SENTINEL" in style
    assert "OTHER_OK_SENTINEL" not in blind
    assert prepared[0]["evidence_skip"] is not None
    assert "evidence" not in prepared[0]["requests"]


def test_unknown_interrupted_reservation_is_never_refunded(tmp_path):
    budget = calibration.CallBudget(tmp_path, 1)
    budget.reserve("baseline", 1, "blind_solver", "x")
    restored = calibration.CallBudget(tmp_path, 1)
    assert restored.counts() == {"maximum": 1, "reserved": 1, "completed": 0, "failed": 0, "unresolved": 1, "remaining": 0}
    with pytest.raises(calibration.BudgetExhausted):
        restored.reserve("iteration2", 1, "blind_solver", "y")


def test_local_validation_error_preserves_invalid_raw_not_verdict(tmp_path):
    budget = calibration.CallBudget(tmp_path / "budget", 3)
    prepared = prepared_item()
    def backend(model, prompt, schema):
        raw = valid_raw(prompt, prepared["question"])
        raw["reason"] = "x" * 301
        return raw
    report = calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=backend)
    saved = json.loads((tmp_path / "baseline" / "01-style.json").read_text())
    assert saved["stage"] == "local_validation"
    assert saved["reason_length"] == 301
    assert "invalid_raw" in saved and "raw" not in saved
    assert report["items"][0]["gates"]["style"]["status"] == "ERROR"
    assert report["all_gates_totals"]["rejected_flagged"] == 0


def test_manual_retry_archives_errors_and_never_retries_valid_fail(tmp_path):
    from shared.cli_models import CLISchemaError
    budget = calibration.CallBudget(tmp_path / "budget", 6)
    prepared = prepared_item()
    def first(model, prompt, schema):
        if prompt == "blind_solver":
            raise CLISchemaError("No structured output")
        raw = valid_raw(prompt, prepared["question"])
        if prompt == "style":
            raw["verdict"] = "FAIL"
            raw["decision_level"] = False
        return raw
    calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=first)
    called = []
    def retry(model, prompt, schema):
        called.append(prompt)
        return valid_raw(prompt, prepared["question"])
    report = calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True,
                             backend=retry, retry_failed=True)
    assert called == ["blind_solver"]
    assert len(list((tmp_path / "baseline" / "prior-attempts").glob("*.json"))) == 1
    assert budget.counts()["reserved"] == 4
    assert report["items"][0]["gates"]["style"]["status"] == "FAIL"


def test_manual_retry_partial_iteration_never_admits_missing_results(tmp_path):
    prepared = prepared_item()
    output = tmp_path / "partial"
    output.mkdir()
    budget = calibration.CallBudget(tmp_path / "budget", 3)
    error_record = {"input_sha256": "blind_solver", "error_class": "CLISchemaError", "passed": False, "attempt": 1}
    calibration.write_json(output / "01-blind_solver.json", error_record)
    calibration.write_json(output / "01-blind_solver.request.json", prepared["requests"]["blind_solver"])
    called = []
    def retry(model, prompt, schema):
        called.append(prompt)
        return valid_raw(prompt, prepared["question"])
    report = calibration.run([prepared], output, budget, "partial", live=True, backend=retry, retry_failed=True)
    assert called == ["blind_solver"]
    assert budget.counts()["reserved"] == 1
    assert report["items"][0]["gates"]["style"]["status"] == "SKIP"
    assert report["items"][0]["gates"]["evidence"]["status"] == "SKIP"


def test_existing_iteration_gate_filter_keeps_all_reporting_metadata(tmp_path):
    prepared = prepared_item()
    budget = calibration.CallBudget(tmp_path / "budget", 3)
    def backend(model, prompt, schema):
        return valid_raw(prompt, prepared["question"])
    calibration.run([prepared], tmp_path / "baseline", budget, "baseline", live=True, backend=backend)
    # Same path as CLI --gate evidence: filter jobs, not requests needed by the report.
    report = calibration.run([prepared], tmp_path / "baseline", budget, "baseline",
                             selected_gates=["evidence"], backend=lambda *a: pytest.fail("offline call"))
    assert set(prepared["requests"]) == set(calibration.GATES)
    assert set(report["items"][0]["gates"]) == set(calibration.GATES)
    assert report["all_gates_totals"]["retained_ok"] == 1


def test_cli_gate_filter_existing_iteration_report(monkeypatch, tmp_path):
    import sys
    prepared = prepared_item()
    budget = calibration.CallBudget(tmp_path / "runs", 3)
    calibration.run([prepared], tmp_path / "runs" / "baseline", budget, "baseline", live=True,
                    backend=lambda model, prompt, schema: valid_raw(prompt, prepared["question"]))
    monkeypatch.setattr(calibration, "load_items", lambda pack: [item()])
    monkeypatch.setattr(calibration, "prepare", lambda items, artifacts: [prepared])
    monkeypatch.setattr(sys, "argv", ["calibrate_gates", "--pack", str(tmp_path), "--artifact-dir", str(tmp_path),
        "--output-dir", str(tmp_path / "runs"), "--iteration", "baseline", "--max-calls", "3",
        "--report", str(tmp_path / "report.json"), "--gate", "evidence"])
    assert calibration.main() == 1  # One retained item cannot meet six-item calibration target.
    report = json.loads((tmp_path / "report.json").read_text())
    assert report["items"][0]["all_gates"] == "PASS"
    assert budget.counts()["reserved"] == 3


def test_corrected_schema_guard_rejects_description_only_bound():
    prepared = prepared_item()
    with pytest.raises(ValueError, match="export reason"):
        calibration.verify_corrected_reason_schemas([prepared])
    from shared.cli_models import output_model
    for gate, request in prepared["requests"].items():
        request["schema"] = output_model(gates.GATE_SIGNATURES[gate]).model_json_schema()
    calibration.verify_corrected_reason_schemas([prepared])


def test_mixed_blind_reuse_preserves_old_hash_and_revalidates(tmp_path):
    from shared.cli_models import output_model
    prepared = prepared_item()
    for gate, request in prepared["requests"].items():
        request["schema"] = output_model(gates.GATE_SIGNATURES[gate]).model_json_schema()
        request["input_sha256"] = calibration.digest({"prompt": request["prompt"], "schema": request["schema"]})
    fresh_hash = prepared["requests"]["blind_solver"]["input_sha256"]
    original = json.loads(json.dumps(prepared["requests"]["blind_solver"]))
    original["schema"]["properties"]["reason"].pop("maxLength")
    original["schema"]["properties"]["reason"].pop("minLength")
    original["input_sha256"] = calibration.digest({"prompt": original["prompt"], "schema": original["schema"]})
    source, destination = tmp_path / "earlier", tmp_path / "mixed"
    source.mkdir()
    calibration.write_json(source / "01-blind_solver.request.json", original)
    calibration.write_json(source / "01-blind_solver.json", {"input_sha256": original["input_sha256"],
        "raw": valid_raw("blind_solver", prepared["question"]), "passed": True, "attempt": 1})
    calibration.verify_corrected_reason_schemas([prepared])
    calibration.reuse_blind([prepared], source, destination)
    saved = json.loads((destination / "01-blind_solver.json").read_text())
    assert saved["input_sha256"] == original["input_sha256"] != fresh_hash
    assert saved["source_iteration"] == "earlier"
    assert saved["reused"] is True
    assert saved["revalidated_schema_sha256"] != saved["source_schema_sha256"]
    assert prepared["requests"]["blind_solver"] == original
    prepared["requests"]["blind_solver"]["prompt"] += "changed"
    with pytest.raises(ValueError, match="identical learner prompt"):
        calibration.reuse_blind([prepared], source, tmp_path / "bad")
