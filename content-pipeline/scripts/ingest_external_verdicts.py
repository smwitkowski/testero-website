#!/usr/bin/env python3
"""Ingest frozen Claude Code subagent verdicts without any live model calls."""
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from types import SimpleNamespace
import uuid

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.generate_pmle_questions import database_client as _database_client, persist_candidate, write_artifact
from shared.cert_context import plan_questions
from shared.cli_models import parse_output
from shared.dedupe import normalize_stem
from shared.doc_search import documentation_context
from shared.evidence import check_evidence
from shared.external_judge import (
    EXTERNAL_JUDGE_PROVENANCE, EXTERNAL_POLICY_MODEL, build_request,
    candidate_storage_id, candidate_question, request_directory,
    validate_candidate_records, canonical_sha256, eligible_repair_verdict,
)
from shared.model_policy import require_independent_models
from shared.quality_gate import QuestionQualitySignature, LEGACY_ROUND4_QUALITY_SIGNATURE, judge_question
from shared.validator import validate_question
from shared.batch_report import option_length_report, format_option_length_report, option_prefix_report, format_option_prefix_report

BLOCKED_STATES = {"inserting", "inserted", "complete", "failed_partial", "unknown"}


def database_client():
    # The legacy module must not load .env files even in write mode.
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    return _database_client()


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _read_json(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Invalid JSON number")))


def _flush(path, payload):
    """Durably flush the atomic artifact, including its directory rename."""
    write_artifact(path, payload)
    with path.open("rb") as saved:
        os.fsync(saved.fileno())
    directory = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


@contextmanager
def artifact_lock(path):
    # Atomic artifact replacement changes its inode; lock a stable sidecar instead.
    with path.with_suffix(path.suffix + ".lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise click.ClickException("Artifact is already locked by another ingestion") from None
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)


def _scope(payload, entry):
    index = entry.get("index")
    if type(index) is not int or not 1 <= index <= len(payload["plan"]):
        raise ValueError("Invalid candidate plan index")
    scope = payload["plan"][index - 1]
    for key in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment", "opening_style", "question_line"):
        if entry.get(key) != scope.get(key):
            raise ValueError("Candidate does not match its frozen plan")
    if scope["cert_id"] != payload["cert_id"]:
        raise ValueError("Certification does not match the artifact")
    current = plan_questions(payload["cert_id"], index, objective_ids=[scope["objective_id"]])
    expected = current[index - 1]
    # Offset is planning provenance, not rubric scope; explicit-objective replay uses zero.
    if expected is None or {k: v for k, v in scope.items() if k != "objective_offset"} != {
            k: v for k, v in expected.items() if k != "objective_offset"}:
        raise ValueError("Frozen scope differs from the current registry")
    return scope


def _validate_candidate(path, payload, entry):
    scope = _scope(payload, entry)
    question = candidate_question(entry)
    candidate_storage_id(entry, scope, question)
    if entry.get("key") != "A" or not validate_question(question).is_valid:
        raise ValueError("Question schema validation failed")
    checked = check_evidence(entry.get("evidence"), entry.get("sources"))
    if not checked["passed"] or checked["options"] != entry["evidence"]:
        raise ValueError("Frozen receipts or source provenance failed validation")
    metadata = entry.get("external_judge_request")
    if not isinstance(metadata, dict) or not isinstance(metadata.get("path"), str):
        raise ValueError("Missing external judge request metadata")
    given = Path(metadata["path"])
    if given.is_absolute() or ".." in given.parts or given.name != entry["candidate_id"] + ".json":
        raise ValueError("Unsafe external judge request path")
    request_path = path.parent / given
    if not request_path.resolve().is_relative_to(path.parent.resolve()):
        raise ValueError("Unsafe external judge request path")
    if any(part.is_symlink() for part in (request_path, *request_path.parents)):
        raise ValueError("External judge requests cannot be symlinks")
    digest = metadata.get("sha256")
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("Invalid external judge request digest")
    if hashlib.sha256(request_path.read_bytes()).hexdigest() != digest:
        raise ValueError("External judge request hash mismatch")
    frozen = _read_json(request_path)
    rebuilt = build_request(entry["candidate_id"], scope, question, entry["sources"], checked["options"])
    if canonical_sha256(frozen) != canonical_sha256(rebuilt):
        # Only unchanged originals may retain the exact known preceding 14-field rubric.
        # No arbitrary old schema or historical 13-field request is accepted.
        if "repair" in entry or canonical_sha256(frozen) != canonical_sha256(build_request(
                entry["candidate_id"], scope, question, entry["sources"], checked["options"],
                signature=LEGACY_ROUND4_QUALITY_SIGNATURE)):
            raise ValueError("External request differs from frozen content or supported rubric")
    return scope, question, checked


def _reject(entry, stage, reason):
    entry["failure_stage"], entry["reason"] = stage, reason
    if stage in ("external_request", "external_verdict"):
        entry["judge_verdict"] = {"passed": False, "score": 0.0, "reason": reason,
                                  "model": EXTERNAL_JUDGE_PROVENANCE}
    # A verdict decision is not a persisted acceptance, including in dry-run.
    if entry.get("persistence_status") != "complete":
        entry["accepted"] = False


def _external_decision(question, scope, sources, evidence, raw, generator_model):
    parse_output(json.dumps(raw, allow_nan=False), QuestionQualitySignature)
    return judge_question(question, scope["domain_prompt"],
        documentation_context=documentation_context(sources),
        model=EXTERNAL_JUDGE_PROVENANCE, generator_model=generator_model,
        option_evidence=evidence, predictor=lambda **_: SimpleNamespace(**raw))


def _run_id(payload, code):
    content = json.dumps({"cert_id": payload["cert_id"], "model": payload["model"],
                          "domain_code": code,
                          "candidate_ids": sorted(entry["candidate_id"] for entry in payload["candidates"]
                                                  if "repair" not in entry)},
                         sort_keys=True, allow_nan=False)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "testero-external-run:" + content))


