"""Real DSPy executor regressions: caps must not leave unguarded queued calls."""
import threading

import dspy
from dspy.utils import DummyLM
import pytest

from scripts.optimize.budget import (
    BudgetExceeded, MetricLimitExceeded, MetricLimiter, SpendBudget,
    budgeted_calls, serial_dspy_execution,
)
from scripts.optimize import run_optimizer as optimizer
from test_optimize_runner import MODEL, plan_row


def refuse_pool(*args, **kwargs):
    raise AssertionError("Budgeted optimizer must not create a DSPy worker pool")


@pytest.mark.parametrize("stop", ["metric", "budget"])
def test_real_evaluate_cap_has_no_pending_transport(monkeypatch, tmp_path, stop):
    """Exercise installed Evaluate, not a fake optimizer constructor."""
    from dspy.utils import parallelizer
    monkeypatch.setattr(parallelizer, "ThreadPoolExecutor", refuse_pool)
    threads, transports = [], []

    def fake_forward(self, **kwargs):
        transports.append(kwargs)
        threads.append(threading.get_ident())
        return {"offline": True}

    monkeypatch.setattr(dspy.LM, "forward", fake_forward)
    lm = dspy.LM(MODEL, max_tokens=100)
    budget = SpendBudget("0.009" if stop == "budget" else "1", {
        MODEL: {"input_usd_per_million": "1", "output_usd_per_million": "1"},
    }, tmp_path / "spend.jsonl")
    metric = MetricLimiter(lambda *args: 0.5, 1 if stop == "metric" else 10)

    class Program(dspy.Module):
        def forward(self, index):
            lm.forward(prompt="offline")
            return dspy.Prediction(answer="synthetic")

    original_execute = parallelizer.ParallelExecutor.execute
    expected = MetricLimitExceeded if stop == "metric" else BudgetExceeded
    with pytest.raises(expected), budgeted_calls(budget), serial_dspy_execution():
        dspy.Evaluate(
            devset=[dspy.Example(index=i).with_inputs("index") for i in range(4)],
            metric=metric, num_threads=1, display_progress=False,
        )(Program())
    assert len(transports) == budget.snapshot()["transport_attempts"] == 2
    assert threads == [threading.get_ident()] * 2
    assert parallelizer.ParallelExecutor.execute is original_execute
    assert dspy.LM.forward is fake_forward


def test_real_gepa_compile_cap_uses_inline_execution(monkeypatch):
    """Use the installed GEPA adapter and its initial full validation pass."""
    from dspy.utils import parallelizer
    from shared import llm_generator
    monkeypatch.setattr(parallelizer, "ThreadPoolExecutor", refuse_pool)
    row = plan_row()
    lm = DummyLM([row["outputs"]] * 10)
    monkeypatch.setattr(llm_generator, "_generation_lm", lambda *args, **kwargs: lm)
    metric = MetricLimiter(lambda *args: dspy.Prediction(score=.5, feedback="Synthetic"), 1)
    example = optimizer.to_example(row, optimizer.stage_signature("plan"))
    original_execute = parallelizer.ParallelExecutor.execute
    with pytest.raises(MetricLimitExceeded):
        optimizer.compile_program(
            optimizer.StageProgram("plan", MODEL), method="gepa", trainset=[example],
            devset=[example, example, example], metric=metric,
            reflection_lm=DummyLM([]), max_metric_calls=1,
        )
    assert metric.calls == 1
    assert len(lm.history) == 2
    assert parallelizer.ParallelExecutor.execute is original_execute


def test_serial_executor_keeps_failure_accounting_and_restores(monkeypatch):
    from dspy.utils import parallelizer
    monkeypatch.setattr(parallelizer, "ThreadPoolExecutor", refuse_pool)
    executor = parallelizer.ParallelExecutor(num_threads=1, max_errors=3, disable_progress_bar=True)
    failure = ValueError("synthetic")

    def work(index):
        if index == 1:
            raise failure
        return index

    original = parallelizer.ParallelExecutor.execute
    with serial_dspy_execution():
        assert executor.execute(work, [0, 1, 2]) == [0, None, 2]
    assert executor.error_count == 1
    assert executor.failed_indices == [1]
    assert executor.exceptions_map == {1: failure}
    assert parallelizer.ParallelExecutor.execute is original


def test_real_gepa_mutation_completes_with_cached_feedback(monkeypatch):
    """Installed GEPA asks for feedback twice; only unique verdicts spend quota."""
    from dspy.utils import parallelizer
    from shared import llm_generator
    monkeypatch.setattr(parallelizer, "ThreadPoolExecutor", refuse_pool)
    train_row, dev_row = plan_row("1.1:1"), plan_row("2.1:1")
    lm = DummyLM([train_row["outputs"]] * 40)
    reflection = DummyLM([{"answer": "```\nSynthetic revised writer instructions\n```"}] * 10)
    monkeypatch.setattr(llm_generator, "_generation_lm", lambda *args, **kwargs: lm)
    judge_calls = []

    def judge(*args):
        judge_calls.append(args)
        return dspy.Prediction(score=.5, feedback="Synthetic missing support")

    metric = MetricLimiter(judge, 8, cache=True)
    signature = optimizer.stage_signature("plan")
    compiled = optimizer.compile_program(
        optimizer.StageProgram("plan", MODEL), method="gepa",
        trainset=[optimizer.to_example(train_row, signature)],
        devset=[optimizer.to_example(dev_row, signature)], metric=metric,
        reflection_lm=reflection, max_metric_calls=8,
    )
    assert compiled.writer is not None
    assert reflection.history  # At least one actual reflective mutation, not baseline-only.
    assert metric.calls == len(judge_calls) == 2
    assert metric.cache_hits > 0
    assert len(lm.history) > metric.calls
