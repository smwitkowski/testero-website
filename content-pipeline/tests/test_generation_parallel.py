"""Offline bounded generation, publication and effort contracts."""
import hashlib
import json
from threading import Barrier, Event, Lock

import pytest
from click.testing import CliRunner

from scripts import generate_pmle_questions as generate
from shared.cert_context import plan_questions
from shared.cli_models import CLIAuthError, CLIUsageLimitError
from shared.external_judge import candidate_id, candidate_question
from test_external_generation import QUESTION, OBJECTIVE, source, receipts


@pytest.fixture
def batch(monkeypatch, tmp_path):
    plan = plan_questions("machine-learning-engineer", 8, objective_ids=[OBJECTIVE])
    for index, item in enumerate(plan, 1):
        item["domain_prompt"] += f"\nFAKE_INDEX={index}"
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "plan_questions", lambda cert, count, **kw: plan[:count])
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [source()])
    monkeypatch.setattr(generate, "database_client", lambda: pytest.fail("DB forbidden"))
    monkeypatch.setattr(generate, "judge_three_gates", lambda *a, **kw: pytest.fail("Judge forbidden"))
    monkeypatch.setattr(generate, "cite_question", lambda *a, **kw: {"evidence": receipts()})
    def question(context, *args, **kwargs):
        index = int(context.rsplit("FAKE_INDEX=", 1)[1])
        return {**QUESTION, "stem": f"You manage workload number {index}. " + QUESTION["stem"]}
    monkeypatch.setattr(generate, "generate_question", question)
    def invoke(name="batch", count=8, *flags):
        return CliRunner().invoke(generate.main, [
            "--model", "codex", "--judge-model", "external", "--n-questions", str(count),
            "--artifact", str(tmp_path / (name + ".json")), *flags])
    return tmp_path, plan, question, invoke


@pytest.mark.parametrize("parallel", [2, 3, 4])
def test_concurrent_pipeline_is_bounded_and_writes_complete_ordered_artifacts(batch, monkeypatch, parallel):
    path, plan, question, invoke = batch
    barrier = Barrier(parallel)
    lock = Lock()
    active = peak = 0
    generation_calls = []
    citation_calls = []
    def generator(context, *args, **kwargs):
        nonlocal active, peak
        index = int(context.rsplit("FAKE_INDEX=", 1)[1])
        with lock:
            active += 1
            peak = max(peak, active)
            generation_calls.append(kwargs["reasoning_effort"])
        if index <= parallel:
            barrier.wait(timeout=10)
        return question(context)
    def citer(*args, **kwargs):
        nonlocal active
        with lock:
            citation_calls.append(kwargs["reasoning_effort"])
            active -= 1
        return {"evidence": receipts()}
    monkeypatch.setattr(generate, "generate_question", generator)
    monkeypatch.setattr(generate, "cite_question", citer)
    original_write = generate.write_artifact
    writes = []
    def checked_write(destination, payload):
        if destination.name == "batch.json":
            entries = payload["candidates"]
            assert [e["index"] for e in entries] == list(range(1, len(entries)+1))
            assert all(e.get("awaiting_external_judge") for e in entries)
            assert all(e["mechanical_check"]["passed"] for e in entries)
            writes.append(len(entries))
        original_write(destination, payload)
        json.loads(destination.read_text())
    monkeypatch.setattr(generate, "write_artifact", checked_write)
    outcome = invoke("batch", 8, "--parallel", str(parallel), "--gen-effort", "medium", "--cite-effort", "low")
    assert outcome.exit_code == 0, outcome.output
    assert peak == parallel and active == 0
    assert writes == list(range(1, 9))
    payload = json.loads((path / "batch.json").read_text())
    assert payload["parallel"] == parallel
    assert payload["gen_effort"] == "medium" and payload["cite_effort"] == "low"
    assert generation_calls == ["medium"] * 8 and citation_calls == ["low"] * 8
    for index, entry in enumerate(payload["candidates"], 1):
        assert entry["candidate_id"] == candidate_id(index, plan[index-1], candidate_question(entry))
        request = path / entry["external_judge_request"]["path"]
        assert entry["external_judge_request"]["sha256"] == hashlib.sha256(request.read_bytes()).hexdigest()
    # Serial and concurrent executions preserve content IDs and frozen plan order.
    monkeypatch.setattr(generate, "generate_question", question)
    monkeypatch.setattr(generate, "cite_question", lambda *a, **kw: {"evidence": receipts()})
    again = invoke("serial", 8, "--parallel", "1")
    assert again.exit_code == 0, again.output
    serial = json.loads((path / "serial.json").read_text())
    assert [c["candidate_id"] for c in serial["candidates"]] == [c["candidate_id"] for c in payload["candidates"]]


