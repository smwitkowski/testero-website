"""Synthetic offline verdicts exercise contracts, not real judge quality or PASS yield."""
import fcntl
import hashlib
import json
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import ingest_external_verdicts as ingest
from scripts import generate_pmle_questions as generate
from shared.cert_context import plan_questions
from shared.evidence import check_evidence
from shared.external_judge import build_request, request_directory, candidate_id, EXTERNAL_JUDGE_PROVENANCE
from shared.quality_gate import ACCURACY_CHECKS
from test_generation_gate import QUESTION, URL, TEXT, QUOTES


@pytest.fixture
def case(tmp_path, monkeypatch):
    scope = plan_questions("cloud-engineer", 1, seed=3)[0]
    sources = [{"requested_url": URL, "url": URL, "text": TEXT,
                "retrieved_at": "2026-10-04T00:00:00+00:00",
                "text_sha256": hashlib.sha256(TEXT.encode()).hexdigest()}]
    evidence = check_evidence([{"option_label": label, "url": URL, "quote": quote}
                               for label, quote in zip("ABCD", QUOTES)], sources)["options"]
    entry = {**{k: scope[k] for k in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment")},
             "index": 1, "candidate_id": "synthetic-candidate", "key": "A", "stem": QUESTION["stem"],
             "options": [{"label": label, "text": QUESTION[field]} for label, field in zip("ABCD", generate.OPTION_FIELDS)],
             "rationales": {label: QUESTION[field] for label, field in zip("ABCD", generate.RATIONALE_FIELDS)},
             "sources": sources, "evidence": evidence, "accepted": False,
             "status": "awaiting_external_judge", "awaiting_external_judge": True}
    entry["candidate_id"] = candidate_id(1, scope, QUESTION)
    path = tmp_path / "batch.json"
    request_path = request_directory(path) / (entry["candidate_id"] + ".json")
    request_path.parent.mkdir()
    request = build_request(entry["candidate_id"], scope, QUESTION, sources, evidence)
    request_path.write_text(json.dumps(request))
    entry["external_judge_request"] = {"path": str(request_path.relative_to(path.parent)),
        "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest()}
    payload = {"cert_id": scope["cert_id"], "plan": [scope], "candidates": [entry],
               "model": "codex", "judge_model": "external", "external_judge_version": 1,
               "difficulty": "MEDIUM", "exam": "cloud-engineer", "generation_runs": {}}
    path.write_text(json.dumps(payload))
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    raw = {"verdict": "PASS", **{key: True for key in ACCURACY_CHECKS},
           "score": .9, "reason": "Synthetic verdict for persistence contract only"}
    (verdict_dir / (entry["candidate_id"] + ".json")).write_text(json.dumps(raw))
    client = Mock()
    client.get_domain_by_code.return_value = {"id": "seeded-domain"}
    client.create_generation_run.side_effect = lambda row: {"id": row["id"]}
    client.insert_question.side_effect = lambda row: {"id": row["id"]}
    client.insert_answers_batch.return_value = [{"id": str(i)} for i in range(4)]
    client.insert_explanation.return_value = {"id": "synthetic-explanation"}
    client.update_question_review.return_value = True
    client.update_generation_run.return_value = True
    factory = Mock(return_value=client)
    monkeypatch.setattr(ingest, "database_client", factory)
    # Every LM adapter is forbidden, even if environment credentials happen to exist.
    monkeypatch.setattr("dspy.LM", Mock(side_effect=AssertionError("No live LM")))
    monkeypatch.setattr("shared.cli_models.run_signature", Mock(side_effect=AssertionError("No live CLI")))
    return path, verdict_dir, payload, client, factory, raw, request_path


def invoke(case, *flags):
    return CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), *flags])


def saved(case):
    return json.loads(case[0].read_text())


def save_input(case):
    case[0].write_text(json.dumps(case[2]))


def test_dry_run_exact_schema_decision_raw_provenance_and_no_client(case):
    result = invoke(case, "--dry-run")
    assert result.exit_code == 0, result.output
    case[4].assert_not_called()
    entry = saved(case)["candidates"][0]
    assert entry["external_verdict"] == case[5]
    assert entry["judge_verdict"]["passed"]
    assert entry["judge_verdict"]["model"] == EXTERNAL_JUDGE_PROVENANCE
    assert not entry["accepted"]
    assert "persistence_status" not in entry and "inserted_question_id" not in entry
    assert saved(case)["generation_runs"] == {}


