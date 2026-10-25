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
from scripts.generate_pmle_questions import (
    database_client as _database_client, persist_candidate, write_artifact, product_share_row,
    is_acknowledgeable_system_failure,
)
from shared.cert_context import plan_questions
from shared.objective_style import validate_style_policy, uses_pde_style
from shared.cert_context import tune_generation_scope
from shared.cert_generation_policy import generation_policy, product_share_report, topic_distribution, select_publication_products
from shared.answer_patterns import check_answer_pattern
from shared.cert_generation_policy import TUNING_SCOPE_FIELDS
from shared.batch_report import ml_practice_report
from shared.cli_models import parse_output
from shared.completion_diagnostics import _safe_completion
from shared.dedupe import normalize_stem
from shared.doc_search import documentation_context
from shared.option_order import canonical_evidence, balance_options, balanced_order
from shared.near_duplicates import check_near_duplicate, comparison_row, tokens
from shared.batch_report import key_position_report, format_key_position_report, template_diversity_report
from shared.evidence import check_evidence
from shared.external_judge import (
    EXTERNAL_JUDGE_PROVENANCE, EXTERNAL_POLICY_MODEL, build_request, documentation_context_limit,
    candidate_storage_id, candidate_question, request_directory,
    validate_candidate_records, canonical_sha256, eligible_repair_verdict, validate_decision_provenance,
)
from shared.model_policy import require_independent_models
from shared.quality_gate import QuestionQualitySignature, LEGACY_ROUND4_QUALITY_SIGNATURE, judge_question
from shared.validator import validate_question
from shared.batch_report import option_length_report, format_option_length_report, option_prefix_report, format_option_prefix_report, key_length_rank_report

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


def refuse_council_canary(path, payload):
    """Block marked artifacts and artifacts below a .council-canaries boundary.

    The marker is directory metadata, never a field in judge-visible requests.
    The shared filesystem barrier checks ancestors and refuses symlink paths.
    Also block request references back into a marked canary workspace.

    Raises:
        ValueError: The artifact or its request cohort is a council canary.
    """
    from shared.council_safety import refuse_canary_paths
    refuse_canary_paths(path)
    if not isinstance(payload, dict):
        return
    candidates = payload.get("candidates", [])
    rows = [payload, *[row for row in candidates if isinstance(row, dict)]] if isinstance(candidates, list) else [payload]
    if any(row.get("council_canary") is True for row in rows):
        raise ValueError("Council canary artifacts cannot be ingested or published")
    for row in rows[1:]:
        metadata = row.get("external_judge_request")
        if isinstance(metadata, dict) and isinstance(metadata.get("path"), str):
            refuse_canary_paths(Path(path).parent / metadata["path"])


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
    historical_pde = payload["cert_id"] == "data-engineer"
    source_index = index
    if "retry_slots" in payload:
        slots, full_count = payload["retry_slots"], payload.get("full_plan_count")
        if (not historical_pde or not isinstance(slots, list) or len(slots) != len(payload["plan"])
                or type(full_count) is not int or full_count < len(payload["plan"])):
            raise ValueError("Invalid frozen retry slot provenance")
        original_indices = []
        for slot in slots:
            if (not isinstance(slot, dict) or set(slot) != {"plan_slot", "attempt"}
                    or type(slot["plan_slot"]) is not int or not 1 <= slot["plan_slot"] <= full_count
                    or type(slot["attempt"]) is not int or slot["attempt"] < 2):
                raise ValueError("Invalid frozen retry slot provenance")
            original_indices.append(slot["plan_slot"])
        if len(set(original_indices)) != len(original_indices):
            raise ValueError("Duplicate frozen retry plan slots")
        source_index = original_indices[index - 1]
    current = plan_questions(payload["cert_id"], source_index, objective_ids=[scope["objective_id"]],
                             **({"generation_tuning": False} if historical_pde else {}))
    expected = current[source_index - 1]
    tuned = uses_pde_style(scope.get("style_policy"))
    if tuned:
        if payload["cert_id"] != "data-engineer" or payload.get("rules_version") != 5:
            raise ValueError("PDE tuning requires the frozen rules-v5 PDE batch")
        if payload.get("generation_policy") != generation_policy(payload["cert_id"]):
            raise ValueError("Frozen generation policy differs from reviewed configuration")
        expected = tune_generation_scope(expected, source_index - 1, topic_id=scope.get("required_topic_id"),
                                         coverage_scope=scope.get("topic_coverage_scope"),
                                         policy=payload["generation_policy"])
        if any(entry.get(key) != scope.get(key) for key in TUNING_SCOPE_FIELDS):
            raise ValueError("Candidate differs from frozen PDE generation hints")
    elif "generation_policy" in payload or any(key in scope or key in entry for key in TUNING_SCOPE_FIELDS):
        raise ValueError("PDE generation hints require frozen rules-v5.2 provenance")
    # Deterministic registry scope stays exact; LLM decision/proof data is frozen separately.
    provenance_fields = {"objective_offset", "decision_plan", "decision_proof", "decision_objective", "style_policy", "distractor_evidence", "doccheck_policy"}
    if "doccheck_policy" in payload:
        if (payload["doccheck_policy"] not in ("v5", "v6")
                or scope.get("doccheck_policy") != payload["doccheck_policy"]
                or entry.get("doccheck_policy") != payload["doccheck_policy"]):
            raise ValueError("Mixed frozen doccheck policies")
    elif "doccheck_policy" in scope or "doccheck_policy" in entry:
        raise ValueError("Doccheck policy requires frozen batch provenance")
    from shared.distractor_evidence import validate_policy
    if "distractor_evidence" in payload:
        validate_policy(payload["distractor_evidence"])
        if (payload.get("rules_version") != 5 or scope.get("distractor_evidence") != payload["distractor_evidence"]
                or entry.get("distractor_evidence") != payload["distractor_evidence"]):
            raise ValueError("Mixed frozen distractor-evidence modes")
    elif "distractor_evidence" in scope or "distractor_evidence" in entry:
        raise ValueError("Distractor-evidence mode requires frozen batch provenance")
    policy = scope.get("style_policy")
    if payload.get("style_policy_version") == "5.1" or tuned:
        validate_style_policy(policy, scope["objective_id"])
        if policy["version"] != payload["style_policy_version"]:
            raise ValueError("Style policy version differs from frozen batch")
    elif policy is not None or entry.get("style_policy") is not None:
        raise ValueError("Style policy requires frozen rules v5.1/v5.2 batch provenance")
    if entry.get("style_policy") != policy:
        raise ValueError("Candidate differs from its frozen style policy")
    for key in ("decision_plan", "decision_proof", "decision_objective", "key_length_rank"):
        if key in scope and entry.get(key) != scope[key]:
            raise ValueError("Candidate does not match its frozen decision provenance")
    if "decision_objective" in scope and scope["decision_objective"] != {
            "objective_id": expected["objective_id"], "objective_text": expected["objective_text"]}:
        raise ValueError("Decision objective differs from the current registry")
    if payload.get("external_judge_version") == 1 and "key_length_rank" not in scope:
        # The exact known v3 scope predates the rank hint; no arbitrary prompt edits.
        expected = dict(expected)
        expected.pop("key_length_rank")
        rank_hint = (f"\nKey length rank hint: {index % 4 or 4} of 4 (1 shortest, 4 longest)."
                     " Distribute key ranks evenly, reaching comparable length with meaningful detail."
                     " Rank 4 should tie one non-key option for longest; never make the key uniquely"
                     " longest. Keep all options balanced and the mechanical two-word key lead limit.")
        if not expected["domain_prompt"].endswith(rank_hint):
            raise ValueError("Unknown historical rank-hint transform")
        expected["domain_prompt"] = expected["domain_prompt"][:-len(rank_hint)]
    if expected is None or {k: v for k, v in scope.items() if k not in provenance_fields} != {
            k: v for k, v in expected.items() if k not in provenance_fields}:
        raise ValueError("Frozen scope differs from the current registry")
    return scope


