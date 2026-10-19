"""Saved-generation judge-only resume, synthetic offline regression tests."""
from copy import deepcopy
import hashlib
import json
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import click
import pytest

from scripts import variants_ab, generate_variants, export_judge_requests as exporter
from shared.external_judge import request_directory
from test_variants import parents, variant_for, verdict_for


@pytest.fixture
def generated(parents, tmp_path, monkeypatch):
    artifact, bank, payload, _ = parents
    path = tmp_path / "saved.json"
    generated = generate_variants.generate([artifact], [payload["candidates"][0]["candidate_id"]], bank,
        path, variants_per_parent=1, enable_variants=True, predictor=variant_for)
    calls = path.with_suffix(".json.calls.jsonl")
    calls.write_text('{"stage":"variant_write","input_tokens":100,"output_tokens":40}\n'
                     '{"stage":"variant_length_repair","input_tokens":10,"output_tokens":4}\n')
    guards = []
    for module, name in ((variants_ab, "generate"), (generate_variants, "generate"),
                         (generate_variants, "write_variant")):
        guard = Mock(side_effect=AssertionError("Resume must never generate"))
        monkeypatch.setattr(module, name, guard)
        guards.append(guard)
    guard = Mock(side_effect=AssertionError("Resume must never repair lengths"))
    monkeypatch.setattr("shared.variants.repair_option_lengths", guard)
    guards.append(guard)
    yield path, generated, calls
    for guard in guards:
        guard.assert_not_called()


def request_failed(path, payload):
    payload = deepcopy(payload)
    for entry in payload["candidates"]:
        metadata = entry.pop("external_judge_request", None)
        if metadata is not None:
            (path.parent / metadata["path"]).unlink()
        entry.update(failure_stage="request", status="awaiting_external_judge", awaiting_external_judge=False,
                     error_class="ValueError", reason="Saved request construction failed")
    for attempt in payload["variant_attempts"]:
        attempt["status"] = "failed"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    return payload


def test_request_failure_recovery_preserves_generation_and_call_log(generated):
    path, payload, calls = generated
    failed = request_failed(path, payload)
    call_bytes = calls.read_bytes()
    frozen = {key: deepcopy(failed[key]) for key in ("variant_attempts", "plan", "variant_parents", "prior_variants", "existing_questions")}
    original = deepcopy(failed["candidates"][0])
    result = variants_ab.prepare_resume(path)
    saved = json.loads(path.read_text())
    assert result["ready_count"] == result["count"] == 1
    assert result["calls_logged"] == 2
    assert calls.read_bytes() == call_bytes
    assert {key: saved[key] for key in frozen} == frozen
    candidate = saved["candidates"][0]
    changed = {"failure_stage", "reason", "error_class", "error_message", "external_judge_request",
               "awaiting_external_judge", "schema_check", "mechanical_check", "near_duplicate_check", "option_rewrite_check"}
    assert {k: v for k, v in candidate.items() if k not in changed} == {k: v for k, v in original.items() if k not in changed}
    assert candidate["awaiting_external_judge"] is True and "failure_stage" not in candidate
    assert saved["request_recovery_journal"][0]["diagnostics"]["failure_stage"] == "request"
    assert (path.parent / candidate["external_judge_request"]["path"]).is_file()
    exporter.ingestion._validate_candidate(path, saved, candidate)


def test_repeated_resume_is_byte_and_mtime_idempotent_with_cached_verdict(generated, monkeypatch):
    path, payload, calls = generated
    request_failed(path, payload)
    first = variants_ab.prepare_resume(path)
    saved = json.loads(path.read_text())
    candidate = saved["candidates"][0]
    # Place a real bound synthetic verdict in the basename used by the runner.
    folder = verdict_for(candidate, path.parent)
    verdicts = path.with_name(path.stem + ".verdicts")
    folder.rename(verdicts)
    watched = [path, calls, path.parent / candidate["external_judge_request"]["path"], verdicts / (candidate["candidate_id"] + ".json")]
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched]
    monkeypatch.setattr(exporter, "_publish", Mock(side_effect=AssertionError("Do not rewrite valid requests")))
    monkeypatch.setattr(exporter, "_archive", Mock(side_effect=AssertionError("Do not archive completed verdicts")))
    second = variants_ab.prepare_resume(path)
    assert second["count"] == second["archived_verdicts"] == 0
    assert second["ready_candidate_ids"] == first["ready_candidate_ids"]
    assert [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched] == before