def test_persists_passing_only_with_durable_callbacks_and_reuses_run(case):
    path, _, _, client, _, _, _ = case
    def insert(row):
        journal = saved(case)
        assert journal["candidates"][0]["persistence_status"] == "inserting"
        assert journal["generation_runs"]
        assert row["status"] == "DRAFT"
        assert json.loads(row["review_notes"])["grounding"]["judge_model"] == EXTERNAL_JUDGE_PROVENANCE
        return {"id": row["id"]}
    def answers(rows):
        entry = saved(case)["candidates"][0]
        assert entry["persistence_status"] == "inserted"
        assert entry["inserted_question_id"] == entry["candidate_id"]
        return [{"id": str(i)} for i in range(4)]
    client.insert_question.side_effect = insert
    client.insert_answers_batch.side_effect = answers
    first = invoke(case)
    assert first.exit_code == 0, first.output
    entry = saved(case)["candidates"][0]
    assert entry["persistence_status"] == "complete" and entry["accepted"]
    assert client.update_question_review.call_args.args[2] == "GOOD"
    assert client.update_generation_run.call_args.args[1]["generated_count"] == 1
    second = invoke(case)
    assert second.exit_code == 0, second.output
    assert client.insert_question.call_count == client.create_generation_run.call_count == 1


@pytest.mark.parametrize("failure", ["missing", "wrapper", "omitted", "uncertain", "low", "false", "string_bool", "extra", "duplicate"])
def test_missing_malformed_or_failed_verdict_never_constructs_client(case, failure):
    verdict = case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")
    raw = case[5].copy()
    if failure == "missing": verdict.unlink()
    elif failure == "wrapper": raw = {"structured_output": raw}
    elif failure == "omitted": del raw["business_context"]
    elif failure == "uncertain": raw["verdict"] = "UNCERTAIN"
    elif failure == "low": raw["score"] = .79
    elif failure == "false": raw["evidence_supported"] = False
    elif failure == "string_bool": raw["business_context"] = "true"
    elif failure == "extra": raw["unexpected"] = 1
    if failure == "duplicate": verdict.write_text('{"verdict":"PASS","verdict":"PASS"}')
    elif failure != "missing": verdict.write_text(json.dumps(raw))
    result = invoke(case)
    assert result.exit_code == 1
    case[4].assert_not_called()
    assert not saved(case)["candidates"][0]["accepted"]
    assert "missing 1" in result.output if failure == "missing" else "rejected 1" in result.output


@pytest.mark.parametrize("change", ["question", "quote", "receipt_hash", "source", "source_and_hash", "scope", "request", "schema", "hash", "path", "duplicate_id", "unsafe_id", "duplicate_index", "same_vendor"])
def test_tampered_or_stale_artifacts_fail_closed(case, change):
    payload, entry = case[2], case[2]["candidates"][0]
    if change == "question": entry["stem"] = entry["stem"].replace("retailer", "manufacturer")
    elif change == "quote": entry["evidence"][0]["quote"] = "Not fetched"
    elif change == "receipt_hash": entry["evidence"][0]["text_sha256"] = "0" * 64
    elif change == "source": entry["sources"][0]["text"] += "Changed"
    elif change == "source_and_hash":
        entry["sources"][0]["text"] += "Changed"
        entry["sources"][0]["text_sha256"] = hashlib.sha256(entry["sources"][0]["text"].encode()).hexdigest()
        for receipt in entry["evidence"]: receipt["text_sha256"] = entry["sources"][0]["text_sha256"]
    elif change == "scope": payload["plan"][0]["domain_prompt"] += "Changed scope"
    elif change in ("request", "schema"):
        request = json.loads(case[6].read_text())
        if change == "request": request["judge_prompt"] += "Change the decision"
        else: request["verdict_schema"] = {}
        case[6].write_text(json.dumps(request))
        entry["external_judge_request"]["sha256"] = hashlib.sha256(case[6].read_bytes()).hexdigest()
    elif change == "hash": entry["external_judge_request"]["sha256"] = "0" * 64
    elif change == "path": entry["external_judge_request"]["path"] = "../unsafe.json"
    elif change == "duplicate_id": payload["candidates"].append(entry.copy())
    elif change == "unsafe_id": entry["candidate_id"] = "../unsafe"
    elif change == "duplicate_index": payload["candidates"].append({**entry, "candidate_id": "other"})
    elif change == "same_vendor": payload["model"] = "claude"
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 1, result.output
    case[4].assert_not_called()


