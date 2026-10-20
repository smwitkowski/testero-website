"""Bounded PDE slot replacement with review waves and pre-write admission.

This module performs no work at import. The coordinator injects subprocess and
admission callbacks. Candidate gates remain owned by generation and ingestion.
"""
from collections import Counter
import hashlib
import json
import math
from pathlib import Path


def read_json(path):
    """Read unambiguous finite JSON; saved provenance must not be lossy."""
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON object key")
            result[key] = value
        return result

    def invalid_constant(value):
        raise ValueError("Nonfinite JSON constant")

    def finite_float(value):
        parsed = float(value)
        if not math.isfinite(parsed):
            raise ValueError("Nonfinite JSON number")
        return parsed

    return json.loads(Path(path).read_text(), object_pairs_hook=unique_object,
                      parse_constant=invalid_constant, parse_float=finite_float)


def write_json(path, value):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    temporary.replace(path)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def merge_bank(bank, rows):
    """Union identical IDs; never erase an older bank comparison."""
    result = {row["id"]: row for row in bank}
    for row in rows:
        prior = result.get(row["id"])
        if prior is not None and (
                any(prior.get(key) != row.get(key) for key in ("stem", "key", "cert_id"))
                or sorted(prior.get("distractors", [])) != sorted(row.get("distractors", []))):
            raise ValueError("Conflicting comparison identity")
        result.setdefault(row["id"], row)
    return list(result.values())


def _export_rows(rows):
    raw = []
    for row in rows:
        distractors = row.get("distractors")
        if not isinstance(distractors, list) or len(distractors) != 3:
            raise ValueError("PDE comparison export needs three distractors")
        raw.append({"id": row["id"], "exam": "data-engineer", "status": "DRAFT",
                    "stem": row["stem"], "answers": [
                        {"choice_text": row["key"], "is_correct": True},
                        *[{"choice_text": text, "is_correct": False} for text in distractors]]})
    return raw


def export_bank(path, rows):
    """Encode normalized comparisons as the ordinary ACTIVE/DRAFT export format."""
    write_json(path, _export_rows(rows))


def _command(command, flag, value):
    result = list(command)
    if flag in result:
        result[result.index(flag) + 1] = str(value)
    else:
        result.extend([flag, str(value)])
    return result


def _selected_entries(payload, rows, storage_id):
    selected_ids = {row["id"] for row in rows}
    if len(selected_ids) != len(rows):
        raise ValueError("Admission returned duplicate selected identities")
    entries = []
    for entry in payload["candidates"]:
        if entry.get("publication_selected") is True:
            if storage_id(payload, entry) not in selected_ids:
                raise ValueError("Admission selection does not match its artifact")
            entries.append(entry)
    if len(entries) != len(selected_ids):
        raise ValueError("Admission selection has missing or duplicate identities")
    return entries


def _comparison_omission(entry):
    """Skip malformed authored prose only when the schema gate rejected it.

    A valid-looking published or reviewed row must still satisfy the comparison
    contract. Never turn a comparison integrity failure into a retryable veto.
    """
    from shared.near_duplicates import tokens

    options = entry.get("options")
    valid = (isinstance(entry.get("stem"), str) and bool(entry["stem"].strip())
             and isinstance(options, list) and len(options) == 4
             and all(isinstance(option, dict) and isinstance(option.get("label"), str) for option in options)
             and {option["label"] for option in options} == set("ABCD")
             and isinstance(entry.get("key"), str) and entry["key"] in set("ABCD")
             and all(isinstance(option.get("text"), str) and option["text"].strip()
                     for option in options))
    if valid:
        correct = next(option["text"] for option in options if option["label"] == entry["key"])
        try:
            tokens(entry["stem"])
            tokens(correct)
        except ValueError:
            valid = False  # Only the explicit local lexical-validation failure.
    if valid:
        return None
    if entry.get("schema_check", {}).get("passed") is False or entry.get("failure_stage") == "schema":
        return "Schema-rejected content has no comparable authored scenario and complete choices"
    raise ValueError("Authored comparison content is malformed without a schema rejection")


