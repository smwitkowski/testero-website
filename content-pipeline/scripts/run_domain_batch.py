#!/usr/bin/env python3
"""Coordinator-only cert batch runner. Importing or --plan-only never contacts services.

Ready requests are judged after incomplete generation, then ordinary batches
attempt ingestion and report partial DRAFT writes even on a nonzero final exit.
Full-plan PDE keeps its frozen-slot, whole-wave admission safeguards: exhausted
system failures can still block admission, but never skip judging ready requests.
Nothing here authorizes ACTIVE publication.
"""
import hashlib
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


def batch_commands(section, tag, cert, count, parallel, *, plan_only=False, resume=None, doccheck_policy="v5",
                   prompt_pack=None, ab_interleaved=False, ab_experiment=None, ab_seed=0,
                   plan_freshness_lint=False, scenario_hint_cap=False, ab_control_pack=None,
                   second_seat_transport="openrouter"):
    """Build one gated batch; ``all`` keeps the full weighted cert plan unfiltered."""
    if (section != "all" and not re.fullmatch(r"[0-9]+\.", section)
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", tag)):
        raise ValueError("Section must be all or like 1.; tag must contain only letters, digits, _ or -")
    if doccheck_policy not in ("v5", "v6"):
        raise ValueError("Unsupported doccheck policy")
    from shared.argon_gate import model_for_transport
    model_for_transport(second_seat_transport)
    if ab_control_pack is not None and not ab_interleaved:
        raise ValueError("--ab-control-pack requires --ab-interleaved")
    if ab_interleaved and (prompt_pack is None or not ab_experiment or resume is not None
                           or (section == "all" and cert == "data-engineer")):
        raise ValueError("A/B requires a challenger and experiment ID; full-plan PDE retries/resume are not supported")
    if not ab_interleaved and ab_experiment is not None:
        raise ValueError("--ab-experiment requires --ab-interleaved")
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
        if saved.get("doccheck_policy", "v5") != doccheck_policy:
            raise ValueError("Doccheck policy differs from saved batch")
        if saved.get("second_seat_transport", "openrouter") != second_seat_transport:
            raise ValueError("Second-seat transport differs from saved batch")
        control_hash = None
        if ab_control_pack is not None:
            from shared.prompt_pack import load_pack, pack_hash
            control_hash = pack_hash(load_pack(ab_control_pack))
        if saved.get("ab_control_pack", {}).get("sha256") != control_hash:
            raise ValueError("Control prompt pack differs from saved batch")
        if any(saved.get(key, False) != value for key, value in (
                ("plan_freshness_lint", plan_freshness_lint), ("scenario_hint_cap", scenario_hint_cap))):
            raise ValueError("Planner experiment flags differ from saved batch")
        count = len(saved["plan"])
        base = artifact.with_suffix("")
    else:
        base = (PIPELINE / ".cache/generation").resolve() / (cert + "-v5-" + tag)
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
    if second_seat_transport != "openrouter":
        generate += ["--second-seat-transport", second_seat_transport]
    if prompt_pack is not None:
        generate += ["--prompt-pack", str(prompt_pack)]
    if ab_control_pack is not None:
        generate += ["--ab-control-pack", str(ab_control_pack)]
    if ab_interleaved:
        if count % 2:
            raise ValueError("A/B candidate count must be even")
        generate += ["--ab-interleaved", "--ab-experiment", ab_experiment, "--ab-seed", str(ab_seed)]
    if doccheck_policy == "v6":
        generate += ["--doccheck-policy", doccheck_policy]
    if plan_freshness_lint:
        generate += ["--plan-freshness-lint"]
    if scenario_hint_cap:
        generate += ["--scenario-hint-cap"]
    if domain is not None:
        for objective in domain["objectives"]:
            generate += ["--objective", objective["objective_id"]]
    if plan_only:
        return artifact, export, [generate + ["--plan-only"]]
    generate += ["--existing-questions", str(export), "--continue-quality-rejections"]
    judge = [sys.executable, "scripts/judge_requests.py", "--requests", str(base) + ".judge-requests",
             "--verdicts", str(base) + ".verdicts", "--judge-model", "claude", "--parallel", str(parallel), "--argon-gate"]
    if second_seat_transport != "openrouter":
        judge += ["--second-seat-transport", second_seat_transport]
    if ab_interleaved:
        judge += ["--full-gate-sample", "1"]
    ingest = [sys.executable, "scripts/ingest_external_verdicts.py", "--artifact", str(artifact),
              "--verdicts", str(base) + ".verdicts", "--continue-quality-rejections"]
    return artifact, export, [generate, judge, ingest]


def retryable_judge_ids(requests, verdicts):
    """Select only frozen, failed system calls, never a completed quality verdict.

    New failure records must explicitly say no seat rejected the candidate. Old
    records without that assertion require manual review, not automatic rerolls.
    """
    failures = verdicts / ".failures"
    if failures.is_symlink():
        raise ValueError("Unsafe judge failure directory")
    selected = []
    hard_stop = {"CLIUsageLimitError", "CLIAuthError", "CodexModelRejectedError",
                 "AuthenticationError", "PermissionDeniedError", "RateLimitError"}
    for path in sorted(failures.glob("*.json")):
        if path.is_symlink():
            raise ValueError("Unsafe judge failure record")
        record = json.loads(path.read_text())
        if not isinstance(record, dict):
            raise ValueError("Malformed judge failure record")
        if record.get("error_class") in hard_stop:
            return []  # Quota/auth stops apply to the whole batch.
        ident = path.stem
        request = requests / path.name
        if (not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", ident)
                or (verdicts / path.name).exists() or (verdicts / path.name).is_symlink()
                or record.get("candidate_id") != ident
                or record.get("quality_rejected") is not False
                or not isinstance(record.get("sub_call"), str)
                or not record["sub_call"].startswith(("claude.", "argon."))
                or record["sub_call"] == "argon.validation"
                or request.is_symlink() or not request.is_file()):
            continue
        if record.get("request_sha256") != hashlib.sha256(request.read_bytes()).hexdigest():
            raise ValueError("Judge failure does not match frozen request")
        selected.append(ident)
    return selected


def judge_with_system_retries(command, execute):
    """Judge once, then at most twice per failed candidate in the same cohort."""
    requests = Path(command[command.index("--requests") + 1])
    verdicts = Path(command[command.index("--verdicts") + 1])
    attempts = {}
    pending = command
    while True:
        try:
            execute(pending)
            return all((verdicts / path.name).is_file() and not (verdicts / path.name).is_symlink()
                       for path in requests.glob("*.json") if path.name != ".verdict-directories.json")
        except subprocess.CalledProcessError:
            ids = [ident for ident in retryable_judge_ids(requests, verdicts)
                   if attempts.get(ident, 0) < 2]
            if not ids:
                return False
            pending = list(command)
            for ident in ids:
                attempts[ident] = attempts.get(ident, 0) + 1
                pending += ["--candidate-id", ident]


@click.command()
@click.argument("section")
@click.argument("tag")
@click.argument("cert", default=DEFAULT_CERT)
@click.option("--count", type=click.IntRange(min=1), default=None, envvar="N",
              help="Total candidates: 40 for all sections, 30 for a single section (overridden by N).")
@click.option("--prompt-pack", type=click.Path(exists=True, dir_okay=False, path_type=Path), help="Writer-only challenger pack.")
@click.option("--ab-control-pack", type=click.Path(exists=True, dir_okay=False, path_type=Path), help="Explicit writer-only control pack; requires --ab-interleaved.")
@click.option("--ab-interleaved", is_flag=True, help="Randomized objective-paired control/challenger generation.")
@click.option("--ab-experiment", default=None)
@click.option("--ab-seed", type=int, default=0, show_default=True)
@click.option("--plan-freshness-lint", is_flag=True, help="Opt in to bounded lifecycle/name re-planning before docs.")
@click.option("--scenario-hint-cap", is_flag=True, help="Opt in to at most 3 relevant unmapped scenario hints.")
@click.option("--doccheck-policy", type=click.Choice(["v5", "v6"]), default="v5", show_default=True, help="Freeze decision documentation policy; council remains unchanged.")
@click.option("--second-seat-transport", type=click.Choice(["openrouter", "codex"]), default="openrouter", show_default=True)
@click.option("--parallel", type=click.IntRange(1, 4), default=3, envvar="PARALLEL", show_default=True)
@click.option("--retry-attempts", type=click.IntRange(min=0, max=10), default=2, show_default=True,
              help="Extra same-slot attempts for full-plan PDE; gates never change.")
@click.option("--plan-only", is_flag=True, help="Offline only: no export, credentials, models or database.")
@click.option("--resume", type=click.Path(exists=True, dir_okay=False, path_type=Path),
              help="Resume this saved full-plan PDE artifact without regenerating saved waves.")
@click.option("--acknowledge-saved-system-failures", is_flag=True,
              help="Resume only: explicitly retain saved pre-judge system failures as failed attempts; never auto-retry them.")
@click.option("--nightly-result", type=click.Path(dir_okay=False, path_type=Path),
              help="Private typed continuation result for the nightly coordinator.")
@click.option("--write", is_flag=True,
              help="Coordinator authorization for resume DRAFT writes; resume is dry admission without this flag.")
def main(section, tag, cert, count, parallel, retry_attempts, plan_only, resume,
         acknowledge_saved_system_failures, write, nightly_result, doccheck_policy="v5",
         prompt_pack=None, ab_interleaved=False, ab_experiment=None, ab_seed=0,
         plan_freshness_lint=False, scenario_hint_cap=False, ab_control_pack=None,
         second_seat_transport="openrouter"):
    """Run SECTION (e.g. 1. or all) as one artifact; all uses the weighted cert plan."""
    from scripts.nightly_outcome import ordinary_failure, write_result, NightlyHardStop
    if nightly_result is not None:
        if nightly_result.exists() or nightly_result.is_symlink():
            raise click.ClickException("Existing nightly result requires manual reconciliation")
        write_result(nightly_result, "hard_stop")  # Interrupted/unknown work stays stopped.
    try:
        if acknowledge_saved_system_failures and resume is None:
            raise ValueError("Saved system-failure acknowledgment requires --resume")
        if write and (plan_only or section != "all" or cert != "data-engineer"):
            raise ValueError("--write requires a full-plan PDE run")
        artifact, export, commands = batch_commands(section, tag, cert, count, parallel,
                                                   plan_only=plan_only, resume=resume, doccheck_policy=doccheck_policy,
                                                   prompt_pack=prompt_pack, ab_interleaved=ab_interleaved,
                                                   ab_experiment=ab_experiment, ab_seed=ab_seed,
                                                   plan_freshness_lint=plan_freshness_lint, scenario_hint_cap=scenario_hint_cap,
                                                   ab_control_pack=ab_control_pack,
                                                   second_seat_transport=second_seat_transport)
        artifact.parent.mkdir(parents=True, exist_ok=True)
        if not plan_only and (resume is None or write):
            url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                raise ValueError("Coordinator must inject SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; no env files are read")
            if resume is None:
                exam = "GCP_PM_ML_ENG" if cert == DEFAULT_CERT else cert
                click.echo(f"Exported {export_questions(url, key, exam, export)} existing {cert} questions")
        stage_failures = []
        judged_cohorts = set()

        def launch(command):
            try:
                subprocess.run(command, cwd=PIPELINE, check=True, stdin=subprocess.DEVNULL,
                               env={**os.environ, "PYTHON_DOTENV_DISABLED": "1"})
            except subprocess.CalledProcessError:
                if nightly_result is not None and not ordinary_failure(command):
                    raise NightlyHardStop("Unclassified or hard nightly failure") from None
                raise

        def execute(command):
            if not plan_only and command[1] == "scripts/judge_requests.py":
                cohort = (command[command.index("--requests") + 1],
                          command[command.index("--verdicts") + 1])
                if cohort not in judged_cohorts:
                    if not judge_with_system_retries(command, launch):
                        stage_failures.append("judge")
                    judged_cohorts.add(cohort)
                return
            try:
                launch(command)
            except subprocess.CalledProcessError:
                if not plan_only and command[1] == "scripts/generate_all_domains.py":
                    target = Path(command[command.index("--artifact") + 1])
                    requests = target.with_suffix(".judge-requests")
                    if requests.is_dir() and not requests.is_symlink():
                        stage_failures.append("generate")
                        click.echo("Generation incomplete; judging frozen requests before ingestion")
                        if section == "all" and cert == "data-engineer":
                            # PDE validates complete frozen slots before admission.
                            # Judge ready requests even if that validation stops a
                            # partial wave; never bypass its admission safeguards.
                            judge = list(commands[1])
                            judge[judge.index("--requests") + 1] = str(requests)
                            judge[judge.index("--verdicts") + 1] = str(target.with_suffix(".verdicts"))
                            execute(judge)
                        return
                raise
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
                try:
                    execute(command)
                except subprocess.CalledProcessError:
                    if not plan_only and command[1] == "scripts/ingest_external_verdicts.py":
                        stage_failures.append("ingest")
                    else:
                        raise
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
        if stage_failures:
            if nightly_result is not None and "ingest" not in stage_failures:
                write_result(nightly_result, "partial")
            raise click.ClickException("Batch incomplete after judging and ingestion; inspect private artifacts ("
                                       + ", ".join(sorted(set(stage_failures))) + ")")
        write_result(nightly_result, "complete")
    except (ValueError, OSError, subprocess.CalledProcessError):
        # Do not print exceptions from HTTP/transport clients or credential-bearing environments.
        raise click.ClickException("Batch stopped; check registry inputs, injected credentials and private batch artifacts. Completed stages remain recorded; no publication is authorized.") from None


if __name__ == "__main__":
    main()
