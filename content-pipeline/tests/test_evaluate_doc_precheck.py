"""Missing historical metadata never becomes claimed predictive accuracy."""
import json
from scripts.evaluate_doc_precheck import evaluate


def test_historical_attempts_are_unmeasured(tmp_path):
    path = tmp_path / "history.json"
    path.write_text(json.dumps({"candidates": [{"accepted": True, "decision_attempts": [
        {"proof": {"passed": False}}, {"proof": {"passed": True}}]}]}))
    report = evaluate(path)
    assert report["unmeasured_attempts"] == 2
    assert report["veto_catch"] is None and report["targets_observed"] is None
    assert report["rollout_authorized"] is False


def test_shadow_counts_only_surviving_plan_for_eventual_pass(tmp_path):
    path = tmp_path / "shadow.json"
    path.write_text(json.dumps({"candidates": [{"accepted": True, "awaiting_external_judge": False, "external_judge_provenance": "independent", "external_verdict": {"recorded": True}, "judge_verdict": {"passed": True}, "decision_attempts": [
        {"doc_precheck": {"shadow": True, "passed": False}, "proof": {"passed": False}},
        {"doc_precheck": {"shadow": True, "passed": True}, "proof": {"passed": True}}]}]}))
    report = evaluate(path)
    assert report["veto_catch"] == 1
    assert report["false_block_eventual_accepted"] == 0
    assert report["eventual_accepted_plans"] == report["judge_passed_plans"] == 1
    assert report["targets_observed"] is True
    assert report["rollout_authorized"] is False


def test_partial_shadow_coverage_never_meets_targets(tmp_path):
    path = tmp_path / "partial.json"
    path.write_text(json.dumps({"candidates": [{"accepted": True, "decision_attempts": [
        {"doc_precheck": {"shadow": True, "passed": False}, "proof": {"passed": False}},
        {"doc_precheck": {"shadow": True, "passed": True}, "proof": {"passed": True}}, {}]}]}))
    assert evaluate(path)["targets_observed"] is None


def test_accepted_without_independent_pass_does_not_meet_target(tmp_path):
    path = tmp_path / "unjudged.json"
    path.write_text(json.dumps({"candidates": [{"accepted": True, "decision_attempts": [
        {"doc_precheck": {"shadow": True, "passed": False}, "proof": {"passed": False}},
        {"doc_precheck": {"shadow": True, "passed": True}, "proof": {"passed": True}}]}]}))
    assert evaluate(path)["targets_observed"] is None


def test_placeholder_judges_are_not_complete_coverage(tmp_path):
    path = tmp_path / "pending.json"
    def attempt(passed, would_pass):
        return {"doc_precheck": {"shadow": True, "passed": would_pass}, "proof": {"passed": passed}}
    path.write_text(json.dumps({"candidates": [
        {"awaiting_external_judge": False, "external_judge_provenance": "independent", "external_verdict": {"receipt": True},
         "judge_verdict": {"passed": True}, "decision_attempts": [attempt(False, False), attempt(True, True)]},
        {"awaiting_external_judge": True, "judge_verdict": {"passed": False, "reason": "Awaiting external judge"},
         "decision_attempts": [attempt(True, False)]}]}))
    report = evaluate(path)
    assert report["complete_independent_judge_coverage"] is False
    assert report["targets_observed"] is None