def coverage_report(plan, slots, *, persisted=False, settled=True):
    """Report accepted output, not merely planned topic hints."""
    planned = Counter(scope["domain_code"] for scope in plan)
    accepted = Counter(plan[slot - 1]["domain_code"] for slot, state in slots.items() if state["selected"])
    topics = {}
    for slot, scope in enumerate(plan, 1):
        topic = scope.get("required_topic_id")
        if not topic:
            continue
        state = slots[slot]
        record = topics.setdefault(topic, {"topic_id": topic,
                                            "status": "attempts_exhausted" if settled else "retry_pending", "attempts": 0,
                                            "plan_slots": [], "candidate_ids": []})
        record["attempts"] += state["attempts"]
        record["plan_slots"].append(slot)
        if state["selected"]:
            record["status"] = "covered"
            record["candidate_ids"].append(state["selected"])
    return {"coverage_basis": "persisted_DRAFT" if persisted else "dry_run_admitted_not_persisted",
            "topics": list(topics.values()),
            "sections": [{"section": section, "planned": count, "accepted": accepted[section],
                           "shortfall": count - accepted[section]} for section, count in planned.items()]}


def _wave_target(artifact, attempt):
    return artifact if attempt == 1 else artifact.with_name(artifact.stem + f"-retry{attempt - 1}.json")


def _frozen_scope(scope):
    return {key: value for key, value in scope.items()
            if key not in {"decision_objective", "decision_plan", "decision_proof"}}


def _no_saved_writes(payload):
    if payload.get("generation_runs") or payload.get("external_run_journal"):
        raise ValueError("Persistence journals require human reconciliation before resume")
    for row in payload["candidates"]:
        if (row.get("persistence_status") is not None or row.get("inserted_question_id") is not None
                or row.get("accepted") is True or row.get("persistence_validation_failed")
                or row.get("persisted") is True
                or row.get("status") in {"ACTIVE", "active", "persisted", "inserted"}):
            raise ValueError("Persistence journals require human reconciliation before resume")


def _cohort_hashes(export, targets):
    files = {str(export): digest(export)}
    for target in targets:
        files[str(target)] = digest(target)
        for suffix in (".plan.json", ".existing.json"):
            sidecar = target.with_suffix(suffix)
            if sidecar.exists():
                files[str(sidecar)] = digest(sidecar)
        for directory in (target.with_suffix(".judge-requests"), target.with_suffix(".verdicts")):
            for path in directory.rglob("*.json"):
                if path.is_symlink():
                    raise ValueError("Frozen admission input cannot be a symlink")
                files[str(path)] = digest(path)
    return files


def _selection_diagnostics(payload, result):
    passes = [row for row in payload["candidates"]
              if row.get("judge_verdict", {}).get("passed") is True
              or row.get("status") == "external_judge_passed"]
    rejected_passes = []
    for row in passes:
        if row.get("publication_selected") is True:
            continue
        if not row.get("failure_stage") or not row.get("reason"):
            raise ValueError("Non-selected judge PASS lacks an admission rejection reason")
        rejected_passes.append({key: row.get(key) for key in
                               ("index", "candidate_id", "failure_stage", "reason", "product_share_check",
                                "answer_pattern_check", "near_duplicate_check")})
    return {"external_judge_passed": len(passes), "selected_count": len(result["selected_candidates"]),
            "non_selected_judge_passes": rejected_passes,
            "quality_rejections": result.get("quality_rejections"),
            "product_share_report": payload.get("product_share_report"),
            "batch_reports": {key: value for key, value in payload.items() if key.endswith("_report")}}