class CandidateValidationError(ValueError):
    """Local validation failed at the recorded pipeline stage."""

    def __init__(self, stage, error):
        self.stage, self.error_class = stage, type(error).__name__
        super().__init__(_safe_completion(str(error))[:1000])


def _taxonomy_tags(payload, entry, scope):
    enabled = payload.get("taxonomy_enabled", False)
    if type(enabled) is not bool:
        raise ValueError("Invalid taxonomy mode")
    if enabled:
        from shared.question_taxonomy import validate_generation_receipt
        return validate_generation_receipt(entry.get("taxonomy"), scope)
    if "taxonomy" in entry:
        raise ValueError("Tags require an explicitly enabled taxonomy artifact")
    return None


def _validate_candidate(path, payload, entry):
    stage = "scope"
    try:
        scope = _scope(payload, entry)
        stage = "schema"
        question = candidate_question(entry)
        candidate_storage_id(entry, scope, question)
        if payload.get("external_judge_version") == 2:
            stage = "decision_veto"
            validate_decision_provenance(scope, entry)
        stage = "schema"
        if not validate_question(question, **({"style_policy": scope["style_policy"]}
                                            if uses_pde_style(scope.get("style_policy")) else {})).is_valid:
            raise ValueError("Question schema validation failed")
        stage = "mechanical"
        checked = check_evidence(canonical_evidence(entry), entry.get("sources"))
        if not checked["passed"] or checked["options"] != canonical_evidence(entry):
            raise ValueError("Frozen receipts or source provenance failed validation")
        stage = "external_request"
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
        v4 = payload.get("external_judge_version") == 2
        rebuilt = build_request(entry["candidate_id"], scope, question, entry["sources"], checked["options"],
                                 doc_context_chars=documentation_context_limit(payload, entry),
                                **({"gate_version": payload.get("rules_version", 4), "argon_gate": payload.get("argon_gate", False), "execution_policy": payload.get("execution_policy")} if v4 else {"signature": QuestionQualitySignature}))
        if canonical_sha256(frozen) != canonical_sha256(rebuilt):
            # Only unchanged originals may retain the exact known preceding 14-field rubric.
            # No arbitrary old schema or historical 13-field request is accepted.
            if v4 or "repair" in entry or documentation_context_limit(payload, entry) is not None or canonical_sha256(frozen) != canonical_sha256(build_request(
                    entry["candidate_id"], scope, question, entry["sources"], checked["options"],
                    signature=LEGACY_ROUND4_QUALITY_SIGNATURE)):
                raise ValueError("External request differs from frozen content or supported rubric")
        _taxonomy_tags(payload, entry, scope)
        return scope, question, checked

    except (ValueError, KeyError, TypeError, OSError, UnicodeError, StopIteration) as error:
        raise CandidateValidationError(stage, error) from None


def _reject(entry, stage, reason):
    reason = _safe_completion(reason)[:1000]
    entry["failure_stage"], entry["reason"] = stage, reason
    entry.setdefault("error_class", "CandidateRejected")
    entry["error_message"] = reason
    if stage in ("external_request", "external_verdict"):
        entry["judge_verdict"] = {"passed": False, "score": 0.0, "reason": reason,
                                  "model": EXTERNAL_JUDGE_PROVENANCE}
    # A verdict decision is not a persisted acceptance, including in dry-run.
    if entry.get("persistence_status") != "complete":
        entry["accepted"] = False


