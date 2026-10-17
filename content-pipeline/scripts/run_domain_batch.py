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


def batch_commands(section, tag, cert, count, parallel, *, plan_only=False):
    if not re.fullmatch(r"[0-9]+\.", section) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", tag):
        raise ValueError("Section must be like 1.; tag must contain only letters, digits, _ or -")
    context = load_cert_context(cert)
    domain = next((d for d in context["domains"].values() if d["section_number"] + "." == section), None)
    if domain is None:
        raise ValueError("Section is not in the selected certification")
    base = PIPELINE / ".cache/generation" / (cert + "-v5-" + tag)
    artifact = base.with_suffix(".json")
    export = Path(str(base) + ".existing.json")
    if any(path.exists() for path in (artifact, export, Path(str(base) + ".judge-requests"),
                                      Path(str(base) + ".verdicts"), Path(str(base) + ".accepted-ids"),
                                      Path(str(artifact) + ".calls.jsonl"))):
        raise ValueError("Batch artifact or sidecar exists; use a new tag")
    generate = [sys.executable, "scripts/generate_all_domains.py", "--cert", cert,
                "--n-questions", str(count), "--model", "codex", "--judge-model", "external",
                "--parallel", str(parallel), "--gen-effort", "high", "--cite-effort", "medium",
                "--argon-gate", "--distractor-evidence", "consistent", "--artifact", str(artifact)]
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
@click.option("--count", type=click.IntRange(min=1), default=30, envvar="N", show_default=True)
@click.option("--parallel", type=click.IntRange(1, 4), default=3, envvar="PARALLEL", show_default=True)
@click.option("--plan-only", is_flag=True, help="Offline only: no export, credentials, models or database.")
def main(section, tag, cert, count, parallel, plan_only):
    try:
        artifact, export, commands = batch_commands(section, tag, cert, count, parallel, plan_only=plan_only)
        artifact.parent.mkdir(parents=True, exist_ok=True)
        if not plan_only:
            url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Coordinator must inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; no env files are read")
            exam = "GCP_PM_ML_ENG" if cert == DEFAULT_CERT else cert
            click.echo(f"Exported {export_questions(url, key, exam, export)} existing {cert} questions")
        for command in commands:
            subprocess.run(command, cwd=PIPELINE, check=True, stdin=subprocess.DEVNULL,
                           env={**os.environ, "PYTHON_DOTENV_DISABLED": "1"})
        if not plan_only:
            payload = json.loads(artifact.read_text())
            ids = [row["inserted_question_id"] for row in payload["candidates"] if row.get("accepted") and row.get("inserted_question_id")]
            Path(str(artifact.with_suffix("")) + ".accepted-ids").write_text("\n".join(ids))
            click.echo(f"Stored {len(ids)} DRAFT questions; publication is not authorized")
    except (ValueError, OSError, subprocess.CalledProcessError):
        # Do not print exceptions from HTTP/transport clients or credential-bearing environments.
        raise click.ClickException("Batch stopped; check registry inputs, injected credentials and private batch artifacts. No later stage was run.") from None


if __name__ == "__main__":
    main()
