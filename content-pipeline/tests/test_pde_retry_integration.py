"""Real offline generation + immutable requests + ingestion across retry waves.

Only semantic/model stage outputs are synthetic. No network or DB is permitted.
"""
from copy import deepcopy
from collections import Counter
import json
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate
from scripts import ingest_external_verdicts as ingestion
from scripts.pde_retry import run_retry_batch, read_json
from shared.external_judge import candidate_question, candidate_storage_id
from shared.near_duplicates import comparison_row, load_export
from test_pde_pipeline_integration import (
    SOURCE, RECEIPTS, plan, proof, question, distinct_specs, save_verdicts,
)


@pytest.mark.parametrize("write", [False, True])
@pytest.mark.parametrize("rejection", ["style", "empty_stem", "empty_key"])
def test_real_generation_and_ingestion_replace_reject_with_fresh_decision(monkeypatch, tmp_path, rejection, write):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    forbidden = Mock(side_effect=AssertionError("No database/model client permitted"))
    for module in (generate, ingestion):
        monkeypatch.setattr(module, "database_client", forbidden)
        # Existing dedicated tests exercise the legacy scenario Jaccard veto.
        monkeypatch.setattr(module, "check_near_duplicate", lambda *a, **kw: {"passed": True, "matches": []})
    monkeypatch.setattr(generate, "check_plan_near_duplicate", lambda *a, **kw: {"passed": True, "matches": []})
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr(generate, "search_objective_docs", lambda *a, **kw: [deepcopy(SOURCE)])
    monkeypatch.setattr(generate, "verify_decision", proof)
    specs = distinct_specs()
    replacement_actions = [
        "Configure Cloud Storage object versioning and retain prior object generations for recovery from accidental replacement during ingestion.",
        "Deploy Dataflow streaming workers and aggregate event windows before loading operational messages into the reporting destination.",
        "Schedule Dataproc maintenance workflows and recreate temporary cluster resources before launching each scheduled transformation process.",
        "Apply BigQuery row access policies to reporting tables and assign regional analyst permissions through managed identity groups.",
    ]
    specs.append((replacement_actions, question(replacement_actions)))
    serial = [0]
    def planner(scope, **kwargs):
        serial[0] += 1
        return plan(scope, specs[serial[0] - 1][0], f"synthetic-attempt-{serial[0]}")
    def writer(context, *args, **kwargs):
        number = next(index for index in range(1, 5) if f"synthetic-attempt-{index}" in context)
        value = {**deepcopy(specs[number - 1][1]), "evidence": deepcopy(RECEIPTS)}
        if number == 1 and rejection == "empty_stem":
            value["stem"] = ""
        elif number == 1 and rejection == "empty_key":
            value["correct_answer"] = ""
        return value
    monkeypatch.setattr(generate, "plan_decision", planner)
    monkeypatch.setattr(generate, "generate_question", writer)
    artifact, export = tmp_path / "full.json", tmp_path / "bank.json"
    export.write_text("[]")
    commands = [["python", "generate", "--cert", "data-engineer", "--n-questions", "3", "--model", "codex",
                 "--judge-model", "external", "--parallel", "1", "--no-doc-cache", "--artifact", str(artifact),
                 "--existing-questions", str(export), "--distractor-evidence", "consistent"],
                ["python", "judge", "--requests", "unused", "--verdicts", "unused"]]
    events = []
    def execute(command):
        if command[1] == "generate":
            result = CliRunner().invoke(generate.main, command[2:])
            assert result.exit_code == 0, (result.output, result.exception)
            events.append("generate")
        else:
            requests = command[command.index("--requests") + 1]
            path = tmp_path / (requests.split("/")[-1].removesuffix(".judge-requests") + ".json")
            payload = read_json(path)
            directory = save_verdicts(path, payload)
            if path == artifact and rejection == "style":
                verdict_path = directory / (payload["candidates"][0]["candidate_id"] + ".json")
                raw = read_json(verdict_path)
                raw["style"].update(verdict="FAIL", inference_required=False)
                verdict_path.write_text(json.dumps(raw))
            events.append("review")
    def storage_id(payload, entry):
        return candidate_storage_id(entry, ingestion._scope(payload, entry), candidate_question(entry))
    inserted, answers, explanations = {}, {}, {}
    client = Mock()
    client.get_domain_by_code.side_effect = lambda code, **kw: {"id": "domain-" + code}
    client.create_generation_run.side_effect = lambda row: {"id": row["id"]}
    client.update_generation_run.return_value = True
    client.update_question_review.return_value = True
    def insert_question(row):
        assert row["id"] not in inserted
        assert row["status"] == "DRAFT"
        inserted[row["id"]] = deepcopy(row)
        return {"id": row["id"]}
    def insert_answers(rows):
        answers[rows[0]["question_id"]] = deepcopy(rows)
        return rows
    def insert_explanation(row):
        explanations[row["question_id"]] = deepcopy(row)
        return {"id": "explanation-" + row["question_id"]}
    client.insert_question.side_effect = insert_question
    client.insert_answers_batch.side_effect = insert_answers
    client.insert_explanation.side_effect = insert_explanation
    def offline_factory():
        # All generation/review and aggregate dry admissions completed first.
        assert serial[0] == 4
        summary = read_json(artifact.with_suffix(".retry-report.json"))
        assert summary["status"] == "writing" and len(summary["waves"]) == 2
        digests = {row["option_balance"]["population_sha256"]
                   for wave in summary["waves"] for row in read_json(wave["artifact"])["candidates"]
                   if row.get("publication_selected")}
        assert len(digests) == 1
        return client
    factory = Mock(side_effect=offline_factory)
    if write:
        monkeypatch.setattr(ingestion, "database_client", factory)
    admissions = []
    def admit(*args, **kwargs):
        admissions.append(kwargs["dry_run"])
        return ingestion.ingest(*args, **kwargs)
    report = run_retry_batch(artifact, export, commands, retry_attempts=2, execute=execute,
                             admit=admit, load_bank=lambda path: load_export(path, cert_id="data-engineer")["questions"],
                             comparison=comparison_row, storage_id=storage_id, write=write)
    assert events == ["generate", "review", "generate", "review"]
    assert len(report["waves"]) == 2
    assert report["waves"][1]["slots"] == [1]
    if rejection != "style":
        assert len(report["waves"][0]["comparison_omissions"]) == 1
    assert sum(row["accepted"] for row in report["sections"]) == 3
    source, replacement = read_json(artifact), read_json(tmp_path / "full-retry1.json")
    assert source["plan"][0]["decision_plan"] != replacement["plan"][0]["decision_plan"]
    for key in ("domain_code", "objective_id", "required_topic_id", "required_topic_guidance"):
        assert source["plan"][0][key] == replacement["plan"][0][key]
    assert replacement["retry_slots"] == [{"plan_slot": 1, "attempt": 2}]
    assert replacement["full_plan_count"] == 3
    assert len(report["balance_population_ids"]) == 3
    if write:
        assert admissions == [True, True, True, True, False, False]
        assert report["status"] == "persisted"
        assert len(inserted) == 3 and factory.call_count == 2
        assert set(inserted) == {ident for wave in report["waves"] for ident in wave["selected_ids"]}
        assert source["candidates"][0]["candidate_id"] not in inserted
        completed = [row for payload in (source, replacement) for row in payload["candidates"]
                     if row.get("persistence_status") == "complete"]
        assert len(completed) == 3 and all(row["accepted"] for row in completed)
        keys = Counter(row["key"] for row in completed)
        assert max(keys.get(label, 0) for label in "ABCD") - min(keys.get(label, 0) for label in "ABCD") <= 1
        for row in completed:
            ident = row["inserted_question_id"]
            stored_answers = {answer["choice_label"]: answer for answer in answers[ident]}
            assert len(stored_answers) == 4
            assert sum(answer["is_correct"] for answer in stored_answers.values()) == 1
            for option in row["options"]:
                answer = stored_answers[option["label"]]
                assert answer["choice_text"] == option["text"]
                assert answer["is_correct"] == (option["label"] == row["key"])
                assert answer["explanation_text"] == row["rationales"][option["label"]]
            grounding = json.loads(inserted[ident]["review_notes"])["grounding"]
            assert grounding["option_order"] == row["option_order"]
            assert grounding["evidence"] == row["evidence"]
            assert set(receipt["option_label"] for receipt in grounding["evidence"]) == set("ABCD")
            assert explanations[ident]["doc_links"] == [SOURCE["url"]]
    else:
        assert admissions == [True, True, True, True]
        assert inserted == {} and factory.call_count == 0
        assert all(not row.get("accepted") and not row.get("inserted_question_id")
                   for payload in (source, replacement) for row in payload["candidates"])
    forbidden.assert_not_called()