def _is_complete(entry):
    return (entry.get("persistence_status") == "complete"
            and isinstance(entry.get("inserted_question_id"), str)
            and bool(entry["inserted_question_id"].strip())
            and entry["inserted_question_id"] == (entry["repair"]["storage_question_id"]
                if "repair" in entry else entry["candidate_id"])
            and entry.get("accepted") is True
            and not entry.get("persistence_validation_failed"))


def validate_completed_journals(payload, path):
    """Validate saved complete writes offline; never repair ambiguous DB journals.

    Raises:
        ValueError: Run mappings, candidate writes or stored PASS decisions are invalid.
    """
    try:
        validate_candidate_records(payload)
        runs = payload.get("generation_runs")
        journal = payload.get("external_run_journal", {})
        domains = {scope["domain_code"] for scope in payload["plan"]}
        if (not isinstance(runs, dict) or not isinstance(journal, dict)
                or set(runs) != set(journal) or set(runs) - domains):
            raise ValueError("Unknown or foreign run journal")
        for code, record in journal.items():
            if (not isinstance(record, dict) or set(record) != {"status", "run_id"}
                    or record["status"] != "created" or record["run_id"] != runs[code]
                    or runs[code] != _run_id(payload, code)):
                raise ValueError("Incomplete or changed run identity")
        for index, scope in enumerate(payload["plan"], 1):
            _scope(payload, {**scope, "index": index})
        for entry in payload["candidates"]:
            state = entry.get("persistence_status")
            if state is None and entry.get("inserted_question_id") is None:
                if (entry.get("accepted") is not False or entry.get("persistence_validation_failed")
                        or entry.get("status") in ("ACTIVE", "active", "persisted", "inserted")):
                    raise ValueError("Nonpersisted candidate claims a saved write")
                continue
            if state != "complete" or not _is_complete(entry):
                raise ValueError("Partial or unknown candidate write")
            scope, question, checked = _validate_candidate(Path(path), payload, entry)
            if scope["domain_code"] not in runs:
                raise ValueError("Completed candidate has no created run")
            decision = _external_decision(question, scope, entry["sources"], checked["options"],
                                          entry["external_verdict"], payload["model"])
            if not decision.passed:
                raise ValueError("Completed candidate lacks a strict stored PASS")
    except Exception:
        raise ValueError("Persistence journals require human reconciliation") from None