def _external_decision(question, scope, sources, evidence, raw, generator_model, *, gate_version=2, rules_version=4, argon_request=None):
    require_independent_models(generator_model, EXTERNAL_POLICY_MODEL)
    if gate_version == 2:
        from shared.gates import aggregate_gate_verdict
        from shared.distractor_evidence import verdict_gates, verdict_with_policy
        policy = scope.get("distractor_evidence")
        raw = verdict_gates(raw, policy)
        base = raw
        if argon_request is not None:
            from shared.argon_gate import evaluate_argon, MODEL
            require_independent_models(generator_model, MODEL)
            if not isinstance(raw, dict) or set(raw) != {"blind_solver", "style", "evidence", "argon"}:
                raise ValueError("All four gates required")
            base = {name: raw[name] for name in ("blind_solver", "style", "evidence")}
            if raw["argon"] == {"status": "skipped", "reason": "prior_gate_failed"}:
                decision = aggregate_gate_verdict(question, verdict_with_policy(base, policy), model=EXTERNAL_JUDGE_PROVENANCE,
                    version=rules_version, style_policy=scope.get("style_policy"), distractor_evidence=policy)
                if argon_request["version"] not in (2, 3) or decision.passed:
                    raise ValueError("Argon skip cannot approve content")
                return decision
            passed, reason = evaluate_argon(question, raw["argon"], argon_request)
        decision = aggregate_gate_verdict(question, verdict_with_policy(base, policy), model=EXTERNAL_JUDGE_PROVENANCE, version=rules_version,
                                          style_policy=scope.get("style_policy"), distractor_evidence=policy)
        if argon_request is not None and not passed:
            from shared.quality_gate import JudgeVerdict
            return JudgeVerdict(False, 0.0, ("Argon: " + reason)[:300], EXTERNAL_JUDGE_PROVENANCE)
        return decision
    if gate_version != 1:
        raise ValueError("Unsupported external judge version")
    parse_output(json.dumps(raw, allow_nan=False), QuestionQualitySignature)
    return judge_question(question, scope["domain_prompt"],
        documentation_context=documentation_context(sources),
        model=EXTERNAL_JUDGE_PROVENANCE, generator_model=generator_model,
        option_evidence=evidence, predictor=lambda **_: SimpleNamespace(**raw))


def _argon_request(path, entry, payload):
    if payload.get("argon_gate") is True:
        return _read_json(path.parent / entry["external_judge_request"]["path"])["argon"]
    return None


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
                                          entry["external_verdict"], payload["model"],
                                          gate_version=payload["external_judge_version"], rules_version=payload.get("rules_version", 4),
                                          argon_request=_argon_request(path, entry, payload))
            if not decision.passed:
                raise ValueError("Completed candidate lacks a strict stored PASS")
    except Exception:
        raise ValueError("Persistence journals require human reconciliation") from None


def _generation_quality_stage(entry):
    """Recognize affirmative frozen quality failures, never arbitrary exceptions."""
    stage = entry.get("failure_stage")
    error = entry.get("error_class")
    if error == "DecisionVetoError":
        attempts = entry.get("decision_attempts")
        if (stage == "decision_veto" and isinstance(attempts, list) and attempts
                and isinstance(attempts[-1], dict)
                and isinstance(attempts[-1].get("proof"), dict)
                and attempts[-1]["proof"].get("passed") is False
                and isinstance(attempts[-1]["proof"].get("reason"), str)
                and attempts[-1]["proof"]["reason"].strip()):
            return stage
        return None
    if error not in (None, "CandidateRejected"):
        return None
    if stage == "documentation" and error == "CandidateRejected":
        attempts = entry.get("decision_attempts")
        if isinstance(attempts, list) and attempts and isinstance(attempts[-1], dict):
            last = attempts[-1]
            check = last.get("documentation_check")
            if last.get("sources") == [] and isinstance(check, dict) and check.get("passed") is False:
                return stage
    checks = {
        "near_duplicate": ("near_duplicate_check",),
        "near_duplicate_plan": ("near_duplicate_plan_check",),
        "answer_pattern": ("answer_pattern_check", "answer_pattern_plan_check"),
        "product_share": ("product_share_check",),
        "schema": ("schema_check",),
        "mechanical": ("mechanical_check",),
    }
    for name in checks.get(stage, ()):
        check = entry.get(name)
        if isinstance(check, dict) and check.get("passed") is False:
            if stage == "answer_pattern" and check.get("errors"):
                return None  # Missing comparison provenance is not a duplicate.
            # A placeholder "No fetched evidence" is not an evaluated quality gate.
            if stage == "mechanical" and not entry.get("citation_attempts"):
                continue
            return stage
    if stage == "duplicate" and entry.get("duplicate") is True:
        return stage
    return None


def saved_system_failure_ids(payload):
    """Discover narrowly supported saved failures; this never acknowledges them."""
    if (not isinstance(payload, dict) or payload.get("cert_id") != "data-engineer"
            or payload.get("judge_model") != "external" or payload.get("external_judge_version") != 2
            or payload.get("rules_version") != 5 or payload.get("batch_stop") is not None):
        return frozenset()
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        return frozenset()
    return frozenset(entry["candidate_id"] for entry in candidates
                     if is_acknowledgeable_system_failure(entry)
                     and isinstance(entry.get("candidate_id"), str) and entry["candidate_id"].strip())


def saved_generation_system_failures(payload):
    """Return safe categorical diagnostics for supported saved resume failures."""
    eligible = saved_system_failure_ids(payload)
    return [{"candidate_id": entry["candidate_id"], "failure_stage": "documentation", "error_class": "ReadTimeout"}
            for entry in payload.get("candidates", []) if entry.get("candidate_id") in eligible]


def validate_saved_generation_failures(payload, acknowledged_system_failure_ids=()):
    """Validate all pre-judge failures without model calls or candidate changes.

    Raises:
        ValueError: A generation failure is unacknowledged or not a quality veto.
    """
    acknowledged = validate_acknowledged_system_failures(payload, acknowledged_system_failure_ids)
    if not isinstance(payload, dict) or payload.get("batch_stop") is not None:
        raise ValueError("Saved generation has a fatal batch stop")
    candidates = payload.get("candidates")
    if not isinstance(candidates, list):
        raise ValueError("Invalid saved generation candidates")
    for entry in candidates:
        if not isinstance(entry, dict):
            raise ValueError("Invalid saved generation candidate")
        if _is_complete(entry) or entry.get("external_judge_request") or entry.get("awaiting_external_judge"):
            continue
        if entry.get("candidate_id") not in acknowledged and _generation_quality_stage(entry) is None:
            raise ValueError("Unverified or system generation rejection requires reconciliation")


