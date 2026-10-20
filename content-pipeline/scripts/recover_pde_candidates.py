#!/usr/bin/env python3
"""Coordinator-only recovery of immutable PDE artifacts; offline dry-run by default."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import sys

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import ingest_external_verdicts as ingestion
from scripts.run_domain_batch import export_questions
from shared.external_judge import candidate_question, candidate_storage_id
from shared.near_duplicates import comparison_row, load_export
from shared.objective_style import uses_pde_style

PIPELINE = Path(__file__).resolve().parents[1]


def _regular(path):
    path = Path(path).absolute()
    if any(part.is_symlink() for part in (path, *path.parents)) or not path.is_file():
        raise ValueError("Recovery inputs must be regular files without symlinks")
    return path


def _digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _merge(bank, rows):
    """Merge unchanged question identities; conflicting snapshots fail closed."""
    by_id = {row["id"]: row for row in bank}
    for row in rows:
        prior = by_id.get(row["id"])
        if prior is not None:
            fields = ("stem", "key", "cert_id")
            if (any(prior.get(key) != row.get(key) for key in fields)
                    or sorted(prior.get("distractors", [])) != sorted(row.get("distractors", []))):
                raise ValueError("Conflicting recovery bank question identity")
            # Optional navigation provenance can differ between export and artifact.
            continue
        by_id[row["id"]] = row
    return list(by_id.values())


def _inventory(artifacts):
    records, payloads, files = [], [], []
    if len(set(map(str, artifacts))) != len(artifacts):
        raise ValueError("Duplicate recovery artifact")
    for index, artifact in enumerate(artifacts, 1):
        source = _regular(artifact)
        payload = ingestion._read_json(source)
        if (payload.get("cert_id") != "data-engineer" or payload.get("style_policy_version") not in ("5.2", "5.3")
                or payload.get("rules_version") != 5 or payload.get("judge_model") != "external"):
            raise ValueError("Recovery requires frozen PDE rules-v5.2/v5.3 external artifacts")
        # Validate complete frozen policies, never reconstruct or upgrade requests.
        for scope in payload["plan"]:
            policy = scope.get("style_policy")
            if (not uses_pde_style(policy) or policy["version"] != payload["style_policy_version"]
                    or policy["objective_id"] != scope.get("objective_id")):
                raise ValueError("Recovery style policy differs from its frozen plan")
        destination = Path(str(index)) / source.name
        records.append({"source": str(source), "sha256": _digest(source), "artifact": str(destination)})
        payloads.append(payload)
        files.append((source, destination))
        for entry in payload["candidates"]:
            if entry.get("persistence_status") is not None or entry.get("inserted_question_id"):
                if not ingestion._is_complete(entry):
                    raise ValueError("Source persistence requires human reconciliation")
            metadata = entry.get("external_judge_request")
            if not metadata:
                continue
            relative = Path(metadata["path"])
            if (relative.is_absolute() or ".." in relative.parts
                    or relative.name != entry["candidate_id"] + ".json"):
                raise ValueError("Unsafe source request path")
            request = _regular(source.parent / relative)
            if _digest(request) != metadata["sha256"]:
                raise ValueError("Source request digest mismatch")
            files.append((request, destination.parent / relative))
            verdict = source.with_suffix(".verdicts") / (entry["candidate_id"] + ".json")
            if verdict.exists() or verdict.is_symlink():
                files.append((_regular(verdict), destination.with_suffix(".verdicts") / verdict.name))
    inventory = [{"source": str(source), "sha256": _digest(source), "copy": str(dest)} for source, dest in files]
    return {"version": 1, "sources": records, "files": inventory}, payloads, files


def _workspace(workspace):
    root = (PIPELINE / ".cache/generation").resolve()
    workspace = Path(workspace).absolute()
    if (workspace == root or not workspace.resolve().is_relative_to(root)
            or any(part.is_symlink() for part in (workspace, *workspace.parents))):
        raise ValueError("Recovery workspace must be below this checkout's .cache/generation without symlinks")
    return workspace


def _prepare(workspace, manifest, files):
    manifest_path = workspace / "sources.json"
    if workspace.exists():
        if not manifest_path.is_file() or ingestion._read_json(manifest_path) != manifest:
            raise ValueError("Recovery workspace inputs changed; use the original sources or a new workspace")
        # Artifacts are mutable journals. Every frozen request and verdict stays exact.
        mutable = {row["artifact"] for row in manifest["sources"]}
        for row in manifest["files"]:
            copied = _regular(workspace / row["copy"])
            if row["copy"] not in mutable and _digest(copied) != row["sha256"]:
                raise ValueError("Recovery request or verdict copy changed")
        return
    workspace.mkdir(parents=True)
    expected = {row["copy"]: row["sha256"] for row in manifest["files"]}
    for source, relative in files:
        target = workspace / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        content = source.read_bytes()
        if hashlib.sha256(content).hexdigest() != expected[str(relative)]:
            raise ValueError("Recovery source changed while copying")
        target.write_bytes(content)
    ingestion.write_artifact(manifest_path, manifest)


def _completed_rows(payload):
    result = []
    for entry in payload["candidates"]:
        if ingestion._is_complete(entry):
            row = comparison_row(entry)
            row["id"] = entry["inserted_question_id"]
            result.append(row)
    return result


def recover(artifacts, workspace, *, existing_questions=None, write=False):
    """Copy then revalidate all ordinary gates; no model calls or source edits.

    Write mode refreshes the bank using coordinator-injected credentials. It never
    trusts a historical export as a current publication bank. Existing completed
    and ambiguous-write journals are never reset. A workspace is resumable only
    with the same immutable sources, requests and verdicts.
    """
    workspace = _workspace(workspace)
    manifest, payloads, files = _inventory([Path(p).absolute() for p in artifacts])
    workspace.parent.mkdir(parents=True, exist_ok=True)
    # Stable sidecar serializes the whole rolling-bank recovery, not only one source.
    with ingestion.artifact_lock(workspace):
        _prepare(workspace, manifest, files)
        if write:
            url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Write recovery requires coordinator-injected Supabase credentials")
            export = workspace / "current-bank.json"
            export_questions(url, key, "data-engineer", export)
            bank_snapshot = load_export(export, cert_id="data-engineer")
            basis = "fresh_coordinator_export"
        elif existing_questions is not None:
            bank_snapshot = load_export(_regular(existing_questions), cert_id="data-engineer")
            basis = "local_export_dry_run_only"
        else:
            rows = []
            for payload in payloads:
                rows = _merge(rows, payload["existing_questions"]["questions"])
            bank_snapshot = {"sha256": None, "questions": rows}
            basis = "historical_snapshots_dry_run_only"
        bank = bank_snapshot["questions"]
        # Include completed writes from every source before the first admission.
        for record in manifest["sources"]:
            target = workspace / record["artifact"]
            current = ingestion._read_json(target)
            ingestion.validate_completed_journals(current, target)
            bank = _merge(bank, _completed_rows(current))
        bank_ids = {row["id"] for row in bank}
        for record in manifest["sources"]:
            current = ingestion._read_json(workspace / record["artifact"])
            for entry in current["candidates"]:
                if "external_judge_request" not in entry or ingestion._is_complete(entry):
                    continue
                scope = ingestion._scope(current, entry)
                ident = candidate_storage_id(entry, scope, candidate_question(entry))
                if ident in bank_ids:
                    raise ValueError("Bank contains a candidate without its completed journal; reconcile before recovery")
        summary = {"version": 1, "dry_run": not write, "bank_basis": basis,
                   "bank_sha256": bank_snapshot["sha256"], "initial_bank_count": len(bank), "artifacts": []}
        for record in manifest["sources"]:
            target = workspace / record["artifact"]
            error = None
            with ingestion.artifact_lock(target):
                try:
                    ingestion.ingest(target, target.with_suffix(".verdicts"), dry_run=not write, publication_bank=bank)
                except click.ClickException as exc:
                    # Normal rejected/missing candidates are not a reason to lose passers.
                    # Any other failure stops all later sources.
                    if str(exc) not in {"Some candidates were not persisted; inspect the artifact",
                                        "No passing candidates; no new DB writes"}:
                        raise
                    error = str(exc)
            current = ingestion._read_json(target)
            # The ordinary final error also covers unknown/partial DB writes.
            # Do not continue the rolling bank after an uncertain persistence event.
            ingestion.validate_completed_journals(current, target)
            selected = []
            for entry in current["candidates"]:
                if ingestion._is_complete(entry) or (not write and entry.get("publication_selected") is True):
                    row = comparison_row(entry)
                    row["id"] = candidate_storage_id(entry, ingestion._scope(current, entry), candidate_question(entry))
                    selected.append(row)
            bank = _merge(bank, selected)
            summary["artifacts"].append({"artifact": str(target), "selected_count": len(selected),
                "selected_ids": [row["id"] for row in selected], "incomplete_candidates": error is not None,
                "product_share_report": current.get("product_share_report")})
            summary["rolling_bank_count"] = len(bank)
            ingestion.write_artifact(workspace / "recovery-report.json", summary)
        return summary


@click.command()
@click.option("--artifact", "artifacts", multiple=True, required=True,
              type=click.Path(exists=True, dir_okay=False, path_type=Path), help="Repeat in recovery order; source artifacts and sidecars stay read-only.")
@click.option("--workspace", required=True, type=click.Path(path_type=Path), help="New or resumable folder below this checkout's .cache/generation.")
@click.option("--existing-questions", type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help="Optional local bank for offline dry-run. Write mode always exports the current bank.")
@click.option("--write", is_flag=True, help="Coordinator only: refresh current bank and persist passing DRAFTs. Default is offline, no DB client.")
def main(artifacts, workspace, existing_questions, write):
    try:
        result = recover(artifacts, workspace, existing_questions=existing_questions, write=write)
        click.echo(f"Recovery {'write' if write else 'dry-run'} complete: rolling bank {result['rolling_bank_count']}; report {workspace / 'recovery-report.json'}")
    except (ValueError, KeyError, TypeError, OSError):
        raise click.ClickException("Recovery stopped safely; check immutable inputs, local workspace, and persistence journals") from None


if __name__ == "__main__":
    main()