@pytest.mark.parametrize("error", [CLIUsageLimitError, CLIAuthError])
@pytest.mark.parametrize("stage", ["generation", "citation"])
def test_limit_or_auth_stops_new_admission_and_drains_inflight(batch, monkeypatch, error, stage):
    path, plan, question, invoke = batch
    stop = Event()
    barrier = Barrier(3)
    admitted = []
    monkeypatch.setattr(generate, "Event", lambda: stop)
    def generator(context, *args, **kwargs):
        index = int(context.rsplit("FAKE_INDEX=", 1)[1])
        admitted.append(index)
        barrier.wait(timeout=10)
        if stage == "generation":
            if index == 2:
                raise error("Safe stop")
            assert stop.wait(timeout=10)
        return question(context)
    def citer(data, *args, **kwargs):
        if stage == "citation":
            if "number 2." in data["stem"]:
                raise error("Safe stop")
            assert stop.wait(timeout=10)
        return {"evidence": receipts()}
    monkeypatch.setattr(generate, "generate_question", generator)
    monkeypatch.setattr(generate, "cite_question", citer)
    result = invoke("batch", 8, "--parallel", "3")
    assert result.exit_code == 1 and "Safe stop" in result.output
    assert sorted(admitted) == [1, 2, 3]
    payload = json.loads((path / "batch.json").read_text())
    assert len(payload["plan"]) == 8
    assert payload["batch_stop"]["error_class"] == error.__name__
    assert payload["batch_stop"]["index"] == 2
    assert [c["index"] for c in payload["candidates"]] == [1, 2, 3]
    assert [c["index"] for c in payload["candidates"] if c.get("awaiting_external_judge")] == [1, 3]
    assert len(list((path / "batch.judge-requests").glob("*.json"))) == 2


def test_duplicate_winner_is_first_in_plan_not_first_to_finish(batch, monkeypatch):
    path, plan, question, invoke = batch
    second_cited = Event()
    def generator(context, *args, **kwargs):
        index = int(context.rsplit("FAKE_INDEX=", 1)[1])
        if index == 1:
            assert second_cited.wait(timeout=10)
        return QUESTION.copy()
    def citer(*args, **kwargs):
        second_cited.set()
        return {"evidence": receipts()}
    monkeypatch.setattr(generate, "generate_question", generator)
    monkeypatch.setattr(generate, "cite_question", citer)
    result = invoke("batch", 2, "--parallel", "2")
    assert result.exit_code == 1
    payload = json.loads((path / "batch.json").read_text())
    assert payload["candidates"][0]["awaiting_external_judge"]
    assert payload["candidates"][1]["failure_stage"] == "duplicate"
    assert len(list((path / "batch.judge-requests").glob("*.json"))) == 1


@pytest.mark.parametrize("parallel", ["0", "5"])
def test_invalid_parallel_rejected_before_calls(batch, parallel):
    result = batch[-1]("batch", 1, "--parallel", parallel)
    assert result.exit_code == 2


def test_request_publication_failure_retains_rejected_index_and_drains_others(batch, monkeypatch):
    path, plan, question, invoke = batch
    original_write = generate.write_artifact
    failed = False
    def write(destination, payload):
        nonlocal failed
        if destination.parent.name == "batch.judge-requests" and not failed:
            failed = True
            raise OSError("PRIVATE local error must not leak")
        original_write(destination, payload)
    monkeypatch.setattr(generate, "write_artifact", write)
    result = invoke("batch", 8, "--parallel", "3")
    assert result.exit_code == 1
    payload = json.loads((path / "batch.json").read_text())
    assert [c["index"] for c in payload["candidates"]] == list(range(1, 9))
    rejected = payload["candidates"][0]
    assert rejected["failure_stage"] == "external_request"
    assert rejected["error_class"] == "OSError"
    assert "external_judge_request" not in rejected
    assert not rejected.get("awaiting_external_judge")
    assert "PRIVATE" not in json.dumps(payload) + result.output
    assert len(list((path / "batch.judge-requests").glob("*.json"))) == 7
    assert all(c.get("awaiting_external_judge") for c in payload["candidates"][1:])