def test_failed_export_is_atomic_and_does_not_consume_calls(generated, monkeypatch):
    path, payload, calls = generated
    request_failed(path, payload)
    before, logged = path.read_bytes(), calls.read_bytes()
    monkeypatch.setattr(exporter, "build_request", Mock(side_effect=ValueError("External request exceeds the character bound even with wide quote-centered excerpts")))
    with pytest.raises(click.ClickException, match="Do not repeat generation"):
        variants_ab.prepare_resume(path)
    assert path.read_bytes() == before and calls.read_bytes() == logged
    assert not list(request_directory(path).glob("*.json"))


@pytest.mark.parametrize("stage", ["schema", "near_duplicate", "judge", "external_verdict", "persistence", "variant_length_repair"])
def test_nonrequest_failure_never_revives(generated, stage):
    path, payload, calls = generated
    failed = request_failed(path, payload)
    failed["candidates"][0]["failure_stage"] = stage
    path.write_text(json.dumps(failed))
    before = path.read_bytes()
    with pytest.raises(click.ClickException, match="No judge-ready"):
        variants_ab.prepare_resume(path)
    assert path.read_bytes() == before
    assert not list(request_directory(path).glob("*.json"))


@pytest.mark.parametrize("defect", ["lineage", "evidence", "scope", "id", "bank", "prior", "offline", "empty", "variant", "journal", "path", "schema_flag", "inserted"])
def test_bad_frozen_input_aborts_without_mutation(generated, defect):
    path, payload, calls = generated
    failed = request_failed(path, payload)
    entry = failed["candidates"][0]
    if defect == "lineage": entry["variant"]["parent_snapshot_sha256"] = "0" * 64
    elif defect == "evidence": entry["evidence"][0]["quote"] = "Tampered evidence"
    elif defect == "scope": failed["plan"][0]["scenario_moment"] = "invalid"
    elif defect == "id": entry["candidate_id"] = "changed"
    elif defect == "bank": del failed["existing_questions"]
    elif defect == "prior": del failed["prior_variants"]
    elif defect == "offline": failed["offline"] = True
    elif defect == "empty": failed["candidates"] = []
    elif defect == "variant": failed["variant_mode"] = 0
    elif defect == "journal": failed["external_run_journal"] = {"domain": {"status": "pending"}}
    elif defect == "path": entry["external_judge_request"] = {"path": "../unsafe.json", "sha256": "0" * 64}
    elif defect == "schema_flag": entry["schema_check"]["passed"] = False
    elif defect == "inserted": entry["inserted_question_id"] = entry["candidate_id"]
    path.write_text(json.dumps(failed))
    before, logged = path.read_bytes(), calls.read_bytes()
    with pytest.raises(click.ClickException): variants_ab.prepare_resume(path)
    assert path.read_bytes() == before and calls.read_bytes() == logged
    assert not list(request_directory(path).glob("*.json"))


def test_missing_request_with_prior_verdict_rejects_without_archive(generated, monkeypatch):
    path, payload, calls = generated
    request_failed(path, payload)
    verdicts = path.with_name(path.stem + ".verdicts")
    verdicts.mkdir()
    prior = verdicts / (payload["candidates"][0]["candidate_id"] + ".json")
    prior.write_text('{"unchanged":"saved"}')
    before = path.read_bytes()
    monkeypatch.setattr(exporter, "_archive", Mock(side_effect=AssertionError("No archive")))
    with pytest.raises(click.ClickException, match="Prior verdicts exist"):
        variants_ab.prepare_resume(path)
    assert path.read_bytes() == before and prior.read_text() == '{"unchanged":"saved"}'
    assert not list(request_directory(path).glob("*.json"))


def test_existing_corrupt_request_is_not_replaced(generated):
    path, payload, _ = generated
    request = path.parent / payload["candidates"][0]["external_judge_request"]["path"]
    request.write_text("{}")
    before = path.read_bytes()
    with pytest.raises(click.ClickException): variants_ab.prepare_resume(path)
    assert path.read_bytes() == before and request.read_text() == "{}"


