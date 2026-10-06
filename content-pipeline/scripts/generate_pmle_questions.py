#!/usr/bin/env python3
"""Generate registry-scoped, grounded single-answer questions; never publish."""
import json
import math
import re
from threading import Condition, Event, RLock
from datetime import datetime, timezone
from pathlib import Path
import sys

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.cert_context import DEFAULT_CERT, plan_questions
from shared.dedupe import normalize_stem, strip_markdown
from shared.doc_search import search_objective_docs, documentation_context, DocumentationCache
from shared.parallel import run_bounded
from shared.evidence import check_evidence
from shared.llm_generator import generate_question, cite_question, GenerationOutputError
from shared.decision_planner import plan_decision, verify_decision, writer_decision_context, DecisionVetoError
from shared.llm_limits import MaxTokensTruncation
from shared.cli_models import CLIModelError, CLIUsageLimitError, CLIAuthError, CodexModelRejectedError
from shared.completion_diagnostics import _safe_completion
from shared.model_policy import DEFAULT_GENERATOR_MODEL, DEFAULT_JUDGE_MODEL, require_independent_models
from shared.quality_gate import JudgeVerdict, QUESTION_FIELDS, judge_question, judge_three_gates
from shared.validator import validate_question
from shared.batch_report import option_length_report, format_option_length_report, option_prefix_report, format_option_prefix_report
from shared.external_judge import build_request, candidate_id, request_directory

ARTIFACT_ROOT = Path(__file__).resolve().parents[1] / ".cache/generation"
OPTION_FIELDS = ("correct_answer", "distractor_1", "distractor_2", "distractor_3")
RATIONALE_FIELDS = ("correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation")


def strip_option_letter(text):
    return re.sub(r"^[A-Da-d][.):]\s*", "", text.strip())


def strip_references(text):
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    text = re.sub(r"\[\s*\d+\s*\]", "", text)
    return " ".join(text.split()).strip()


def clean_question(raw):
    question = {key: strip_markdown(raw.get(key, "")) if isinstance(raw.get(key), str) else "" for key in QUESTION_FIELDS}
    for key in OPTION_FIELDS:
        question[key] = strip_option_letter(question[key])
    for key in RATIONALE_FIELDS:
        question[key] = strip_references(question[key])
    return question


def database_client():
    # Dry-run never imports the database module, much less constructs a client.
    from shared.supabase_client import SupabaseClient
    return SupabaseClient()


