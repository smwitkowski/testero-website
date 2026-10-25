"""Offline budget admission and optimizer behavior; no model/provider calls."""
import copy
import json
from decimal import Decimal

import dspy
from dspy.utils import DummyLM
import pytest

from scripts.optimize.budget import (BudgetExceeded, MetricLimitExceeded, MetricLimiter,
                                     SpendBudget, budgeted_calls, input_token_bound)
from scripts.optimize import run_optimizer as optimizer

MODEL = "openrouter/offline/writer"
PRICES = {MODEL: {"input_usd_per_million": "1", "output_usd_per_million": "2"},
          "claude": {"input_usd_per_million": "3", "output_usd_per_million": "15"}}


def plan_row(objective="1.1:1", domain="1"):
    plan = {"objective_id": objective, "engineering_decision": "Use managed evaluation",
            "business_consequence": "Keep results reliable", "existing_system": "A managed model",
            "decisive_constraints": ["Minimize operational effort"], "best_action": "Use evaluation",
            "mistakes": [{"action": action, "scenario_reason": "Adds effort"}
                         for action in ("Migrate", "Build custom", "Repeat manually")]}
    return {"objective_id": objective, "domain": domain,
            "scope": {"objective_id": objective, "domain_prompt": "Evaluate models"},
            "inputs": {"objective_scope": "Evaluate models", "difficulty": "MEDIUM",
                       "replacement_feedback": "", "existing_scenarios": "[]"},
            "outputs": {"plan": plan}, "proof": {"passed": True}, "sources": []}


def test_budget_rejects_unknown_or_zero_prices_and_nonfinite_cap(tmp_path):
    for cap in (0, -1, "NaN", "Infinity"):
        with pytest.raises(ValueError):
            SpendBudget(cap, PRICES, tmp_path / "spend")
    with pytest.raises(ValueError):
        SpendBudget(1, {MODEL: {"input_usd_per_million": 0, "output_usd_per_million": 1}}, tmp_path / "spend")
    budget = SpendBudget(1, PRICES, tmp_path / "spend")
    with pytest.raises(ValueError, match="Missing"):
        budget.reserve("unknown", 1, 1)


def test_budget_stops_before_cap_and_retains_failed_attempts_and_resume(tmp_path):
    path = tmp_path / "spend.jsonl"
    budget = SpendBudget("0.03", PRICES, path)
    budget.reserve(MODEL, 10000, 5000)
    with pytest.raises(BudgetExceeded):
        budget.reserve(MODEL, 10000, 5000)
    resumed = SpendBudget("0.03", PRICES, path)
    assert Decimal(resumed.snapshot()["reserved_usd"]) == Decimal("0.02")
    assert resumed.snapshot()["transport_attempts"] == 1
    path.write_text(path.read_text() + "broken\n")
    with pytest.raises(ValueError):
        resumed.reserve(MODEL, 1, 1)


def test_transport_guard_admits_once_and_stops_before_real_forward(monkeypatch, tmp_path):
    calls = []
    def fake_forward(self, **kwargs):
        calls.append(kwargs)
        assert self.num_retries == 0
        return {"offline": True}
    monkeypatch.setattr(dspy.LM, "forward", fake_forward)
    lm = dspy.LM(MODEL, max_tokens=100, num_retries=9, cache=False)
    budget = SpendBudget("0.008", PRICES, tmp_path / "spend")
    with budgeted_calls(budget):
        assert lm.forward(messages=[{"role": "user", "content": "offline"}]) == {"offline": True}
        with pytest.raises(BudgetExceeded):
            lm.forward(messages=[{"role": "user", "content": "offline"}])
    assert len(calls) == 1
    assert dspy.LM.forward is fake_forward