@pytest.mark.parametrize("args", [["resume"], ["resume", "--parent-dir", "unused", "--allow-live"],
                                  ["prepare-resume", "--prior-artifact", "unused"],
                                  ["prepare-resume", "--live-prior-manifest", "unused"]])
def test_resume_mode_guards_before_preflight(generated, monkeypatch, args):
    path, _, _ = generated
    prepare = Mock(side_effect=AssertionError("Guard before artifact access"))
    monkeypatch.setattr(variants_ab, "prepare_resume", prepare)
    monkeypatch.setattr(sys, "argv", ["variants_ab.py", *args, "--artifact", str(path)])
    with pytest.raises(SystemExit): variants_ab.main()
    prepare.assert_not_called()


def test_prepare_resume_cli_is_metadata_only_and_offline(generated, monkeypatch, capsys):
    path, payload, _ = generated
    request_failed(path, payload)
    run = Mock(side_effect=AssertionError("Offline mode must not judge"))
    monkeypatch.setattr("scripts.judge_requests.run_requests", run)
    monkeypatch.setattr(sys, "argv", ["variants_ab.py", "prepare-resume", "--artifact", str(path)])
    variants_ab.main()
    output = capsys.readouterr().out
    assert '"ready_count": 1' in output and '"calls_logged": 2' in output
    assert "judge_prompt" not in output and payload["candidates"][0]["stem"] not in output
    run.assert_not_called()


def test_live_resume_dispatches_judges_only_and_keeps_choices(generated, monkeypatch):
    path, payload, calls = generated
    request_failed(path, payload)
    run = Mock(return_value=SimpleNamespace(failed=0, usage_stopped=False))
    monkeypatch.setattr("scripts.judge_requests.run_requests", run)
    monkeypatch.setattr(variants_ab, "report", lambda *a: {"accepted_variant_ids": [payload["candidates"][0]["candidate_id"]]})
    monkeypatch.setattr(variants_ab, "review_pairs", Mock())
    monkeypatch.setattr("shared.option_order.balance_options", Mock(side_effect=AssertionError("Resume preserves choices")))
    monkeypatch.setattr(sys, "argv", ["variants_ab.py", "resume", "--artifact", str(path), "--allow-live"])
    variants_ab.main()
    run.assert_called_once_with(request_directory(path), path.with_name("saved.verdicts"), judge_model="claude", parallel=3,
                                argon_gate=True, full_gate_sample=1, candidate_ids=[payload["candidates"][0]["candidate_id"]])


def test_recovery_checks_prospective_cohort_before_publishing_diagnostics(generated, monkeypatch):
    path, payload, _ = generated
    request_failed(path, payload)
    before = path.read_bytes()
    observed = []
    def duplicate(entry, existing, parent, *, siblings, prior):
        observed.extend(siblings)
        assert all(s.get("failure_stage") != "request" and s["awaiting_external_judge"] for s in siblings)
        return {"passed": False, "reason": "Synthetic family duplicate"}
    monkeypatch.setattr("shared.variants.variant_duplicates", duplicate)
    with pytest.raises(click.ClickException, match="after duplicate replay"):
        variants_ab.prepare_resume(path)
    assert observed and path.read_bytes() == before


def test_resume_never_accepts_force_or_relocation(generated):
    path, _, _ = generated
    with pytest.raises(click.ClickException, match="cannot force"):
        exporter.export_requests(path, recover_request_failures=True, force=True)
    with pytest.raises(click.ClickException, match="cannot force"):
        exporter.export_requests(path, path.parent / "elsewhere", recover_request_failures=True)


def test_completed_verdict_cache_skips_all_live_judges(generated, monkeypatch):
    from scripts import judge_requests
    path, payload, calls = generated
    request_failed(path, payload)
    result = variants_ab.prepare_resume(path)
    entry = json.loads(path.read_text())["candidates"][0]
    folder = verdict_for(entry, path.parent)
    verdicts = path.with_name("saved.verdicts")
    folder.rename(verdicts)
    judge = Mock(side_effect=AssertionError("Completed judge cache must skip paid calls"))
    argon = Mock(side_effect=AssertionError("Completed Argon cache must skip paid calls"))
    monkeypatch.setattr(judge_requests.cli_models, "run_claude_request", judge)
    monkeypatch.setattr(judge_requests.argon, "run_argon", argon)
    before = calls.read_bytes()
    summary = judge_requests.run_requests(request_directory(path), verdicts, candidate_ids=result["ready_candidate_ids"],
        argon_gate=True, full_gate_sample=1, parallel=3)
    assert summary.skipped == 1 and summary.failed == summary.completed == 0
    assert calls.read_bytes() == before
    judge.assert_not_called(); argon.assert_not_called()
    assert variants_ab.prepare_resume(path)["ready_candidate_ids"] == result["ready_candidate_ids"]