def validate_saved_judge_requests(path, payload):
    """Validate a saved cohort's immutable request set, without verdict files.

    Supported saved timeouts are recognized, not authorized here. The resume
    coordinator must require explicit acknowledgment before any live calls.

    Raises:
        ValueError: Saved requests, scope, provenance or completed journals are invalid.
    """
    path = Path(path)
    try:
        if path.is_symlink():
            raise ValueError("Unsafe artifact path")
        validate_completed_journals(payload, path)
        validate_saved_generation_failures(payload, saved_system_failure_ids(payload))
        expected = set()
        directory = request_directory(path)
        if directory.is_symlink():
            raise ValueError("Unsafe request directory")
        for entry in payload["candidates"]:
            _scope(payload, entry)
            if entry.get("external_judge_request") or entry.get("awaiting_external_judge"):
                _validate_candidate(path, payload, entry)
                request = path.parent / entry["external_judge_request"]["path"]
                if request != directory / (entry["candidate_id"] + ".json"):
                    raise ValueError("Request is outside the frozen cohort directory")
                expected.add(request.name)
        actual = set()
        for child in directory.iterdir() if directory.exists() else ():
            if child.is_symlink() or not child.is_file():
                raise ValueError("Saved request files must be regular files")
            if child.name == ".judge-requests.lock":
                continue  # Stable runner/exporter lock, not candidate content.
            if child.name == ".verdict-directories.json":
                registry = _read_json(child)
                if (not isinstance(registry, dict) or set(registry) != {"version", "directories"}
                        or type(registry["version"]) is not int or registry["version"] != 1
                        or not isinstance(registry["directories"], list)
                        or any(not isinstance(item, str) or not Path(item).is_absolute()
                               for item in registry["directories"])
                        or len(set(registry["directories"])) != len(registry["directories"])):
                    raise ValueError("Invalid saved verdict-directory registry")
                for item in registry["directories"]:
                    target = Path(item)
                    if (any(part.is_symlink() for part in (target, *target.parents))
                            or not target.resolve().is_relative_to(path.parent.resolve())
                            or target.resolve() in (path.parent.resolve(), directory.resolve())
                            or (target.exists() and not target.is_dir())):
                        raise ValueError("Unsafe saved verdict-directory registry")
                continue
            actual.add(child.name)
        if actual != expected:
            raise ValueError("Saved request set differs from the frozen cohort")
    except (ValueError, KeyError, TypeError, OSError, UnicodeError, StopIteration):
        raise ValueError("Saved judge requests failed immutable preflight") from None


def validate_acknowledged_system_failures(payload, ids=()):
    """Validate explicit saved-failure IDs without changing any candidate state.

    Raises:
        ValueError: IDs are malformed or do not name eligible saved failures.
    """
    if (not isinstance(ids, (list, tuple, set, frozenset))
            or any(not isinstance(ident, str) or not ident.strip() for ident in ids)
            or len(set(ids)) != len(ids)):
        raise ValueError("Acknowledged failures require unique saved candidate IDs")
    requested = frozenset(ids)
    if not requested:
        return requested
    candidates = payload.get("candidates") if isinstance(payload, dict) else None
    if not isinstance(candidates, list):
        raise ValueError("Acknowledged failures require saved candidate records")
    all_ids = [entry.get("candidate_id") for entry in candidates if isinstance(entry, dict)]
    if (len(all_ids) != len(candidates) or any(all_ids.count(ident) != 1 for ident in requested)
            or not requested <= saved_system_failure_ids(payload)):
        raise ValueError("Acknowledged IDs must name pre-judge documentation ReadTimeout failures")
    try:
        validate_candidate_records(payload)
        for entry in candidates:
            if entry["candidate_id"] in requested:
                _scope(payload, entry)
    except (ValueError, KeyError, TypeError, StopIteration):
        raise ValueError("Acknowledged failure scope or candidate identity is invalid") from None
    return requested


def _strict_preflight(path, verdicts, payload, acknowledged_system_failure_ids=()):
    """Validate every request/verdict, even for a later duplicate-vetoed row."""
    try:
        refuse_council_canary(path, payload)
        if path.is_symlink() or verdicts.is_symlink():
            raise ValueError("Unsafe artifact or verdict directory")
        if payload.get("batch_stop"):
            raise ValueError("Generation stopped on a system failure")
        validate_completed_journals(payload, path)
        for entry in payload["candidates"]:
            if _is_complete(entry):
                continue
            if not entry.get("external_judge_request") and not entry.get("awaiting_external_judge"):
                if entry["candidate_id"] in acknowledged_system_failure_ids:
                    continue  # Validated explicitly; keep rejected, never judge or persist.
                if _generation_quality_stage(entry) is None:
                    raise ValueError("Unverified or system generation rejection")
                continue
            scope, question, checked = _validate_candidate(path, payload, entry)
            verdict_path = verdicts / (entry["candidate_id"] + ".json")
            if verdict_path.is_symlink():
                raise ValueError("Unsafe external verdict path")
            raw = _read_json(verdict_path)
            if not isinstance(raw, dict):
                raise ValueError("Malformed external verdict")
            _external_decision(question, scope, entry["sources"], checked["options"], raw, payload["model"],
                gate_version=payload["external_judge_version"], rules_version=payload.get("rules_version", 4),
                argon_request=_argon_request(path, entry, payload))
    except Exception as error:
        raise click.ClickException("Strict ingestion preflight failed; no new DB writes ("
                                   + type(error).__name__ + ")") from None


def _quality_summary(payload, superseded, acknowledged_system_failure_ids=()):
    candidates = [{"candidate_id": entry["candidate_id"], "stage": entry["failure_stage"],
                   "reason": entry.get("reason", "Candidate rejected")}
                  for entry in payload["candidates"]
                  if entry["candidate_id"] not in superseded and entry.get("failure_stage")
                  and entry["candidate_id"] not in acknowledged_system_failure_ids
                  and not _is_complete(entry)]
    stages = {}
    for row in candidates:
        stages[row["stage"]] = stages.get(row["stage"], 0) + 1
    return {"count": len(candidates), "by_stage": stages, "candidates": candidates}