def test_cli_retry_attempts_and_exception_reservations(monkeypatch, tmp_path):
    from shared import cli_models
    calls = []
    def fail(*args, **kwargs):
        calls.append(1)
        raise RuntimeError("synthetic failure")
    monkeypatch.setattr(cli_models, "_run_cli_transport", fail)
    budget = SpendBudget(1, PRICES, tmp_path / "spend")
    with budgeted_calls(budget, cli_output_tokens=100):
        for _ in range(2):
            with pytest.raises(RuntimeError):
                cli_models._run_cli_transport("claude", "data", {}, object(), usage={})
    assert len(calls) == 2
    assert budget.snapshot()["transport_attempts"] == 2


def test_message_bounds_reject_nontext_and_multicompletion(monkeypatch, tmp_path):
    with pytest.raises(ValueError):
        input_token_bound(messages=[{"role": "user", "content": [{"image_url": "no"}]}])
    assert input_token_bound("é") > len("é")
    monkeypatch.setattr(dspy.LM, "forward", lambda *a, **k: None)
    with budgeted_calls(SpendBudget(1, PRICES, tmp_path / "spend")):
        with pytest.raises(ValueError, match="one completion"):
            dspy.LM(MODEL, max_tokens=100).forward(prompt="data", n=2)


def test_metric_cap_is_hard_and_feedback_preserved():
    metric = MetricLimiter(lambda *args: dspy.Prediction(score=.5, feedback="recorded reason"), 1)
    result = metric(None, None)
    assert result.score == .5 and result.feedback == "recorded reason"
    assert metric.scores == [.5]
    with pytest.raises(MetricLimitExceeded):
        metric(None, None)
    assert metric.calls == 1


def test_diverse_train_only_positive_demos_are_deterministic():
    rows = [plan_row(f"{domain}.1:{i}", domain) for domain in ("1", "2") for i in range(1, 7)]
    rows.append({**plan_row("1.1:9"), "proof": {"passed": False}})
    before = copy.deepcopy(rows)
    selected = optimizer.select_diverse_demos(rows, stage="plan", seed=17)
    assert selected == optimizer.select_diverse_demos(list(reversed(rows)), stage="plan", seed=17)
    assert len(selected) == 8
    assert {domain: sum(row["domain"] == domain for row in selected) for domain in ("1", "2")} == {"1": 4, "2": 4}
    assert "1.1:9" not in {row["objective_id"] for row in selected}
    assert rows == before


def test_labeled_bootstrap_is_offline_and_keeps_selected_demos():
    student = optimizer.StageProgram("plan", MODEL)
    examples = [optimizer.to_example(plan_row(f"1.1:{i}"), optimizer.stage_signature("plan")) for i in range(1, 5)]
    compiled = optimizer.compile_program(student, method="bootstrap", trainset=examples, devset=[], metric=None)
    assert len(compiled.writer.demos) == 4
    assert not student.writer.demos


def test_writer_predict_reuses_tuned_instructions_and_demos(monkeypatch):
    from shared import llm_generator, openrouter_writer
    row = plan_row()
    lm = DummyLM([row["outputs"]])
    monkeypatch.setattr(llm_generator, "_generation_lm", lambda *a, **k: lm)
    monkeypatch.setenv(openrouter_writer.MODEL_PARAMETERS_ENV, "{}")
    program = optimizer.StageProgram("plan", MODEL)
    program.writer.signature = program.writer.signature.with_instructions("OFFLINE TUNED INSTRUCTIONS")
    program.writer.demos = [optimizer.to_example(row, optimizer.stage_signature("plan"))]
    pred = program(**row["inputs"])
    assert pred.plan == row["outputs"]["plan"]
    messages = lm.history[-1]["messages"]
    assert "OFFLINE TUNED INSTRUCTIONS" in messages[0]["content"]
    assert len(messages) > 2


def test_gepa_configuration_only_sets_concrete_cap(monkeypatch):
    captured = {}
    class FakeGEPA:
        def __init__(self, **kwargs): captured.update(kwargs)
        def compile(self, student, **kwargs): return student
    monkeypatch.setattr(dspy, "GEPA", FakeGEPA)
    student = optimizer.StageProgram("plan", MODEL)
    assert optimizer.compile_program(student, method="gepa", trainset=[1], devset=[2],
                                     metric=lambda *a: None, reflection_lm=object(), max_metric_calls=7) is student
    assert captured["max_metric_calls"] == 7 and "auto" not in captured
    assert captured["num_threads"] == 1


