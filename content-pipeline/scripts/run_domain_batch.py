#!/usr/bin/env python3
"""Coordinator-only cert batch runner. Importing or --plan-only never contacts services."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

import click
from shared.cert_context import DEFAULT_CERT, load_cert_context
from shared.near_duplicates import load_export

PIPELINE = Path(__file__).resolve().parents[1]
PAGE_SIZE = 500


def export_questions(url, key, exam, path, *, fetch=None):
    """Write a complete ACTIVE/DRAFT export only after all pages validate."""
    origin = urlsplit(url)
    if (origin.scheme != "https" or origin.username or origin.password or origin.port
            or not re.fullmatch(r"[a-z0-9]+\.supabase\.co", origin.hostname or "")
            or origin.path not in ("", "/") or origin.query or origin.fragment):
        raise ValueError("SUPABASE_URL must be a hosted Supabase project origin")
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    opener = build_opener(NoRedirect())
    def request(params):
        req = Request(url.rstrip("/") + "/rest/v1/questions?" + urlencode(params),
                      headers={"apikey": key, "Authorization": "Bearer " + key})
        with opener.open(req) as response:
            return json.load(response)
    fetch = fetch or request
    rows, ids = [], set()
    offset = 0
    while True:
        page = fetch({"select": "id,exam,status,stem,answers(choice_text,is_correct)",
                      "status": "in.(ACTIVE,DRAFT)", "exam": "eq." + exam,
                      "order": "id.asc", "limit": PAGE_SIZE, "offset": offset})
        if not isinstance(page, list):
            raise ValueError("Export API did not return a question list")
        for row in page:
            if (not isinstance(row, dict) or row.get("exam") != exam
                    or row.get("status") not in ("ACTIVE", "DRAFT")
                    or not isinstance(row.get("id"), str) or row["id"] in ids):
                raise ValueError("Export has foreign, duplicate or malformed question rows")
            ids.add(row["id"])
            rows.append(row)
        if not page:
            break
        # Continue until an empty page, even if the server caps page size below limit.
        offset += len(page)
    temp = path.with_suffix(".tmp.json")
    try:
        temp.write_text(json.dumps(rows, indent=2) + "\n")
        cert = DEFAULT_CERT if exam == "GCP_PM_ML_ENG" else exam
        load_export(temp, cert_id=cert)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)
    return len(rows)


def batch_commands(section, tag, cert, count, parallel, *, plan_only=False, resume=None):
    """Build one gated batch; ``all`` keeps the full weighted cert plan unfiltered."""
    if (section != "all" and not re.fullmatch(r"[0-9]+\.", section)
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", tag)):
        raise ValueError("Section must be all or like 1.; tag must contain only letters, digits, _ or -")
    context = load_cert_context(cert)
    domain = None
    if section != "all":
        domain = next((d for d in context["domains"].values() if d["section_number"] + "." == section), None)
        if domain is None:
            raise ValueError("Section is not in the selected certification")
    if resume is not None:
        if plan_only or section != "all" or cert != "data-engineer":
            raise ValueError("Resume requires an existing full-plan PDE run, not --plan-only")
        artifact = Path(resume).absolute()
        if (artifact.name != cert + "-v5-" + tag + ".json"
                or any(path.is_symlink() for path in (artifact, *artifact.parents))):
            raise ValueError("Resume artifact must match the certification and tag and cannot use symlinks")
        if not artifact.is_file():
            raise ValueError("Resume artifact does not exist")
        if artifact.parent.resolve() != (PIPELINE / ".cache/generation").resolve():
            raise ValueError("Resume must run from the artifact-owning pipeline checkout")
        saved = json.loads(artifact.read_text())
        if (saved.get("cert_id") != cert or saved.get("plan_only") or saved.get("requested_objective_ids")
                or not isinstance(saved.get("plan"), list) or not saved["plan"]
                or saved.get("planned_count") != len(saved["plan"])
                or (count is not None and count != len(saved["plan"]))):
            raise ValueError("Resume count or scope differs from the saved full plan")
        count = len(saved["plan"])
        base = artifact.with_suffix("")
    else:
        base = PIPELINE / ".cache/generation" / (cert + "-v5-" + tag)
        artifact = base.with_suffix(".json")
        if any(path.exists() for path in (artifact, Path(str(base) + ".existing.json"),
                                          Path(str(base) + ".judge-requests"), Path(str(base) + ".verdicts"),
                                          Path(str(base) + ".accepted-ids"), Path(str(artifact) + ".calls.jsonl"),
                                          base.with_suffix(".retry-report.json"))) or list(base.parent.glob(base.name + "-retry*")):
            raise ValueError("Batch artifact or sidecar exists; use a new tag")
    count = count if count is not None else (40 if section == "all" else 30)
    export = Path(str(base) + ".existing.json")
    if resume is not None and (export.is_symlink() or not export.is_file()):
        raise ValueError("Resume requires the unchanged non-symlink saved bank export")
    generate = [sys.executable, "scripts/generate_all_domains.py", "--cert", cert,
                "--n-questions", str(count), "--model", "codex", "--judge-model", "external",
                "--parallel", str(parallel), "--gen-effort", "high", "--cite-effort", "medium",
                "--argon-gate", "--distractor-evidence", "consistent",
                "--doc-cache", "--verify-stable-prefix", "--artifact", str(artifact)]
    if domain is not None:
        for objective in domain["objectives"]:
            generate += ["--objective", objective["objective_id"]]
    if plan_only:
        return artifact, export, [generate + ["--plan-only"]]
    generate += ["--existing-questions", str(export)]
    judge = [sys.executable, "scripts/judge_requests.py", "--requests", str(base) + ".judge-requests",
             "--verdicts", str(base) + ".verdicts", "--judge-model", "claude", "--parallel", str(parallel), "--argon-gate"]
    ingest = [sys.executable, "scripts/ingest_external_verdicts.py", "--artifact", str(artifact),
              "--verdicts", str(base) + ".verdicts"]
    return artifact, export, [generate, judge, ingest]


@click.command()
@click.argument("section")
@click.argument("tag")
@click.argument("cert", default=DEFAULT_CERT)
@click.option("--count", type=click.IntRange(min=1), default=None, envvar="N",
              help="Total candidates: 40 for all sections, 30 for a single section (overridden by N).")
@click.option("--parallel", type=click.IntRange(1, 4), default=3, envvar="PARALLEL", show_default=True)
@click.option("--retry-attempts", type=click.IntRange(min=0, max=10), default=2, show_default=True,
              help="Extra same-slot attempts for full-plan PDE; gates never change.")
@click.option("--plan-only", is_flag=True, help="Offline only: no export, credentials, models or database.")
@click.option("--resume", type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help="Resume this saved full-plan PDE artifact without regenerating saved waves.")
@click.option("--acknowledge-saved-system-failures", is_flag=True,
              help="Resume only: explicitly retain saved pre-judge system failures as failed attempts; never auto-retry them.")
@click.option("--write", is_flag=True,
              help="Coordinator authorization for resume DRAFT writes; resume is dry admission without this flag.")
def main(section, tag, cert, count, parallel, retry_attempts, plan_only, resume,
         acknowledge_saved_system_failures, write):
    """Run SECTION (e.g. 1. or all) as one artifact; all uses the weighted cert plan."""
    try:
        if acknowledge_saved_system_failures and resume is None:
            raise ValueError("Saved system-failure acknowledgment requires --resume")
        if write and (plan_only or section != "all" or cert != "data-engineer"):
            raise ValueError("--write requires a full-plan PDE run")
        artifact, export, commands = batch_commands(section, tag, cert, count, parallel,
                                                   plan_only=plan_only, resume=resume)
        artifact.parent.mkdir(parents=True, exist_ok=True)
        if not plan_only and (resume is None or write):
            url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Coordinator must inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; no env files are read")
            if resume is None:
                exam = "GCP_PM_ML_ENG" if cert == DEFAULT_CERT else cert
                click.echo(f"Exported {export_questions(url, key, exam, export)} existing {cert} questions")
        def execute(command):
            subprocess.run(command, cwd=PIPELINE, check=True, stdin=subprocess.DEVNULL,
                           env={**os.environ, "PYTHON_DOTENV_DISABLED": "1"})
        if not plan_only and section == "all" and cert == "data-engineer":
            from scripts.pde_retry import run_retry_batch
            from scripts import ingest_external_verdicts as ingestion
            from shared.external_judge import candidate_question, candidate_storage_id
            from shared.near_duplicates import comparison_row

            def storage_id(payload, entry):
                return candidate_storage_id(entry, ingestion._scope(payload, entry), candidate_question(entry))

            def admit(path, verdicts, **kwargs):
                with ingestion.artifact_lock(path):
                    return ingestion.ingest(path, verdicts, **kwargs)

            report = run_retry_batch(artifact, export, commands, retry_attempts=retry_attempts,
                                     execute=execute, admit=admit,
                                     load_bank=lambda path: load_export(path, cert_id=cert)["questions"],
                                     comparison=comparison_row, storage_id=storage_id,
                                     **({"resume": True, "write": write,
                                         "acknowledge_saved_system_failures": acknowledge_saved_system_failures}
                                        if resume is not None else {}))
            ids = [ident for wave in report["waves"] for ident in wave["selected_ids"]]
            click.echo("PDE accepted topic coverage: " + json.dumps(report["topics"]))
            click.echo("PDE planned vs accepted sections: " + json.dumps(report["sections"]))
        else:
            for command in commands:
                execute(command)
            ids = []
            if not plan_only:
                payload = json.loads(artifact.read_text())
                ids = [row["inserted_question_id"] for row in payload["candidates"] if row.get("accepted") and row.get("inserted_question_id")]
        if not plan_only:
            if resume is not None and not write:
                click.echo(f"Dry admission selected {len(ids)} questions; no DRAFT writes; coordinator --write required")
            else:
                Path(str(artifact.with_suffix("")) + ".accepted-ids").write_text("\n".join(ids))
                click.echo(f"Stored {len(ids)} DRAFT questions; publication is not authorized")
    except (ValueError, OSError, subprocess.CalledProcessError):
        # Do not print exceptions from HTTP/transport clients or credential-bearing environments.
        raise click.ClickException("Batch stopped; check registry inputs, injected credentials and private batch artifacts. No later stage was run.") from None


if __name__ == "__main__":
    main()
