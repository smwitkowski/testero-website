#!/usr/bin/env python3
"""Opt-in verified-parent variants. Default dry run renders prompts; never writes a DB."""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import sys
import uuid

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.generate_pmle_questions import clean_question, write_artifact
from scripts.ingest_external_verdicts import _read_json, _scope, validate_completed_journals
from scripts.export_judge_requests import _encode
from scripts.judge_requests import _publish
from shared.call_logging import call_context
from shared.cert_context import plan_questions, DEFAULT_CERT
from shared.external_judge import (candidate_id, canonical_sha256, build_request, request_directory,
                                   validate_candidate_records, SCOPE_FIELDS)
from shared.model_policy import require_independent_models
from shared.near_duplicates import load_export, comparison_row
from shared.option_order import store_options
from shared.quality_gate import QUESTION_FIELDS
from shared.validator import validate_question
from shared.variants import (parent_snapshot, writer_inputs, write_variant, render_prompt, lineage,
                             validate_variant, variant_duplicates, SKELETON_FIELDS, FAMILY_STEM_THRESHOLD, family_threshold)


def select_parents(artifacts, ids, bank_path):
    bank = load_export(bank_path, cert_id=DEFAULT_CERT)
    raw = _read_json(Path(bank_path))
    rows = raw["questions"] if isinstance(raw, dict) else raw
    selected = {}
    for artifact in artifacts:
        payload = _read_json(Path(artifact))
        validate_completed_journals(payload, Path(artifact))
        for entry in payload.get("candidates", []):
            ident = entry.get("inserted_question_id")
            if ident not in ids:
                continue
            _scope(payload, entry)
            parent = parent_snapshot(payload, entry, rows)
            if ident in selected and canonical_sha256(parent) != canonical_sha256(selected[ident]):
                raise ValueError("Conflicting parent artifacts; pass only the authoritative artifact")
            selected[ident] = parent
    if len(set(ids)) != len(ids) or set(selected) != set(ids):
        raise ValueError("Every requested parent ID must resolve once to an ACTIVE verified original")
    policies = {canonical_sha256(p["scope"].get("distractor_evidence")) for p in selected.values()}
    if len(policies) != 1:
        raise ValueError("Run separate batches for different parent evidence policies")
    return [selected[ident] for ident in ids], bank


def build_plan(parents, count, *, prior=(), policy_version=4, repair_mode=None):
    from collections import Counter
    from shared.variants import industry_allocation
    from shared.variant_plan import assignments as planned_assignments, make_scope
    rows = planned_assignments(parents, count, repair_mode=repair_mode)
    counts = Counter(parent["question_id"] for parent, _, _ in rows)
    allocation = industry_allocation(parents, counts, prior=prior)
    plan, assignments = [], []
    for index, (parent, ordinal, moment) in enumerate(rows, 1):
        scope = plan_questions(DEFAULT_CERT, index,
            objective_ids=[parent["scope"]["objective_id"]])[-1]
        scope = make_scope(scope, parent, ordinal, policy_version=policy_version,
                           index=index, total=len(rows), moment=moment)
        scope["industry"] = allocation[(parent["question_id"], ordinal)]
        for name in SKELETON_FIELDS:
            scope[name] = deepcopy(parent["scope"][name])
        if "distractor_evidence" in parent["scope"]:
            scope["distractor_evidence"] = deepcopy(parent["scope"]["distractor_evidence"])
        plan.append(scope)
        assignments.append((index, parent, ordinal))
    return plan, assignments

