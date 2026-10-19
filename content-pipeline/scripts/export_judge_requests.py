#!/usr/bin/env python3
"""Re-export frozen external judge requests without generation or database access."""
from contextlib import ExitStack
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import uuid

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import ingest_external_verdicts as ingestion
from scripts import judge_requests as runner
from shared.option_order import canonical_evidence
from shared.evidence import check_evidence
from shared.external_judge import (
    EXTERNAL_POLICY_MODEL, REQUEST_CHARACTER_LIMIT, build_request,
    candidate_id, candidate_storage_id, candidate_question, request_directory, validate_candidate_records,
    validate_decision_provenance,
)
from shared.model_policy import require_independent_models
from shared.validator import validate_question

REQUEST_FIELDS = {"candidate_id", "objective_id", "judge_prompt", "verdict_schema", "trimming"}
GATE_REQUEST_FIELDS = {"candidate_id", "objective_id", "gate_version", "decision_provenance_sha256", "gates", "trimming"}


def _encode(payload):
    return (json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def _sync_directory(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _publish(path, raw):
    """Durably replace one request with its complete serialized bytes."""
    fd, temporary = tempfile.mkstemp(prefix=".export-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        _sync_directory(path.parent)
    finally:
        Path(temporary).unlink(missing_ok=True)


def _validate_payload(payload):
    if (not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list)
            or not payload["candidates"] or not isinstance(payload.get("plan"), list)
            or not payload["plan"] or not isinstance(payload.get("generation_runs"), dict)):
        raise click.ClickException("Invalid external judge artifact")
    if payload.get("judge_model") != "external" or type(payload.get("external_judge_version")) is not int or payload["external_judge_version"] not in (1, 2):
        raise click.ClickException("Artifact must use a supported external judge version")
    try:
        require_independent_models(payload["model"], EXTERNAL_POLICY_MODEL)
    except (KeyError, ValueError, TypeError):
        raise click.ClickException("Invalid generator/judge vendor independence") from None
    if payload["generation_runs"] or payload.get("external_run_journal"):
        raise click.ClickException("Database run journals require human reconciliation; export is blocked")
    if ("external_run_journal" in payload
            and not isinstance(payload["external_run_journal"], dict)):
        raise click.ClickException("Invalid database run journal")
    if payload.get("difficulty") not in ("EASY", "MEDIUM", "HARD") or not isinstance(payload.get("exam"), str) or not payload["exam"].strip():
        raise click.ClickException("Artifact lacks persistence difficulty or exam")
    entries = payload["candidates"]
    if any(not isinstance(entry, dict) for entry in entries):
        raise click.ClickException("Invalid candidate records")
    try:
        validate_candidate_records(payload)
    except ValueError:
        raise click.ClickException("Invalid candidate records or repair lineage") from None
    for entry in entries:
        if (entry.get("persistence_status") is not None or entry.get("inserted_question_id") is not None
                or entry.get("accepted") is not False or entry.get("persistence_validation_failed")
                or entry.get("status") in ("ACTIVE", "active", "persisted", "inserted")):
            raise click.ClickException("Candidate persistence state requires human reconciliation; export is blocked")
    try:
        for index, scope in enumerate(payload["plan"], 1):
            ingestion._scope(payload, {**scope, "index": index})
        for entry in entries:
            ingestion._scope(payload, entry)
    except (ValueError, KeyError, TypeError, StopIteration):
        raise click.ClickException("Frozen plan differs from the current registry") from None


def _resume_candidates(payload):
    """Validate saved generation and recover only pre-judge request failures in memory."""
    from copy import deepcopy
    import re
    from shared.external_judge import validate_decision_provenance
    from shared.near_duplicates import comparison_row, tokens
    from shared.variant_history import validate_prior_variants
    from shared.variants import validate_variant, variant_duplicates, option_rewrite_check

    if (type(payload.get("variant_mode")) is not int or payload["variant_mode"] != 1
            or payload.get("offline") is not False or "dry_run" in payload
            or payload.get("external_judge_version") != 2 or payload.get("rules_version") != 5
            or payload.get("argon_gate") is not True
            or payload.get("execution_policy") != "short_circuit_v1"
            or not isinstance(payload.get("variant_parents"), dict) or not payload["variant_parents"]
            or not isinstance(payload.get("variant_attempts"), list) or not payload["variant_attempts"]):
        raise click.ClickException("Resume requires saved live generation with full frozen variant provenance; never regenerate this artifact")
    validate_prior_variants(payload["prior_variants"])
    bank = payload.get("existing_questions")
    if (not isinstance(bank, dict) or not isinstance(bank.get("questions"), list)
            or not isinstance(bank.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", bank["sha256"])):
        raise click.ClickException("Resume requires the frozen existing-question bank")
    for row in bank["questions"]:
        if not isinstance(row.get("id"), str) or not row["id"]:
            raise ValueError("Invalid frozen bank ID")
        tokens(row["stem"]); tokens(row["key"])
    entries, recover = [], []
    for entry in payload["candidates"]:
        # Failed schema, duplicate, judge, or persistence attempts are never revived.
        stage = entry.get("failure_stage")
        if stage not in (None, "request"):
            continue
        if (entry.get("status") != "awaiting_external_judge"
                or entry.get("external_verdict") is not None
                or entry.get("schema_check", {}).get("passed") is not True
                or entry.get("near_duplicate_check", {}).get("passed") is not True
                or entry.get("mechanical_check", {}).get("passed") is not True):
            continue
        if stage is None and entry.get("awaiting_external_judge") is not True:
            continue
        if not entry.get("variant") or not entry.get("options"):
            raise ValueError("Missing frozen variant content")
        scope = ingestion._scope(payload, entry)
        question = candidate_question(entry)
        candidate_storage_id(entry, scope, question)
        validate_decision_provenance(scope, entry)
        validate_variant(payload, entry)
        validation = validate_question(question, industry_only=True)
        checked = check_evidence(canonical_evidence(entry), entry["sources"])
        if not validation.is_valid or not checked["passed"] or checked["options"] != canonical_evidence(entry):
            raise ValueError("Saved variant schema or evidence failed; resume cannot repair content")
        entries.append(entry)
        if stage == "request":
            recover.append((entry, validation, scope))
    if not entries:
        raise click.ClickException("No judge-ready saved variants or recoverable request failures; inspect diagnostics, do not rerun generation")
    # Restore the writer's intended seen population in frozen generation order.
    # Request construction used to fail before seen.append(), hiding prior siblings.
    # Existing valid requests stay untouched; only newly recovered candidates can
    # become new generation duplicate rejects. All static validation above finishes
    # before any diagnostic field is cleared, and nothing is published here.
    from shared.variants import eligible_sibling
    cohort = deepcopy(payload["candidates"])
    by_id = {entry["candidate_id"]: entry for entry in cohort}
    ready = {entry["candidate_id"] for entry in entries}
    diagnostics = ("failure_stage", "reason", "error_class", "error_message", "external_verdict")
    for entry, validation, scope in sorted(recover, key=lambda row: row[0]["index"]):
        ident = entry["candidate_id"]
        parent = payload["variant_parents"][entry["parent_question_id"]]
        prospective = by_id[ident]
        prospective.pop("failure_stage", None)
        prospective.update(awaiting_external_judge=True, status="awaiting_external_judge")
        duplicate = variant_duplicates(entry,
            bank["questions"] + [comparison_row(s) for s in cohort
                if s.get("options") and s["candidate_id"] != ident and eligible_sibling(s)],
            parent, siblings=cohort, prior=payload["prior_variants"]["questions"])
        passed = duplicate["passed"]
        payload.setdefault("request_recovery_journal", []).append({"candidate_id": ident,
            "diagnostics": {field: entry[field] for field in diagnostics if field in entry},
            "outcome": "ready" if passed else "near_duplicate", "near_duplicate_check": duplicate})
        entry["schema_check"] = {"passed": True, "errors": validation.errors, "warnings": validation.warnings}
        entry["mechanical_check"] = {"passed": True, "errors": []}
        entry["option_rewrite_check"] = option_rewrite_check(candidate_question(entry), parent,
            **({"key_length_rank": scope["key_length_rank"]} if scope.get("variant_policy_version") == 5 else {}))
        entry["near_duplicate_check"] = duplicate
        for field in diagnostics:
            entry.pop(field, None)
        entry.update(awaiting_external_judge=passed, accepted=False)
        if passed:
            entry["status"] = "awaiting_external_judge"
        else:
            ready.remove(ident)
            entry.update(status="generation_failed", failure_stage="near_duplicate",
                         reason=duplicate["reason"], error_class="ValueError", error_message=duplicate["reason"])
        prospective.update(deepcopy(entry))
    if not ready:
        raise click.ClickException("No judge-ready saved variants remain after duplicate replay; inspect diagnostics, do not repeat generation")
    return [entry["candidate_id"] for entry in sorted(entries, key=lambda row: row["index"])
            if entry["candidate_id"] in ready]


def _build_outputs(artifact, out, payload, *, force, resume_ids=None):
    outputs, trimmed = [], 0
    superseded = {entry["repair"]["parent_candidate_id"] for entry in payload["candidates"] if "repair" in entry}
    for entry in payload["candidates"]:
        if resume_ids is not None:
            if entry["candidate_id"] not in resume_ids:
                continue
            metadata = entry.get("external_judge_request")
            if metadata is not None and (artifact.parent / metadata["path"]).exists():
                ingestion._validate_candidate(artifact, payload, entry)
                continue  # Never rewrite an existing valid request on resume.
        if entry["candidate_id"] in superseded:
            # This snapshot belongs to the lineage journal; even --force cannot alter it.
            ingestion._validate_candidate(artifact, payload, entry)
            continue
        variant_rejected = ("variant" in entry and (entry.get("schema_check", {}).get("passed") is False
                or entry.get("near_duplicate_check", {}).get("passed") is False))
        if variant_rejected and "external_judge_request" not in entry:
            continue
        waiting = entry.get("status") == "awaiting_external_judge" or entry.get("awaiting_external_judge") is True
        if not waiting and "external_judge_request" not in entry:
            continue
        if not force and (entry.get("external_verdict") is not None
                          or entry.get("status") in ("external_judge_passed", "external_judge_rejected")):
            raise click.ClickException("Stored judge decisions exist; --force is required to rejudge")
        try:
            scope = ingestion._scope(payload, entry)
            question = candidate_question(entry)
            candidate_storage_id(entry, scope, question)
            if payload["external_judge_version"] == 2:
                validate_decision_provenance(scope, entry)
            if "variant_origin" in scope or "variant" in entry or "parent_question_id" in entry:
                from shared.variants import validate_variant
                validate_variant(payload, entry)
            if not validate_question(question, industry_only="variant" in entry).is_valid:
                raise ValueError()
            checked = check_evidence(canonical_evidence(entry), entry.get("sources"))
            if not checked["passed"] or checked["options"] != canonical_evidence(entry):
                raise ValueError()
            from shared.quality_gate import QuestionQualitySignature
            request = build_request(entry["candidate_id"], scope, question, entry["sources"], checked["options"],
                                    **({"gate_version": payload.get("rules_version", 4), "argon_gate": payload.get("argon_gate", False), "execution_policy": payload.get("execution_policy"),
                                        "variant_context": ({"metadata": entry["variant"],
                                            "parent": payload["variant_parents"][entry["parent_question_id"]]}
                                            if "variant" in entry else None)} if payload["external_judge_version"] == 2 else {"signature": QuestionQualitySignature}))
            raw = _encode(request)
            if len(raw.decode("utf-8")) > REQUEST_CHARACTER_LIMIT:
                raise ValueError("External request exceeds the character bound even with wide quote-centered excerpts")
            destination = out / (entry["candidate_id"] + ".json")
            runner._no_symlinks(destination)
            if destination.exists() and not destination.is_file():
                raise ValueError()
            metadata = entry.get("external_judge_request", {})
            if not isinstance(metadata, dict):
                raise ValueError()
            entry["external_judge_request"] = {**metadata,
                "path": str(destination.relative_to(artifact.parent)),
                "sha256": hashlib.sha256(raw).hexdigest()}
            if force:
                entry.pop("external_verdict", None)
                if not variant_rejected:
                    for field in ("reason", "failure_stage"):
                        entry.pop(field, None)
                    entry["judge_verdict"] = {"passed": False, "score": 0.0,
                                              "reason": "Awaiting external judge", "model": "external"}
                    entry.update(status="awaiting_external_judge", awaiting_external_judge=True, accepted=False)
            outputs.append((destination, raw))
            trimmed += int(request["trimming"]["enabled"])
        except (ValueError, KeyError, TypeError, StopIteration) as error:
            if (type(error) is ValueError and str(error) ==
                    "External request exceeds the character bound even with wide quote-centered excerpts"):
                raise click.ClickException("Request still exceeds the character limit after bounded excerpting; inspect frozen sources and request sizing offline, then retry prepare-resume. Do not repeat generation.") from None
            raise click.ClickException("Frozen candidate question, ID, schema or evidence validation failed") from None
    # Validate the complete final artifact before publishing any request.
    _encode(payload)
    return outputs, trimmed


def _request_directories(artifact, out, payload):
    directories = {out}
    for entry in payload["candidates"]:
        metadata = entry.get("external_judge_request")
        if metadata is None:
            continue
        if not isinstance(metadata, dict) or not isinstance(metadata.get("path"), str):
            raise click.ClickException("Invalid external judge request metadata")
        given = Path(metadata["path"])
        if given.is_absolute() or ".." in given.parts or given.name != entry["candidate_id"] + ".json":
            raise click.ClickException("Unsafe existing external judge request path")
        path = artifact.parent / given
        runner._no_symlinks(path)
        if path.exists() and not path.is_file():
            raise click.ClickException("Existing request must be a regular file")
        directory = path.parent.resolve()
        if directory == artifact.parent or not directory.is_relative_to(artifact.parent):
            raise click.ClickException("Existing request directory must be beneath the artifact parent")
        if directory.exists() and not directory.is_dir():
            raise click.ClickException("Existing request directory must be a directory")
        directories.add(directory)
    return sorted(directories)


def _verdict_directories(artifact, out):
    directories = {artifact.with_name(artifact.stem + ".verdicts"),
                   out.with_name(out.name + ".verdicts"), out}
    if out.name.endswith(".judge-requests"):
        directories.add(out.with_name(out.name[:-len(".judge-requests")] + ".verdicts"))
    for directory in directories:
        runner._no_symlinks(directory)
        if directory.exists() and not directory.is_dir():
            raise click.ClickException("Associated verdict path must be a directory")
    return sorted(directory for directory in directories if directory.is_dir())


def _additional_verdict_directories(artifact, request_directories, explicit):
    directories = set()
    for directory in request_directories:
        registry = directory / ".verdict-directories.json"
        runner._no_symlinks(registry)
        if not registry.exists():
            continue
        if not registry.is_file():
            raise click.ClickException("Verdict directory registry must be a regular file")
        data = ingestion._read_json(registry)
        if (not isinstance(data, dict) or set(data) != {"version", "directories"}
                or type(data["version"]) is not int or data["version"] != 1
                or not isinstance(data["directories"], list)
                or any(not isinstance(item, str) or not item or not Path(item).is_absolute()
                       for item in data["directories"])
                or len(set(data["directories"])) != len(data["directories"])):
            raise click.ClickException("Invalid verdict directory registry")
        directories.update(Path(item) for item in data["directories"])
    directories.update(Path(item).absolute() for item in explicit)
    resolved = set()
    for directory in directories:
        runner._no_symlinks(directory)
        directory = directory.resolve()
        if directory == artifact.parent or not directory.is_relative_to(artifact.parent):
            raise click.ClickException("Registered and explicit verdict directories must be beneath the artifact parent")
        if directory in request_directories:
            raise click.ClickException("Request and verdict directories must be separate")
        if directory.exists() and not directory.is_dir():
            raise click.ClickException("Associated verdict path must be a directory")
        resolved.add(directory)
    return resolved


def _prior_results(directories, out, ids, *, preserved_ids=()):
    results, found = set(), False
    for directory in directories:
        for path in directory.glob("*.json"):
            if directory == out and path.name == ".verdict-directories.json":
                continue
            runner._no_symlinks(path)
            if not path.is_file():
                raise click.ClickException("Associated JSON must be a regular file")
            if directory != out:
                found = True
                if path.stem in ids:
                    results.add(path)
                continue
            try:
                data = ingestion._read_json(path)
                is_request = isinstance(data, dict) and (set(data) == REQUEST_FIELDS or
                    GATE_REQUEST_FIELDS <= set(data) <= GATE_REQUEST_FIELDS | {
                        "argon", "style_policy", "execution_policy", "distractor_evidence", "variant_mode", "variant_policy_version"})
            except (ValueError, UnicodeError, RecursionError):
                is_request = False
            if path.stem in preserved_ids:
                if not is_request or data["candidate_id"] != path.stem:
                    raise click.ClickException("Immutable parent request is invalid")
                continue
            if path.stem not in ids:
                raise click.ClickException("Output contains unrelated JSON; choose a clean directory")
            if is_request:
                if data["candidate_id"] != path.stem:
                    raise click.ClickException("Existing request ID does not match its filename")
            else:
                found = True
                results.add(path)
    return sorted(results), found


def _archive(results):
    """Move old files out of runner-visible filenames without deleting them."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ") + "-" + uuid.uuid4().hex[:8]
    archives = {}
    for path in results:
        archive = archives.get(path.parent)
        if archive is None:
            archive = path.parent / (".export-quarantine-" + stamp)
            archive.mkdir(mode=0o700)
            archives[path.parent] = archive
        os.replace(path, archive / path.name)
        _sync_directory(archive)
        _sync_directory(path.parent)
    return list(archives.values())


def export_requests(artifact, out=None, *, force=False, verdicts=(), recover_request_failures=False):
    """Export frozen requests; optional variant resume never archives or regenerates."""
    if recover_request_failures and (force or out is not None):
        raise click.ClickException("Resume cannot force rejudge or relocate frozen requests")
    artifact = Path(artifact).absolute()
    runner._no_symlinks(artifact)
    runner._no_symlinks(artifact.with_suffix(artifact.suffix + ".lock"))
    if not artifact.is_file():
        raise click.ClickException("Artifact must be a regular JSON file")
    out = Path(out).absolute() if out is not None else request_directory(artifact)
    runner._no_symlinks(out)
    artifact, out = artifact.resolve(), out.resolve()
    if out == artifact.parent or not out.is_relative_to(artifact.parent):
        raise click.ClickException("Output directory must be strictly beneath the artifact parent")
    if out.exists() and not out.is_dir():
        raise click.ClickException("Output must be a directory")
    try:
        with ingestion.artifact_lock(artifact), ExitStack() as locks:
            payload = ingestion._read_json(artifact)
            _validate_payload(payload)
            request_directories = _request_directories(artifact, out, payload)
            if recover_request_failures and any(directory != out for directory in request_directories):
                raise click.ClickException("Resume requires all frozen requests in the default request directory; reconcile custom request roots offline without moving or archiving saved files")
            journal_size = len(payload.get("request_recovery_journal", []))
            resume_ids = _resume_candidates(payload) if recover_request_failures else None
            recovered = len(payload.get("request_recovery_journal", [])) - journal_size
            old_requests = []
            superseded = {entry["repair"]["parent_candidate_id"] for entry in payload["candidates"] if "repair" in entry}
            for entry in payload["candidates"]:
                if entry["candidate_id"] in superseded:
                    continue
                metadata = entry.get("external_judge_request")
                if metadata is not None:
                    old = artifact.parent / metadata["path"]
                    if old.parent.resolve() != out and old.exists():
                        if not old.is_file():
                            raise click.ClickException("Existing request must be a regular file")
                        old_requests.append(old)
            outputs, trimmed = _build_outputs(artifact, out, payload, force=force, resume_ids=resume_ids)
            # Complete validation precedes directory creation and every replacement.
            # Readers lock requests first, so even a newly created verdict directory
            # cannot let a runner race this export.
            held = set()
            for directory in request_directories:
                if directory.is_dir():
                    locks.enter_context(runner.batch_lock(directory))
                    held.add(directory)
            additional = _additional_verdict_directories(artifact, request_directories, verdicts)
            directories = sorted(set(_verdict_directories(artifact, out))
                                 | {directory for directory in additional if directory.is_dir()})
            for directory in directories:
                if directory not in held:
                    locks.enter_context(runner.batch_lock(directory))
                    held.add(directory)
            result_ids = ({entry["candidate_id"] for entry in payload["candidates"]}
                          if recover_request_failures else {path.stem for path, _ in outputs})
            results, found = _prior_results(directories, out, result_ids, preserved_ids=superseded)
            if found and not force and (not recover_request_failures or outputs or recovered):
                raise click.ClickException("Prior verdicts exist; missing requests cannot be resumed without human reconciliation"
                    if recover_request_failures else "Prior verdicts exist; --force archives them before exporting")
            # Validate every local output and prior-result condition before creating files.
            if outputs and not out.exists():
                out.mkdir(parents=True)
                _sync_directory(out.parent)
                locks.enter_context(runner.batch_lock(out))
            archives = _archive(results) if results and not recover_request_failures else []
            request_archives = []
            if outputs:
                for path, raw in outputs:
                    _publish(path, raw)
                # Retire only metadata-linked old candidate files, while both roots
                # remain locked, before the artifact can point at the new root.
                request_archives = _archive(old_requests) if old_requests else []
                ingestion._flush(artifact, payload)
            elif recovered:
                ingestion._flush(artifact, payload)
    except click.ClickException:
        raise
    except (OSError, ValueError, TypeError, KeyError, UnicodeError, RecursionError):
        raise click.ClickException("Export failed; verify the frozen artifact and local files before rerunning") from None
    sizes = sorted(len(raw.decode("utf-8")) for _, raw in outputs)
    def percentile(fraction):
        return sizes[max(0, math.ceil(len(sizes) * fraction) - 1)] if sizes else 0
    summary = {"count": len(sizes), "min_chars": sizes[0] if sizes else 0,
               "p50_chars": percentile(.5), "p95_chars": percentile(.95),
               "max_chars": sizes[-1] if sizes else 0, "trimmed": trimmed,
               "archived_verdicts": len(results) if not recover_request_failures else 0,
               "quarantine_paths": [str(path.relative_to(artifact.parent)) for path in archives],
               "retired_requests": len(old_requests),
               "request_quarantine_paths": [str(path.relative_to(artifact.parent)) for path in request_archives]}
    if recover_request_failures:
        summary["ready_candidate_ids"] = resume_ids
        summary["ready_count"] = len(resume_ids)
        summary["blocked_candidate_ids"] = [entry["candidate_id"] for entry in sorted(payload["candidates"], key=lambda row: row["index"])
                                            if entry["candidate_id"] not in resume_ids]
        summary["blocked_count"] = len(summary["blocked_candidate_ids"])
    click.echo(json.dumps(summary, sort_keys=True))
    return summary


@click.command()
@click.option("--artifact", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--out", type=click.Path(path_type=Path), help="Request directory strictly beneath the artifact parent.")
@click.option("--force", is_flag=True, help="Archive prior verdicts; never override database journals.")
@click.option("--verdicts", multiple=True, type=click.Path(path_type=Path),
              help="Repeat for historical/manual verdict directories beneath the artifact parent.")
def main(artifact, out, force, verdicts):
    """Rebuild requests from frozen sources and evidence, without live calls."""
    export_requests(artifact, out, force=force, verdicts=verdicts)


if __name__ == "__main__":
    main()
