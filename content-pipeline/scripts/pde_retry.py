"""Bounded PDE slot replacement with review waves and pre-write admission.

This module performs no work at import. The coordinator injects subprocess and
admission callbacks. Candidate gates remain owned by generation and ingestion.
"""
from collections import Counter
import hashlib
import json
from pathlib import Path


def read_json(path):
    return json.loads(Path(path).read_text())


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


def export_bank(path, rows):
    """Encode normalized comparisons as the ordinary ACTIVE/DRAFT export format."""
    raw = []
    for row in rows:
        distractors = row.get("distractors")
        if not isinstance(distractors, list) or len(distractors) != 3:
            raise ValueError("PDE comparison export needs three distractors")
        raw.append({"id": row["id"], "exam": "data-engineer", "status": "DRAFT",
                    "stem": row["stem"], "answers": [
                        {"choice_text": row["key"], "is_correct": True},
                        *[{"choice_text": text, "is_correct": False} for text in distractors]]})
    write_json(path, raw)


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


def run_retry_batch(artifact, export, commands, *, retry_attempts, execute, admit,
                    load_bank, comparison, storage_id, write=True):
    """Review every initial candidate, then retry rejected slots in bounded waves.

    All admission passes finish before any write. A second complete dry pass
    freezes aggregate option balance and checks expected IDs. Each final write
    checks that same selection before opening its database client. Exceptions
    are never swallowed: only the owned admission API classifies quality rejects.
    """
    if type(retry_attempts) is not int or retry_attempts < 0:
        raise ValueError("Retry attempts must be a nonnegative integer")
    artifact, export = Path(artifact), Path(export)
    report_path = artifact.with_suffix(".retry-report.json")
    if report_path.exists() or list(artifact.parent.glob(artifact.stem + "-retry*")):
        raise ValueError("Retry artifact or sidecar exists; use a new tag")
    initial_bank = load_bank(export)
    bank, comparison_bank = list(initial_bank), list(initial_bank)
    waves, slots, plan = [], {}, None
    generate, judge = commands[:2]
    for attempt in range(1, retry_attempts + 2):
        pending_slots = list(slots) if attempt == 1 else [slot for slot, state in slots.items() if not state["selected"]]
        if attempt > 1 and not pending_slots:
            break
        target = artifact if attempt == 1 else artifact.with_name(artifact.stem + f"-retry{attempt - 1}.json")
        wave_generate = _command(generate, "--artifact", target)
        if "--continue-quality-rejections" not in wave_generate:
            wave_generate.append("--continue-quality-rejections")
        if attempt > 1:
            frozen = target.with_suffix(".plan.json")
            snapshot = target.with_suffix(".existing.json")
            write_json(frozen, {"version": 1, "cert_id": "data-engineer", "source_artifact": str(artifact),
                               "source_sha256": digest(artifact), "full_plan_count": len(plan),
                               "slots": [{"plan_slot": slot, "attempt": attempt} for slot in pending_slots]})
            export_bank(snapshot, comparison_bank)
            wave_generate = _command(wave_generate, "--existing-questions", snapshot)
            wave_generate = _command(wave_generate, "--n-questions", len(pending_slots))
            wave_generate.extend(["--frozen-plan", str(frozen)])
        execute(wave_generate)
        payload = read_json(target)
        if attempt == 1:
            plan = payload["plan"]
            slots = {slot: {"attempts": 0, "selected": None} for slot in range(1, len(plan) + 1)}
            pending_slots = list(slots)
        if len(payload["plan"]) != len(pending_slots) or len(payload["candidates"]) != len(pending_slots):
            raise ValueError("Generation did not finish every planned candidate")
        if attempt > 1:
            def frozen_scope(scope):
                return {key: value for key, value in scope.items()
                        if key not in {"decision_objective", "decision_plan", "decision_proof"}}
            if ([frozen_scope(scope) for scope in payload["plan"]]
                    != [frozen_scope(plan[slot - 1]) for slot in pending_slots]):
                raise ValueError("Replacement changed its pinned topic or section scope")
        requests = target.with_suffix(".judge-requests")
        verdicts = target.with_suffix(".verdicts")
        requests.mkdir(exist_ok=True)
        wave_judge = _command(_command(judge, "--requests", requests), "--verdicts", verdicts)
        execute(wave_judge)  # No retry generation begins before the entire cohort is reviewed.
        result = admit(target, verdicts, dry_run=True, publication_bank=bank,
                       continue_quality_rejections=True, full_plan_count=len(plan))
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
                  "candidate_ids": [row["candidate_id"] for row in selected]}
        waves.append(record)
        write_json(report_path, {"version": 1, "status": "reviewing", "retry_attempts": retry_attempts,
                                 "waves": waves, **coverage_report(plan, slots, settled=False)})
    population = sorted(ident for wave in waves for ident in wave["candidate_ids"])
    # Complete the globally balanced dry replay before even the first write.
    bank = list(initial_bank)
    for wave in waves:
        result = admit(Path(wave["artifact"]), Path(wave["verdicts"]), dry_run=True, publication_bank=bank,
                       continue_quality_rejections=True, full_plan_count=len(plan),
                       expected_selected_ids=wave["selected_ids"], balance_population_ids=population)
        bank = merge_bank(bank, result["selected_candidates"])
    frozen_files = {str(export): digest(export)}
    for wave in waves:
        target, verdicts = Path(wave["artifact"]), Path(wave["verdicts"])
        frozen_files[str(target)] = digest(target)
        for suffix in (".plan.json", ".existing.json"):
            sidecar = target.with_suffix(suffix)
            if sidecar.exists():
                frozen_files[str(sidecar)] = digest(sidecar)
        for directory in (target.with_suffix(".judge-requests"), verdicts):
            for path in directory.rglob("*.json"):
                frozen_files[str(path)] = digest(path)
    summary = {"version": 1, "status": "admitted", "retry_attempts": retry_attempts,
               "waves": waves, "balance_population_ids": population, "frozen_files": frozen_files,
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
                result = admit(target, Path(wave["verdicts"]), dry_run=False, publication_bank=bank,
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