def ingest(path, verdicts, *, dry_run=False):
    """Validate all inputs before creating a client; persist passing candidates only."""
    payload = _read_json(path)
    if (not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list)
            or not payload["candidates"]
            or not isinstance(payload.get("plan"), list) or not payload["plan"]
            or not isinstance(payload.get("generation_runs"), dict)):
        raise click.ClickException("Invalid external judge artifact")
    if payload.get("judge_model") != "external" or payload.get("external_judge_version") != 1:
        raise click.ClickException("Artifact does not use external judge version 1")
    try:
        require_independent_models(payload["model"], EXTERNAL_POLICY_MODEL)
    except (KeyError, ValueError):
        raise click.ClickException("Invalid generator/judge vendor independence") from None
    if payload.get("difficulty") not in ("EASY", "MEDIUM", "HARD") or not isinstance(payload.get("exam"), str) or not payload["exam"].strip():
        raise click.ClickException("Artifact lacks persistence difficulty or exam")
    try:
        validate_candidate_records(payload)
    except ValueError:
        raise click.ClickException("Invalid candidate records or repair lineage") from None
    try:
        for index, scope in enumerate(payload["plan"], 1):
            _scope(payload, {**scope, "index": index})
    except (ValueError, KeyError, TypeError, StopIteration):
        raise click.ClickException("Frozen plan differs from the current registry") from None
    # Validate superseded parents before modifying any artifact decision or opening a DB client.
    superseded = {entry["repair"]["parent_candidate_id"]: entry for entry in payload["candidates"] if "repair" in entry}
    if superseded:
        try:
            validate_completed_journals(payload, path)
        except ValueError:
            raise click.ClickException("Repair persistence journals require human reconciliation") from None
    try:
        for parent in payload["candidates"]:
            child = superseded.get(parent["candidate_id"])
            if child is None:
                continue
            _validate_candidate(path, payload, parent)
            verdict_path = verdicts / (parent["candidate_id"] + ".json")
            if verdict_path.is_symlink():
                raise ValueError("Unsafe parent verdict path")
            raw = _read_json(verdict_path)
            eligible_repair_verdict(raw)
            if canonical_sha256(raw) != child["repair"]["original_verdict_sha256"]:
                raise ValueError("Parent verdict changed after repair")
    except (ValueError, KeyError, TypeError, OSError, UnicodeError, StopIteration):
        raise click.ClickException("Superseded parent request or frozen FAIL verdict is invalid") from None
    # A repair cannot evade another candidate's stem by moving earlier in the list.
    # Its own immutable failed parent is the only permitted duplicate.
    repair_duplicate_ids = set()
    for child in superseded.values():
        normalized = normalize_stem(candidate_question(child)["stem"])
        for other in payload["candidates"]:
            if other["candidate_id"] in (child["candidate_id"], child["repair"]["parent_candidate_id"]):
                continue
            try:
                if normalize_stem(candidate_question(other)["stem"]) == normalized:
                    repair_duplicate_ids.add(child["candidate_id"])
            except (ValueError, KeyError, TypeError):
                continue
    pending, seen = [], set()
    # Include completed stems before pending validation, regardless of list order.
    for entry in payload["candidates"]:
        if _is_complete(entry):
            try:
                seen.add(normalize_stem(candidate_question(entry)["stem"]))
            except (ValueError, KeyError, TypeError):
                pass
    rejected, missing, blocked = 0, 0, 0
    for entry in payload["candidates"]:
        ident = entry["candidate_id"]
        if ident in superseded:
            click.echo(f"{ident}: immutable failed parent; judging its r1 only")
            continue
        state = entry.get("persistence_status")
        if entry.get("inserted_question_id") or state in BLOCKED_STATES or state is not None:
            if state == "complete":
                try:
                    scope, question, checked = _validate_candidate(path, payload, entry)
                    if not _is_complete(entry):
                        raise ValueError("Incomplete persisted journal")
                    code = scope["domain_code"]
                    record = payload.get("external_run_journal", {}).get(code)
                    if (not isinstance(record, dict) or record.get("status") != "created"
                            or record.get("run_id") != _run_id(payload, code)
                            or record.get("run_id") != payload["generation_runs"].get(code)):
                        raise ValueError("Incomplete persisted run journal")
                    decision = _external_decision(question, scope, entry["sources"], checked["options"],
                                                  entry["external_verdict"], payload["model"])
                    if not decision.passed:
                        raise ValueError("Stored verdict no longer passes")
                    seen.add(normalize_stem(question["stem"]))
                except Exception:
                    entry["persistence_validation_failed"] = True
            if not _is_complete(entry):
                entry["accepted"] = False
                entry["failure_stage"] = "persistence"
                entry["reason"] = "Persistence journal requires human reconciliation"
                blocked += 1
                click.echo(f"{ident}: persistence blocked; human reconciliation required")
            else:
                click.echo(f"{ident}: already complete; no new insert")
            continue
        # Previous dry-run decisions are not evidence for the current verdict file.
        entry.pop("external_verdict", None)
        entry["judge_verdict"] = {"passed": False, "score": 0.0,
                                  "reason": "Current external verdict not validated",
                                  "model": EXTERNAL_JUDGE_PROVENANCE}
        try:
            scope, question, checked = _validate_candidate(path, payload, entry)
            normalized = normalize_stem(question["stem"])
            if normalized in seen or ident in repair_duplicate_ids:
                raise ValueError("Duplicate normalized stem")
            seen.add(normalized)
        except (ValueError, KeyError, TypeError, OSError, UnicodeError, StopIteration):
            _reject(entry, "external_request", "Question, evidence, scope or external request validation failed")
            rejected += 1
            click.echo(f"{ident}: rejected; {entry['reason']}")
            continue
        verdict_path = verdicts / f"{ident}.json"
        if not verdict_path.exists():
            missing += 1
            _reject(entry, "external_verdict", "Missing external verdict")
            click.echo(f"{ident}: missing external verdict")
            continue
        try:
            if verdict_path.is_symlink():
                raise ValueError("Unsafe verdict path")
            raw = _read_json(verdict_path)
            if not isinstance(raw, dict):
                raise ValueError("Expected output fields")
            entry["external_verdict"] = raw
            judge = _external_decision(question, scope, entry["sources"], checked["options"],
                                       raw, payload["model"])
            entry["judge_verdict"] = {"passed": judge.passed, "score": judge.score,
                                      "reason": judge.reason, "model": judge.model}
            entry["external_judge_provenance"] = EXTERNAL_JUDGE_PROVENANCE
            entry["awaiting_external_judge"] = False
            entry["status"] = "external_judge_passed" if judge.passed else "external_judge_rejected"
        except Exception:
            _reject(entry, "external_verdict", "Malformed external verdict; exact output fields required")
            rejected += 1
            click.echo(f"{ident}: rejected; {entry['reason']}")
            continue
        if not judge.passed:
            _reject(entry, "judge", judge.reason)
            rejected += 1
            click.echo(f"{ident}: rejected; {entry['reason']}")
            continue
        entry.pop("failure_stage", None)
        entry.pop("reason", None)
        grounding = {key: scope[key] for key in ("cert_id", "objective_id", "guide_sha256")}
        grounding.update(generator_model=payload["model"], judge_model=EXTERNAL_JUDGE_PROVENANCE,
                         evidence=checked["options"], mechanical_check={"passed": True, "errors": []})
        entry["grounding"] = grounding
        entry["accepted"] = False
        pending.append((entry, scope, question, judge, grounding))
        click.echo(f"{ident}: passing external verdict; {judge.reason}")
    payload["option_length_report"] = option_length_report(payload["candidates"])
    payload["option_prefix_report"] = option_prefix_report(payload["candidates"])
    _flush(path, payload)
    if not dry_run and (pending or payload["generation_runs"]):
        journal = payload.setdefault("external_run_journal", {})
        if (not isinstance(journal, dict)
                or set(journal) != set(payload["generation_runs"])
                or any(not isinstance(record, dict) or record.get("status") != "created"
                       or record.get("run_id") != payload["generation_runs"].get(code)
                       or record.get("run_id") != _run_id(payload, code)
                       for code, record in journal.items())):
            raise click.ClickException("Run creation journal is incomplete or unknown; human reconciliation required")
        try:
            client = database_client()
            domains = {}
            # Resolve every planned domain before creating any run or inserting rows.
            for scope in payload["plan"]:
                code = scope["domain_code"]
                if code not in domains:
                    domain = client.get_domain_by_code(code)
                    if not domain or not domain.get("id"):
                        raise ValueError("Unseeded domain")
                    domains[code] = domain["id"]
            runs = payload["generation_runs"]
            if set(runs) - set(domains) or any(not isinstance(run, str) or not run for run in runs.values()):
                raise ValueError("Invalid saved runs")
            for code in domains:
                if code not in runs:
                    run_id = _run_id(payload, code)
                    journal[code] = {"status": "creating", "run_id": run_id}
                    _flush(path, payload)
                    try:
                        run = client.create_generation_run({"id": run_id, "exam": payload["exam"], "domain_code": code,
                            "target_count": sum(item["domain_code"] == code for item in payload["plan"]),
                            "generated_count": 0, "model": payload["model"], "prompt_version": "registry-grounded-v1",
                            "notes": json.dumps({"cert_id": payload["cert_id"], "judge_model": EXTERNAL_JUDGE_PROVENANCE})})
                        if not run or run.get("id") != run_id:
                            raise ValueError("Run creation failed or returned an unexpected ID")
                        runs[code] = run_id
                        journal[code] = {"status": "created", "run_id": run_id}
                        _flush(path, payload)
                        click.echo(f"Generation run {code}: {run_id}")
                    except Exception:
                        journal[code] = {"status": "unknown", "run_id": run_id}
                        runs.pop(code, None)
                        _flush(path, payload)
                        raise
        except Exception:
            raise click.ClickException("Database setup or run creation failed; no candidates inserted. Unknown run writes require human reconciliation") from None
        for entry, scope, question, judge, grounding in pending:
            storage_id = candidate_storage_id(entry, scope, question)

            def before_insert():
                entry["persistence_status"] = "inserting"
                _flush(path, payload)

            def on_question_inserted(saved_id):
                entry["inserted_question_id"] = saved_id
                entry["persistence_status"] = "inserted"
                _flush(path, payload)
                if saved_id != storage_id:
                    raise ValueError("Inserted question returned an unexpected ID")

            try:
                stored = persist_candidate(client, scope, question, judge, grounding, payload["exam"],
                    domains[scope["domain_code"]], runs[scope["domain_code"]], payload["difficulty"],
                    before_insert=before_insert, on_question_inserted=on_question_inserted,
                    question_id=storage_id)
                if not stored or not entry.get("inserted_question_id"):
                    raise ValueError("Incomplete persistence")
                entry["persistence_status"] = "complete"
                entry["accepted"] = True
                entry["status"] = "persisted"
                click.echo(f"{entry['candidate_id']}: accepted DRAFT; {judge.reason}")
            except Exception:
                entry["persistence_status"] = "failed_partial" if entry.get("inserted_question_id") else "unknown"
                _reject(entry, "persistence", "Persistence incomplete or unknown; human reconciliation required")
                blocked += 1
                click.echo(f"{entry['candidate_id']}: {entry['reason']}")
            payload["option_length_report"] = option_length_report(payload["candidates"])
            payload["option_prefix_report"] = option_prefix_report(payload["candidates"])
            _flush(path, payload)
        try:
            for code, run_id in runs.items():
                complete = sum(_is_complete(entry) and entry["domain_code"] == code
                               for entry in payload["candidates"])
                if not client.update_generation_run(run_id, {"generated_count": complete,
                        "completed_at": datetime.now(timezone.utc).isoformat()}):
                    raise ValueError("Run completion failed")
        except Exception:
            raise click.ClickException("Run completion failed; founder approval remains blocked") from None
    complete = sum(_is_complete(entry) for entry in payload["candidates"])
    click.echo(format_option_length_report(payload["option_length_report"]))
    click.echo(format_option_prefix_report(payload["option_prefix_report"]))
    click.echo(f"Passing verdicts {len(pending)}; accepted/complete {complete}; rejected {rejected}; missing {missing}; blocked {blocked}")
    if rejected or missing or blocked:
        raise click.ClickException("Some candidates were not persisted; inspect the artifact")


@click.command()
@click.option("--artifact", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--verdicts", required=True, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--dry-run", is_flag=True, help="Validate and record decisions locally; never construct a DB client.")
def main(artifact, verdicts, dry_run):
    try:
        if artifact.is_symlink():
            raise click.ClickException("Artifact cannot be a symlink")
        artifact = artifact.resolve()
        with artifact_lock(artifact):
            ingest(artifact, verdicts.resolve(), dry_run=dry_run)
    except click.ClickException:
        raise
    except Exception:
        raise click.ClickException("External verdict ingestion failed safely; inspect local inputs") from None


if __name__ == "__main__":
    main()
