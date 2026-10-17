"""Offline b14 replay: recorded four-gate verdicts, mocked DB, no model calls."""
from collections import Counter
from copy import deepcopy
import gzip
import json
from math import ceil
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import ingest_external_verdicts as ingest
from shared.batch_report import key_length_rank_report, key_position_report
from shared.external_judge import candidate_question
from shared.option_order import balance_options, canonical_evidence

FIXTURE = Path(__file__).parent / "fixtures/key-balance-b14.json.gz"


@pytest.fixture
def replay(tmp_path, monkeypatch):
    data = json.loads(gzip.decompress(FIXTURE.read_bytes()))
    payload = data["payload"]
    path = tmp_path / "b14.json"
    verdicts = tmp_path / "verdicts"
    verdicts.mkdir()
    judged = {}
    for entry in payload["candidates"]:
        ident = entry["candidate_id"]
        request_path = tmp_path / entry["external_judge_request"]["path"]
        request_path.parent.mkdir(exist_ok=True)
        request_path.write_text(data["requests"][ident])
        (verdicts / (ident + ".json")).write_text(data["verdicts"][ident])
        frozen = json.loads(data["requests"][ident])
        prompt = frozen["gates"]["evidence"]["judge_prompt"]
        # Extract the exact canonical question judged, not a newly generated key.
        question = json.loads(prompt.rsplit("[[ ## question_data ## ]]\n", 1)[1].split(
            "\n\n[[ ## domain_context ## ]]", 1)[0])
        judged[ident] = question["correct_answer"]
        assert candidate_question(entry)["correct_answer"] == judged[ident]
    path.write_text(json.dumps(payload))
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "offline-domain"}
    client.create_generation_run.side_effect = lambda row: {"id": row["id"]}
    client.insert_question.side_effect = lambda row: {"id": row["id"]}
    client.insert_answers_batch.side_effect = lambda rows: [{"id": str(i)} for i in range(len(rows))]
    client.insert_explanation.return_value = {"id": "offline-explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = True
    factory = Mock(return_value=client)
    monkeypatch.setattr(ingest, "database_client", factory)
    monkeypatch.setattr("dspy.LM", Mock(side_effect=AssertionError("No live LM")))
    monkeypatch.setattr("shared.cli_models.run_signature", Mock(side_effect=AssertionError("No live CLI")))
    monkeypatch.setattr("requests.sessions.Session.request", Mock(side_effect=AssertionError("No HTTP")))
    return path, verdicts, payload, judged, client, factory


def invoke(replay, *flags):
    return CliRunner().invoke(ingest.main, ["--artifact", str(replay[0]), "--verdicts", str(replay[1]), *flags])


@pytest.mark.parametrize("count", [1, 2, 3, 4, 5, 13])
def test_recorded_b14_balanced_persistence_and_rerun(replay, count):
    path, _, payload, judged, client, factory = replay
    payload["candidates"] = payload["candidates"][:count]
    before = deepcopy(payload["candidates"])
    if count == 13:
        assert Counter(entry["key"] for entry in before) == {"B": 7, "C": 3, "D": 3}
        assert key_position_report(before)["passed"] is False
    path.write_text(json.dumps(payload))
    dry = invoke(replay, "--dry-run")
    assert dry.exit_code == 0, dry.output
    factory.assert_not_called()
    balanced = json.loads(path.read_text())
    counts = balanced["key_position_report"]["counts"]
    assert max(counts.values()) <= ceil(count / 4)
    assert balanced["key_length_rank_report"] == key_length_rank_report(balanced["candidates"])
    for original, entry in zip(before, balanced["candidates"]):
        assert candidate_question(entry) == candidate_question(original)
        assert canonical_evidence(entry) == canonical_evidence(original)
        assert entry["external_verdict"] == json.loads((replay[1] / (entry["candidate_id"] + ".json")).read_text())
    again = invoke(replay, "--dry-run")
    assert again.exit_code == 0, again.output
    assert json.loads(path.read_text()) == balanced
    first = invoke(replay)
    assert first.exit_code == 0, first.output
    saved = json.loads(path.read_text())
    by_id = {entry["candidate_id"]: entry for entry in saved["candidates"]}
    assert client.insert_question.call_count == client.insert_answers_batch.call_count == count
    for call in client.insert_answers_batch.call_args_list:
        rows = call.args[0]
        ident = rows[0]["question_id"]
        entry = by_id[ident]
        correct = [row for row in rows if row["is_correct"]]
        assert len(correct) == 1
        assert correct[0]["choice_text"] == judged[ident]
        assert correct[0]["choice_label"] == entry["key"]
        for row, option in zip(rows, entry["options"]):
            assert row["choice_label"] == option["label"]
            assert row["choice_text"] == option["text"]
            assert row["explanation_text"] == entry["rationales"][option["label"]]
        assert entry["grounding"]["evidence"] == entry["evidence"]
        assert entry["grounding"]["option_order"] == entry["option_order"]
    ingest.validate_completed_journals(saved, path)
    second = invoke(replay)
    assert second.exit_code == 0, second.output
    assert client.insert_question.call_count == count
    assert json.loads(path.read_text()) == saved


def test_balance_order_independent_and_idempotent(replay):
    entries = replay[2]["candidates"]
    reversed_entries = list(reversed(deepcopy(entries)))
    balance_options(entries)
    balance_options(reversed_entries)
    assert sorted(entries, key=lambda e: e["candidate_id"]) == sorted(
        reversed_entries, key=lambda e: e["candidate_id"])
    previous = deepcopy(entries)
    balance_options(entries)
    assert entries == previous
    counts = Counter(entry["key"] for entry in entries)
    assert sorted(counts.values()) == [3, 3, 3, 4]


@pytest.mark.parametrize("field,value", [("version", True), ("index", -1), ("population_sha256", "x" * 64)])
def test_malformed_balance_blocks_helpers(replay, field, value):
    entries = replay[2]["candidates"]
    balance_options(entries)
    entries[0]["option_balance"][field] = value
    with pytest.raises(ValueError):
        candidate_question(entries[0])
    with pytest.raises(ValueError):
        canonical_evidence(entries[0])


def test_changed_cohort_does_not_relabel_completed_rows(replay):
    path, verdicts, payload, _, client, factory = replay
    verdict = verdicts / (payload["candidates"][-1]["candidate_id"] + ".json")
    withheld = verdict.read_text()
    verdict.unlink()
    first = invoke(replay)
    # Twelve valid candidates persist, while the missing verdict remains rejected.
    assert first.exit_code == 1 and client.insert_question.call_count == 12
    saved = json.loads(path.read_text())
    completed = deepcopy(saved["candidates"][:-1])
    verdict.write_text(withheld)
    factory.reset_mock()
    second = invoke(replay)
    assert second.exit_code == 1 and "layout requires reconciliation" in second.output
    factory.assert_not_called()
    client.insert_question.assert_not_called()
    assert json.loads(path.read_text())["candidates"][:-1] == completed
