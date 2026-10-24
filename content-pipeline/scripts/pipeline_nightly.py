"""Nightly pipeline coordinator. Default --print is offline and credential-free."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys

from scripts.nightly_budget import accounting, load_calls, BudgetError, week_start
from scripts.nightly_digest import digest, send
from scripts.nightly_plan import plan

PIPELINE = Path(__file__).resolve().parents[1]
REQUIRED_KEYS = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENROUTER_API_KEY", "EXA_API_KEY", "RESEND_API_KEY")
QUEUE_FIELDS = ("id,exam,domain_id,status,review_status,parent_question_id,stem,revision,content_sha256,"
                "created_at,review_notes,answers(choice_label,choice_text,is_correct,explanation_text),"
                "domain:exam_domains(id,code,exam),question_events(id,at,action,revision,payload)")


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w") as handle:
        os.chmod(temp, 0o600)
        json.dump(value, handle, indent=2, allow_nan=False)
        handle.write("\n")
    temp.replace(path)


def run(command, *, output=None):
    """Never echo CLI output, model prompts or credential-bearing errors."""
    if output:
        with Path(output).open("w") as handle:
            os.chmod(output, 0o600)
            return subprocess.run(command, cwd=PIPELINE, stdin=subprocess.DEVNULL, stdout=handle,
                                  stderr=subprocess.DEVNULL, timeout=21600, check=False).returncode
    return subprocess.run(command, cwd=PIPELINE, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL, timeout=21600, check=False).returncode


def preflight(*, execute=run, environ=None):
    environ = os.environ if environ is None else environ
    if any(not environ.get(key) for key in REQUIRED_KEYS):
        raise ValueError("Runtime credential injection is incomplete")
    # Coordinator-only. Authentication and quota probes never print auth state.
    probes = [["claude", "auth", "status"], ["codex", "login", "status"],
              [sys.executable, "-m", "scripts.nightly_preflight", "--provider", "claude", "--live"],
              [sys.executable, "-m", "scripts.nightly_preflight", "--provider", "codex", "--live"]]
    for command in probes:
        if execute(command):
            raise ValueError("Authentication/quota probe failed; checkpoint and stop")


def paused(tools):
    if (Path(tools) / "PIPELINE_PAUSED").exists():
        raise ValueError("PIPELINE_PAUSED is present")


def export_snapshot(client, now):
    from scripts.review_batch import all_pages
    rows = all_pages(lambda: client.table("questions").select(QUEUE_FIELDS).order("id"))
    return {"complete": True, "captured_at": now.isoformat(), "questions": rows}


def publications_today(client, now):
    from scripts.review_batch import all_pages
    start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    return len(all_pages(lambda: client.table("question_events").select("id").eq("action", "published").gte("at", start).order("id")))


def commands_for_batch(batch, tag, *, state_dir, tools, live=False, limit=10):
    cert = batch["cert"]
    base = PIPELINE / ".cache/generation" / (cert + "-v5-" + tag)
    report = Path(state_dir) / (tag + ".publish.json")
    generate = [sys.executable, "-m", "scripts.run_domain_batch", batch["section"], tag, cert,
                "--count", str(batch["count"]), "--parallel", "2"]
    publish = [sys.executable, "-m", "scripts.publish_batch", "--artifact", str(base) + ".json",
               "--verdicts", str(base) + ".verdicts", "--limit", str(limit), "--report", str(report)]
    publish += ["--apply"] if live else ["--read-db", "--dry-run"]
    return [("generate-judge-ingest", generate), ("publish", publish)]


def monitor_commands(config, run_dir, tools, seed):
    commands = []
    for kind, artifacts in (("canaries", config.get("health_artifacts")), ("gold", config.get("gold_artifacts"))):
        if not isinstance(artifacts, list) or not artifacts:
            raise ValueError("Canary and gold source artifacts must be configured")
        root = Path(run_dir) / kind
        prepare = [sys.executable, "-m", "scripts.council_health", "prepare", "--out", str(root),
                   "--seed", str(seed), "--per-type", "2"]
        if kind == "gold":
            prepare += ["--gold"]
        for artifact in artifacts:
            prepare += ["--artifact", str(artifact)]
        commands.extend([(kind + "-prepare", prepare),
                         (kind + "-judge", [sys.executable, "-m", "scripts.council_health", "live", "--root", str(root), "--coordinator-approved"]),
                         (kind + "-evaluate", [sys.executable, "-m", "scripts.council_health", "evaluate", "--root", str(root),
                                               "--state", str(Path(tools) / "council-health.json"), "--pause", str(Path(tools) / "PIPELINE_PAUSED")])])
    return commands


def notify(report, config, state, state_path, now, *, immediate=False, deliver=send):
    today = now.date().isoformat()
    week = week_start(now).date().isoformat()
    if immediate:
        if state.get("page_day") == today:
            return
        key, value = "page_day", today
    else:
        if state.get("digest_week") == week:
            return
        key, value = "digest_week", week
    # Claim before sending: unknown transport outcome must not spam on retries.
    state[key] = value
    state["mail_status"] = "delivery_unknown"
    save(state_path, state)
    deliver(digest(report), config)
    state["mail_status"] = "accepted_by_resend"
    save(state_path, state)


def nightly(config, *, coverage, tools, state_dir, now, live=False, execute=run, client=None):
    state_dir, tools = Path(state_dir), Path(tools)
    report = {"status": "planned", "mode": "shadow", "batches": [], "at": now.isoformat()}
    planned = plan(coverage, now, batches=config.get("batches", 2), count=config.get("count", 40))
    report["coverage"] = planned["coverage"]
    report["budget"] = accounting(load_calls(config["calls_root"]), now, rates=config.get("rates"))
    publication_live = live and (tools / "PUBLISH_LIVE").is_file()
    report["mode"] = "publish-live" if publication_live else "shadow"
    run_dir = state_dir / now.strftime("%Y%m%d")
    preview = []
    for index, batch in enumerate(planned["batches"]):
        tag = now.strftime("night-%Y%m%d") + "-" + str(index + 1)
        preview.extend(commands_for_batch(batch, tag, state_dir=run_dir, tools=tools, live=publication_live))
    queue_dir = run_dir / "recouncil"
    common = [sys.executable, "-m", "scripts.recouncil", "--queue", str(run_dir / "quarantined.json"),
              "--output-dir", str(queue_dir), "--artifact-root", str(PIPELINE / ".cache/generation")]
    queue_commands = [("recouncil-prepare", common + ["--report", str(run_dir / "recouncil-prepare.json")]),
                      ("recouncil-judge", [sys.executable, "-m", "scripts.judge_requests", "--requests", str(queue_dir / "judge-requests"),
                                           "--verdicts", str(queue_dir / "verdicts"), "--judge-model", "claude", "--argon-gate", "--full-gate-sample", "1"]),
                      ("recouncil-evaluate", common + ["--verdict-dir", str(queue_dir / "verdicts"), "--report", str(run_dir / "recouncil.json")]
                       + (["--apply"] if publication_live else ["--dry-run"]))]
    monitors = monitor_commands(config, run_dir, tools, int(now.strftime("%Y%m%d")))
    report["commands"] = monitors + preview + queue_commands
    if not live:
        report["note"] = "Offline print only: no logins, keys, quota probes, models, DB or email."
        return report
    state_dir.mkdir(parents=True, exist_ok=True)
    with (state_dir / "nightly.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state_path = state_dir / "state.json"
        state = json.loads(state_path.read_text()) if state_path.exists() else {}
        # Never replay an uncertain generation/publish command automatically.
        if run_dir.exists():
            raise ValueError("Daily checkpoint exists; reconcile manually before another run")
        run_dir.mkdir(parents=True)
        checkpoint = run_dir / "checkpoint.json"
        report["status"] = "preflight"
        save(checkpoint, report)
        try:
            preflight(execute=execute)
            paused(tools)
            from scripts.retire_legacy import get_client
            client = client or get_client()
            fresh = export_snapshot(client, now)
            save(run_dir / "coverage.json", fresh)
            # Rebuild the plan from fresh database counts, never the preview export.
            planned = plan(fresh, now, batches=config.get("batches", 2), count=config.get("count", 40))
            report["coverage"] = planned["coverage"]
            def step(name, command, output=None):
                paused(tools)
                if "--apply" in command and not (tools / "PUBLISH_LIVE").is_file():
                    raise ValueError("PUBLISH_LIVE removed before a write stage")
                report["budget"] = accounting(load_calls(config["calls_root"]), datetime.now(timezone.utc), rates=config.get("rates"))
                report["status"], report["running_stage"] = "running", name
                report["next_command"] = command
                save(checkpoint, report)
                if execute(command, **({"output": output} if output else {})):
                    raise ValueError("Stage failed or quota exhausted: " + name)
                report.setdefault("completed_stages", []).append(name)
                report.pop("running_stage", None)
                save(checkpoint, report)
            # Health must pass before any new publication, including the first live night.
            for name, command in monitors:
                output = run_dir / (name + ".json") if name.endswith("evaluate") else None
                step(name, command, output=output)
                if output:
                    report.setdefault("health", {})[name] = json.loads(output.read_text())
            for index, batch in enumerate(planned["batches"]):
                tag = now.strftime("night-%Y%m%d") + "-" + str(index + 1)
                used = publications_today(client, datetime.now(timezone.utc))
                remaining = max(0, 10 - used)
                if remaining == 0:
                    report["reason"] = "Daily publication cap reached"
                    break
                from shared.nightly_budget import daily_claim
                # Reserve before generation; uncertainty never refunds a batch slot.
                daily_claim(config["calls_root"], datetime.now(timezone.utc))
                commands = commands_for_batch(batch, tag, state_dir=run_dir, tools=tools,
                                               live=publication_live, limit=remaining)
                for name, command in commands:
                    # Recheck the live flag immediately before each publication.
                    if name == "publish":
                        if publication_live and not (tools / "PUBLISH_LIVE").is_file():
                            raise ValueError("PUBLISH_LIVE removed before publication")
                        current = datetime.now(timezone.utc)
                        used = publications_today(client, current)
                        remaining = max(0, 10 - used)
                        if publication_live:
                            remaining = daily_claim(config["calls_root"], current, db_used=used,
                                                    publications=min(remaining, 5 if len(planned["batches"]) > 1 else 10))
                        command[command.index("--limit") + 1] = str(remaining)
                    step(tag + "-" + name, command)
                result = json.loads((run_dir / (tag + ".publish.json")).read_text())
                from scripts.nightly_metrics import batch_metrics
                metrics = batch_metrics(PIPELINE / ".cache/generation" / (batch["cert"] + "-v5-" + tag + ".json"),
                                        PIPELINE / ".cache/generation" / (batch["cert"] + "-v5-" + tag + ".verdicts"), result)
                report["batches"].append({"plan": batch, "publication": result, "metrics": metrics})
            fresh_queue = export_snapshot(client, datetime.now(timezone.utc))
            queue = [row for row in fresh_queue["questions"] if row["review_status"] == "QUARANTINED"]
            save(run_dir / "quarantined.json", {"questions": queue})
            if queue:
                for name, command in queue_commands:
                    if name == "recouncil-judge" and not list((queue_dir / "judge-requests").glob("*.json")):
                        report["recouncil_judge"] = {"status": "skipped", "reason": "No valid prepared requests; evaluate retained-quarantine reasons"}
                        save(checkpoint, report)
                        continue
                    step(name, command)
                report["recouncil"] = json.loads((run_dir / "recouncil.json").read_text())
            else:
                report["recouncil"] = {"queued": 0, "note": "Fresh DB queue empty"}
            report["status"] = "complete"
            report["budget"] = accounting(load_calls(config["calls_root"]), datetime.now(timezone.utc), rates=config.get("rates"))
            from scripts.nightly_metrics import observed_week
            report["weekly_observed"] = observed_week(state_dir, report, now)
            save(checkpoint, report)
            pages = list(report.get("recouncil", {}).get("pages", []))
            if report["weekly_observed"]["low_yield_two_batches"]:
                pages.append("Yield below 15% in two observed consecutive batches")
            report["pages"] = pages
            for value in report.get("health", {}).values():
                pages.extend(value.get("pages", []))
            report["pages"] = pages
            save(checkpoint, report)
            notify(report, config, state, state_path, now, immediate=bool(pages))
        except Exception as error:
            report["status"] = "checkpointed_stop"
            # Allowlisted local errors only; never include external transport prose.
            report["reason"] = str(error) if type(error) in (ValueError, BudgetError) else type(error).__name__
            save(checkpoint, report)
            try:
                notify(report, config, state, state_path, now, immediate=True)
            except Exception:
                report["email"] = "not confirmed; daily page claim retained to prevent repeats"
                save(checkpoint, report)
            return report
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--coverage", type=Path, help="Required offline: local complete coverage export; live reads fresh DB after preflight")
    parser.add_argument("--tools-dir", type=Path, required=True)
    parser.add_argument("--state-dir", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--print", action="store_true")
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--live", action="store_true", help="Coordinator only: probes, models, DB, optional flag-gated writes, email")
    args = parser.parse_args()
    try:
        config = json.loads(args.config.read_text())
        if not args.live and not args.coverage:
            parser.error("Offline print requires --coverage")
        if args.live:
            os.environ["TESTERO_NIGHTLY_CONFIG"] = str(args.config.resolve())
            os.environ["PYTHON_DOTENV_DISABLED"] = "1"
        now = datetime.now(timezone.utc)
        coverage = json.loads(args.coverage.read_text()) if args.coverage else {"complete": True, "captured_at": now.isoformat(), "questions": []}
        result = nightly(config, coverage=coverage, tools=args.tools_dir,
                         state_dir=args.state_dir, now=now, live=args.live)
        print(json.dumps(result, indent=2))
        return int(result["status"] == "checkpointed_stop")
    except Exception:
        parser.exit(2, "Nightly stopped; inspect offline inputs/runtime configuration. No fallback was attempted.\n")


if __name__ == "__main__":
    raise SystemExit(main())