def _resume_preflight(artifact, export, report_path, retry_attempts, storage_id):
    """Validate all saved cohorts before a judge, generation, or admission call."""
    import re

    if not artifact.is_file() or not report_path.is_file():
        raise ValueError("Resume requires an existing artifact and retry report")
    report = read_json(report_path)
    if (report.get("version") != 1 or report.get("status") not in {"reviewing", "admitted"}
            or report.get("requires_reconciliation") or report.get("completed_waves")
            or report.get("retry_attempts") != retry_attempts
            or not isinstance(report.get("waves"), list) or not report["waves"]
            or len(report["waves"]) > retry_attempts + 1):
        raise ValueError("Retry report is not resumable; preserve attempt cap and reconcile writes")
    if artifact.is_symlink() or report_path.is_symlink() or export.is_symlink():
        raise ValueError("Resume inputs cannot be symlinks")
    for name, expected in report.get("frozen_files", {}).items():
        path = Path(name)
        if path.is_symlink() or digest(path) != expected:
            raise ValueError("Frozen resume input changed")
    # Refuse orphaned/over-budget cohorts, rather than overwriting or ignoring them.
    for path in artifact.parent.glob(artifact.stem + "-retry*"):
        match = re.fullmatch(re.escape(artifact.stem) + r"-retry([1-9][0-9]*)(?:\.json(?:\.calls\.jsonl|\.lock)?|\.plan\.json|\.existing\.json|\.judge-requests|\.verdicts)", path.name)
        if (path.is_symlink() or not match or int(match[1]) > retry_attempts
                or not _wave_target(artifact, int(match[1]) + 1).is_file()):
            raise ValueError("Orphaned or over-budget retry artifact; reconcile before resume")
    initial = read_json(artifact)
    plan = initial["plan"]
    if not plan:
        raise ValueError("Resume requires a complete original plan")
    states = {slot: None for slot in range(1, len(plan) + 1)}
    saved = {}
    for attempt in range(1, retry_attempts + 2):
        target = _wave_target(artifact, attempt)
        if not target.exists():
            if any(_wave_target(artifact, later).exists() for later in range(attempt + 1, retry_attempts + 2)):
                raise ValueError("Saved retry waves are not contiguous")
            break
        if attempt > len(report["waves"]) + 1:
            raise ValueError("Saved cohort has no preceding reviewed wave")
        if target.is_symlink():
            raise ValueError("Resume artifact cannot be a symlink")
        payload = read_json(target)
        _no_saved_writes(payload)
        pending = list(states) if attempt == 1 else [slot for slot in states if not states[slot]]
        if (not pending or len(payload["plan"]) != len(pending)
                or len(payload["candidates"]) != len(pending)
                or [row.get("index") for row in payload["candidates"]] != list(range(1, len(pending) + 1))):
            raise ValueError("Saved generation did not finish every planned candidate")
        if [_frozen_scope(scope) for scope in payload["plan"]] != [_frozen_scope(plan[slot - 1]) for slot in pending]:
            raise ValueError("Saved replacement changed its pinned topic or section scope")
        record = report["waves"][attempt - 1] if attempt <= len(report["waves"]) else None
        if record is not None:
            if (record.get("artifact") != str(target) or record.get("verdicts") != str(target.with_suffix(".verdicts"))
                    or record.get("attempt") != attempt or record.get("slots") != pending):
                raise ValueError("Saved retry report changed wave paths, slots or attempts")
            selected = _selected_entries(payload, [{"id": ident} for ident in record["selected_ids"]], storage_id)
            if [row["candidate_id"] for row in selected] != record.get("candidate_ids"):
                raise ValueError("Saved retry report changed selected candidate identities")
            for row in selected:
                states[pending[row["index"] - 1]] = row["candidate_id"]
        if attempt > 1:
            manifest_path, snapshot = target.with_suffix(".plan.json"), target.with_suffix(".existing.json")
            if manifest_path.is_symlink() or snapshot.is_symlink():
                raise ValueError("Saved retry provenance cannot be a symlink")
            manifest = read_json(manifest_path)
            expected_slots = [{"plan_slot": slot, "attempt": attempt} for slot in pending]
            if (set(manifest) != {"version", "cert_id", "source_artifact", "source_sha256", "full_plan_count", "slots"}
                    or manifest.get("version") != 1 or manifest.get("cert_id") != "data-engineer"
                    or manifest.get("source_artifact") != str(artifact)
                    or manifest.get("full_plan_count") != len(plan) or manifest.get("slots") != expected_slots
                    or payload.get("retry_slots") != expected_slots
                    or payload.get("retry_source") != {"source_artifact": str(artifact), "source_sha256": manifest["source_sha256"]}
                    or payload.get("full_plan_count") != len(plan)
                    or payload.get("existing_questions", {}).get("sha256") != digest(snapshot)):
                raise ValueError("Saved retry provenance differs from frozen plan or comparison bank")
            if manifest["source_sha256"] != digest(artifact):
                # Admission can update the original artifact after generation. Only
                # a report-bound, previously validated source digest permits this.
                bound = report.get("frozen_files", {})
                if (not record or record.get("source_sha256") != manifest["source_sha256"]
                        or any(str(path) not in bound for path in (artifact, target, manifest_path, snapshot))):
                    raise ValueError("Frozen retry source changed")
        requests = target.with_suffix(".judge-requests")
        if requests.is_symlink() or not requests.is_dir():
            raise ValueError("Saved generation is missing its frozen request directory")
        for directory in (requests, target.with_suffix(".verdicts")):
            if directory.is_symlink() or any(path.is_symlink() for path in directory.rglob("*")):
                raise ValueError("Saved judge cohort cannot contain symlinks")
        from scripts.ingest_external_verdicts import validate_saved_judge_requests
        validate_saved_judge_requests(target, payload)
        saved[attempt] = (payload, record)
    if len(saved) < len(report["waves"]):
        raise ValueError("Retry report references a missing saved wave")
    if report["status"] == "admitted":
        population = sorted(ident for wave in report["waves"] for ident in wave["candidate_ids"])
        if (len(saved) != len(report["waves"]) or report.get("balance_population_ids") != population
                or not report.get("frozen_files")
                or (len(saved) < retry_attempts + 1 and any(value is None for value in states.values()))):
            raise ValueError("Admitted report has incomplete waves or balance provenance")
    frozen_export = initial.get("existing_questions", {}).get("sha256")
    if frozen_export is not None and frozen_export != digest(export):
        raise ValueError("Saved initial comparison export changed")
    return report, saved