def test_round5_request_recognizer_does_not_classify_requests_as_verdicts(tmp_path):
    path = tmp_path / "candidate.json"
    request = {key: None for key in exporter.GATE_REQUEST_FIELDS}
    request.update(candidate_id="candidate", variant_policy_version=5)
    path.write_text(json.dumps(request))
    assert exporter._prior_results([tmp_path], tmp_path, {"candidate"}) == ([], False)


@pytest.mark.parametrize("reverse", [False, True])
def test_recovery_replays_frozen_index_order_keeps_first_duplicate_and_never_revives_later(parents, tmp_path, monkeypatch, reverse):
    artifact, bank, parent_payload, _ = parents
    path = tmp_path / "pair.json"
    def unique_setting(inputs):
        question = variant_for(inputs)
        question["setting"] += " for " + question["industry"]
        return question
    payload = generate_variants.generate([artifact], [parent_payload["candidates"][0]["candidate_id"]], bank,
        path, variants_per_parent=2, enable_variants=True, predictor=unique_setting)
    assert payload["candidates"][0].get("failure_stage") is None
    assert payload["candidates"][1]["failure_stage"] == "near_duplicate"
    # Reproduce the original bug: request construction failed before seen.append().
    for entry in payload["candidates"]:
        entry["near_duplicate_check"] = {"passed": True}
        entry["mechanical_check"] = {"passed": True, "errors": []}
    payload = request_failed(path, payload)
    if reverse:
        payload["candidates"].reverse()
        path.write_text(json.dumps(payload))
    guard = Mock(side_effect=AssertionError("No paid generation on resume"))
    monkeypatch.setattr(variants_ab, "generate", guard)
    monkeypatch.setattr(generate_variants, "write_variant", guard)
    monkeypatch.setattr("shared.variants.repair_option_lengths", guard)
    attempts = deepcopy(payload["variant_attempts"])
    first, second = sorted(payload["candidates"], key=lambda row: row["index"])
    result = variants_ab.prepare_resume(path)
    assert result["ready_candidate_ids"] == [first["candidate_id"]]
    assert result["blocked_candidate_ids"] == [second["candidate_id"]]
    assert result["ready_count"] == result["blocked_count"] == 1
    saved = json.loads(path.read_text())
    assert saved["variant_attempts"] == attempts
    written = {e["index"]: e for e in saved["candidates"]}
    for entry in payload["candidates"]:
        for field in ("candidate_id", "stem", "options", "rationales", "evidence", "parent_question_id", "variant"):
            assert written[entry["index"]][field] == entry[field]
    assert written[2]["failure_stage"] == "near_duplicate"
    assert written[2]["status"] == "generation_failed"
    assert written[2]["awaiting_external_judge"] is False
    assert written[2]["near_duplicate_check"]["passed"] is False
    assert saved["request_recovery_journal"][1]["outcome"] == "near_duplicate"
    assert saved["request_recovery_journal"][1]["diagnostics"]["failure_stage"] == "request"
    before = path.read_bytes()
    assert variants_ab.prepare_resume(path)["ready_candidate_ids"] == [first["candidate_id"]]
    assert path.read_bytes() == before
    guard.assert_not_called()


def _move_request_to_custom_root(path, payload):
    import shutil
    entry = payload["candidates"][0]
    old = path.parent / entry["external_judge_request"]["path"]
    custom = path.parent / "custom-root"
    custom.mkdir()
    moved = custom / old.name
    old.rename(moved)
    entry["external_judge_request"]["path"] = str(moved.relative_to(path.parent))
    path.write_text(json.dumps(payload))
    # Remove only synthetic test output, so the rejection must not recreate it.
    shutil.rmtree(request_directory(path))
    return moved