def test_dataset_objective_leakage_refused(tmp_path):
    for split in ("train", "dev", "test"):
        (tmp_path / f"plan.{split}.json").write_text(json.dumps([plan_row()]))
    with pytest.raises(ValueError, match="objective-disjoint"):
        optimizer.load_splits(tmp_path, "plan")


def test_bootstrap_cli_pack_roundtrip_without_model_calls(tmp_path):
    dataset = tmp_path / "data"
    dataset.mkdir()
    for split, rows in (("train", [plan_row(f"1.1:{i}") for i in range(1, 5)]),
                        ("dev", [plan_row("2.1:1")]), ("test", [plan_row("3.1:1")])):
        (dataset / f"plan.{split}.json").write_text(json.dumps(rows))
    (dataset / "manifest.json").write_text(json.dumps({"seed": 0}))
    prices = tmp_path / "prices.json"
    prices.write_text(json.dumps(PRICES))
    output = tmp_path / "pack.json"
    assert optimizer.main(["--stage", "plan", "--method", "bootstrap", "--dataset-dir", str(dataset),
                           "--output", str(output), "--student-model", MODEL, "--budget-usd", "1",
                           "--prices", str(prices)]) == 0
    from shared.prompt_pack import load_pack
    pack = load_pack(output)
    assert len(pack["writers"][0]["demos"]) == 4
    run = json.loads((tmp_path / "pack.run/run.json").read_text())
    assert run["budget"]["transport_attempts"] == 0
    assert run["test_objectives"] == ["3.1:1"]


def test_live_optimization_requires_explicit_approval(tmp_path):
    with pytest.raises(SystemExit, match="explicit"):
        optimizer.main(["--stage", "plan", "--method", "gepa", "--dataset-dir", str(tmp_path),
                        "--output", str(tmp_path / "pack.json"), "--budget-usd", "1", "--prices", "absent"])


def test_metric_feedback_cache_avoids_duplicate_paid_judging():
    calls = []
    def score(*args):
        calls.append(1)
        return dspy.Prediction(score=1., feedback="same frozen reason")
    metric = MetricLimiter(score, 1, cache=True)
    gold, pred = dspy.Example(scope={"objective_id": "1"}), dspy.Prediction(plan={"objective_id": "1"})
    first = metric(gold, pred)
    first.feedback = "mutation cannot poison cached feedback"
    repeated = metric(gold, pred, pred_name="writer", pred_trace=[])
    assert repeated.feedback == "same frozen reason"
    assert len(calls) == metric.calls == 1 and metric.cache_hits == 1
    with pytest.raises(MetricLimitExceeded):
        metric(gold, dspy.Prediction(plan={"objective_id": "different"}))


def test_effective_plan_signature_matches_frozen_production_transforms():
    from shared.decision_planner import planning_prompt
    from shared.prompt_pack import create_pack, use_prompt_pack
    from shared.question_style import practitioner_signature
    program = optimizer.StageProgram("plan", MODEL, cert_id="data-engineer", doccheck_policy="v6")
    tuned = "An ML engineer should choose an engineering decision."
    program.writer.signature = program.writer.signature.with_instructions(tuned)
    pack = create_pack(stage="plan", signature=optimizer.stage_signature("plan"), instructions=tuned,
                       policy={}, source_run="test", scores={})
    with use_prompt_pack(pack):
        expected, _ = planning_prompt({"domain_prompt": "", "cert_id": "data-engineer", "doccheck_policy": "v6"}, stable_prefix=True)
    assert tuple(program.writer.effective_signature().input_fields) == tuple(expected.input_fields)
    assert program.writer.effective_signature().instructions == expected.instructions
    assert program.writer.signature.instructions == tuned
    assert "documented POSITIVE fact" in expected.instructions
    draft = optimizer.StageProgram("draft", MODEL, cert_id="data-engineer")
    assert draft.writer.effective_signature().instructions == practitioner_signature(draft.writer.signature, "data-engineer").instructions