def generate(artifacts, ids, bank_path, output, *, variants_per_parent=3, enable_variants=False,
             model="codex", effort="low", predictor=None, family_stem_threshold=FAMILY_STEM_THRESHOLD,
             length_repair_predictor=None, prior_artifacts=(), variant_policy_version=4,
             repair_mode=None, live_prior_manifest=None):
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    family_stem_threshold = family_threshold(family_stem_threshold)
    output = Path(output).absolute()
    requests = request_directory(output)
    calls = output.with_suffix(output.suffix + ".calls.jsonl")
    if any(os.path.lexists(p) for p in (output, requests, calls)):
        raise ValueError("Use a fresh artifact basename; attempts cannot be replayed automatically")
    require_independent_models(model, "anthropic/claude-sonnet-5.5")
    require_independent_models(model, "openrouter/google/gemini-4-argon")
    parents, bank = select_parents(artifacts, ids, bank_path)
    from shared.variant_history import load_prior_variants
    if repair_mode is not None and (variant_policy_version != 5 or live_prior_manifest is None):
        raise ValueError("Round-5 repair requires policy 5 and the live-prior manifest")
    if live_prior_manifest is not None:
        from shared.variant_live_history import load_live_priors
        history = load_live_priors(live_prior_manifest, [Path(path).absolute() for path in prior_artifacts])
    else:
        history = load_prior_variants([Path(path).absolute() for path in prior_artifacts])
    plan, assignments = build_plan(parents, variants_per_parent, prior=history["questions"],
                                   policy_version=variant_policy_version, repair_mode=repair_mode)
    payload = {"cert_id": DEFAULT_CERT, "model": model, "judge_model": "external",
               "external_judge_version": 2, "rules_version": 5, "style_policy_version": "5.1",
               "execution_policy": "short_circuit_v1", "argon_gate": True,
               "difficulty": "MEDIUM", "exam": "GCP_PM_ML_ENG", "generation_runs": {},
               "variant_mode": 1, "family_stem_threshold": family_stem_threshold, "variant_parents": {p["question_id"]: p for p in parents},
               "existing_questions": bank, "plan": plan, "candidates": [],
               "variant_attempts": [], "offline": not enable_variants, "prior_variants": history}
    if repair_mode is not None:
        payload["repair_mode"] = repair_mode
    if "distractor_evidence" in parents[0]["scope"]:
        payload["distractor_evidence"] = parents[0]["scope"]["distractor_evidence"]
    output.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive reservation before any model work; unknown/interrupted attempts are consumed.
    if not _publish(output, payload, exclusive=True):
        raise ValueError("Artifact already exists")
    rendered = []
    seen = list(bank["questions"])
    for index, parent, ordinal in assignments:
        scope = plan[index - 1]
        siblings = [e for e in payload["candidates"] if e.get("parent_question_id") == parent["question_id"]]
        inputs = writer_inputs(parent, scope, siblings, ordinal, payload["difficulty"])
        prompt = render_prompt(inputs)
        rendered.append({"parent_question_id": parent["question_id"], "index": index,
                         "ordinal": ordinal, "characters": len(prompt),
                         "estimated_input_tokens": (len(prompt) + 3) // 4, "prompt": prompt})
        if not enable_variants:
            continue
        attempt = {"index": index, "parent_question_id": parent["question_id"],
                   "ordinal": ordinal, "status": "started", "calls_started": 1}
        payload["variant_attempts"].append(attempt)
        write_artifact(output, payload)
        entry = {name: deepcopy(scope[name]) for name in (*SCOPE_FIELDS, *SKELETON_FIELDS, "key_length_rank") if name in scope}
        entry.update(index=index, parent_question_id=parent["question_id"], accepted=False,
                     candidate_id=str(uuid.uuid5(uuid.NAMESPACE_URL, str(output) + f":{index}")),
                     sources=deepcopy(parent["sources"]), status="generation_failed")
        try:
            with call_context(stage="variant_write", index=index, attempt=1, calls_path=calls):
                raw = predictor(inputs) if predictor else write_variant(inputs, model=model, effort=effort)
            from shared.cli_models import output_model
            from shared.variants import VariantSignature
            raw = output_model(VariantSignature).model_validate(raw).model_dump()
            question = clean_question(raw)
            entry.update(candidate_id=candidate_id(index, scope, question), stem=question["stem"],
                         variant=lineage(parent, ordinal, {k: raw[k] for k in ("industry", "setting")}, family_stem_threshold))
            store_options(entry, question, parent["evidence"])
            payload["candidates"].append(entry)
            entry["failure_stage"] = "schema"
            validation = validate_question(question, industry_only=True)
            if raw["industry"] != scope["industry"]:
                validation.errors.append("Variant industry differs from its assigned plan industry")
                validation.is_valid = False
            entry["schema_check"] = {"passed": validation.is_valid, "errors": validation.errors,
                                     "warnings": validation.warnings}
            from shared.variants import (option_rewrite_check, option_rewrite_errors,
                length_repair_inputs, repair_option_lengths, OptionLengthRepairSignature)
            rank_policy = {"key_length_rank": scope["key_length_rank"]} if variant_policy_version == 5 else {}
            rewrite = option_rewrite_check(question, parent, **rank_policy)
            # One small option-only retry, never a new scenario or a general repair loop.
            length_only = all(error.startswith("Choice ") and " word count (" in error
                              for error in validation.errors)
            if ((validation.is_valid or length_only) and (rewrite["key_uniquely_shortest"]
                    or (variant_policy_version == 5 and not rewrite["key_length_rank_passed"]))
                    and raw["industry"] == scope["industry"]
                    and all(v < rewrite["threshold"] for v in rewrite["option_jaccard"].values())):
                entry["option_rewrite_check"] = rewrite
                entry["length_repair"] = {"before": deepcopy(rewrite), "status": "started"}
                entry["failure_stage"] = "variant_length_repair"
                attempt["calls_started"] = 2
                write_artifact(output, payload)
                repair_inputs = length_repair_inputs(question, rewrite)
                with call_context(stage="variant_length_repair", index=index, attempt=2, calls_path=calls):
                    repaired = (length_repair_predictor(repair_inputs) if length_repair_predictor
                                else repair_option_lengths(repair_inputs, model=model))
                repaired = output_model(OptionLengthRepairSignature).model_validate(repaired).model_dump()
                question = clean_question({**question, **repaired})
                entry.update(candidate_id=candidate_id(index, scope, question), stem=question["stem"])
                store_options(entry, question, parent["evidence"])
                validation = validate_question(question, industry_only=True)
                rewrite = option_rewrite_check(question, parent, **rank_policy)
                entry["length_repair"].update(status="completed", after=deepcopy(rewrite))
                entry["schema_check"] = {"passed": validation.is_valid, "errors": validation.errors,
                                         "warnings": validation.warnings}
                entry["failure_stage"] = "schema"
            entry["option_rewrite_check"] = rewrite
            validation.errors.extend(option_rewrite_errors(rewrite))
            if not rewrite["passed"]:
                validation.is_valid = False
                entry["schema_check"]["passed"] = False
            if not validation.is_valid:
                raise ValueError("Variant failed schema/mechanical style validation")
            entry["failure_stage"] = "lineage"
            validate_variant(payload, entry)
            entry["failure_stage"] = "near_duplicate"
            duplicate = variant_duplicates(entry, seen, parent, siblings=payload["candidates"],
                                           prior=history["questions"])
            entry["near_duplicate_check"] = duplicate
            if not duplicate["passed"]:
                entry["failure_stage"] = "near_duplicate"
                raise ValueError(duplicate["reason"])
            entry.update(mechanical_check={"passed": True, "errors": []},
                         awaiting_external_judge=True, status="awaiting_external_judge",
                         judge_verdict={"passed": False, "score": 0.0, "model": "external",
                                        "reason": "Awaiting independent gates"})
            entry["failure_stage"] = "request"
            request = build_request(entry["candidate_id"], scope, question, entry["sources"], parent["evidence"],
                                    gate_version=5, argon_gate=True, execution_policy="short_circuit_v1",
                                    variant_context={"metadata": entry["variant"], "parent": parent})
            destination = requests / (entry["candidate_id"] + ".json")
            requests.mkdir(parents=True, exist_ok=True)
            if not _publish(destination, request, exclusive=True):
                raise ValueError("Request already exists")
            entry["external_judge_request"] = {"path": str(destination.relative_to(output.parent)),
                                              "sha256": hashlib.sha256(_encode(request)).hexdigest()}
            entry.pop("failure_stage")
            seen.append(comparison_row(entry))
            attempt["status"] = "awaiting_external_judge"
        except Exception as error:
            if not any(e is entry for e in payload["candidates"]):
                payload["candidates"].append(entry)
            entry.update(failure_stage=entry.get("failure_stage", "variant_write"),
                         reason="Variant rejected: " + type(error).__name__,
                         error_class=type(error).__name__, awaiting_external_judge=False)
            attempt["status"] = "failed"
            from shared.variant_diagnostics import record_failure
            record_failure(attempt, payload, entry)
            entry["reason"] = attempt["reason"]
            write_artifact(output, payload)
            from shared.cli_models import CLIUsageLimitError, CLIAuthError, CodexModelRejectedError
            if isinstance(error, (CLIUsageLimitError, CLIAuthError, CodexModelRejectedError)):
                raise
        write_artifact(output, payload)
    if not enable_variants:
        payload["dry_run"] = {"method": "ceil(prompt characters / 4); not measured provider tokens",
                              "prompts": rendered,
                              "estimated_writer_input_tokens": sum(r["estimated_input_tokens"] for r in rendered),
                              "writer_calls": len(rendered), "plan_calls": 0, "verify_calls": 0,
                              "citation_calls": 0, "judge_tokens": "not estimated: depend on resulting question"}
        write_artifact(output, payload)
    elif payload["candidates"]:
        from shared.option_order import balance_options
        written = [e for e in payload["candidates"] if e.get("variant") and e.get("options")]
        if written:
            balance_options(written)
            write_artifact(output, payload)
            from scripts.export_judge_requests import export_requests
            export_requests(output, force=True)
            payload = _read_json(output)
        validate_candidate_records(payload)
    if variant_policy_version == 5:
        from shared.variant_plan import key_length_batch_report
        payload["variant_key_length_batch_report"] = key_length_batch_report(payload,
            [entry for entry in payload["candidates"] if entry.get("external_judge_request") and not entry.get("failure_stage")])
        write_artifact(output, payload)
    return payload


@click.command()
@click.option("--parent-artifact", "artifacts", multiple=True, required=True, type=click.Path(exists=True, path_type=Path))
@click.option("--parent-id", "ids", multiple=True, required=True)
@click.option("--existing-questions", "bank_path", required=True, type=click.Path(exists=True, path_type=Path))
@click.option("--artifact", "output", required=True, type=click.Path(path_type=Path))
@click.option("--variants-per-parent", default=3, type=click.IntRange(1, 5), show_default=True)
@click.option("--family-stem-threshold", default=FAMILY_STEM_THRESHOLD, type=click.FloatRange(min=0, max=1, min_open=True), show_default=True)
@click.option("--prior-artifact", "prior_artifacts", multiple=True, type=click.Path(exists=True, path_type=Path),
              help="Earlier variant artifacts; freeze their bound all-gate passes for family dedupe.")
@click.option("--enable-variants", is_flag=True, help="Opt in to live writer calls; default renders prompts offline.")
@click.option("--model", default="codex", show_default=True)
@click.option("--effort", default="low", type=click.Choice(["low", "medium", "high"]))
def main(**kwargs):
    try:
        payload = generate(**kwargs, variant_policy_version=5)
    except (ValueError, KeyError, OSError, TypeError) as error:
        raise click.ClickException("Variant preflight failed (" + type(error).__name__ + "); inspect local inputs") from None
    summary = {"candidates": len(payload["candidates"]), "offline": payload["offline"]}
    if "dry_run" in payload:
        summary.update({k: v for k, v in payload["dry_run"].items() if k != "prompts"})
    click.echo(json.dumps(summary, ensure_ascii=False))
    if any(e.get("failure_stage") for e in payload["candidates"]):
        raise click.exceptions.Exit(1)


if __name__ == "__main__":
    main()