@pytest.mark.parametrize("stage", ["answers", "explanation", "finalize", "insert_throw", "insert_none"])
def test_partial_and_unknown_inserts_cannot_automatically_retry(case, stage):
    client = case[3]
    if stage == "answers": client.insert_answers_batch.return_value = []
    elif stage == "explanation": client.insert_explanation.return_value = None
    elif stage == "finalize": client.update_question_review.return_value = False
    elif stage == "insert_throw": client.insert_question.side_effect = RuntimeError("PRIVATE_PROVIDER_KEY")
    else: client.insert_question.side_effect = lambda row: None
    first = invoke(case)
    assert first.exit_code == 1
    entry = saved(case)["candidates"][0]
    assert entry["persistence_status"] == ("unknown" if stage.startswith("insert_") else "failed_partial")
    assert not entry["accepted"]
    assert "PRIVATE_PROVIDER_KEY" not in first.output + case[0].read_text()
    second = invoke(case)
    assert second.exit_code == 1
    assert client.insert_question.call_count == 1
    assert client.update_generation_run.call_args.args[1]["generated_count"] == 0


@pytest.mark.parametrize("state", ["inserting", "inserted", "complete", "failed_partial", "unknown", "unexpected"])
def test_saved_journal_states_never_reinsert(case, state):
    case[2]["candidates"][0]["persistence_status"] = state
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 1
    case[3].insert_question.assert_not_called()


def test_inserted_id_without_status_blocks_retry(case):
    case[2]["candidates"][0]["inserted_question_id"] = "possibly-written"
    save_input(case)
    assert invoke(case).exit_code == 1
    case[3].insert_question.assert_not_called()


def test_lock_refuses_concurrent_ingestion_before_client(case):
    lock = case[0].with_suffix(".json.lock")
    with lock.open("a") as held:
        fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = invoke(case)
        assert result.exit_code == 1 and "already locked" in result.output
        case[4].assert_not_called()


@pytest.mark.parametrize("failure", ["client", "domain", "run", "completion"])
def test_setup_and_completion_errors_are_safe(case, failure):
    if failure == "client": case[4].side_effect = RuntimeError("PRIVATE_PROVIDER_KEY")
    elif failure == "domain": case[3].get_domain_by_code.return_value = None
    elif failure == "run": case[3].create_generation_run.side_effect = RuntimeError("PRIVATE_PROVIDER_KEY")
    else: case[3].update_generation_run.side_effect = RuntimeError("PRIVATE_PROVIDER_KEY")
    result = invoke(case)
    assert result.exit_code == 1 and "PRIVATE_PROVIDER_KEY" not in result.output
    if failure != "completion": case[3].insert_question.assert_not_called()
    else:
        assert saved(case)["candidates"][0]["persistence_status"] == "complete"
        again = invoke(case)
        assert again.exit_code == 1 and case[3].insert_question.call_count == 1


def test_all_domains_resolved_before_creating_runs(case):
    extra = next(scope for scope in plan_questions("cloud-engineer", 8, seed=0)
                 if scope["domain_code"] != case[2]["plan"][0]["domain_code"])
    # Extra planned candidate need not yet have a verdict to block unseeded-domain writes.
    case[2]["plan"].append(extra)
    save_input(case)
    case[3].get_domain_by_code.side_effect = [{"id": "seeded"}, None]
    result = invoke(case)
    assert result.exit_code == 1, result.output
    case[3].create_generation_run.assert_not_called()
    case[3].insert_question.assert_not_called()


