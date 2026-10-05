#!/usr/bin/env python3
"""Report PMLE replacement coverage; explicitly retire one legacy ACTIVE domain.

Receipts live in questions.review_notes. This tool never retrieves evidence or
loads environment files. Guarded row updates are not a cross-row transaction;
concurrent changes or unknown results stop further writes, not roll back writes.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.review_batch import all_pages, grounding, grounding_errors, is_judge_passed
from shared.cert_context import DEFAULT_CERT, load_cert_context

EXAM = "GCP_PM_ML_ENG"
FIELDS = "id,exam,domain_id,status,review_status,review_notes,generation_run_id"
RECEIPT_KEYS = {"cert_id", "objective_id", "guide_sha256", "generator_model",
                "judge_model", "evidence", "mechanical_check"}
EVIDENCE_KEYS = {"option_label", "url", "quote", "retrieved_at", "text_sha256"}


def get_client():
    """Create a client lazily from process environment only; tests inject this."""
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise click.ClickException("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the process environment.")
    return create_client(url, key)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def classification(question, context, code):
    """Return grounded, legacy, or invalid; invalid receipts are never legacy."""
    raw = question.get("review_notes")
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return "legacy"
    if not isinstance(raw, str):
        return "invalid"
    # Historic human notes are prose. JSON-looking or receipt-bearing damage
    # is not evidence that a row is legacy and must fail closed.
    if raw.strip() and raw.lstrip()[0] not in "{[\"" and '"grounding"' not in raw:
        try:
            json.loads(raw)
        except (ValueError, RecursionError):
            return "legacy"
    try:
        notes = json.loads(raw, object_pairs_hook=unique_object)
        if not isinstance(notes, dict):
            return "invalid"
        if "grounding" not in notes:
            return "legacy"
        data = grounding(question)
        if (not isinstance(data, dict) or set(data) != RECEIPT_KEYS
                or not is_judge_passed(raw) or grounding_errors(question)
                or question.get("review_status") != "GOOD"
                or not isinstance(question.get("generation_run_id"), str)
                or not question["generation_run_id"].strip()
                or data["cert_id"] != context["cert_id"]
                or data["guide_sha256"] != context["guide_sha256"]
                or data["objective_id"] not in {
                    obj["objective_id"] for obj in context["domains"][code]["objectives"]}
                or set(data["mechanical_check"]) != {"passed", "errors"}
                or any(set(item) != EVIDENCE_KEYS for item in data["evidence"])):
            return "invalid"
        return "grounded"
    except (ValueError, TypeError, KeyError, RecursionError, OverflowError):
        return "invalid"


def domain_ids(client, context):
    rows = all_pages(lambda: client.table("exam_domains").select("id,code")
                     .in_("code", list(context["domains"])))
    mapping = {}
    for row in rows:
        if (not isinstance(row, dict) or not isinstance(row.get("id"), str) or not row["id"].strip()
                or row.get("code") not in context["domains"]
                or row["code"] in mapping or row["id"] in mapping.values()):
            raise click.ClickException("Invalid or ambiguous canonical domain mapping; no retirement performed.")
        mapping[row["code"]] = row["id"]
    return mapping


def active_rows(client, domain_id=None):
    def query():
        q = client.table("questions").select(FIELDS).eq("exam", EXAM).eq("status", "ACTIVE")
        return q.eq("domain_id", domain_id) if domain_id is not None else q
    rows = all_pages(query)
    ids = set()
    for row in rows:
        if (not isinstance(row, dict) or set(FIELDS.split(",")) - set(row)
                or not isinstance(row["id"], str) or not row["id"]
                or not isinstance(row["domain_id"], str) or not row["domain_id"]
                or row["id"] in ids or row["exam"] != EXAM or row["status"] != "ACTIVE"
                or (domain_id is not None and row["domain_id"] != domain_id)):
            raise click.ClickException("Invalid or unstable ACTIVE snapshot; stop and retry after inspection.")
        ids.add(row["id"])
    return rows


def coverage(rows, context, code):
    groups = {kind: [] for kind in ("grounded", "legacy", "invalid")}
    objectives = {obj["objective_id"]: 0 for obj in context["domains"][code]["objectives"]}
    for row in rows:
        kind = classification(row, context, code)
        groups[kind].append(row)
        if kind == "grounded":
            objectives[grounding(row)["objective_id"]] += 1
    return groups, objectives


def report(rows, context, mapping, phase, codes=None):
    click.echo(f"{phase} PMLE ACTIVE coverage:")
    for code in codes or context["domains"]:
        selected = [r for r in rows if r["domain_id"] == mapping.get(code)]
        groups, objectives = coverage(selected, context, code)
        click.echo(f"{code}: grounded ACTIVE={len(groups['grounded'])}; legacy ACTIVE={len(groups['legacy'])}; invalid ACTIVE={len(groups['invalid'])}")
        for objective, count in objectives.items():
            click.echo(f"  {objective}: grounded ACTIVE={count}")
    unknown = sum(row["domain_id"] not in mapping.values() for row in rows)
    if unknown:
        click.echo(f"Unmapped PMLE ACTIVE rows={unknown} (not eligible for retirement).")


def require_threshold(rows, context, code):
    groups, _ = coverage(rows, context, code)
    if groups["invalid"]:
        raise click.ClickException("Invalid receipts in selected domain; no further retirement performed.")
    shortfall = len(groups["legacy"]) - len(groups["grounded"])
    if shortfall > 0:
        raise click.ClickException(f"Replacement shortfall={shortfall}; no retirement performed.")
    return groups["legacy"]


def snapshot(rows):
    return {row["id"]: row for row in rows}


def retire(client, rows, context, code, domain_id):
    legacy = require_threshold(rows, context, code)
    expected = snapshot(rows)
    retired = 0
    for row in legacy:
        fresh = active_rows(client, domain_id)
        if snapshot(fresh) != expected:
            raise click.ClickException("ACTIVE counts or row snapshots changed; no further retirement performed.")
        require_threshold(fresh, context, code)
        update = (client.table("questions").update({"status": "RETIRED"})
                  .eq("id", row["id"]).eq("exam", EXAM)
                  .eq("domain_id", domain_id).eq("status", "ACTIVE"))
        for field in ("review_notes", "generation_run_id", "review_status"):
            value = row[field]
            update = update.is_(field, "null") if value is None else update.eq(field, value)
        data = update.execute().data
        if (not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict)
                or set(row) - set(data[0])
                or any(data[0][key] != value for key, value in {**row, "status": "RETIRED"}.items())):
            raise click.ClickException("Retirement conflict or unknown update result; inspect persisted state before retrying.")
        retired += 1
        del expected[row["id"]]
    if snapshot(active_rows(client, domain_id)) != expected:
        raise click.ClickException("ACTIVE counts or row snapshots changed after retirement; inspect persisted state.")
    click.echo(f"Retired: {retired} (status only; no deletes).")


@click.command()
@click.option("--domain", help="Canonical PMLE domain CODE; required for --apply.")
@click.option("--apply", "apply_changes", is_flag=True, help="Retire legacy ACTIVE rows in the selected domain only.")
def main(domain, apply_changes):
    """Dry-run PMLE coverage by default. No cross-row atomicity is guaranteed."""
    if apply_changes and not domain:
        raise click.UsageError("--apply requires --domain CODE.")
    try:
        context = load_cert_context(DEFAULT_CERT)
        if domain and domain not in context["domains"]:
            raise click.UsageError("Unknown canonical PMLE domain CODE.")
        client = get_client()
        mapping = domain_ids(client, context)
        rows = active_rows(client)
        report(rows, context, mapping, "Before")
        if not apply_changes:
            click.echo("Dry run; no writes.")
            return
        if domain not in mapping:
            raise click.ClickException("Selected canonical domain is not seeded; no retirement performed.")
        selected = [row for row in rows if row["domain_id"] == mapping[domain]]
        click.echo("Guarded row updates are not atomic across rows; conflicts stop further writes, without rollback.")
        try:
            require_threshold(selected, context, domain)
            fresh = active_rows(client, mapping[domain])
            if snapshot(fresh) != snapshot(selected):
                raise click.ClickException("ACTIVE counts or row snapshots changed before retirement; no writes performed.")
            require_threshold(fresh, context, domain)
            retire(client, fresh, context, domain, mapping[domain])
        finally:
            try:
                report(active_rows(client, mapping[domain]), context, mapping, "After", [domain])
            except Exception:
                click.echo("After PMLE ACTIVE coverage: unavailable; inspect persisted state before retrying.")
                raise click.ClickException("After snapshot failed; no further retirement performed.") from None
    except click.ClickException:
        raise
    except Exception:
        raise click.ClickException("Retirement database or registry operation failed; no further writes performed. Inspect persisted state before retrying.") from None


if __name__ == "__main__":
    main()
