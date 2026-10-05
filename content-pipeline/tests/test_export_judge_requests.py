"""Offline request repair contracts; synthetic verdicts are not live judge proof."""
from copy import deepcopy
import fcntl
import hashlib
import json
import os
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import export_judge_requests as export
from scripts import ingest_external_verdicts as ingest
from scripts import judge_requests as runner
from shared.external_judge import REQUEST_CHARACTER_LIMIT, build_request, candidate_id, request_directory
from test_external_ingest import case, save_input, saved


@pytest.fixture(autouse=True)
def forbid_live_calls(monkeypatch):
    for name in ("generate_question", "cite_question", "clean_question", "search_objective_docs", "database_client"):
        monkeypatch.setattr("scripts.generate_pmle_questions." + name,
                            Mock(side_effect=AssertionError("No generation, retrieval, cleaning or DB")))
    monkeypatch.setattr("shared.cli_models.run_claude_request", Mock(side_effect=AssertionError("No live judge")))
    monkeypatch.setattr("dotenv.load_dotenv", Mock(side_effect=AssertionError("No env files")))


def invoke(case, *flags):
    return CliRunner().invoke(export.main, ["--artifact", str(case[0]), *map(str, flags)])


def snapshot(case):
    return case[0].read_bytes(), case[6].read_bytes()


def request_path(case):
    return case[0].parent / saved(case)["candidates"][0]["external_judge_request"]["path"]