def test_created_run_is_saved_before_insert_failure_and_reused(case):
    case[3].insert_question.side_effect = RuntimeError("unknown write")
    assert invoke(case).exit_code == 1
    assert saved(case)["generation_runs"]
    assert invoke(case).exit_code == 1
    assert case[3].create_generation_run.call_count == 1


@pytest.mark.parametrize("stage", ["inserting", "inserted"])
def test_process_interrupt_preserves_journal_and_blocks_rerun(case, stage):
    if stage == "inserting": case[3].insert_question.side_effect = KeyboardInterrupt()
    else: case[3].insert_answers_batch.side_effect = KeyboardInterrupt()
    assert invoke(case).exit_code != 0
    entry = saved(case)["candidates"][0]
    assert entry["persistence_status"] == stage
    assert invoke(case).exit_code == 1
    assert case[3].insert_question.call_count == 1


def test_completed_content_tampering_blocks_counts_and_never_reinserts(case):
    assert invoke(case).exit_code == 0
    payload = saved(case)
    payload["candidates"][0]["stem"] = "Altered after insert?"
    case[0].write_text(json.dumps(payload))
    assert invoke(case).exit_code == 1
    assert case[3].insert_question.call_count == 1
    assert case[3].update_generation_run.call_args.args[1]["generated_count"] == 0
    assert saved(case)["candidates"][0]["persistence_validation_failed"]


def test_stale_accepted_flag_is_not_a_dry_run_persistence_result(case):
    case[2]["candidates"][0]["accepted"] = True
    save_input(case)
    assert invoke(case, "--dry-run").exit_code == 0
    assert not saved(case)["candidates"][0]["accepted"]
    case[4].assert_not_called()


def test_version_and_external_model_are_required(case):
    case[2]["external_judge_version"] = 2
    save_input(case)
    assert invoke(case).exit_code == 1
    case[4].assert_not_called()


