#!/usr/bin/env python3
"""Export a founder spotcheck, then explicitly approve that reviewed candidate pool.

Approval is deliberately a separate invocation. --yes explicitly attests that a
human reviewed the existing exported sample; it never bypasses the export gate.
"""

from __future__ import annotations

import hashlib
import html
import json
import math
import random
import re
import sys
from pathlib import Path
from typing import Any

import click

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from shared.quality_gate import is_judge_passed

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
PAGE_SIZE = 500
ANSWER_CHUNK_SIZE = 100
MANIFEST_PREFIX = "<!-- content-pipeline-spotcheck: "
QUESTION_FIELDS = "id,generation_run_id,stem,exam,domain_id,difficulty,status,review_status,review_notes"
ANSWER_FIELDS = "id,question_id,choice_label,choice_text,is_correct,explanation_text"


def get_client():
    """Import connection code only when used; offline tests inject this factory."""
    from shared.supabase_client import SupabaseClient
    return SupabaseClient()


def all_pages(query_factory):
    """Stable ordering plus explicit ranges avoid Supabase's default row cap."""
    rows = []
    offset = 0
    while True:
        page = query_factory().order("id").range(offset, offset + PAGE_SIZE - 1).execute().data
        if not isinstance(page, list):
            raise click.ClickException("Database returned an invalid result; no approval performed.")
        rows.extend(page)
        # Advance by actual page size even if a server cap is smaller than requested.
        if not page:
            return rows
        offset += len(page)


def load_candidates(wrapper, run_id: str):
    client = wrapper.client
    runs = client.table("question_generation_runs").select("id,completed_at").eq("id", run_id).execute().data
    if not isinstance(runs, list) or len(runs) != 1:
        raise click.ClickException("Generation run not found.")
    if not runs[0].get("completed_at"):
        raise click.ClickException("Generation run is incomplete; completed_at is required.")
    questions = all_pages(lambda: client.table("questions").select(QUESTION_FIELDS)
                          .eq("generation_run_id", run_id).eq("status", "DRAFT")
                          .eq("review_status", "GOOD"))
    questions = [q for q in questions if is_judge_passed(q.get("review_notes"))]
    answers_by_question: dict[str, list[dict[str, Any]]] = {}
    ids = [q["id"] for q in questions]
    for start in range(0, len(ids), ANSWER_CHUNK_SIZE):
        chunk = ids[start:start + ANSWER_CHUNK_SIZE]
        answers = all_pages(lambda: client.table("answers").select(ANSWER_FIELDS).in_("question_id", chunk))
        for answer in answers:
            answers_by_question.setdefault(answer["question_id"], []).append(answer)
    candidates = []
    for question in questions:
        answers = answers_by_question.get(question["id"], [])
        # PMLE generation contract is exactly A-D, one correct and four rationales.
        if not complete_answers(answers) or not nonempty_text(question.get("stem")):
            continue
        candidates.append({**question, "answers": sorted(answers, key=lambda a: a["choice_label"])})
    return sorted(candidates, key=lambda q: q["id"]), len(questions) - len(candidates)


def nonempty_text(value):
    return isinstance(value, str) and bool(value.strip())


def complete_answers(answers):
    return (len(answers) == 4
            and {a.get("choice_label") for a in answers} == {"A", "B", "C", "D"}
            and all(type(a.get("is_correct")) is bool for a in answers)
            and sum(a["is_correct"] for a in answers) == 1
            and all(nonempty_text(a.get("choice_text")) and nonempty_text(a.get("explanation_text"))
                    for a in answers))


def sample_size(count):
    return math.ceil(count / 10) if count else 0


