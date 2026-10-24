#!/usr/bin/env python3
"""Offline-first unanimous, content-hash-bound publication. No model calls."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PYTHON_DOTENV_DISABLED"] = "1"

from scripts import ingest_external_verdicts as ingest
from scripts.review_batch import all_pages, complete_answers, grounding_errors
from shared.external_judge import (canonical_sha256, candidate_storage_id, candidate_question,
    validate_candidate_records, require_publishable_request)
from shared.content_hash import content_sha256, question_content_sha256
from shared.product_freshness import freshness_errors
from shared.cli_models import parse_output, output_model
from shared.gates import gate_signatures, evaluate_gate
from shared.argon_gate import evaluate_argon
from shared.near_duplicates import check_near_duplicate, comparison_row


def publication_errors(question, scope, request, verdict, *, rules_version=5):
    """Pure full-council/freshness gate; outer caller must bind request to content.

    Missing schemas, skipped seats and UNCERTAIN always reject. The helper is
    shared with council health and re-council. It performs no IO except reading
    the versioned local lexicon; it never constructs a database/model client.
    """
    errors = []
    try:
        require_publishable_request(request)
        if rules_version != 5 or request.get("gate_version") != rules_version:
            raise ValueError("Publication requires current independent council")
        if request.get("objective_id") != scope.get("objective_id"):
            raise ValueError("Council objective mismatch")
        signatures = gate_signatures(rules_version,
            distractor_evidence=request.get("distractor_evidence"),
            cert_id=scope.get("cert_id"), style_policy=scope.get("style_policy"))
        original_verdict = verdict
        from shared.distractor_evidence import verdict_gates
        verdict = verdict_gates(verdict, request.get("distractor_evidence"))
        if not isinstance(verdict, dict) or set(verdict) != {*signatures, "argon"}:
            raise ValueError("Every independent council seat is required")
        for name, signature in signatures.items():
            gate = request["gates"][name]
            if (set(gate) != {"judge_prompt", "verdict_schema"}
                    or not isinstance(gate["judge_prompt"], str) or not gate["judge_prompt"].strip()
                    or gate["verdict_schema"] != output_model(signature).model_json_schema()):
                raise ValueError("Council request schema mismatch")
            parsed = parse_output(json.dumps(verdict[name], allow_nan=False), signature)
            # No historical waiver may turn a recorded FAIL into a new publish.
            if parsed.get("verdict") != "PASS":
                errors.append(name + ": seat did not PASS")
            passed, _ = evaluate_gate(name, verdict[name], question, version=rules_version,
                style_policy=scope.get("style_policy"))
            if not passed:
                errors.append(name + ": seat rejected")
        passed, _ = evaluate_argon(question, verdict["argon"], request["argon"])
        if not passed:
            errors.append("argon: blind or review rejected")
        # Strict external decision additionally validates frozen evidence policy.
        decision = ingest._external_decision(question, scope, [], [], original_verdict, "codex",
            gate_version=2, rules_version=rules_version, argon_request=request["argon"])
        if not decision.passed:
            errors.append("council: unanimous independent decision failed")
        errors.extend(freshness_errors(question, scope.get("cert_id")))
    except Exception as error:
        # Never include arbitrary provider data or exception bodies in reports.
        errors.append("invalid_council:" + type(error).__name__)
    return errors


def database_client():
    """Use injected shell values only. Do not import dotenv-loading legacy client."""
    from supabase import create_client
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise click.ClickException("Injected database URL and service role are required")
    return create_client(url, key)


def _read(path):
    return ingest._read_json(Path(path))


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _bound_read(path):
    raw = Path(path).read_bytes()
    data = json.loads(raw, object_pairs_hook=ingest._pairs,
        parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Invalid JSON number")))
    return data, hashlib.sha256(raw).hexdigest()


def load_database_rows(client, ids):
    questions, answers = [], []
    for start in range(0, len(ids), 100):
        chunk = ids[start:start+100]
        questions.extend(all_pages(lambda: client.table("questions").select("*").in_("id", chunk)))
        answers.extend(all_pages(lambda: client.table("answers").select("*").in_("question_id", chunk)))
    domains = all_pages(lambda: client.table("exam_domains").select("id,code,exam"))
    by_domain = {d["id"]: d for d in domains}
    for row in questions:
        row["answers"] = [a for a in answers if a["question_id"] == row["id"]]
        row["domain"] = by_domain.get(row.get("domain_id"))
    return questions


def _row_errors(row, question, scope, expected_hash):
    errors = []
    if row.get("status") != "DRAFT" or row.get("review_status") != "GOOD":
        errors.append("row_not_draft_good")
    if not complete_answers(row.get("answers", [])):
        return errors + ["incomplete_answers"]
    if content_sha256(row["stem"], row["answers"]) != expected_hash:
        errors.append("database_content_hash_mismatch")
    exam = "GCP_PM_ML_ENG" if scope["cert_id"] == "machine-learning-engineer" else scope["cert_id"]
    if row.get("exam") != exam:
        errors.append("database_cert_mismatch")
    domain = row.get("domain")
    if (not isinstance(domain, dict) or domain.get("id") != row.get("domain_id")
            or domain.get("code") != scope["domain_code"] or domain.get("exam") != exam):
        errors.append("database_domain_mismatch")
    if row.get("parent_question_id") is not None:
        errors.append("variants_not_original_publications")
    errors.extend("grounding:" + error for error in grounding_errors(row))
    return errors


def plan_publication(artifact, verdicts, rows, *, limit=10):
    """Validate frozen provenance and current rows without changing any input."""
    artifact, verdicts = Path(artifact), Path(verdicts)
    payload, artifact_digest = _bound_read(artifact)
    ingest.refuse_council_canary(artifact, payload)
    from shared.council_safety import refuse_canary_paths
    refuse_canary_paths(verdicts)
    if type(limit) is not int or not 0 <= limit <= 10:
        raise ValueError("Publish limit must be between zero and ten")
    if (payload.get("external_judge_version") != 2 or payload.get("rules_version") != 5
            or payload.get("argon_gate") is not True):
        raise ValueError("Publication requires versioned full council artifacts")
    validate_candidate_records(payload)
    # Explicit even for ordinary ingestion: completed journals alone cannot
    # authorize a new publish or bypass checking saved raw verdict files.
    ingest._strict_preflight(artifact, verdicts, payload)
    row_by_id = {row["id"]: row for row in rows}
    if len(row_by_id) != len(rows):
        raise ValueError("Duplicate database question IDs")
    superseded = {e["repair"]["parent_candidate_id"] for e in payload["candidates"] if "repair" in e}
    results, bindings, seen = [], [], []
    for entry in sorted(payload["candidates"], key=lambda e: e["candidate_id"]):
        ident = entry["candidate_id"]
        if ident in superseded:
            results.append({"candidate_id": ident, "would_publish": False, "reasons": ["superseded"]})
            continue
        if not entry.get("external_judge_request"):
            results.append({"candidate_id": ident, "would_publish": False, "reasons": ["generation_rejected"]})
            continue
        scope, question, checked = ingest._validate_candidate(artifact, payload, entry)
        request_path = artifact.parent / entry["external_judge_request"]["path"]
        verdict_path = verdicts / (ident + ".json")
        request, request_digest = _bound_read(request_path)
        raw, verdict_digest = _bound_read(verdict_path)
        if request_digest != entry["external_judge_request"]["sha256"]:
            raise ValueError("Request changed during publication validation")
        errors = publication_errors(question, scope, request, raw, rules_version=payload["rules_version"])
        expected_hash = question_content_sha256(question)
        storage_id = candidate_storage_id(entry, scope, question)
        row = row_by_id.get(storage_id)
        if not isinstance(row, dict):
            errors.append("database_row_missing")
        else:
            errors.extend(_row_errors(row, question, scope, expected_hash))
            if entry.get("inserted_question_id") != storage_id or entry.get("persistence_status") != "complete":
                errors.append("missing_completed_draft_journal")
            if row.get("generation_run_id") != payload.get("generation_runs", {}).get(scope["domain_code"]):
                errors.append("generation_run_mismatch")
        bank = payload.get("existing_questions", {}).get("questions", [])
        comparison_entry = {"id": storage_id, "stem": question["stem"], "cert_id": scope["cert_id"],
            "key": "A", "options": [{"label": "A", "text": question["correct_answer"]}]}
        comparison = comparison_row(comparison_entry, cert_id=scope["cert_id"])
        duplicate = check_near_duplicate(comparison_entry, [b for b in [*bank, *seen] if b["id"] != storage_id])
        if not duplicate["passed"]:
            errors.append("near_duplicate")
        if not errors and sum(r["would_publish"] for r in results) >= limit:
            errors.append("publish_limit")
        result = {"candidate_id": ident, "question_id": storage_id, "content_sha256": expected_hash,
            "would_publish": not errors, "reasons": errors, "revision": row.get("revision") if row else None,
            "verdict_sha256": canonical_sha256(raw), "request_sha256": canonical_sha256(request)}
        results.append(result)
        bindings.extend([(request_path, request_digest), (verdict_path, verdict_digest)])
        if not errors:
            seen.append(comparison)
    bindings = [(artifact, artifact_digest), *bindings]
    for path, digest in bindings:
        refuse_canary_paths(path)
        if _sha(path) != digest:
            raise ValueError("Frozen inputs changed during publication validation")
    return {"version": 1, "mode": "dry-run", "artifact_sha256": artifact_digest,
        "would_publish": sum(r["would_publish"] for r in results), "published": 0,
        "candidates": results}, bindings


def apply_publication(client, report, bindings, *, actor="pipeline-v6", checkpoint=None):
    """Final local fences precede each atomic DB recomputation and event write."""
    from shared.council_safety import refuse_canary_paths
    for row in report["candidates"]:
        if not row["would_publish"]:
            continue
        for path, digest in bindings:
            refuse_canary_paths(path)
            if _sha(path) != digest:
                raise ValueError("Frozen publication inputs changed")
        row["write_status"] = "unknown"
        report["mode"] = "apply"
        if checkpoint:
            checkpoint(report)  # Durable intent before an ambiguous transport failure.
        try:
            result = client.rpc("publish_question", {"p_question_id": row["question_id"],
                "p_expected_sha256": row["content_sha256"], "p_actor": actor,
                "p_payload": {"artifact_sha256": report["artifact_sha256"],
                    "verdict_sha256": row["verdict_sha256"], "request_sha256": row["request_sha256"],
                    "expected_revision": row["revision"]}}).execute().data
            if not isinstance(result, dict) or result.get("changed") is not True:
                if isinstance(result, dict) and result.get("changed") is False:
                    row["write_status"] = "refused"
                raise ValueError("Publication refused or unknown; reconcile DB events before retry")
            row["published"] = True
            row["write_status"] = "complete"
            report["published"] += 1
        finally:
            if checkpoint:
                checkpoint(report)
    report["mode"] = "apply"
    return report


def write_report(path, report):
    """Atomic, fsync-backed local checkpoint; never logs provider error bodies."""
    import tempfile
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".publish-report-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(report, stream, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        Path(temporary).unlink(missing_ok=True)


@click.command()
@click.option("--artifact", required=True, type=click.Path(exists=True, path_type=Path))
@click.option("--verdicts", required=True, type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--questions", type=click.Path(exists=True, path_type=Path), help="Offline DB export, questions with answers and domain objects")
@click.option("--read-db", is_flag=True, help="Explicit coordinator-only read of current DB rows")
@click.option("--dry-run", is_flag=True, help="Default: write shadow report only")
@click.option("--apply", is_flag=True, help="Explicit coordinator-only atomic publication")
@click.option("--limit", default=10, type=click.IntRange(0, 10))
@click.option("--report", "report_path", required=True, type=click.Path(path_type=Path))
def main(artifact, verdicts, questions, read_db, dry_run, apply, limit, report_path):
    if dry_run and apply:
        raise click.ClickException("--dry-run and --apply are mutually exclusive")
    if questions and (read_db or apply):
        raise click.ClickException("Apply/read-db must read current rows, not trust an offline export")
    if not questions and not (read_db or apply):
        raise click.ClickException("Supply --questions for offline shadow, or explicitly --read-db")
    try:
        payload = _read(artifact)
        ingest.refuse_council_canary(artifact, payload)
        from shared.council_safety import refuse_canary_paths
        refuse_canary_paths(verdicts, report_path)
        if questions:
            refuse_canary_paths(questions)
        client = None
        if read_db or apply:
            client = database_client()
            ids = [candidate_storage_id(e, ingest._scope(payload, e), candidate_question(e))
                for e in payload["candidates"] if e.get("external_judge_request")]
            rows = load_database_rows(client, ids)
        else:
            exported = _read(questions)
            rows = exported["questions"] if isinstance(exported, dict) else exported
        report, bindings = plan_publication(artifact, verdicts, rows, limit=limit)
        if report_path.resolve() in {p.resolve() for p, _ in bindings}:
            raise ValueError("Report must not overwrite a frozen input")
        if report_path.exists():
            prior = _read(report_path)
            if any(r.get("write_status") in ("unknown", "complete") for r in prior.get("candidates", [])):
                raise ValueError("Existing publication checkpoint requires reconciliation")
        report["at"] = datetime.now(timezone.utc).isoformat()
        write_report(report_path, report)
        if apply:
            apply_publication(client, report, bindings,
                checkpoint=lambda current: write_report(report_path, current))
        write_report(report_path, report)
        click.echo(json.dumps({k: report[k] for k in ("mode", "would_publish", "published")}))
    except Exception as error:
        raise click.ClickException("Publication blocked: " + type(error).__name__) from None


if __name__ == "__main__":
    main()