def test_completed_stems_block_pending_duplicates_even_when_reordered(case):
    assert invoke(case).exit_code == 0
    payload = saved(case)
    original = payload["candidates"][0]
    extra = {**original, "index": 2, "candidate_id": candidate_id(2, payload["plan"][0], QUESTION),
             "accepted": False, "status": "awaiting_external_judge", "awaiting_external_judge": True}
    for field in ("persistence_status", "inserted_question_id", "external_verdict", "judge_verdict"):
        extra.pop(field, None)
    payload["plan"].append(payload["plan"][0].copy())
    request_path = request_directory(case[0]) / (extra["candidate_id"] + ".json")
    request_path.write_text(json.dumps(build_request(extra["candidate_id"], payload["plan"][1], QUESTION,
                                                     extra["sources"], extra["evidence"])))
    extra["external_judge_request"] = {"path": str(request_path.relative_to(case[0].parent)),
        "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest()}
    payload["candidates"].insert(0, extra)
    case[0].write_text(json.dumps(payload))
    (case[1] / (extra["candidate_id"] + ".json")).write_text(json.dumps(case[5]))
    assert invoke(case).exit_code == 1
    assert case[3].insert_question.call_count == 1
    assert not saved(case)["candidates"][0]["accepted"]


@pytest.mark.parametrize("failure", ["missing", "malformed_json", "schema"])
def test_dry_run_pass_cannot_leave_stale_pass_on_failed_current_verdict(case, failure):
    assert invoke(case, "--dry-run").exit_code == 0
    assert saved(case)["candidates"][0]["judge_verdict"]["passed"]
    verdict = case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")
    if failure == "missing": verdict.unlink()
    elif failure == "malformed_json": verdict.write_text("{not JSON}")
    else: verdict.write_text(json.dumps({"structured_output": case[5]}))
    assert invoke(case, "--dry-run").exit_code == 1
    entry = saved(case)["candidates"][0]
    assert not entry["judge_verdict"]["passed"] and entry["judge_verdict"]["score"] == 0
    assert not entry["accepted"]
    assert entry["judge_verdict"]["model"] == EXTERNAL_JUDGE_PROVENANCE
    if failure == "schema": assert entry["external_verdict"] == {"structured_output": case[5]}
    else: assert "external_verdict" not in entry
    case[4].assert_not_called()


@pytest.mark.parametrize("failure", ["none", "raise", "interrupt", "post_create_flush"])
def test_unknown_run_creation_is_journaled_and_never_retried(case, failure, monkeypatch):
    client = case[3]
    def create(row):
        record = saved(case)["external_run_journal"][row["domain_code"]]
        assert record == {"status": "creating", "run_id": row["id"]}
        if failure == "none": return None
        if failure == "raise": raise RuntimeError("PRIVATE_PROVIDER_KEY")
        if failure == "interrupt": raise KeyboardInterrupt()
        return {"id": row["id"]}
    client.create_generation_run.side_effect = create
    if failure == "post_create_flush":
        flush = ingest._flush
        calls = 0
        def fail_once(path, payload):
            nonlocal calls
            calls += 1
            flush(path, payload)
            if calls == 3: raise OSError("PRIVATE_FILESYSTEM_DETAIL")
        monkeypatch.setattr(ingest, "_flush", fail_once)
    first = invoke(case)
    assert first.exit_code != 0
    assert "PRIVATE" not in first.output
    payload = saved(case)
    record = next(iter(payload["external_run_journal"].values()))
    assert record["status"] == ("creating" if failure == "interrupt" else "unknown")
    assert not payload["generation_runs"]
    assert invoke(case).exit_code == 1
    assert client.create_generation_run.call_count == 1
    client.insert_question.assert_not_called()


def test_run_journal_records_matching_created_id_before_questions(case):
    def insert(row):
        payload = saved(case)
        code = payload["plan"][0]["domain_code"]
        assert payload["external_run_journal"][code] == {
            "status": "created", "run_id": row["generation_run_id"]}
        assert row["generation_run_id"] == ingest._run_id(payload, code)
        assert row["id"] == payload["candidates"][0]["candidate_id"]
        return {"id": row["id"]}
    case[3].insert_question.side_effect = insert
    assert invoke(case).exit_code == 0


def test_prewrite_artifact_copy_hits_existing_run_primary_key_not_duplicate_rows(case):
    import shutil
    snapshot = case[0].read_bytes()
    copy_dir = case[0].parent / "copy"
    copy_dir.mkdir()
    copied = copy_dir / case[0].name
    copied.write_bytes(snapshot)
    shutil.copytree(request_directory(case[0]), request_directory(copied))
    runs, questions = set(), set()
    def create_run(row):
        if row["id"] in runs: raise ValueError("Simulated unique primary key")
        runs.add(row["id"])
        return {"id": row["id"]}
    def insert_question(row):
        if row["id"] in questions: raise ValueError("Simulated unique primary key")
        questions.add(row["id"])
        return {"id": row["id"]}
    case[3].create_generation_run.side_effect = create_run
    case[3].insert_question.side_effect = insert_question
    assert invoke(case).exit_code == 0
    second = CliRunner().invoke(ingest.main, ["--artifact", str(copied), "--verdicts", str(case[1])])
    assert second.exit_code == 1
    assert len(runs) == len(questions) == 1
    assert case[3].insert_question.call_count == 1
    assert next(iter(json.loads(copied.read_text())["external_run_journal"].values()))["status"] == "unknown"
    third = CliRunner().invoke(ingest.main, ["--artifact", str(copied), "--verdicts", str(case[1])])
    assert third.exit_code == 1
    assert case[3].create_generation_run.call_count == 2


@pytest.mark.parametrize("target", ["run", "question"])
def test_unexpected_returned_ids_remain_unknown_or_partial_and_block_retry(case, target):
    unexpected = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    if target == "run": case[3].create_generation_run.side_effect = lambda row: {"id": unexpected}
    else: case[3].insert_question.side_effect = lambda row: {"id": unexpected}
    assert invoke(case).exit_code == 1
    payload = saved(case)
    if target == "run":
        assert next(iter(payload["external_run_journal"].values()))["status"] == "unknown"
        case[3].insert_question.assert_not_called()
    else:
        entry = payload["candidates"][0]
        assert entry["persistence_status"] == "failed_partial"
        assert entry["inserted_question_id"] == unexpected
        assert not entry["accepted"]
        case[3].insert_answers_batch.assert_not_called()
    assert invoke(case).exit_code == 1
    assert case[3].create_generation_run.call_count == 1
    assert case[3].insert_question.call_count == (0 if target == "run" else 1)