def ingest(path, verdicts, *, dry_run=False, publication_bank=None,
           continue_quality_rejections=False, full_plan_count=None,
           expected_selected_ids=None, balance_population_ids=None,
           acknowledged_system_failure_ids=()):
    """Persist passing candidates; an optional PDE comparison bank adds fresh gates.

    publication_bank is a list of normalized load_export question rows. It never
    replaces or mutates the frozen duplicate snapshot, requests or journals.
    Returns selected_candidates comparison rows with stable storage IDs and a
    quality_rejections summary. By default historical rejection behavior stays
    unchanged. continue_quality_rejections enables strict whole-artifact preflight
    and tolerates only verified content-quality failures, including an empty
    selection. Missing/malformed verdicts, system errors and integrity failures
    block before any database client or run is created. expected_selected_ids
    requires exact selected storage-ID equality before database access.
    full_plan_count preserves the original product-cap budget across retry waves.
    balance_population_ids binds option layouts to the full selected cohort.
    acknowledged_system_failure_ids is an explicit coordinator-resume policy for
    saved pre-judge documentation ReadTimeout failures only. It requires strict
    quality continuation, leaves these candidates rejected, and never bypasses
    request/verdict, provenance, journal, quality or batch-report validation.
    """
    if type(continue_quality_rejections) is not bool:
        raise click.ClickException("Invalid quality-rejection continuation policy")
    if full_plan_count is not None and (type(full_plan_count) is not int or full_plan_count < 1):
        raise click.ClickException("full_plan_count must be a positive integer")
    if expected_selected_ids is not None:
        if (not isinstance(expected_selected_ids, (list, tuple, set, frozenset))
                or any(not isinstance(ident, str) or not ident.strip() for ident in expected_selected_ids)
                or len(set(expected_selected_ids)) != len(expected_selected_ids)):
            raise click.ClickException("Expected selection requires unique stable storage IDs")
        expected_selected_ids = set(expected_selected_ids)
    if balance_population_ids is not None and (
            not isinstance(balance_population_ids, list)
            or any(not isinstance(ident, str) or not ident.strip() for ident in balance_population_ids)
            or len(set(balance_population_ids)) != len(balance_population_ids)):
        raise click.ClickException("Invalid full-run option balance population")
    strict_preflight = continue_quality_rejections or expected_selected_ids is not None
    payload = _read_json(path)
    try:
        refuse_council_canary(path, payload)
    except ValueError as error:
        raise click.ClickException(str(error)) from None
    if (not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list)
            or not payload["candidates"]
            or not isinstance(payload.get("plan"), list) or not payload["plan"]
            or not isinstance(payload.get("generation_runs"), dict)):
        raise click.ClickException("Invalid external judge artifact")
    try:
        acknowledged_system_failure_ids = validate_acknowledged_system_failures(
            payload, acknowledged_system_failure_ids)
    except ValueError as error:
        raise click.ClickException(str(error)) from None
    if acknowledged_system_failure_ids and not continue_quality_rejections:
        raise click.ClickException("Saved system failure acknowledgment requires strict quality continuation")
    frozen_count = payload.get("full_plan_count")
    if frozen_count is not None:
        if type(frozen_count) is not int or frozen_count < len(payload["plan"]):
            raise click.ClickException("Invalid frozen full_plan_count")
        if full_plan_count is not None and full_plan_count != frozen_count:
            raise click.ClickException("full_plan_count differs from frozen artifact")
        full_plan_count = frozen_count
    if full_plan_count is not None and full_plan_count < len(payload["plan"]):
        raise click.ClickException("full_plan_count is smaller than the frozen plan")
    if (payload.get("judge_model") != "external" or type(payload.get("external_judge_version")) is not int
            or payload["external_judge_version"] not in (1, 2)):
        raise click.ClickException("Artifact does not use a supported external judge version")
    try:
        if "argon_gate" in payload and type(payload["argon_gate"]) is not bool:
            raise ValueError("Invalid Argon policy")
        require_independent_models(payload["model"], EXTERNAL_POLICY_MODEL)
    except (KeyError, ValueError):
        raise click.ClickException("Invalid generator/judge vendor independence") from None
    if payload.get("difficulty") not in ("EASY", "MEDIUM", "HARD") or not isinstance(payload.get("exam"), str) or not payload["exam"].strip():
        raise click.ClickException("Artifact lacks persistence difficulty or exam")
    persistence_exam = "GCP_PM_ML_ENG" if payload.get("cert_id") == "machine-learning-engineer" else payload.get("cert_id")
    allowed_exams = ({"GCP_PM_ML_ENG", "machine-learning-engineer"}
                     if payload.get("cert_id") == "machine-learning-engineer" else {persistence_exam})
    if payload["exam"] not in allowed_exams:
        raise click.ClickException("Artifact exam must match its certification (PMLE uses GCP_PM_ML_ENG)")
    for row in [payload, *payload["plan"], *payload["candidates"]]:
        if not isinstance(row, dict) or not isinstance(row.get("options", []), list):
            raise click.ClickException("Invalid candidate record or options")
        if (row.get("question_type", "single_select") != "single_select"
                or row.get("answer_mode", "single_select") != "single_select"
                or any(key in row for key in ("keys", "correct_labels", "correct_answers"))
                or ("key" in row and not isinstance(row["key"], str))
                or any(isinstance(option, dict) and "is_correct" in option
                       for option in row.get("options", []))):
            raise click.ClickException("Only single_select candidates are supported; multiple-select ingestion waits for phase 3")
    try:
        validate_candidate_records(payload)
        # Validate every candidate, including failed/unwritten records, before ingest.
        for entry in payload["candidates"]:
            _scope(payload, entry)
    except (ValueError, KeyError, TypeError, StopIteration):
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
            eligible_repair_verdict(raw, gate_version=payload["external_judge_version"], distractor_evidence=parent.get("distractor_evidence"),
                                    style_policy=parent.get("style_policy"))
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
    near_seen = []
    if payload.get("rules_version") == 5:
        bank = payload.get("existing_questions")
        if (not isinstance(bank, dict) or set(bank) != {"sha256", "questions"} or not isinstance(bank["questions"], list)
                or (bank["sha256"] is not None and (not isinstance(bank["sha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", bank["sha256"])) )):
            raise click.ClickException("Missing or malformed local export snapshot for near-duplicate checks")
        for row in bank["questions"]:
            if (not isinstance(row, dict) or not {"id", "stem", "key"} <= set(row)
                    or set(row) - ({"id", "stem", "key", "cert_id", "objective_id"}
                                   | ({"distractors", "answer_pattern_source"} if uses_pde_style(payload["plan"][0].get("style_policy")) else set()))
                    or not isinstance(row["id"], str) or not row["id"].strip()
                    or ("objective_id" in row and (not isinstance(row["objective_id"], str) or not row["objective_id"].strip()))
                    or row.get("cert_id", payload["cert_id"]) != payload["cert_id"]
                    or (payload["cert_id"] != "machine-learning-engineer" and row.get("cert_id") != payload["cert_id"])):
                raise click.ClickException("Malformed local export snapshot")
            tokens(row["stem"]); tokens(row["key"])
            if uses_pde_style(payload["plan"][0].get("style_policy")) and not check_answer_pattern(row, [], cert_id=payload["cert_id"])["passed"]:
                raise click.ClickException("Malformed PDE answer-pattern snapshot")
        near_seen = list(bank["questions"])
    cap_bank = list(near_seen)
    if publication_bank is not None:
        if payload.get("cert_id") != "data-engineer" or not uses_pde_style(payload["plan"][0].get("style_policy")):
            raise click.ClickException("Publication bank override requires tuned PDE")
        if not isinstance(publication_bank, list):
            raise click.ClickException("Publication bank must be a normalized question list")
        ids = set()
        for row in publication_bank:
            if (not isinstance(row, dict) or not {"id", "stem", "key", "cert_id"} <= set(row)
                    or set(row) - {"id", "stem", "key", "cert_id", "objective_id", "distractors", "answer_pattern_source"}
                    or row["cert_id"] != payload["cert_id"]
                    or not isinstance(row["id"], str) or not row["id"].strip() or row["id"] in ids
                    or ("objective_id" in row and (not isinstance(row["objective_id"], str) or not row["objective_id"].strip()))):
                raise click.ClickException("Malformed publication bank")
            try:
                tokens(row["stem"]); tokens(row["key"])
                if not check_answer_pattern(row, [], cert_id=payload["cert_id"])["passed"]:
                    raise ValueError("Malformed answer pattern")
            except (ValueError, KeyError, TypeError):
                raise click.ClickException("Malformed publication bank") from None
            ids.add(row["id"])
        # A fresh bank ID without a completed local journal is not proof that
        # this invocation may retry that insert. Never silently treat it as self.
        for entry in payload["candidates"]:
            if not entry.get("external_judge_request") or _is_complete(entry):
                continue
            try:
                scope = _scope(payload, entry)
                storage_id = candidate_storage_id(entry, scope, candidate_question(entry))
            except (ValueError, KeyError, TypeError):
                continue  # The ordinary immutable request validation rejects it.
            if storage_id in ids:
                raise click.ClickException("Publication bank contains an unjournaled candidate; human reconciliation required")
        cap_bank = list(publication_bank)
        # Keep both historical and fresh comparison content even if a stable ID
        # appears in both: a fresh edit must not erase a frozen duplicate veto.
        near_seen.extend(publication_bank)
    if strict_preflight:
        _strict_preflight(path, verdicts, payload, acknowledged_system_failure_ids)
    if uses_pde_style(payload["plan"][0].get("style_policy")):
        for entry in payload["candidates"]:
            if not _is_complete(entry) and entry["candidate_id"] not in acknowledged_system_failure_ids:
                entry["publication_selected"] = False
    pending, seen = [], set()
    fatal_rejections = []
    # Include completed content before pending validation, regardless of list order.
    if payload.get("rules_version") == 5:
        near_seen.extend(comparison_row(entry) for entry in payload["candidates"] if _is_complete(entry))
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
                                                  entry["external_verdict"], payload["model"],
                                          gate_version=payload["external_judge_version"], rules_version=payload.get("rules_version", 4),
                                          argon_request=_argon_request(path, entry, payload))
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
        if ident in acknowledged_system_failure_ids:
            # Preserve the saved diagnostic; never expose provider error bodies.
            rejected += 1
            click.echo(f"{ident}: acknowledged saved system failure; documentation/ReadTimeout; remains rejected")
            continue
        # Generation rejects have no published request and must not be relabelled
        # as invalid requests. Recover stages overwritten by older ingestion too.
        if not entry.get("external_judge_request") and not entry.get("awaiting_external_judge"):
            if entry.get("error_class") == "DecisionVetoError":
                attempts = entry.get("decision_attempts", [])
                reason = attempts[-1].get("proof", {}).get("reason") if attempts else None
                _reject(entry, "decision_veto", reason or "Replacement decision vetoed; discard candidate")
            elif entry.get("near_duplicate_check", {}).get("passed") is False:
                _reject(entry, "near_duplicate", entry["near_duplicate_check"]["reason"])
            elif not entry.get("failure_stage"):
                _reject(entry, "external_request", "Candidate has no published external judge request")
            else:
                _reject(entry, entry["failure_stage"], entry.get("reason") or "Candidate rejected before external judging")
            rejected += 1
            click.echo(f"{ident}: generation rejected at {entry['failure_stage']}; {entry['reason']}")
            continue
        # Previous dry-run decisions are not evidence for the current verdict file.
        entry.pop("external_verdict", None)
        entry["judge_verdict"] = {"passed": False, "score": 0.0,
                                  "reason": "Current external verdict not validated",
                                  "model": EXTERNAL_JUDGE_PROVENANCE}
        try:
            scope, question, checked = _validate_candidate(path, payload, entry)
            if payload.get("rules_version") == 5:
                duplicate = check_near_duplicate(entry, near_seen,
                    exclude=(ident, entry.get("repair", {}).get("parent_candidate_id")))
                entry["near_duplicate_check"] = duplicate
                if not duplicate["passed"]:
                    _reject(entry, "near_duplicate", duplicate["reason"])
                    rejected += 1
                    click.echo(f"{ident}: rejected; {duplicate['reason']}")
                    continue
                if uses_pde_style(scope.get("style_policy")):
                    entry["answer_pattern_check"] = check_answer_pattern(entry, near_seen, cert_id=payload["cert_id"],
                        exclude=(ident, entry.get("repair", {}).get("parent_candidate_id")))
                    if not entry["answer_pattern_check"]["passed"]:
                        if strict_preflight and entry["answer_pattern_check"].get("errors"):
                            fatal_rejections.append(ident)
                        _reject(entry, "answer_pattern", entry["answer_pattern_check"]["reason"])
                        rejected += 1
                        click.echo(f"{ident}: rejected; {entry['answer_pattern_check']['reason']}")
                        continue
                near_seen.append(comparison_row(entry))
            normalized = normalize_stem(question["stem"])
            if normalized in seen or ident in repair_duplicate_ids:
                raise ValueError("Duplicate normalized stem")
            seen.add(normalized)
        except (ValueError, KeyError, TypeError, OSError, UnicodeError, StopIteration) as exc:
            entry["error_class"] = getattr(exc, "error_class", type(exc).__name__)
            if strict_preflight:
                # Only the deliberate normalized-stem veto is a content rejection.
                if type(exc) is not ValueError or str(exc) != "Duplicate normalized stem":
                    fatal_rejections.append(ident)
            _reject(entry, getattr(exc, "stage", "near_duplicate"), str(exc))
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
                                       raw, payload["model"], gate_version=payload["external_judge_version"], rules_version=payload.get("rules_version", 4),
                                          argon_request=_argon_request(path, entry, payload))
            entry["judge_verdict"] = {"passed": judge.passed, "score": judge.score,
                                      "reason": judge.reason, "model": judge.model}
            entry["external_judge_provenance"] = EXTERNAL_JUDGE_PROVENANCE
            entry["awaiting_external_judge"] = False
            entry["status"] = "external_judge_passed" if judge.passed else "external_judge_rejected"
        except Exception as exc:
            if strict_preflight:
                fatal_rejections.append(ident)
            entry["error_class"] = type(exc).__name__
            _reject(entry, "external_verdict", str(exc))
            rejected += 1
            click.echo(f"{ident}: rejected; {entry['reason']}")
            continue
        if not judge.passed:
            _reject(entry, "judge", judge.reason)
            rejected += 1
            click.echo(f"{ident}: rejected; {entry['reason']}")
            continue
        for field in ("failure_stage", "reason", "error_class", "error_message"):
            entry.pop(field, None)
        grounding = {key: scope[key] for key in ("cert_id", "objective_id", "guide_sha256")}
        grounding.update(generator_model=payload["model"], judge_model=EXTERNAL_JUDGE_PROVENANCE,
                         evidence=checked["options"], mechanical_check={"passed": True, "errors": []})
        if payload["external_judge_version"] == 2:
            grounding.update(gate_version=payload.get("rules_version", 4), rules_version=payload.get("rules_version", 4), gate_verdicts=raw,
                             **{name: scope[name] for name in
                                ("decision_objective", "decision_plan", "decision_proof", "key_length_rank")})
        if uses_pde_style(scope.get("style_policy")):
            grounding.update({key: scope[key] for key in TUNING_SCOPE_FIELDS})
            grounding["answer_pattern_check"] = entry["answer_pattern_check"]
        if scope.get("style_policy") is not None:
            grounding["style_policy"] = scope["style_policy"]
        if "distractor_evidence" in scope:
            grounding["distractor_evidence"] = scope["distractor_evidence"]
        if payload.get("argon_gate") is True:
            grounding["argon"] = raw["argon"]
        if "option_order" in entry:
            grounding.update(option_order=entry["option_order"], evidence=entry["evidence"])
        entry["grounding"] = grounding
        entry["accepted"] = False
        pending.append((entry, scope, question, judge, grounding))
        click.echo(f"{ident}: passing external verdict; {judge.reason}")
    cap_vetoed = 0
    if uses_pde_style(payload["plan"][0].get("style_policy")):
        # Existing completed rows reserve capacity even when the export is older.
        completed = []
        for entry in payload["candidates"]:
            if _is_complete(entry):
                completed.append({**product_share_row(entry), "id": entry["inserted_question_id"]})
        bank_actions = [{"id": row["id"], "best_action": row["key"], "product_context": row["stem"]}
                        for row in cap_bank]
        bank_by_id = {row["id"]: row for row in bank_actions}
        for row in completed:
            bank_by_id.setdefault(row["id"], row)
        admissions = [{**product_share_row(question), "id": candidate_storage_id(entry, scope, question),
                       "score": judge.score} for entry, scope, question, judge, _ in pending]
        selection = select_publication_products(admissions, list(bank_by_id.values()), cert_id=payload["cert_id"],
                                                full_plan_count=full_plan_count)
        payload["product_share_report"] = selection["report"]
        keep = set(selection["selected_indices"])
        for index, (entry, *_) in enumerate(pending):
            entry["publication_selected"] = index in keep
            entry["product_share_check"] = {"passed": index in keep, "denominator": selection["report"]["denominator"],
                                            "max_per_product": selection["report"]["max_per_product"]}
            if index not in keep:
                _reject(entry, "product_share", selection["vetoes"].get(index, "Already represented in the publication bank"))
                cap_vetoed += 1
        pending = [row for index, row in enumerate(pending) if index in keep]
    selected_ids = {candidate_storage_id(entry, scope, question)
                    for entry, scope, question, _, _ in pending}
    if expected_selected_ids is not None and selected_ids != expected_selected_ids:
        raise click.ClickException("Selected storage IDs changed since dry-run; no new DB writes")
    if strict_preflight and (fatal_rejections or missing or blocked):
        raise click.ClickException("Ingestion integrity or persistence failure; no new DB writes")
    quality_rejections = _quality_summary(payload, superseded, acknowledged_system_failure_ids)
    system_rejections = {"count": len(acknowledged_system_failure_ids), "candidates": [
        {"candidate_id": entry["candidate_id"], "stage": entry["failure_stage"], "error_class": entry["error_class"]}
        for entry in payload["candidates"] if entry["candidate_id"] in acknowledged_system_failure_ids]}
    if payload.get("rules_version") == 5:
        quality_eligible = [entry for entry in payload["candidates"]
                            if entry["candidate_id"] not in superseded
                            and entry.get("judge_verdict", {}).get("passed") is True
                            and not entry.get("persistence_validation_failed")]
        eligible = [entry for entry in quality_eligible if entry.get("publication_selected") is not False]
        if not blocked:
            try:
                if balance_population_ids is not None:
                    balance_options(eligible, population_ids=balance_population_ids)
                elif uses_pde_style(payload["plan"][0].get("style_policy")):
                    # Completed layouts freeze their original balancing cohort,
                    # which can include a now cap-vetoed, still judge-passed row.
                    # Replaying a newer cap-selected cohort must also keep that
                    # subset, rather than resurrecting every historical passer.
                    frozen_digests = {entry.get("option_balance", {}).get("population_sha256")
                                      for entry in quality_eligible if _is_complete(entry)}
                    frozen_ids = set()
                    for digest in frozen_digests:
                        cohort = [entry for entry in quality_eligible
                                  if entry.get("option_balance", {}).get("population_sha256") == digest]
                        balance_options(cohort)
                        frozen_ids.update(entry["candidate_id"] for entry in cohort)
                    balance_options([entry for entry in eligible if entry["candidate_id"] not in frozen_ids])
                else:
                    balance_options(eligible)
            except ValueError:
                raise click.ClickException("Persisted option layout requires reconciliation; no new DB writes") from None
    payload["option_length_report"] = option_length_report(payload["candidates"])
    payload["key_length_rank_report"] = key_length_rank_report(payload["candidates"])
    payload["option_prefix_report"] = option_prefix_report(payload["candidates"])
    if payload.get("rules_version") == 5:
        payload["all_candidate_key_position_report"] = key_position_report(payload["candidates"])
        payload["key_position_report"] = key_position_report([entry for entry in payload["candidates"]
            if entry["candidate_id"] not in superseded and entry.get("judge_verdict", {}).get("passed") is True
            and not entry.get("persistence_validation_failed")
            and entry.get("publication_selected") is not False])
        if balance_population_ids is not None:
            population = sorted(balance_population_ids)
            digest = hashlib.sha256(json.dumps(population, separators=(",", ":")).encode()).hexdigest()
            planned_keys = []
            for index, ident in enumerate(population):
                mapping = balanced_order(ident, {"version": 1, "population_sha256": digest, "index": index})
                planned_keys.append({"options": [True],
                                     "key": next(label for label, origin in mapping.items() if origin == "A")})
            payload["key_position_report"]["aggregate_blocker"] = False
            payload["run_key_position_report"] = {
                **key_position_report(planned_keys), "basis": "dry_admitted_full_run_population",
                "persisted": False, "population_sha256": digest}
        payload["template_diversity_report"] = template_diversity_report([entry for entry in payload["candidates"]
            if entry["candidate_id"] not in superseded])
        click.echo(format_key_position_report(payload["key_position_report"]))
        payload["ml_practice_report"] = ml_practice_report(payload["candidates"])
        click.echo("ML practice allowance: " + json.dumps(payload["ml_practice_report"]))
        click.echo("Template diversity: " + json.dumps(payload["template_diversity_report"]))
        if uses_pde_style(payload["plan"][0].get("style_policy")):
            payload["section_product_share_report"] = product_share_report([
                product_share_row(entry) for entry in eligible], cert_id=payload["cert_id"])
            payload["section_product_share_report"]["aggregate_blocker"] = False
            payload["topic_plan_report"] = topic_distribution(payload["plan"])
            click.echo("PDE correct-answer products: " + json.dumps(payload["product_share_report"]))
        _flush(path, payload)
        if blocked:
            raise click.ClickException("Persistence journal requires reconciliation; no new DB writes")
        empty_quality_selection = (continue_quality_rejections and not quality_eligible
                                   and (quality_rejections["count"] > 0 or system_rejections["count"] > 0))
        if not payload["key_position_report"]["count"] and not cap_vetoed and not empty_quality_selection:
            raise click.ClickException("No passing candidates; no new DB writes")
        enforced_keys = payload.get("run_key_position_report") if balance_population_ids is not None else payload["key_position_report"]
        if ((enforced_keys["count"] and enforced_keys["passed"] is False)
                or (not payload["template_diversity_report"]["passed"] and not empty_quality_selection)):
            raise click.ClickException("V5 batch report failed; no new DB writes")
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
                    domain = client.get_domain_by_code(code, exam=persistence_exam)
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
                        run = client.create_generation_run({"id": run_id, "exam": persistence_exam, "domain_code": code,
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
                stored = persist_candidate(client, scope, question, judge, grounding, persistence_exam,
                    domains[scope["domain_code"]], runs[scope["domain_code"]], payload["difficulty"],
                    before_insert=before_insert, on_question_inserted=on_question_inserted,
                    question_id=storage_id,
                    **({"taxonomy_tags": _taxonomy_tags(payload, entry, scope)} if payload.get("taxonomy_enabled") else {}))
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
            payload["key_length_rank_report"] = key_length_rank_report(payload["candidates"])
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
    if missing or blocked or (rejected and not continue_quality_rejections):
        raise click.ClickException("Some candidates were not persisted; inspect the artifact")
    return {"selected_candidates": [{**comparison_row(entry), "id": candidate_storage_id(entry, scope, question)}
                                     for entry, scope, question, _, _ in pending],
            "product_share_report": payload.get("product_share_report"), "complete": complete,
            "cap_vetoed": cap_vetoed, "quality_rejections": quality_rejections,
            "acknowledged_system_failures": system_rejections}


@click.command()
@click.option("--artifact", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--verdicts", required=True, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--dry-run", is_flag=True, help="Validate and record decisions locally; never construct a DB client.")
@click.option("--continue-quality-rejections", is_flag=True,
              help="Treat verified quality rejections as complete outcomes; missing or invalid verdicts still fail.")
def main(artifact, verdicts, dry_run, continue_quality_rejections):
    try:
        if artifact.is_symlink():
            raise click.ClickException("Artifact cannot be a symlink")
        artifact = artifact.resolve()
        with artifact_lock(artifact):
            ingest(artifact, verdicts.resolve(), dry_run=dry_run,
                   continue_quality_rejections=continue_quality_rejections)
    except click.ClickException:
        raise
    except Exception:
        raise click.ClickException("External verdict ingestion failed safely; inspect local inputs") from None


if __name__ == "__main__":
    main()