def test_existing_optimizer_run_state_is_never_resumed(tmp_path):
    dataset = tmp_path / "data"
    dataset.mkdir()
    for split, objective in (("train", "1.1:1"), ("dev", "2.1:1"), ("test", "3.1:1")):
        (dataset / f"plan.{split}.json").write_text(json.dumps([plan_row(objective)]))
    (dataset / "manifest.json").write_text(json.dumps({"seed": 0}))
    (tmp_path / "pack.run/gepa").mkdir(parents=True)
    (tmp_path / "pack.run/gepa/gepa_state.bin").write_bytes(b"old foreign optimization state")
    prices = tmp_path / "prices.json"
    prices.write_text(json.dumps(PRICES))
    with pytest.raises(SystemExit, match="existing optimizer run"):
        optimizer.main(["--stage", "plan", "--method", "bootstrap", "--dataset-dir", str(dataset),
                        "--output", str(tmp_path / "pack.json"), "--student-model", MODEL,
                        "--budget-usd", "1", "--prices", str(prices)])
    assert not (tmp_path / "pack.json").exists()


def test_development_sample_is_bounded_objective_balanced_and_deterministic():
    rows = [plan_row(f"1.1:{i}") for i in range(100)]
    sample = optimizer.development_subset(rows, 10, 42)
    assert sample == optimizer.development_subset(list(reversed(rows)), 10, 42)
    assert len(sample) == 10 and len({row["objective_id"] for row in sample}) == 10


def test_dataset_manifest_hash_tampering_refused(tmp_path):
    import hashlib
    files = {}
    for split, objective in (("train", "1.1:1"), ("dev", "2.1:1"), ("test", "3.1:1")):
        path = tmp_path / f"plan.{split}.json"
        path.write_text(json.dumps([plan_row(objective)]))
        files[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    (tmp_path / "manifest.json").write_text(json.dumps({"files": files}))
    (tmp_path / "plan.train.json").write_text(json.dumps([plan_row("4.1:1")]))
    with pytest.raises(ValueError, match="manifest hash"):
        optimizer.load_splits(tmp_path, "plan")


def test_nested_objective_mismatch_refused():
    row = plan_row()
    row["scope"]["objective_id"] = "another-objective"
    with pytest.raises(ValueError, match="objective IDs differ"):
        optimizer.to_example(row, optimizer.stage_signature("plan"))


def test_failed_compile_records_safe_failure_without_partial_pack(monkeypatch, tmp_path):
    dataset = tmp_path / "data"
    dataset.mkdir()
    for split, objective in (("train", "1.1:1"), ("dev", "2.1:1"), ("test", "3.1:1")):
        (dataset / f"plan.{split}.json").write_text(json.dumps([plan_row(objective)]))
    (dataset / "manifest.json").write_text(json.dumps({"seed": 0}))
    prices = tmp_path / "prices.json"
    prices.write_text(json.dumps(PRICES))
    def fail(*a, **k):
        raise RuntimeError("raw synthetic provider body must not be persisted")
    monkeypatch.setattr(optimizer, "compile_program", fail)
    output = tmp_path / "pack.json"
    assert optimizer.main(["--stage", "plan", "--method", "bootstrap", "--dataset-dir", str(dataset),
                           "--output", str(output), "--student-model", MODEL,
                           "--budget-usd", "1", "--prices", str(prices)]) == 2
    report = (tmp_path / "pack.run/run.json").read_text()
    assert json.loads(report)["status"] == "failed"
    assert json.loads(report)["error_class"] == "RuntimeError"
    assert "raw synthetic" not in report and not output.exists()