def grow_source(case, length):
    source = case[2]["candidates"][0]["sources"][0]
    source["text"] += " padding" * (length // 8)
    source["text_sha256"] = hashlib.sha256(source["text"].encode()).hexdigest()
    for receipt in case[2]["candidates"][0]["evidence"]:
        receipt["text_sha256"] = source["text_sha256"]
    save_input(case)


@pytest.mark.parametrize("custom", [False, True])
def test_exact_serialization_metadata_ingestion_and_unchanged_frozen_data(case, custom):
    before = deepcopy(case[2])
    before["extra"] = {"preserve": ["unicode café", {"unused": True}]}
    before["candidates"][0]["external_judge_request"]["extra"] = "preserve"
    case[2].update(before)
    save_input(case)
    out = case[0].parent / "nested" / "custom" if custom else request_directory(case[0])
    result = invoke(case, *(["--out", out] if custom else []))
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["count"] == 1 and summary["trimmed"] == 0
    entry = saved(case)["candidates"][0]
    path = request_path(case)
    expected = build_request(entry["candidate_id"], before["plan"][0], export.candidate_question(entry),
                             entry["sources"], entry["evidence"])
    raw = (json.dumps(expected, ensure_ascii=False, allow_nan=False, indent=2) + "\n").encode()
    assert path == out / (entry["candidate_id"] + ".json")
    assert path.read_bytes() == raw
    assert entry["external_judge_request"]["sha256"] == hashlib.sha256(raw).hexdigest()
    assert summary["min_chars"] == summary["p50_chars"] == summary["p95_chars"] == summary["max_chars"] == len(raw.decode())
    restored = saved(case)
    restored["candidates"][0]["external_judge_request"] = before["candidates"][0]["external_judge_request"]
    assert restored == before
    # Export never creates conventional verdict directories.
    assert not case[0].with_name(case[0].stem + ".verdicts").exists()
    dry = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert dry.exit_code == 0, dry.output
    case[4].assert_not_called()


@pytest.mark.parametrize("length,trimmed", [(70000, 0), (220000, 1)])
def test_new_limit_full_first_then_wide_trim(case, length, trimmed):
    assert REQUEST_CHARACTER_LIMIT == runner.REQUEST_CHARACTER_LIMIT == 150000
    grow_source(case, length)
    original = deepcopy(case[2])
    result = invoke(case)
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["trimmed"] == trimmed
    assert summary["max_chars"] <= 150000
    if not trimmed:
        assert summary["max_chars"] > 60000
    else:
        request = json.loads(request_path(case).read_text())
        assert request["trimming"]["enabled"]
        assert request["trimming"]["sources"][0]["margin"] == 8000
    original["candidates"][0]["external_judge_request"] = saved(case)["candidates"][0]["external_judge_request"]
    assert saved(case) == original


@pytest.mark.parametrize("change", ["duplicate_id", "duplicate_index", "unsafe_id", "question", "receipt", "source", "scope", "schema", "version", "mode", "same_vendor", "bad_index"])
def test_malformed_inputs_do_not_replace_outputs(case, change):
    payload = case[2]
    entry = payload["candidates"][0]
    if change == "duplicate_id": payload["candidates"].append(deepcopy(entry))
    elif change == "duplicate_index": payload["candidates"].append({**entry, "candidate_id": "other"})
    elif change == "unsafe_id": entry["candidate_id"] = "../unsafe"
    elif change == "question": entry["stem"] += " altered"
    elif change == "receipt": entry["evidence"][0]["quote"] = "Not fetched"
    elif change == "source": entry["sources"][0]["text"] += " altered"
    elif change == "scope": payload["plan"][0]["domain_prompt"] += " altered"
    elif change == "schema": entry["key"] = "B"
    elif change == "version": payload["external_judge_version"] = True
    elif change == "mode": payload["judge_model"] = "claude"
    elif change == "same_vendor": payload["model"] = "claude"
    else: entry["index"] = 0
    save_input(case)
    before = snapshot(case)
    result = invoke(case, "--force")
    assert result.exit_code == 1, result.output
    assert snapshot(case) == before
    case[4].assert_not_called()


@pytest.mark.parametrize("state", ["inserting", "inserted", "complete", "failed_partial", "unknown", "unexpected", ""])
def test_force_never_bypasses_candidate_database_state(case, state):
    case[2]["candidates"][0]["persistence_status"] = state
    save_input(case)
    before = snapshot(case)
    result = invoke(case, "--force")
    assert result.exit_code == 1 and "reconciliation" in result.output
    assert snapshot(case) == before


@pytest.mark.parametrize("change", ["inserted_id", "accepted", "active", "runs", "unknown_run", "invalid_run"])
def test_force_never_bypasses_other_database_journals(case, change):
    entry = case[2]["candidates"][0]
    if change == "inserted_id": entry["inserted_question_id"] = "possibly-written"
    elif change == "accepted": entry["accepted"] = True
    elif change == "active": entry["status"] = "ACTIVE"
    elif change == "runs": case[2]["generation_runs"] = {"domain": "run"}
    elif change == "unknown_run": case[2]["external_run_journal"] = {"domain": {"status": "unknown"}}
    else: case[2]["external_run_journal"] = []
    save_input(case)
    before = snapshot(case)
    assert invoke(case, "--force").exit_code == 1
    assert snapshot(case) == before


@pytest.mark.parametrize("kind", ["artifact", "counterpart", "custom_suffix", "raw_out"])
def test_verdict_refusal_then_force_archives_bytes(case, kind):
    out = case[0].parent / "nested" / ("wide.judge-requests" if kind == "counterpart" else "custom")
    if kind == "artifact": directory = case[0].with_name(case[0].stem + ".verdicts")
    elif kind == "counterpart": directory = out.with_name("wide.verdicts")
    elif kind == "custom_suffix": directory = out.with_name(out.name + ".verdicts")
    else: directory = out
    directory.mkdir(parents=True)
    ident = case[2]["candidates"][0]["candidate_id"]
    verdict = directory / (ident + ".json")
    raw = json.dumps(case[5]).encode()
    verdict.write_bytes(raw)
    before = snapshot(case)
    denied = invoke(case, "--out", out)
    assert denied.exit_code == 1 and "--force" in denied.output
    assert snapshot(case) == before and verdict.read_bytes() == raw
    result = invoke(case, "--out", out, "--force")
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["archived_verdicts"] == 1
    archive = case[0].parent / summary["quarantine_paths"][0] / verdict.name
    assert archive.read_bytes() == raw
    if kind != "raw_out": assert not verdict.exists()
    else: assert "judge_prompt" in json.loads(verdict.read_text())
    assert not list(directory.glob("*.json")) if kind != "raw_out" else True


def test_force_rejudges_previous_dry_run_and_preserves_nonjudge_fields(case):
    dry = CliRunner().invoke(ingest.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]), "--dry-run"])
    assert dry.exit_code == 0
    prior = saved(case)
    assert prior["candidates"][0]["awaiting_external_judge"] is False
    assert invoke(case).exit_code == 1
    result = invoke(case, "--force", "--verdicts", case[1])
    assert result.exit_code == 0, result.output
    assert not list(case[1].glob("*.json"))
    entry = saved(case)["candidates"][0]
    assert entry["status"] == "awaiting_external_judge" and entry["awaiting_external_judge"] is True
    assert not entry["accepted"] and not entry["judge_verdict"]["passed"]
    assert "external_verdict" not in entry
    for key in ("sources", "evidence", "stem", "options", "rationales", "candidate_id", "index", "grounding"):
        assert entry[key] == prior["candidates"][0][key]
    assert saved(case)["generation_runs"] == prior["generation_runs"] == {}
    case[4].assert_not_called()