def artifact_json_value(value):
    """Copy invalid nonfinite receipt values into explicit JSON-safe debug markers."""
    if isinstance(value, float) and not math.isfinite(value):
        return {"__nonfinite_float__": "NaN" if math.isnan(value) else ("Infinity" if value > 0 else "-Infinity")}
    if isinstance(value, dict):
        return {key: artifact_json_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [artifact_json_value(item) for item in value]
    return value


def write_artifact(path, artifact):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(artifact_json_value(artifact), indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    temp.replace(path)


def reject_candidate(entry, stage, reason):
    """Record a bounded gate reason without exposing provider exception bodies."""
    entry["failure_stage"] = stage
    entry["reason"] = _safe_completion(reason)[:1000]


def persist_candidate(client, scope, question, judge, grounding, exam, domain_id, run_id, difficulty,
                      *, before_insert=None, on_question_inserted=None, question_id=None):
    notes = json.loads(judge.to_review_notes())
    notes["grounding"] = grounding
    review_notes = json.dumps(notes, allow_nan=False, separators=(",", ":"))
    final_review = "GOOD" if judge.passed else "NEEDS_ANSWER_FIX"
    if before_insert is not None:
        before_insert()
    saved = client.insert_question({
        "exam": exam, "domain_id": domain_id, "stem": question["stem"], "difficulty": difficulty,
        "status": "DRAFT", "review_status": "UNREVIEWED" if judge.passed else final_review,
        "review_notes": review_notes, "generation_run_id": run_id,
        **({"id": question_id} if question_id is not None else {}),
    })
    if not saved:
        return False
    if on_question_inserted is not None:
        on_question_inserted(saved["id"])
    if question_id is not None and saved["id"] != question_id:
        raise ValueError("Inserted question ID does not match its idempotency key")
    options = [{"question_id": saved["id"], "choice_label": label,
                "choice_text": question[field], "is_correct": label == "A",
                "explanation_text": question[rationale]}
               for label, field, rationale in zip("ABCD", OPTION_FIELDS, RATIONALE_FIELDS)]
    answers = client.insert_answers_batch(options)
    if not answers or len(answers) != 4:
        return False
    explanation = client.insert_explanation({
        "question_id": saved["id"], "explanation_text": "\n\n".join(
            f"{label}: {question[field]}" for label, field in zip("ABCD", RATIONALE_FIELDS)),
        "doc_links": list(dict.fromkeys(e["url"] for e in grounding["evidence"])),
    })
    if not explanation:
        return False
    return bool(client.update_question_review(saved["id"], run_id, final_review, review_notes))


@click.command()
@click.option("--cert", default=DEFAULT_CERT, show_default=True)
@click.option("--n-questions", type=click.IntRange(min=1), default=10, show_default=True, help="Total candidate count across the plan, not per domain.")
@click.option("--domain-code", default=None, help="Optional domain filter; otherwise use all weighted sections.")
@click.option("--subsection", default=None, help="Optional guide subsection filter.")
@click.option("--objective", "objective_ids", multiple=True, help="Repeatable registry objective ID; overrides weights with round-robin targets in flag order.")
@click.option("--section-allocation", default=None, help="Comma-separated counts in included guide section order, summing to N; pilot: 4,5,6,6,5,4. Cannot combine with scope filters.")
@click.option("--model", default=DEFAULT_GENERATOR_MODEL, show_default=True)
@click.option("--judge-model", default=DEFAULT_JUDGE_MODEL, show_default=True, help="Use external to export judge requests and never write the DB.")
@click.option("--difficulty", type=click.Choice(["EASY", "MEDIUM", "HARD"]), default="MEDIUM", show_default=True)
@click.option("--dry-run", is_flag=True, help="Generate and judge locally; never access/write the DB.")
@click.option("--artifact", type=click.Path(path_type=Path), help="JSON review artifact. Defaults to .cache/generation/<cert>-<UTC>.json.")
@click.option("--exam", default=None, help="Existing DB exam identifier; no domain seeding is performed.")
@click.option("--seed", type=int, default=None, help="Reproduce weighted-plan objective offsets; explicit objectives always use flag order.")
@click.option("--parallel", type=click.IntRange(min=1, max=4), default=3, show_default=True, help="Concurrent candidates for Codex with external judging; other paths remain serial.")
@click.option("--gen-effort", type=click.Choice(["low", "medium", "high"]), default="high", show_default=True)
@click.option("--cite-effort", type=click.Choice(["low", "medium", "high"]), default="medium", show_default=True)
def main(cert, n_questions, domain_code, subsection, objective_ids, model, judge_model, difficulty, dry_run, artifact, exam, seed,
         parallel=3, gen_effort="high", cite_effort="medium", section_allocation=None):
    try:
        allocation = None
        if section_allocation is not None:
            if not re.fullmatch(r"[0-9]+(?:,[0-9]+)*", section_allocation):
                raise ValueError("Section allocation must be comma-separated nonnegative integers")
            allocation = [int(value) for value in section_allocation.split(",")]
        generator_family, judge_family = require_independent_models(model, judge_model)
        plan = plan_questions(cert, n_questions, domain_code=domain_code, subsection=subsection, seed=seed,
                              objective_ids=objective_ids, section_allocation=allocation)
    except ValueError as exc:
        raise click.ClickException(str(exc)) from None
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    artifact = artifact or ARTIFACT_ROOT / f"{cert}-{stamp}.json"
    if not artifact.resolve().is_relative_to(ARTIFACT_ROOT.resolve()) or artifact.suffix != ".json":
        raise click.ClickException("Artifacts must be JSON files under .cache/generation/")
    external = judge_model == "external"
    codex = model == "codex" or model.startswith("codex/")
    effective_parallel = parallel if external and codex else 1
    if external and (artifact.exists() or request_directory(artifact).exists()):
        raise click.ClickException("External artifacts/requests must use a new path; never overwrite an ingestion journal")
    payload = {"version": 1, "cert_id": cert, "model": model, "judge_model": judge_model,
               "generator_family": generator_family, "judge_family": judge_family,
               "dry_run": dry_run, "seed": seed, "requested_objective_ids": list(dict.fromkeys(objective_ids)),
               "planned_count": n_questions, "plan": plan, "candidates": [],
               "parallel": effective_parallel, "gen_effort": gen_effort, "cite_effort": cite_effort,
               "rules_version": 4, "section_allocation": allocation, "decision_first": True}
    client = None if dry_run or external else database_client()
    exam = exam or ("GCP_PM_ML_ENG" if cert == DEFAULT_CERT else cert)
    payload.update({"difficulty": difficulty, "exam": exam})
    if external:
        payload["external_judge_version"] = 2
    domains, runs, run_counts = {}, {}, {}
    if client is not None:
        # Resolve ALL existing domains before creating any run; never seed new certs.
        for item in plan:
            code = item["domain_code"]
            if code not in domains:
                domain = client.get_domain_by_code(code)
                if not domain:
                    raise click.ClickException(f"Domain {code} is not seeded; DB seeding requires separate approval")
                domains[code] = domain["id"]
        for code in domains:
            run = client.create_generation_run({"exam": exam, "domain_code": code,
                "target_count": sum(p["domain_code"] == code for p in plan), "generated_count": 0,
                "model": model, "prompt_version": "decision-first-rules-v4",
                "notes": json.dumps({"cert_id": cert, "judge_model": judge_model, "rules_version": 4})})
            if not run:
                raise click.ClickException("Could not create generation run")
            runs[code], run_counts[code] = run["id"], 0
            click.echo(f"Generation run {code}: {run['id']}")
    payload["generation_runs"] = runs
    seen = set()
    accepted = 0
    awaiting = 0
    batch_stop = None
    stop_event = Event()
    write_lock = RLock()
    commit_order = Condition(write_lock)
    next_commit = 1
    docs_cache = DocumentationCache()

    def process_candidate(item):
        nonlocal accepted, awaiting, batch_stop, next_commit
        index, scope = item
        request = None
        entry = {**{k: scope[k] for k in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment", "opening_style", "question_line", "key_length_rank")},
                 "index": index, "stem": None, "options": [], "key": "A", "rationales": {},
                 "evidence": [], "citation_attempts": [], "mechanical_check": {"passed": False, "errors": ["No fetched evidence"]},
                 "judge_verdict": {"passed": False, "score": 0.0, "reason": "Not judged", "model": judge_model},
                 "accepted": False}
        if external:
            entry["candidate_id"] = candidate_id(index, scope, {})
        stage = "decision_plan"
        try:
            entry["decision_attempts"] = []
            feedback = ""
            previous_decision = None
            for decision_attempt in range(2):
                stage = "decision_plan"
                decision = plan_decision(scope, model=model, difficulty=difficulty,
                    replacement_feedback=feedback, reasoning_effort=gen_effort)
                attempt = {"plan": decision}
                entry["decision_attempts"].append(attempt)
                if previous_decision is not None and decision["engineering_decision"].casefold() == previous_decision.casefold():
                    raise DecisionVetoError("Replacement must change the unsupported engineering decision")
                stage = "documentation"
                sources = search_objective_docs(scope["objective_text"], scope["services"],
                    cache=docs_cache, objective_id=scope["objective_id"], decision_plan=decision)
                if not sources:
                    raise ValueError("No fetched documentation")
                attempt["sources"] = sources
                entry["sources"] = sources  # Frozen current sources for final receipts.
                context = documentation_context(sources)
                stage = "decision_veto"
                proof = verify_decision(scope, decision, sources, model=model, reasoning_effort=cite_effort)
                attempt["proof"] = proof
                if proof["passed"]:
                    break
                previous_decision = decision["engineering_decision"]
                feedback = json.dumps({"unsupported_decision": decision, "veto_reason": proof["reason"],
                    "mechanical_errors": proof["mechanical_check"]["errors"],
                    "instruction": "Replace the engineering decision, not the scenario with extra exceptions."})
            else:
                raise DecisionVetoError("Replacement decision vetoed; discard candidate")
            # Objective text comes from the frozen reviewed registry, never the LM.
            decision_objective = {"objective_id": scope["objective_id"], "objective_text": scope["objective_text"]}
            scope["decision_objective"] = entry["decision_objective"] = decision_objective
            scope["decision_plan"], scope["decision_proof"] = decision, proof
            entry["decision_plan"], entry["decision_proof"] = decision, proof
            stage = "generation"
            raw = generate_question(writer_decision_context(scope, decision, proof), context, model=model,
                                    difficulty=difficulty, exam_subsection=scope["subsection"],
                                    **({"reasoning_effort": gen_effort} if codex else {}))
            stage = "schema"
            question = clean_question(raw)
            if external:
                entry["candidate_id"] = candidate_id(index, scope, question)
            entry.update({"stem": question["stem"], "options": [
                {"label": label, "text": question[field]} for label, field in zip("ABCD", OPTION_FIELDS)],
                "rationales": {label: question[field] for label, field in zip("ABCD", RATIONALE_FIELDS)}})
            validation = validate_question(question)
            entry["schema_check"] = {"passed": validation.is_valid, "errors": validation.errors}
            if not validation.is_valid:
                reject_candidate(entry, stage, "Schema validation failed: " + "; ".join(validation.errors))
                return
            stage = "citation"
            checked = None
            for cite_attempt in range(2):
                citation = cite_question(question, sources, model=model,
                    check_errors=checked["errors"] if checked else None,
                    **({"reasoning_effort": cite_effort} if codex else {}))
                checked = check_evidence(citation.get("evidence"), sources)
                attempt = {"evidence": citation.get("evidence"),
                           "mechanical_check": {"passed": checked["passed"], "errors": checked["errors"]}}
                # The citation helper returns only bounded, sanitized completion diagnostics.
                for key in ("parse_failure", "raw_response", "diagnostics"):
                    if key in citation:
                        attempt[key] = citation[key]
                entry["citation_attempts"].append(attempt)
                entry["evidence"] = attempt["evidence"]
                entry["mechanical_check"] = attempt["mechanical_check"]
                if checked["passed"]:
                    break
            if not checked["passed"]:
                reject_candidate(entry, "mechanical", "Mechanical evidence check failed: " + "; ".join(checked["errors"]))
                return
            entry["evidence"] = checked["options"]
            if not external:
                normalized = normalize_stem(question["stem"])
                if normalized in seen:
                    entry["duplicate"] = True
                    reject_candidate(entry, "duplicate", "Duplicate normalized stem within this batch")
                    return
                seen.add(normalized)
            if external:
                stage = "external_request"
                entry["candidate_id"] = candidate_id(index, scope, question)
                request = build_request(entry["candidate_id"], scope, question, sources, checked["options"])
                return  # Publish in plan order under the shared write lock.
            stage = "judge"
            judge = judge_three_gates(question, scope["domain_prompt"], documentation_context=context,
                                   model=judge_model, generator_model=model, option_evidence=checked["options"])
            entry["judge_verdict"] = {"passed": judge.passed, "score": judge.score, "reason": judge.reason, "model": judge.model}
            if getattr(judge, "gate_results", None) is not None:
                entry["gate_verdicts"] = judge.gate_results
            if getattr(judge, "error_class", None):
                entry["judge_verdict"]["error_class"] = judge.error_class
            if not judge.passed and getattr(judge, "diagnostics", None):
                entry["judge_verdict"]["diagnostics"] = judge.diagnostics
            grounding = {k: scope[k] for k in ("cert_id", "objective_id", "guide_sha256")}
            grounding.update({"generator_model": model, "judge_model": judge_model,
                              "evidence": checked["options"], "mechanical_check": entry["mechanical_check"],
                              "rules_version": 4, "gate_version": 4,
                              "decision_objective": decision_objective,
                              "decision_plan": decision, "decision_proof": proof,
                              "key_length_rank": scope["key_length_rank"]})
            if getattr(judge, "gate_results", None) is not None:
                grounding["gate_verdicts"] = judge.gate_results
            entry["grounding"] = grounding
            stage = "persistence"
            stored = True if dry_run else persist_candidate(client, scope, question, judge, grounding,
                exam, domains[scope["domain_code"]], runs[scope["domain_code"]], difficulty)
            entry["accepted"] = judge.passed and stored
            if not judge.passed:
                reject_candidate(entry, "judge", judge.reason)
                if not stored:
                    entry["reason"] += "; candidate persistence also failed"
            elif not stored:
                reject_candidate(entry, stage, "Candidate persistence failed; founder approval remains blocked")
            if client is not None and stored:
                run_counts[scope["domain_code"]] += 1
            accepted += int(entry["accepted"])
        except Exception as exc:
            # Never copy provider exception bodies/credentials into artifacts or stdout.
            entry["error_class"] = type(exc).__name__
            reject_candidate(entry, stage, str(exc) if isinstance(exc, CLIModelError) else stage.capitalize() + " request failed")
            if isinstance(exc, (CLIUsageLimitError, CLIAuthError, CodexModelRejectedError)):
                stop_event.set()  # Stop admission now, not after ordered publication.
                with write_lock:
                    if batch_stop is None:
                        batch_stop = {"error_class": type(exc).__name__, "reason": str(exc), "index": index}
                        payload["batch_stop"] = batch_stop
            if isinstance(exc, GenerationOutputError) and isinstance(exc.raw_response, str):
                entry["raw_response"] = exc.raw_response
            if isinstance(exc, (GenerationOutputError, MaxTokensTruncation)) and getattr(exc, "diagnostics", None):
                entry["diagnostics"] = exc.diagnostics
        finally:
            # Workers keep entries private until complete. All publication and report
            # updates share one lock, and duplicate selection follows the frozen plan.
            with commit_order:
                commit_order.wait_for(lambda: index == next_commit)
                try:
                    if request is not None:
                        try:
                            normalized = normalize_stem(entry["stem"])
                            if normalized in seen:
                                entry["duplicate"] = True
                                reject_candidate(entry, "duplicate", "Duplicate normalized stem within this batch")
                            else:
                                seen.add(normalized)
                                request_path = request_directory(artifact) / (entry["candidate_id"] + ".json")
                                write_artifact(request_path, request)
                                import hashlib
                                entry["external_judge_request"] = {
                                    "path": str(request_path.relative_to(artifact.parent)),
                                    "sha256": hashlib.sha256(request_path.read_bytes()).hexdigest(),
                                }
                                entry.update({"awaiting_external_judge": True, "status": "awaiting_external_judge"})
                                entry["judge_verdict"]["reason"] = "Awaiting external judge"
                                awaiting += 1
                        except Exception as exc:
                            entry["error_class"] = type(exc).__name__
                            entry.pop("external_judge_request", None)
                            reject_candidate(entry, "external_request", "External request publication failed; inspect local artifacts")
                    if not entry["accepted"] and not entry.get("awaiting_external_judge") and not entry.get("reason") and not entry.get("error_class"):
                        reject_candidate(entry, stage, stage.capitalize() + " failed before acceptance")
                    payload["candidates"].append(entry)
                    payload["option_length_report"] = option_length_report(payload["candidates"])
                    payload["option_prefix_report"] = option_prefix_report(payload["candidates"])
                    write_artifact(artifact, payload)
                finally:
                    next_commit += 1
                    commit_order.notify_all()

    run_bounded(enumerate(plan, 1), process_candidate, effective_parallel, stop_event)
    if client is not None:
        for code, run_id in runs.items():
            if not client.update_generation_run(run_id, {"generated_count": run_counts[code], "completed_at": datetime.now(timezone.utc).isoformat()}):
                raise click.ClickException("Run completion failed; founder approval remains blocked")
    click.echo(format_option_length_report(payload["option_length_report"]))
    click.echo(format_option_prefix_report(payload["option_prefix_report"]))
    click.echo(f"Accepted {accepted}/{n_questions}; artifact: {artifact}")
    if batch_stop:
        raise click.ClickException(batch_stop["reason"])
    if external:
        click.echo(f"Awaiting external judge {awaiting}/{n_questions}; requests: {request_directory(artifact)}; no DB writes")
        if awaiting != n_questions:
            raise click.ClickException("Some candidates failed before external judgment; inspect the artifact")
    elif accepted != n_questions:
        raise click.ClickException("Some candidates failed; inspect the artifact before retrying")


if __name__ == "__main__":
    main()