def test_resume_rejects_complete_custom_request_root_without_mutation(generated):
    path, payload, calls = generated
    custom_request = _move_request_to_custom_root(path, payload)
    watched = [path, calls, custom_request]
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched]
    with pytest.raises(click.ClickException, match="default request directory"):
        variants_ab.prepare_resume(path)
    assert [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched] == before
    assert not request_directory(path).exists()
    assert not list(path.parent.rglob(".export-quarantine-*"))


def test_resume_rejects_custom_plus_missing_requests_before_recovery(parents, tmp_path, monkeypatch):
    artifact, bank, parent_payload, _ = parents
    path = tmp_path / "mixed.json"
    def unique_setting(inputs):
        question = variant_for(inputs)
        question["setting"] += " for " + question["industry"]
        return question
    payload = generate_variants.generate([artifact], [parent_payload["candidates"][0]["candidate_id"]], bank,
        path, variants_per_parent=2, enable_variants=True, predictor=unique_setting)
    payload["candidates"][1].update(failure_stage="request", status="awaiting_external_judge",
        awaiting_external_judge=False, near_duplicate_check={"passed": True}, mechanical_check={"passed": True})
    calls = path.with_suffix(".json.calls.jsonl")
    calls.write_text('{"stage":"variant_write"}\n')
    custom_request = _move_request_to_custom_root(path, payload)
    watched = [path, calls, custom_request]
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched]
    recover = Mock(side_effect=AssertionError("Reject custom roots before recovery"))
    monkeypatch.setattr(exporter, "_resume_candidates", recover)
    with pytest.raises(click.ClickException, match="default request directory"):
        variants_ab.prepare_resume(path)
    assert [(p.read_bytes(), p.stat().st_mtime_ns) for p in watched] == before
    assert not request_directory(path).exists()
    assert not list(path.parent.rglob(".export-quarantine-*"))
    recover.assert_not_called()


@pytest.mark.parametrize("defect", ["directory", "fifo", "invalid_utf8"])
def test_call_log_preflight_rejects_bad_log_before_export(generated, monkeypatch, defect):
    import os
    path, payload, calls = generated
    request_failed(path, payload)
    calls.unlink()
    if defect == "directory": calls.mkdir()
    elif defect == "fifo":
        if not hasattr(os, "mkfifo"): pytest.skip("FIFO not available")
        os.mkfifo(calls)
    else: calls.write_bytes(b"\xff\xfe")
    before, log_stat = path.read_bytes(), calls.stat()
    export = Mock(side_effect=AssertionError("Call log preflight must precede export"))
    monkeypatch.setattr(exporter, "export_requests", export)
    with pytest.raises(click.ClickException, match="readable regular UTF-8 call log"):
        variants_ab.prepare_resume(path)
    assert path.read_bytes() == before
    assert calls.stat().st_mtime_ns == log_stat.st_mtime_ns
    assert calls.stat().st_mode == log_stat.st_mode
    if defect == "invalid_utf8": assert calls.read_bytes() == b"\xff\xfe"
    assert not list(request_directory(path).glob("*.json"))
    export.assert_not_called()


@pytest.mark.parametrize("defect", ["fifo", "directory"])
def test_existing_request_must_be_regular_before_resume_validation(generated, monkeypatch, defect):
    import os
    path, payload, calls = generated
    request = path.parent / payload["candidates"][0]["external_judge_request"]["path"]
    request.unlink()
    if defect == "fifo":
        if not hasattr(os, "mkfifo"): pytest.skip("FIFO not available")
        os.mkfifo(request)
    else: request.mkdir()
    before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in (path, calls)]
    request_stat = request.stat()
    recover = Mock(side_effect=AssertionError("Reject nonregular requests before recovery"))
    monkeypatch.setattr(exporter, "_resume_candidates", recover)
    with pytest.raises(click.ClickException, match="Existing request must be a regular file"):
        variants_ab.prepare_resume(path)
    assert [(p.read_bytes(), p.stat().st_mtime_ns) for p in (path, calls)] == before
    assert request.stat().st_mtime_ns == request_stat.st_mtime_ns
    assert request.stat().st_mode == request_stat.st_mode
    recover.assert_not_called()