def test_early_rejects_are_skipped_without_question_regeneration(case):
    payload = case[2]
    from shared.cert_context import plan_questions
    second = plan_questions(payload["cert_id"], 2, objective_ids=[payload["plan"][0]["objective_id"]])[1]
    payload["plan"].append(second)
    scope = payload["plan"][1]
    reject = {**{key: scope[key] for key in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment", "opening_style", "question_line")},
              "index": 2, "candidate_id": candidate_id(2, scope, {}), "accepted": False,
              "stem": None, "options": [], "failure_stage": "generation", "reason": "Synthetic reject"}
    payload["candidates"].append(reject)
    save_input(case)
    result = invoke(case)
    assert result.exit_code == 0, result.output
    assert json.loads(result.output)["count"] == 1
    assert saved(case)["candidates"][1] == reject
    assert not (request_directory(case[0]) / (reject["candidate_id"] + ".json")).exists()


def test_all_builds_finish_before_any_request_is_replaced(case):
    payload = case[2]
    from shared.cert_context import plan_questions
    second = plan_questions(payload["cert_id"], 2, objective_ids=[payload["plan"][0]["objective_id"]])[1]
    payload["plan"].append(second)
    other = deepcopy(payload["candidates"][0])
    other.update({key: second[key] for key in ("scenario_moment", "opening_style", "question_line")})
    other["index"] = 2
    other["candidate_id"] = candidate_id(2, payload["plan"][1], export.candidate_question(other))
    other["sources"][0]["text_sha256"] = "0" * 64
    payload["candidates"].append(other)
    save_input(case)
    before = snapshot(case)
    assert invoke(case).exit_code == 1
    assert snapshot(case) == before
    assert not (case[6].parent / (other["candidate_id"] + ".json")).exists()


@pytest.mark.parametrize("lock_kind", ["artifact", "verdicts"])
def test_locks_refuse_concurrent_ingest_or_runner(case, lock_kind):
    if lock_kind == "artifact": lock = case[0].with_suffix(".json.lock")
    else:
        directory = case[0].with_name(case[0].stem + ".verdicts")
        directory.mkdir()
        lock = directory / ".judge-requests.lock"
    before = snapshot(case)
    with lock.open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = invoke(case)
        assert result.exit_code == 1 and "locked" in result.output
    assert snapshot(case) == before


@pytest.mark.parametrize("kind", ["outside", "parent", "symlink", "file"])
def test_custom_output_must_be_safe_directory_beneath_parent(case, kind):
    out = case[0].parent / "custom"
    if kind == "outside": out = case[0].parent.parent / "outside"
    elif kind == "parent": out = case[0].parent
    elif kind == "symlink": out.symlink_to(case[6].parent, target_is_directory=True)
    else: out.write_text("not a directory")
    before = snapshot(case)
    assert invoke(case, "--out", out).exit_code == 1
    assert snapshot(case) == before


def test_unrelated_mixed_json_is_not_deleted_even_with_force(case):
    mixed = case[6].parent / "unrelated.json"
    mixed.write_text(json.dumps(case[5]))
    before = snapshot(case)
    assert invoke(case, "--force").exit_code == 1
    assert snapshot(case) == before and mixed.exists()


def test_crash_before_artifact_flush_fails_closed_and_rerun_repairs(case, monkeypatch):
    before = case[0].read_bytes()
    original = ingest._flush
    monkeypatch.setattr(ingest, "_flush", Mock(side_effect=OSError("PRIVATE_FILESYSTEM_DETAIL")))
    result = invoke(case)
    assert result.exit_code == 1 and "PRIVATE" not in result.output
    assert case[0].read_bytes() == before
    with pytest.raises(ValueError, match="hash mismatch"):
        ingest._validate_candidate(case[0], saved(case), saved(case)["candidates"][0])
    monkeypatch.setattr(ingest, "_flush", original)
    assert invoke(case).exit_code == 0
    ingest._validate_candidate(case[0], saved(case), saved(case)["candidates"][0])
    case[4].assert_not_called()


@pytest.mark.parametrize("custom", [False, True])
def test_held_original_request_lock_blocks_export_even_to_custom_out(case, custom):
    lock = case[6].parent / ".judge-requests.lock"
    before = snapshot(case)
    out = case[0].parent / "new-custom"
    with lock.open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = invoke(case, *(["--out", out] if custom else []))
        assert result.exit_code == 1 and "locked" in result.output
    assert snapshot(case) == before
    assert not out.exists()
    assert not case[0].with_name(case[0].stem + ".verdicts").exists()


def test_request_locks_precede_verdict_locks(case, monkeypatch):
    from contextlib import contextmanager
    directory = case[0].with_name(case[0].stem + ".verdicts")
    directory.mkdir()
    order = []
    original = runner.batch_lock
    @contextmanager
    def recorded(path):
        order.append(path)
        with original(path):
            yield
    monkeypatch.setattr(runner, "batch_lock", recorded)
    result = invoke(case)
    assert result.exit_code == 0, result.output
    assert order.index(case[6].parent) < order.index(directory)


@pytest.mark.parametrize("move", [False, True])
def test_fake_runner_custom_registry_blocks_and_force_requires_new_calls(case, monkeypatch, move):
    assert invoke(case).exit_code == 0
    custom_verdicts = case[0].parent / "arbitrary-manual-results"
    fake = Mock(return_value=case[5].copy())
    monkeypatch.setattr("shared.cli_models.run_claude_request", fake)
    first = runner.run_requests(case[6].parent, custom_verdicts, parallel=1)
    assert first.completed == 1 and fake.call_count == 1
    registry = case[6].parent / ".verdict-directories.json"
    assert json.loads(registry.read_text()) == {"version": 1, "directories": [str(custom_verdicts)]}
    before = snapshot(case)
    out = case[0].parent / "new-requests" if move else case[6].parent
    denied = invoke(case, "--out", out)
    assert denied.exit_code == 1 and "--force" in denied.output
    assert snapshot(case) == before
    result = invoke(case, "--out", out, "--force")
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["archived_verdicts"] == 1
    ident = case[2]["candidates"][0]["candidate_id"]
    archive = case[0].parent / summary["quarantine_paths"][0] / (ident + ".json")
    assert json.loads(archive.read_text()) == case[5]
    assert not (custom_verdicts / (ident + ".json")).exists()
    if move:
        assert summary["retired_requests"] == 1
        old_archive = case[0].parent / summary["request_quarantine_paths"][0] / case[6].name
        assert old_archive.read_bytes() == before[1]
        assert not case[6].exists()
        old_run = runner.run_requests(case[6].parent, custom_verdicts, parallel=1)
        assert old_run.completed == old_run.skipped == old_run.remaining == 0
        assert fake.call_count == 1
    else:
        assert summary["retired_requests"] == 0
    second = runner.run_requests(out, custom_verdicts, parallel=1)
    assert second.completed == 1 and second.skipped == 0 and fake.call_count == 2
    case[4].assert_not_called()


def test_explicit_historical_verdict_directory_refuses_then_archives(case):
    before = snapshot(case)
    denied = invoke(case, "--verdicts", case[1])
    assert denied.exit_code == 1 and "--force" in denied.output
    assert snapshot(case) == before
    result = invoke(case, "--verdicts", case[1], "--force")
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["archived_verdicts"] == 1
    assert not list(case[1].glob("*.json"))


def test_any_associated_verdict_blocks_no_force_but_unrelated_results_survive_force(case):
    directory = case[0].with_name(case[0].stem + ".verdicts")
    directory.mkdir()
    unrelated = directory / "other-candidate.json"
    unrelated.write_text(json.dumps(case[5]))
    before = snapshot(case)
    assert invoke(case).exit_code == 1
    assert snapshot(case) == before
    result = invoke(case, "--force")
    assert result.exit_code == 0, result.output
    assert json.loads(result.output)["archived_verdicts"] == 0
    assert unrelated.exists()


@pytest.mark.parametrize("force", [False, True])
def test_unexpected_request_files_require_clean_output_not_auto_delete(case, force):
    extra = case[6].parent / "unrelated-candidate.json"
    data = json.loads(case[6].read_text())
    data["candidate_id"] = extra.stem
    extra.write_text(json.dumps(data))
    before = snapshot(case)
    result = invoke(case, *(["--force"] if force else []))
    assert result.exit_code == 1 and "clean directory" in result.output
    assert snapshot(case) == before and extra.exists()


@pytest.mark.parametrize("kind", ["extra", "version", "duplicate_key", "relative", "outside", "symlink", "directories_type", "fifo", "directory"])
def test_invalid_registries_fail_closed_before_creating_custom_output(case, kind):
    registry = case[6].parent / ".verdict-directories.json"
    data = {"version": 1, "directories": []}
    if kind == "extra": data["extra"] = True
    elif kind == "version": data["version"] = True
    elif kind == "relative": data["directories"] = ["relative"]
    elif kind == "outside": data["directories"] = [str(case[0].parent.parent / "outside")]
    elif kind == "directories_type": data["directories"] = {}
    if kind == "duplicate_key": registry.write_text('{"version":1,"version":1,"directories":[]}')
    elif kind == "symlink": registry.symlink_to(case[0])
    elif kind == "fifo": os.mkfifo(registry)
    elif kind == "directory": registry.mkdir()
    else: registry.write_text(json.dumps(data))
    before = snapshot(case)
    out = case[0].parent / "new-custom"
    result = invoke(case, "--out", out, "--force")
    assert result.exit_code == 1
    assert snapshot(case) == before and not out.exists()


def test_explicit_verdict_directory_outside_artifact_parent_is_blocked(case):
    before = snapshot(case)
    assert invoke(case, "--verdicts", case[0].parent.parent / "outside", "--force").exit_code == 1
    assert snapshot(case) == before


def test_registered_custom_verdict_lock_blocks_export(case):
    custom = case[0].parent / "custom-results"
    custom.mkdir()
    registry = case[6].parent / ".verdict-directories.json"
    registry.write_text(json.dumps({"version": 1, "directories": [str(custom)]}))
    before = snapshot(case)
    with (custom / ".judge-requests.lock").open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = invoke(case, "--force")
        assert result.exit_code == 1 and "locked" in result.output
    assert snapshot(case) == before


def test_custom_move_retirement_crash_fails_closed_and_rerun_repairs(case, monkeypatch):
    old_artifact, old_request = snapshot(case)
    out = case[0].parent / "new-requests"
    original = ingest._flush
    monkeypatch.setattr(ingest, "_flush", Mock(side_effect=OSError("PRIVATE_DETAIL")))
    result = invoke(case, "--out", out)
    assert result.exit_code == 1 and "PRIVATE" not in result.output
    assert case[0].read_bytes() == old_artifact and not case[6].exists()
    retired = list(case[6].parent.glob(".export-quarantine-*/" + case[6].name))
    assert len(retired) == 1 and retired[0].read_bytes() == old_request
    assert (out / case[6].name).exists()
    with pytest.raises((OSError, ValueError)):
        ingest._validate_candidate(case[0], saved(case), saved(case)["candidates"][0])
    monkeypatch.setattr(ingest, "_flush", original)
    repaired = invoke(case, "--out", out)
    assert repaired.exit_code == 0, repaired.output
    assert json.loads(repaired.output)["retired_requests"] == 0
    assert request_path(case) == out / case[6].name
    ingest._validate_candidate(case[0], saved(case), saved(case)["candidates"][0])
    case[4].assert_not_called()


def test_reexport_schema_requires_new_knowledge_check(case):
    result=invoke(case)
    assert result.exit_code==0,result.output
    schema=json.loads(request_path(case).read_text())["verdict_schema"]
    assert len(schema["properties"])==15
    assert "distractors_need_knowledge" in schema["required"]
    assert schema["properties"]["distractors_need_knowledge"]["type"]=="boolean"
