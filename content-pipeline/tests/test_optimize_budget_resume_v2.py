"""Offline metric headroom, safe resume and predictor feedback routing."""
import json
from types import SimpleNamespace

import dspy
import pytest

from scripts.optimize.budget import MetricLimiter, MetricLimitExceeded
from scripts.optimize import run_optimizer as opt


def test_headroom_covers_full_validation_and_two_minibatches():
    assert opt.optimizer_metric_budget(250, 39, 6) == 199
    for size in (26, 30, 39):
        cap = opt.optimizer_metric_budget(250, size, 6)
        assert cap + size + 12 <= 250
    with pytest.raises(ValueError, match="headroom"):
        opt.optimizer_metric_budget(30, 13, 6)


def test_gepa_overshoot_still_emits_valid_pack(monkeypatch, tmp_path):
    from shared.prompt_pack import create_pack, save_pack, load_pack
    calls = []
    metric = MetricLimiter(lambda *a: dspy.Prediction(score=.4, feedback="docs only"), 40)
    class GEPA:
        def __init__(self, **kwargs):
            self.kwargs = kwargs
        def compile(self, student, *, valset, **kwargs):
            count = self.kwargs["max_metric_calls"] + len(valset) + 2 * self.kwargs["reflection_minibatch_size"]
            for _ in range(count):
                metric(None, None)
                calls.append(1)
            return student
    monkeypatch.setattr(dspy, "GEPA", GEPA)
    student = opt.StageProgram("plan", "openrouter/offline/writer")
    result = opt.compile_program(student, method="gepa", trainset=[1], devset=[1]*4,
                                 metric=metric, reflection_lm=object(), max_metric_calls=40)
    pack = create_pack(stage="plan", signature=opt.stage_signature("plan"),
                       instructions=result.writer.signature.instructions,
                       source_run="offline", policy={}, scores={"calls": metric.calls})
    output = tmp_path / "pack.json"
    save_pack(pack, output)
    assert load_pack(output)["scores"]["calls"] == 40
    assert len(calls) == 40


def test_metric_state_survives_resume_and_routes_cached_feedback(tmp_path):
    state = tmp_path / "metric-state.json"
    calls = []
    def judge(*args):
        calls.append(1)
        return dspy.Prediction(score=.4, feedback="overall", feedback_by_predictor={
            "plan": "improve alternative design", "repair": "fix option C"})
    first = MetricLimiter(judge, 2, cache=True, state_path=state)
    assert first({"id": 1}, {"plan": 1}, pred_name="plan").feedback == "improve alternative design"
    resumed = MetricLimiter(judge, 2, cache=True, state_path=state, resume=True)
    assert resumed({"id": 1}, {"plan": 1}, pred_name="repair").feedback == "fix option C"
    assert resumed.calls == 1 and len(calls) == 1
    resumed({"id": 2}, {"plan": 2})
    with pytest.raises(MetricLimitExceeded):
        resumed({"id": 3}, {"plan": 3})
    assert json.loads(state.read_text())["calls"] == 2
    with pytest.raises(ValueError, match="does not match"):
        MetricLimiter(judge, 3, state_path=state, resume=True)


def test_failed_metric_admission_is_not_erased_by_resume(tmp_path):
    state = tmp_path / "metric-state.json"
    def fail(*args):
        raise RuntimeError("offline")
    metric = MetricLimiter(fail, 1, state_path=state)
    with pytest.raises(RuntimeError):
        metric(None, None)
    resumed = MetricLimiter(fail, 1, state_path=state, resume=True)
    with pytest.raises(MetricLimitExceeded):
        resumed(None, None)


def test_resume_manifest_binds_inputs_and_refuses_foreign_or_completed(tmp_path):
    run = tmp_path / "run"
    assert opt.prepare_run_directory(run, resume=False, binding="one") is None
    (run / "metric-state.json").write_text("{}")
    report = {"status": "stopped", "resume_binding": "one"}
    (run / "run.json").write_text(json.dumps(report))
    assert opt.prepare_run_directory(run, resume=True, binding="one") == report
    with pytest.raises(SystemExit, match="differ"):
        opt.prepare_run_directory(run, resume=True, binding="other")
    report["status"] = "completed"
    (run / "run.json").write_text(json.dumps(report))
    with pytest.raises(SystemExit, match="unfinished"):
        opt.prepare_run_directory(run, resume=True, binding="one")


def test_missing_metric_accounting_cannot_reset_resume(tmp_path):
    (tmp_path / "run.json").write_text(json.dumps({"status": "stopped", "resume_binding": "one"}))
    with pytest.raises(SystemExit, match="accounting"):
        opt.prepare_run_directory(tmp_path, resume=True, binding="one")


def test_codex_student_reuses_shared_serial_cli_path(monkeypatch):
    from shared import cli_models
    from test_optimize_runner import plan_row
    row = plan_row()
    calls = []
    def run(model, signature, inputs, **kwargs):
        calls.append((model, signature, inputs, kwargs))
        return row["outputs"]
    monkeypatch.setattr(cli_models, "run_signature", run)
    program = opt.StageProgram("plan", "codex")
    result = program(**row["inputs"])
    assert result.plan == row["outputs"]["plan"]
    assert calls[0][0] == "codex" and calls[0][3]["reasoning_effort"] == "high"
    assert opt.student_model("codex") == "codex"
    assert opt.student_model("codex/gpt-6.1-sol") == "codex/gpt-6.1-sol"
    with pytest.raises(ValueError):
        opt.openrouter_model("codex")


def test_explicit_subscription_quota_is_separate_durable_and_hard(monkeypatch, tmp_path):
    from scripts.optimize.budget import SpendBudget, SubscriptionQuota, budgeted_calls, BudgetExceeded
    from shared import cli_models
    calls = []
    monkeypatch.setattr(cli_models, "_run_cli_transport", lambda *a, **k: calls.append(1))
    paid = SpendBudget("1", {"openrouter/offline/model": {
        "input_usd_per_million": "1", "output_usd_per_million": "1"}}, tmp_path/"paid.jsonl")
    quota = SubscriptionQuota(1, tmp_path/"quota.jsonl")
    with budgeted_calls(paid, subscription_quota=quota):
        cli_models._run_cli_transport("codex", "offline", {}, object())
        with pytest.raises(BudgetExceeded, match="Subscription"):
            cli_models._run_cli_transport("codex", "offline", {}, object())
    assert len(calls) == 1 and paid.snapshot()["transport_attempts"] == 0
    resumed = SubscriptionQuota(1, tmp_path/"quota.jsonl")
    assert resumed.snapshot()["transport_attempts"] == 1
    with pytest.raises(BudgetExceeded):
        resumed.reserve("codex", 100, 100)


def test_requested_dev_objectives_require_two_to_three_real_inputs_each():
    rows = [{"objective_id": str(i)} for i in range(13) for _ in range(3)]
    opt.validate_development_slice(rows, 13)
    with pytest.raises(SystemExit, match="2-3"):
        opt.validate_development_slice(rows + [{"objective_id": "0"}], 13)
    with pytest.raises(SystemExit, match="2-3"):
        opt.validate_development_slice([{ "objective_id": str(i)} for i in range(13)], 13)
