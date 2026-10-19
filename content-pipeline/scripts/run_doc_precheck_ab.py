#!/usr/bin/env python3
"""Plan a fresh offline-safe precheck A/B; execute only with coordinator consent."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import click

PIPELINE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE))


def comparison_commands(bank, tag, count=12, seed=1019):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]*", tag):
        raise ValueError("Use a filesystem-safe fresh tag")
    from shared.near_duplicates import load_export
    from shared.cert_context import DEFAULT_CERT
    load_export(bank, cert_id=DEFAULT_CERT)
    directory = PIPELINE / ".cache/generation" / tag
    if directory.exists():
        raise ValueError("A/B tag exists; use a fresh tag")
    base = [sys.executable, "scripts/generate_all_domains.py", "--cert", DEFAULT_CERT,
            "--n-questions", str(count), "--seed", str(seed), "--parallel", "1",
            "--model", "codex", "--judge-model", "external", "--argon-gate",
            "--distractor-evidence", "consistent", "--existing-questions", str(bank)]
    commands = {}
    for arm, flags in (("baseline", []), ("shadow", ["--planner-doc-precheck", "--doc-precheck-shadow"]),
                       ("treatment", ["--planner-doc-precheck"])):
        commands[arm] = base + ["--artifact", str(directory / (arm + ".json"))] + flags
    return directory, commands


@click.command()
@click.option("--bank", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--tag", required=True)
@click.option("--count", default=12, type=click.IntRange(min=1))
@click.option("--seed", default=1019, type=int)
@click.option("--execute", is_flag=True, help="Coordinator only: approved injected credentials; never reads env files.")
def main(bank, tag, count, seed, execute):
    try:
        bank = bank.resolve()
        directory, commands = comparison_commands(bank, tag, count, seed)
        implementation = {relative: hashlib.sha256((PIPELINE / relative).read_bytes()).hexdigest()
                          for relative in ("shared/decision_planner.py", "shared/doc_precheck.py",
                                           "shared/doc_search.py", "scripts/generate_pmle_questions.py",
                                           "scripts/evaluate_doc_precheck.py", "scripts/run_doc_precheck_ab.py")}
        manifest = {"version": 1, "implementation_sha256": implementation, "bank_sha256": hashlib.sha256(bank.read_bytes()).hexdigest(),
                    "commands": commands, "seed": seed, "count_per_arm": count,
                    "execute": execute, "quality_targets": {"veto_catch_min": .40, "false_block_max": .05},
                    "limits": "Unpaired LM plans despite fixed seed. Shadow predicts mechanical blocks against full-doc verifier; independent judges and eventual pass lineage required."}
        click.echo(json.dumps(manifest, indent=2))
        if execute:
            import os
            directory.mkdir(parents=True)
            (directory / "run.json").write_text(json.dumps(manifest, indent=2) + "\n")
            for command in commands.values():
                subprocess.run(command, cwd=PIPELINE, check=True, stdin=subprocess.DEVNULL,
                               env={**os.environ, "PYTHON_DOTENV_DISABLED": "1"})
    except (ValueError, OSError, subprocess.CalledProcessError):
        raise click.ClickException("A/B stopped; check inputs and private artifacts. No later stage was run.") from None


if __name__ == "__main__":
    main()