def run_retry_batch(artifact, export, commands, *, retry_attempts, execute, admit,
                    load_bank, comparison, storage_id, write=True, resume=False,
                    acknowledge_saved_system_failures=False):
    """Review candidates and refill rejected slots within the original attempt cap.

    Resume reuses saved cohorts and never regenerates their content or requests.
    Only an explicit acknowledgement can skip a supported saved transport failure;
    new system failures remain fatal. Saved writes always require reconciliation.
    All admission passes finish before any write. A second complete dry pass
    freezes aggregate option balance and checks expected IDs. Each final write
    checks that same selection before opening its database client. Exceptions
    are never swallowed: only the owned admission API classifies quality rejects.
    """
    if type(retry_attempts) is not int or retry_attempts < 0:
        raise ValueError("Retry attempts must be a nonnegative integer")
    if type(resume) is not bool or type(acknowledge_saved_system_failures) is not bool:
        raise ValueError("Resume and saved-failure acknowledgement must be booleans")
    if acknowledge_saved_system_failures and not resume:
        raise ValueError("Saved system failures can only be acknowledged with resume")
    artifact, export = Path(artifact).absolute(), Path(export).absolute()
    report_path = artifact.with_suffix(".retry-report.json")
    saved_report, saved = ({}, {})
    if resume:
        saved_report, saved = _resume_preflight(artifact, export, report_path, retry_attempts, storage_id)
    elif report_path.exists() or list(artifact.parent.glob(artifact.stem + "-retry*")):
        raise ValueError("Retry artifact or sidecar exists; use a new tag")
    acknowledgements = {}
    saved_failures = []
    if resume:
        from scripts.ingest_external_verdicts import saved_system_failure_ids
        for attempt, (payload, _) in saved.items():
            ids = saved_system_failure_ids(payload)
            failures = [{key: row.get(key) for key in ("candidate_id", "error_class", "failure_stage")}
                        for row in payload["candidates"] if row["candidate_id"] in ids]
            if failures and not acknowledge_saved_system_failures:
                raise ValueError("Saved system failures require explicit acknowledgement before resume")
            acknowledgements[attempt] = [row["candidate_id"] for row in failures]
            saved_failures.extend({"artifact": str(_wave_target(artifact, attempt)), **row} for row in failures)
    def admission(target, verdicts, **kwargs):
        attempt = next((number for number in acknowledgements if _wave_target(artifact, number) == target), None)
        ids = acknowledgements.get(attempt, [])
        if ids:
            kwargs["acknowledged_system_failure_ids"] = ids
        return admit(target, verdicts, **kwargs)
    initial_bank = load_bank(export)
    bank, comparison_bank = list(initial_bank), list(initial_bank)
    waves, slots, plan = [], {}, None
    generate, judge = commands[:2]
    for attempt in range(1, retry_attempts + 2):
        pending_slots = list(slots) if attempt == 1 else [slot for slot, state in slots.items() if not state["selected"]]
        if attempt > 1 and not pending_slots:
            break
        target = _wave_target(artifact, attempt)
        wave_generate = _command(generate, "--artifact", target)
        if "--continue-quality-rejections" not in wave_generate:
            wave_generate.append("--continue-quality-rejections")
        if attempt not in saved and attempt > 1:
            frozen = target.with_suffix(".plan.json")
            snapshot = target.with_suffix(".existing.json")
            write_json(frozen, {"version": 1, "cert_id": "data-engineer", "source_artifact": str(artifact),
                               "source_sha256": digest(artifact), "full_plan_count": len(plan),
                               "slots": [{"plan_slot": slot, "attempt": attempt} for slot in pending_slots]})
            export_bank(snapshot, comparison_bank)
            wave_generate = _command(wave_generate, "--existing-questions", snapshot)
            wave_generate = _command(wave_generate, "--n-questions", len(pending_slots))
            wave_generate.extend(["--frozen-plan", str(frozen)])
        if attempt not in saved:
            execute(wave_generate)
        payload = read_json(target)
        if attempt == 1:
            plan = payload["plan"]
            slots = {slot: {"attempts": 0, "selected": None} for slot in range(1, len(plan) + 1)}
            pending_slots = list(slots)
        if (len(payload["plan"]) != len(pending_slots) or len(payload["candidates"]) != len(pending_slots)
                or [row.get("index") for row in payload["candidates"]] != list(range(1, len(pending_slots) + 1))):
            raise ValueError("Generation did not finish every planned candidate")
        if attempt > 1:
            if ([_frozen_scope(scope) for scope in payload["plan"]]
                    != [_frozen_scope(plan[slot - 1]) for slot in pending_slots]):
                raise ValueError("Replacement changed its pinned topic or section scope")
        if attempt in saved and attempt > 1:
            if read_json(target.with_suffix(".existing.json")) != _export_rows(comparison_bank):
                raise ValueError("Saved retry comparison bank differs from earlier authored content")
        requests = target.with_suffix(".judge-requests")
        verdicts = target.with_suffix(".verdicts")
        requests.mkdir(exist_ok=True)
        wave_judge = _command(_command(judge, "--requests", requests), "--verdicts", verdicts)
        saved_record = saved.get(attempt, (None, None))[1]
        if saved_record is None:
            execute(wave_judge)  # The runner skips existing verdicts without regenerating requests.
        expected = {"expected_selected_ids": saved_record["selected_ids"]} if saved_record else {}
        if saved_report.get("status") == "admitted":
            expected["balance_population_ids"] = saved_report["balance_population_ids"]
        result = admission(target, verdicts, dry_run=True, publication_bank=bank,
                           continue_quality_rejections=True, full_plan_count=len(plan), **expected)
        payload = read_json(target)
        selected = _selected_entries(payload, result["selected_candidates"], storage_id)
        selected_by_index = {row["index"]: row for row in selected}
        for index, slot in enumerate(pending_slots, 1):
            slots[slot]["attempts"] += 1
            if index in selected_by_index:
                slots[slot]["selected"] = selected_by_index[index]["candidate_id"]
        bank = merge_bank(bank, result["selected_candidates"])
        omissions = []
        for entry in payload["candidates"]:
            if entry.get("options") or entry.get("schema_check", {}).get("passed") is False:
                omission = _comparison_omission(entry)
                if omission is not None:
                    omissions.append({"candidate_id": entry["candidate_id"], "reason": omission})
                    continue
                comparison_bank = merge_bank(comparison_bank, [comparison(entry)])
        record = {"artifact": str(target), "verdicts": str(verdicts),
                  "comparison_omissions": omissions,
                  "slots": pending_slots, "attempt": attempt,
                  "selected_ids": [row["id"] for row in result["selected_candidates"]],
                  "candidate_ids": [row["candidate_id"] for row in selected],
                  "selection_diagnostics": _selection_diagnostics(payload, result)}
        if attempt > 1:
            record["source_sha256"] = read_json(target.with_suffix(".plan.json"))["source_sha256"]
        waves.append(record)
        if saved_record is None:
            write_json(report_path, {"version": 1, "status": "reviewing", "retry_attempts": retry_attempts,
                                     "waves": waves, "acknowledged_saved_system_failures": saved_failures,
                                     "frozen_files": _cohort_hashes(export, [Path(wave["artifact"]) for wave in waves]),
                                     **coverage_report(plan, slots, settled=False)})
    population = sorted(ident for wave in waves for ident in wave["candidate_ids"])
    # Complete the globally balanced dry replay before even the first write.
    bank = list(initial_bank)
    for wave in waves:
        result = admission(Path(wave["artifact"]), Path(wave["verdicts"]), dry_run=True, publication_bank=bank,
                       continue_quality_rejections=True, full_plan_count=len(plan),
                       expected_selected_ids=wave["selected_ids"], balance_population_ids=population)
        bank = merge_bank(bank, result["selected_candidates"])
        wave["selection_diagnostics"] = _selection_diagnostics(read_json(wave["artifact"]), result)
    frozen_files = _cohort_hashes(export, [Path(wave["artifact"]) for wave in waves])
    summary = {"version": 1, "status": "admitted", "retry_attempts": retry_attempts,
               "waves": waves, "balance_population_ids": population, "frozen_files": frozen_files,
               "acknowledged_saved_system_failures": saved_failures,
               **coverage_report(plan, slots)}
    write_json(report_path, summary)
    if write:
        bank = list(initial_bank)
        remaining = dict(frozen_files)
        summary["completed_waves"] = []
        try:
            for wave in waves:
                # Check the complete remaining frozen cohort before each write.
                for name, expected in remaining.items():
                    if digest(name) != expected:
                        raise ValueError("Frozen admission input changed before persistence")
                target = Path(wave["artifact"])
                summary.update(status="writing", current_wave=wave["artifact"])
                write_json(report_path, summary)
                result = admission(target, Path(wave["verdicts"]), dry_run=False, publication_bank=bank,
                               continue_quality_rejections=True, full_plan_count=len(plan),
                               expected_selected_ids=wave["selected_ids"], balance_population_ids=population)
                bank = merge_bank(bank, result["selected_candidates"])
                remaining.pop(str(target))  # Its completed persistence journal is now mutable.
                summary["completed_waves"].append(wave["artifact"])
        except Exception:
            summary.update(status="write_interrupted", requires_reconciliation=True)
            write_json(report_path, summary)
            raise
        summary.pop("current_wave", None)
        summary.update(status="persisted", **coverage_report(plan, slots, persisted=True))
        summary["completed_artifact_sha256"] = {wave["artifact"]: digest(wave["artifact"]) for wave in waves}
        write_json(report_path, summary)
    return summary