def fingerprint(candidates):
    payload = json.dumps(candidates, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def verdict(question):
    notes = question["review_notes"]
    if isinstance(notes, str):
        notes = json.loads(notes)
    return notes["content_pipeline_judge"]


def safe_text(value):
    # Escape HTML (including manifest-looking content) and Markdown control chars.
    text = html.escape(str(value), quote=False)
    return re.sub(r"([\\`*_{}\[\]#|])", r"\\\1", text).replace("\n", "<br>")


def render_report(run_id, candidates, sample):
    lines = [f"# Founder spotcheck: {run_id}", "",
             f"Eligible candidates: {len(candidates)}. Uniform random sample: {len(sample)} (ceil(10%)).", "",
             "Review every sampled question, correct flag, explanation and judge verdict before approval.",
             "If any sample fails, fix or reject it and export a new spotcheck before approving.", ""]
    for question in sample:
        v = verdict(question)
        lines.extend([f"## Question {question['id']}", "", safe_text(question["stem"]), "",
                      f"Judge: passed={v['passed']}; score={v['score']}; model={safe_text(v['model'])}",
                      f"Reason: {safe_text(v['reason'])}", ""])
        for answer in question["answers"]:
            lines.extend([f"- **{answer['choice_label']}** (correct={answer['is_correct']}): {safe_text(answer['choice_text'])}",
                          f"  Explanation: {safe_text(answer['explanation_text'])}"])
        lines.append("")
    return "\n".join(lines) + "\n"


def safe_report_path(path):
    path = Path(path)
    if any(part.startswith(".env") for part in path.parts):
        raise click.ClickException("Environment-file paths are forbidden.")
    # Do not follow symlinks to read or overwrite unrelated files.
    if any(p.is_symlink() for p in [path, *path.parents]):
        raise click.ClickException("Spotcheck paths must not contain symlinks.")
    if path.suffix.lower() != ".md":
        raise click.ClickException("Spotcheck output must be a .md file.")
    return path


def export_report(path, run_id, candidates):
    sample = random.sample(candidates, sample_size(len(candidates)))
    body = render_report(run_id, candidates, sample)
    manifest = {"version": 1, "run_id": run_id, "candidate_count": len(candidates),
                "candidate_fingerprint": fingerprint(candidates),
                "sample_ids": [q["id"] for q in sample], "body_sha256": digest(body)}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(MANIFEST_PREFIX + json.dumps(manifest, sort_keys=True) + " -->\n" + body, encoding="utf-8")
    return len(sample)


def verify_report(path, run_id, candidates):
    if not path.is_file():
        raise click.ClickException("Export a founder spotcheck first; approval does not create one.")
    try:
        first, body = path.read_text(encoding="utf-8").split("\n", 1)
        if not first.startswith(MANIFEST_PREFIX) or not first.endswith(" -->"):
            raise ValueError("missing manifest")
        manifest = json.loads(first[len(MANIFEST_PREFIX):-4])
        ids = manifest["sample_ids"]
        by_id = {q["id"]: q for q in candidates}
        valid = (manifest["version"] == 1 and manifest["run_id"] == run_id
                 and manifest["candidate_count"] == len(candidates)
                 and manifest["candidate_fingerprint"] == fingerprint(candidates)
                 and isinstance(ids, list) and len(ids) == sample_size(len(candidates))
                 and len(set(ids)) == len(ids) and all(i in by_id for i in ids)
                 and manifest["body_sha256"] == digest(body)
                 and body == render_report(run_id, candidates, [by_id[i] for i in ids]))
    except (ValueError, KeyError, TypeError):
        valid = False
    if not valid:
        raise click.ClickException("Spotcheck is stale, altered or for a different run; export and review again.")


def approve_candidates(wrapper, run_id, candidates):
    promoted = 0
    for question in candidates:
        # Recheck the judge immediately before constructing each guarded update.
        if not is_judge_passed(question.get("review_notes")):
            continue
        result = (wrapper.client.table("questions").update({"status": "ACTIVE"})
                  .eq("id", question["id"]).eq("generation_run_id", run_id)
                  .eq("status", "DRAFT").eq("review_status", "GOOD")
                  .eq("review_notes", question["review_notes"]).eq("stem", question["stem"])
                  .execute())
        if not isinstance(result.data, list):
            raise click.ClickException(f"Approval result unknown after {promoted} promotions; inspect the run before retrying.")
        promoted += len(result.data)
    return promoted


@click.command()
@click.argument("generation_run_id", type=click.UUID)
@click.option("--output", "-o", type=click.Path(path_type=Path), help="Spotcheck .md path (also read during approval).")
@click.option("--approve", is_flag=True, help="Promote the previously exported, human-reviewed pool to ACTIVE.")
@click.option("--yes", is_flag=True, help="Attest that you personally reviewed every sampled question in the existing export, and confirm promotion.")
def main(generation_run_id, output, approve, yes):
    """Export a 10% founder spotcheck for GENERATION_RUN_ID, or approve its reviewed pool."""
    run_id = str(generation_run_id)
    path = safe_report_path(output or PIPELINE_ROOT / "review" / f"{run_id}.md")
    if not approve and yes:
        raise click.UsageError("--yes requires --approve and attests human spotcheck review.")
    try:
        wrapper = get_client()
        candidates, excluded = load_candidates(wrapper, run_id)
        click.echo(f"Eligible: {len(candidates)}; incomplete excluded: {excluded}.")
        if not approve:
            size = export_report(path, run_id, candidates)
            click.echo(f"Exported {size} sampled questions to {path}.")
            return
        if not candidates:
            click.echo("Promoted: 0.")
            return
        verify_report(path, run_id, candidates)
        if not yes:
            click.confirm(f"I personally reviewed all sampled questions in {path} and accept their quality. "
                          f"Promote all {len(candidates)} candidates for run {run_id} to ACTIVE?", abort=True)
        # Refuse content or pool changes that happened while the founder confirmed.
        fresh, _ = load_candidates(wrapper, run_id)
        if fingerprint(fresh) != fingerprint(candidates):
            raise click.ClickException("Candidates changed during confirmation; export and review again.")
        promoted = approve_candidates(wrapper, run_id, fresh)
        click.echo(f"Promoted: {promoted}.")
    except click.ClickException:
        raise
    except click.Abort:
        raise
    except OSError as exc:
        raise click.ClickException("Cannot read or write the spotcheck file.") from exc
    except Exception as exc:
        # Do not echo API errors, which can contain endpoints or credential details.
        raise click.ClickException("Review database operation failed; no further approvals performed.") from exc


if __name__ == "__main__":
    main()
