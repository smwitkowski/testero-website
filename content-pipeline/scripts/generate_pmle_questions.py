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
from shared.cert_context import DEFAULT_CERT, plan_questions, load_cert_context
from shared.objective_style import style_policy, uses_pde_style
from shared.cert_style import normalize_learner_prose, check_cert_style
from shared.cert_generation_policy import generation_policy, topic_distribution, check_product_share, product_share_report, select_publication_products, TUNING_SCOPE_FIELDS
from shared.answer_patterns import check_answer_pattern
from shared.batch_report import ml_practice_report
from shared.yield_planning import existing_scenarios, ObjectiveRotation
from shared.dedupe import normalize_stem, strip_markdown
from shared.option_order import store_options
from shared.near_duplicates import load_export, check_near_duplicate, check_plan_near_duplicate, comparison_row
from shared.batch_report import key_position_report, format_key_position_report, template_diversity_report
from shared.doc_search import search_objective_docs, DocumentationCache
from shared.doc_context_budget import DEFAULT_DOC_CONTEXT_CHARS, build_documentation_context, quote_in_context
from shared.parallel import run_bounded
from shared.evidence import check_evidence
from shared.call_logging import call_context
from shared.llm_generator import generate_question, cite_question, GenerationOutputError
from shared.decision_planner import plan_decision, verify_decision, writer_decision_context, writer_documentation_context, DecisionVetoError, evidence_missing_veto
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


def product_share_row(entry):
    """Use only the marked action, with the stem as fallback attribution context."""
    if "correct_answer" in entry:
        action = entry["correct_answer"]
    else:
        action = next(option["text"] for option in entry["options"] if option["label"] == entry["key"])
    return {"best_action": action, "product_context": entry["stem"]}


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
    entry.setdefault("error_class", "CandidateRejected")
    entry["error_message"] = entry["reason"]


QUALITY_REJECTION_STAGES = frozenset({"near_duplicate_plan", "answer_pattern", "schema", "mechanical",
                                      "near_duplicate", "duplicate", "documentation"})


def is_quality_rejection(entry):
    """Recognize explicit candidate vetoes, never arbitrary errors at a quality stage."""
    return ((entry.get("error_class") == "CandidateRejected"
             and entry.get("failure_stage") in QUALITY_REJECTION_STAGES)
            or (entry.get("error_class") == "DecisionVetoError"
                and entry.get("failure_stage") == "decision_veto"))


def is_acknowledgeable_system_failure(entry):
    """Identify the saved pre-judge documentation timeout, not a quality veto.

    This deliberately narrow resume classifier does not change generation's
    default fatal-error policy. Local schema, request, report and persistence
    failures are never eligible for acknowledgment.
    """
    if (not isinstance(entry, dict) or entry.get("failure_stage") != "documentation"
            or entry.get("error_class") != "ReadTimeout" or entry.get("accepted") is not False
            or (entry.get("awaiting_external_judge") is not None
                and entry.get("awaiting_external_judge") is not False)
            or entry.get("status") is not None):
        return False
    if any(key in entry for key in (
            "external_judge_request", "external_verdict", "external_judge_provenance",
            "grounding", "repair", "persistence_status", "inserted_question_id",
            "persistence_validation_failed", "option_order", "option_balance")):
        return False
    judge = entry.get("judge_verdict")
    if (not isinstance(judge, dict) or set(judge) != {"passed", "score", "reason", "model"}
            or judge["passed"] is not False or type(judge["score"]) not in (int, float)
            or judge["score"] != 0 or judge["reason"] != "Not judged" or judge["model"] != "external"):
        return False
    # The final search failed before its source set, proof or question existed.
    if (entry.get("stem") is not None or entry.get("options") != []
            or entry.get("evidence") != [] or entry.get("citation_attempts") != []
            or entry.get("rationales") != {}):
        return False
    mechanical = entry.get("mechanical_check")
    if not isinstance(mechanical, dict) or mechanical.get("passed") is not False:
        return False
    attempts = entry.get("decision_attempts")
    if not isinstance(attempts, list) or not attempts or not isinstance(attempts[-1], dict):
        return False
    last = attempts[-1]
    if (not isinstance(last.get("plan"), dict) or not last["plan"]
            or any(key in last for key in ("sources", "proof", "documentation_check"))):
        return False
    if "sources" in entry:
        # A later decision search can fail after an earlier attempt fetched docs.
        # Retain those frozen receipts; they are not proof of the failed attempt.
        return (isinstance(entry["sources"], list) and bool(entry["sources"])
                and any(isinstance(prior, dict) and prior.get("sources") == entry["sources"]
                        for prior in attempts[:-1]))
    return True


def generation_failure_summary(entries):
    """Count vetoes and system failures without printing provider messages."""
    quality = sum(is_quality_rejection(entry) for entry in entries)
    stages = {"decision_plan", "decision_veto", "near_duplicate_plan", "documentation", "taxonomy",
              "generation", "schema", "citation", "mechanical", "near_duplicate", "duplicate",
              "answer_pattern", "product_share", "external_request", "external_request_publication",
              "judge", "persistence"}
    diagnostics = []
    for entry in entries[:20]:
        ident, error = entry.get("candidate_id"), entry.get("error_class")
        diagnostics.append({
            "candidate_id": ident if isinstance(ident, str) and re.fullmatch(
                r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", ident) else "unknown",
            "failure_stage": entry.get("failure_stage") if entry.get("failure_stage") in stages else "unknown",
            "error_class": error if isinstance(error, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", error) else "unknown",
        })
    return {"quality_vetoes": quality, "system_errors": len(entries) - quality,
            "candidates": diagnostics, "omitted": max(0, len(entries) - len(diagnostics))}


def persist_candidate(client, scope, question, judge, grounding, exam, domain_id, run_id, difficulty,
                      *, before_insert=None, on_question_inserted=None, question_id=None, taxonomy_tags=None):
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
    order = grounding.get("option_order", dict(zip("ABCD", "ABCD")))
    options = [{"question_id": saved["id"], "choice_label": label,
                "choice_text": question[OPTION_FIELDS["ABCD".index(origin)]], "is_correct": origin == "A",
                "explanation_text": question[RATIONALE_FIELDS["ABCD".index(origin)]]}
               for label, origin in order.items()]
    answers = client.insert_answers_batch(options)
    if not answers or len(answers) != 4:
        return False
    explanation = client.insert_explanation({
        "question_id": saved["id"], "explanation_text": "\n\n".join(
            f"{label}: {question[RATIONALE_FIELDS['ABCD'.index(origin)]]}" for label, origin in order.items()),
        "doc_links": list(dict.fromkeys(e["url"] for e in grounding["evidence"])),
    })
    if not explanation:
        return False
    if taxonomy_tags is not None:
        from shared.question_taxonomy import persist_tags
        persist_tags(client, saved["id"], "generation", taxonomy_tags)
    return bool(client.update_question_review(saved["id"], run_id, final_review, review_notes))


def candidate_budget(n_questions=None, target_accepted=None, expected_yield=0.29):
    if n_questions is not None and target_accepted is not None:
        raise ValueError("--target-accepted and --n-questions are alternatives")
    if not math.isfinite(expected_yield) or not 0 < expected_yield <= 1:
        raise ValueError("Expected yield must be greater than 0 and at most 1")
    return math.ceil(target_accepted / expected_yield) if target_accepted is not None else (n_questions or 10)


@click.command()
@click.option("--cert", default=DEFAULT_CERT, show_default=True)
@click.option("--n-questions", type=click.IntRange(min=1), default=None, help="Total candidate count across the plan, not per domain (default: 10).")
@click.option("--target-accepted", type=click.IntRange(min=1), default=None, help="Plan ceil(K / expected-yield) candidates; alternative to --n-questions, not a quality guarantee.")
@click.option("--expected-yield", type=click.FloatRange(min=0, max=1, min_open=True), default=0.29, show_default=True, help="Planning yield assumption for --target-accepted; does not change gates.")
@click.option("--domain-code", default=None, help="Optional domain filter; otherwise use all weighted sections.")
@click.option("--subsection", default=None, help="Optional guide subsection filter.")
@click.option("--objective", "objective_ids", multiple=True, help="Repeatable registry objective ID; overrides weights with round-robin targets in flag order.")
@click.option("--distractor-evidence", type=click.Choice(["strict", "consistent"]), default="strict", show_default=True, help="Freeze decision/evidence review policy for this batch.")
@click.option("--doc-context-chars", type=click.IntRange(min=1), default=DEFAULT_DOC_CONTEXT_CHARS, show_default=True, help="Maximum fetched-document context characters per stage; required receipts must fit or the stage fails closed.")
@click.option("--doc-cache/--no-doc-cache", default=True, show_default=True, help="Reuse 7-day on-disk public official-document snapshots (IO only).")
@click.option("--verify-retrieval", is_flag=True, help="Opt in to per-claim BM25 queries with adjacent spans and one evidence-missing full-doc escalation (cheap context at most about 45k estimated doc tokens; escalation uses the configured full-source budget).")
@click.option("--verify-stable-prefix/--no-verify-stable-prefix", default=True, show_default=True, help="Reorder existing plan and verifier fields only; provider cache hits must be measured.")
@click.option("--decision-attempts", type=click.IntRange(min=1, max=3), default=3, show_default=True, help="Total decision plans including initial attempt; lower caps are experimental.")
@click.option("--argon-gate", is_flag=True, help="Freeze mandatory independent Gemini 4 Argon blind/full review requests.")
@click.option("--existing-questions", type=click.Path(exists=True, dir_okay=False, path_type=Path), help="Local ACTIVE/DRAFT question export for near-duplicate veto; no DB access.")
@click.option("--section-allocation", default=None, help="Comma-separated counts in included guide section order, summing to N; pilot: 4,5,6,6,5,4. Cannot combine with scope filters.")
@click.option("--model", default=DEFAULT_GENERATOR_MODEL, show_default=True)
@click.option("--judge-model", default=DEFAULT_JUDGE_MODEL, show_default=True, help="Use external to export judge requests and never write the DB.")
@click.option("--difficulty", type=click.Choice(["EASY", "MEDIUM", "HARD"]), default="MEDIUM", show_default=True)
@click.option("--emit-taxonomy", is_flag=True, help="Opt in to one additional plan-tagging call; freeze tags for ingestion. No quality prompt or threshold changes.")
@click.option("--frozen-plan", type=click.Path(exists=True, dir_okay=False, path_type=Path), help="Replacement scopes derived from a SHA256-bound original full-plan artifact.")
@click.option("--continue-quality-rejections", is_flag=True, help="External PDE orchestration only: finish all requests despite ordinary candidate quality vetoes; system errors still stop.")
@click.option("--plan-only", is_flag=True, help="Write the frozen cert plan offline; no model, docs or DB calls.")
@click.option("--dry-run", is_flag=True, help="Generate and judge locally; never access/write the DB.")
@click.option("--artifact", type=click.Path(path_type=Path), help="JSON review artifact. Defaults to .cache/generation/<cert>-<UTC>.json.")
@click.option("--exam", default=None, help="Existing DB exam identifier; no domain seeding is performed.")
@click.option("--seed", type=int, default=None, help="Reproduce weighted-plan objective offsets; explicit objectives always use flag order.")
@click.option("--parallel", type=click.IntRange(min=1, max=4), default=3, show_default=True, help="Concurrent candidates for Codex with external judging; other paths remain serial.")
@click.option("--gen-effort", type=click.Choice(["low", "medium", "high"]), default="high", show_default=True)
@click.option("--cite-effort", type=click.Choice(["low", "medium", "high"]), default="medium", show_default=True)
def main(cert, n_questions, domain_code, subsection, objective_ids, model, judge_model, difficulty, dry_run, artifact, exam, seed,
         parallel=3, gen_effort="high", cite_effort="medium", section_allocation=None, existing_questions=None, argon_gate=False,
         target_accepted=None, expected_yield=0.29, distractor_evidence="strict", plan_only=False, emit_taxonomy=False,
         doc_cache=True, verify_retrieval=False, verify_stable_prefix=True, decision_attempts=3,
         doc_context_chars=DEFAULT_DOC_CONTEXT_CHARS, frozen_plan=None, continue_quality_rejections=False):
    retry_manifest = None
    try:
        from shared.distractor_evidence import evidence_policy
        frozen_evidence = evidence_policy(distractor_evidence)
        n_questions = candidate_budget(n_questions, target_accepted, expected_yield)
        if argon_gate:
            if judge_model != "external":
                raise ValueError("Argon gate requires external judging")
            require_independent_models(model, "openrouter/google/gemini-4-argon")
        bank = load_export(existing_questions, cert_id=cert) if existing_questions else {"sha256": None, "questions": []}
        allocation = None
        if section_allocation is not None:
            if not re.fullmatch(r"[0-9]+(?:,[0-9]+)*", section_allocation):
                raise ValueError("Section allocation must be comma-separated nonnegative integers")
            allocation = [int(value) for value in section_allocation.split(",")]
        generator_family, judge_family = require_independent_models(model, judge_model)
        if frozen_plan is not None:
            if (cert != "data-engineer" or judge_model != "external" or domain_code or subsection
                    or objective_ids or allocation is not None or target_accepted is not None):
                raise ValueError("Frozen retries require unfiltered external PDE generation")
            from shared.retry_plan import load_frozen_retry_plan
            plan, retry_manifest = load_frozen_retry_plan(frozen_plan, cert_id=cert)
            if n_questions != len(plan):
                raise ValueError("Retry candidate count differs from the frozen source slots")
        else:
            plan = plan_questions(cert, n_questions, domain_code=domain_code, subsection=subsection, seed=seed,
                                  objective_ids=objective_ids, section_allocation=allocation)
        if continue_quality_rejections and (cert != "data-engineer" or judge_model != "external"):
            raise ValueError("Quality-only continuation requires external PDE generation")
    except ValueError as exc:
        raise click.ClickException(str(exc)) from None
    for scope in plan:
        scope["distractor_evidence"] = dict(frozen_evidence)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    artifact = artifact or ARTIFACT_ROOT / f"{cert}-{stamp}.json"
    if not artifact.resolve().is_relative_to(ARTIFACT_ROOT.resolve()) or artifact.suffix != ".json":
        raise click.ClickException("Artifacts must be JSON files under .cache/generation/")
    external = judge_model == "external"
    if emit_taxonomy and not external:
        raise click.ClickException("Taxonomy emission currently requires external verdict ingestion")
    codex = model == "codex" or model.startswith("codex/")
    effective_parallel = parallel if external and codex else 1
    if external and (artifact.exists() or request_directory(artifact).exists()):
        raise click.ClickException("External artifacts/requests must use a new path; never overwrite an ingestion journal")
    payload = {"version": 1, "cert_id": cert, "model": model, "judge_model": judge_model,
               "generator_family": generator_family, "judge_family": judge_family,
               "dry_run": dry_run, "seed": seed, "requested_objective_ids": list(dict.fromkeys(objective_ids)),
               "planned_count": n_questions, "target_accepted": target_accepted, "expected_yield": expected_yield,
               "plan": plan, "candidates": [],
               "parallel": effective_parallel, "gen_effort": gen_effort, "cite_effort": cite_effort,
               "rules_version": 5, "style_policy_version": plan[0]["style_policy"]["version"], "section_allocation": allocation, "decision_first": True,
               "distractor_evidence": frozen_evidence,
               "documentation_context_policy": {"version": 1, "max_chars": doc_context_chars},
               "existing_questions": bank, "argon_gate": argon_gate, "execution_policy": "short_circuit_v1",
               "retrieval_experiment": {"version": 1, "disk_cache": doc_cache,
                                         "per_option_retrieval": verify_retrieval,
                                         "stable_prefix": verify_stable_prefix,
                                         "decision_attempts": decision_attempts}}
    tuned = uses_pde_style(plan[0]["style_policy"])
    bank_actions = [{"id": row["id"], "best_action": row["key"], "product_context": row["stem"]}
                    for row in bank["questions"]] if tuned else []
    full_plan_count = retry_manifest["full_plan_count"] if retry_manifest else n_questions
    product_budget = max(40, len(bank_actions) + n_questions, full_plan_count)
    if retry_manifest is not None:
        payload.update(full_plan_count=full_plan_count, retry_slots=retry_manifest["slots"],
                       retry_source={key: retry_manifest[key] for key in ("source_artifact", "source_sha256")})
    if continue_quality_rejections:
        payload["continue_quality_rejections"] = True
    if tuned:
        payload["generation_policy"] = generation_policy(cert)
        payload["topic_plan_report"] = topic_distribution(plan)
        payload["product_share_report"] = product_share_report([], cert_id=cert)
    if emit_taxonomy:
        payload["taxonomy_enabled"] = True
    exam = exam or ("GCP_PM_ML_ENG" if cert == DEFAULT_CERT else cert)
    payload.update({"difficulty": difficulty, "exam": exam})
    if plan_only:
        payload.update(plan_only=True, dry_run=True, generation_runs={})
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_text(json.dumps(payload, indent=2) + "\n")
        click.echo(f"Offline plan: {len(plan)} {cert} candidates; no model, documentation or database calls")
        return
    client = None if dry_run or external else database_client()
    if external:
        payload["external_judge_version"] = 2
    domains, runs, run_counts = {}, {}, {}
    if client is not None:
        # Resolve ALL existing domains before creating any run; never seed new certs.
        for item in plan:
            code = item["domain_code"]
            if code not in domains:
                domain = client.get_domain_by_code(code, exam=exam)
                if not domain:
                    raise click.ClickException(f"Domain {code} is not seeded; DB seeding requires separate approval")
                domains[code] = domain["id"]
        for code in domains:
            run = client.create_generation_run({"exam": exam, "domain_code": code,
                "target_count": sum(p["domain_code"] == code for p in plan), "generated_count": 0,
                "model": model, "prompt_version": "decision-first-rules-v5",
                "notes": json.dumps({"cert_id": cert, "judge_model": judge_model, "rules_version": 5})})
            if not run:
                raise click.ClickException("Could not create generation run")
            runs[code], run_counts[code] = run["id"], 0
            click.echo(f"Generation run {code}: {run['id']}")
    payload["generation_runs"] = runs
    seen = set()
    accepted = 0
    pending_inline = []
    awaiting = 0
    batch_stop = None
    stop_event = Event()
    write_lock = RLock()
    commit_order = Condition(write_lock)
    next_commit = 1
    from shared.doc_disk_cache import DiskDocumentationCache
    from shared.doc_retrieval import RetrievalSession
    disk_cache = DiskDocumentationCache(Path(__file__).resolve().parent.parent / ".cache/documentation") if doc_cache else None
    docs_cache = DocumentationCache(disk_cache=disk_cache)
    retrieval_session = RetrievalSession() if verify_retrieval else None
    planning_history = {}
    objective_rotations = {}
    registry = load_cert_context(cert)
    pools = {code: [obj["objective_id"] for obj in domain["objectives"]
                   if (not subsection or obj["subsection"] == subsection)
                   and (not objective_ids or obj["objective_id"] in objective_ids)]
             for code, domain in registry["domains"].items()
             if any(item["domain_code"] == code for item in plan)}
    rotation = ObjectiveRotation(plan, pools)

    def admissions():
        for index, original in enumerate(plan, 1):
            with write_lock:
                selected, fair_share = rotation.select(original, payload["candidates"])
                # Required-topic reservations stay bound to their reviewed objective.
                if frozen_plan is not None or original.get("required_topic_id") is not None:
                    selected = original["objective_id"]
                scope = original
                if selected != original["objective_id"]:
                    scope = plan_questions(cert, index, objective_ids=[selected])[-1]
                    if tuned:
                        from shared.cert_context import tune_generation_scope
                        base = plan_questions(cert, index, objective_ids=[selected], generation_tuning=False)[-1]
                        scope = tune_generation_scope(base, index - 1, coverage_scope=original["topic_coverage_scope"],
                                                      policy=payload["generation_policy"])
                    scope["distractor_evidence"] = dict(frozen_evidence)
                    objective_rotations[index] = {"from": original["objective_id"], "to": selected,
                                                  "fair_share": fair_share}
                    plan[index - 1] = scope
            yield index, scope

    def process_candidate(item):
        nonlocal accepted, awaiting, batch_stop, next_commit
        index, scope = item
        request = None
        entry = {**{k: scope[k] for k in ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment", "opening_style", "question_line", "key_length_rank")},
                 "style_policy": scope["style_policy"], "distractor_evidence": dict(frozen_evidence),
                 "index": index, "stem": None, "options": [], "key": "A", "rationales": {},
                 "evidence": [], "citation_attempts": [], "mechanical_check": {"passed": False, "errors": ["No fetched evidence"]},
                 "judge_verdict": {"passed": False, "score": 0.0, "reason": "Not judged", "model": judge_model},
                 "accepted": False}
        if tuned:
            entry.update({key: scope[key] for key in TUNING_SCOPE_FIELDS})
        if index in objective_rotations:
            entry["objective_rotation"] = objective_rotations[index]
        if external:
            entry["candidate_id"] = candidate_id(index, scope, {})
        stage = "decision_plan"
        try:
            entry["decision_attempts"] = []
            feedback = ""
            vetoed_decisions = []
            veto_feedback = []
            escalated = False  # At most one full-source budgeted verify per candidate.
            for decision_attempt in range(decision_attempts):
                stage = "decision_plan"
                with write_lock:
                    summaries = existing_scenarios(scope, bank["questions"], payload["candidates"],
                        [decision for earlier, decision in sorted(planning_history.items()) if earlier < index])
                with call_context(stage="plan", candidate_id=entry.get("candidate_id"), index=index,
                                  attempt=decision_attempt + 1, calls_path=str(artifact) + ".calls.jsonl"):
                    decision = plan_decision(scope, model=model, difficulty=difficulty,
                        replacement_feedback=feedback, existing_scenarios=summaries, reasoning_effort=gen_effort,
                        **({"stable_prefix": True} if verify_stable_prefix else {}))
                attempt = {"attempt": decision_attempt + 1, "replacement_feedback": feedback,
                           "existing_scenarios": summaries, "plan": decision}
                with write_lock:
                    planning_history[index] = decision
                entry["decision_attempts"].append(attempt)
                if decision["engineering_decision"].casefold() in vetoed_decisions:
                    stage = "decision_veto"
                    attempt["proof"] = {"passed": False, "reason": "Replacement must change the unsupported engineering decision"}
                    raise DecisionVetoError(attempt["proof"]["reason"])
                stage = "near_duplicate_plan"
                plan_check = check_plan_near_duplicate(decision, bank["questions"], cert_id=cert)
                attempt["near_duplicate_plan_check"] = plan_check
                if not plan_check["passed"]:
                    entry["near_duplicate_plan_check"] = plan_check
                    reject_candidate(entry, stage, "near_duplicate_plan")
                    return
                if tuned:
                    with write_lock:
                        earlier_plans = [prior for earlier, prior in sorted(planning_history.items()) if earlier < index]
                        written = [row for row in payload["candidates"]
                                   if row.get("awaiting_external_judge") or row.get("accepted")
                                   or (not external and row.get("near_duplicate_check", {}).get("passed"))]
                        pattern = check_answer_pattern(decision, bank["questions"] + written + earlier_plans, cert_id=cert)
                        attempt["answer_pattern_check"] = entry["answer_pattern_plan_check"] = pattern
                        if not pattern["passed"]:
                            reject_candidate(entry, "answer_pattern", pattern["reason"])
                            return
                        # Planning is diagnostic only. Rank actual judged actions at
                        # publication, rather than reject a whole filtered section.
                        products = check_product_share(decision, bank_actions + earlier_plans, product_budget)
                        attempt["product_share_check"] = entry["product_share_plan_check"] = products
                stage = "documentation"
                sources = search_objective_docs(scope["objective_text"], scope["services"],
                    cache=docs_cache, objective_id=scope["objective_id"], decision_plan=decision)
                if not sources:
                    attempt["sources"] = []
                    attempt["documentation_check"] = {"passed": False, "reason": "No fetched official documentation"}
                    reject_candidate(entry, "documentation", "No fetched official documentation; evidence remains unsupported")
                    return
                full_sources = sources
                retrieval = None
                if retrieval_session is not None:
                    retrieval = retrieval_session.prepare(scope, decision, sources, budget=min(180000, doc_context_chars))
                    sources = retrieval["sources"]
                    attempt["retrieval"] = retrieval["metadata"]
                attempt["sources"] = sources
                entry["sources"] = sources  # Frozen full sources for final receipts and independent judges.
                attempt["documentation_contexts"] = {"verify": {}}
                stage = "decision_veto"
                with call_context(stage="verify", candidate_id=entry.get("candidate_id"), index=index,
                                  attempt=decision_attempt + 1, calls_path=str(artifact) + ".calls.jsonl",
                                  escalation=False, verify_context="retrieved" if retrieval is not None else "full"):
                    verify_options = {"doc_context_chars": doc_context_chars,
                                      "budget_metadata": attempt["documentation_contexts"]["verify"]}
                    if retrieval is not None:
                        verify_options["retrieval"] = retrieval
                    if verify_stable_prefix:
                        verify_options["stable_prefix"] = True
                    proof = verify_decision(scope, decision, sources, model=model, reasoning_effort=cite_effort, **verify_options)
                if retrieval is not None and not escalated and evidence_missing_veto(proof):
                    escalated = True
                    attempt["cheap_proof"] = proof
                    attempt["escalation"] = {"count": 1, "reason": "evidence_missing", "context": "full"}
                    # Baseline signature and original full sources under the doc cap;
                    # no retrieval/stable-prefix variant; semantic/mechanical gates stay.
                    with call_context(stage="verify", candidate_id=entry.get("candidate_id"), index=index,
                                      attempt=decision_attempt + 1, calls_path=str(artifact) + ".calls.jsonl",
                                      escalation=True, verify_context="full"):
                        attempt["documentation_contexts"]["escalation"] = {}
                        proof = verify_decision(scope, decision, full_sources, model=model, reasoning_effort=cite_effort,
                            doc_context_chars=doc_context_chars,
                            budget_metadata=attempt["documentation_contexts"]["escalation"])
                    sources = full_sources
                    attempt["sources"] = entry["sources"] = sources
                attempt["proof"] = proof
                if proof["passed"]:
                    break
                vetoed_decisions.append(decision["engineering_decision"].casefold())
                veto_feedback.append({"unsupported_decision": decision, "veto_reason": proof["reason"],
                                      "mechanical_errors": proof["mechanical_check"]["errors"]})
                feedback = json.dumps({"previous_vetoes": veto_feedback,
                    "instruction": "Replace the engineering decision, not the scenario with extra exceptions. Avoid the unverifiable claim and make each distractor clearly wrong on documented tradeoffs."})
            else:
                raise DecisionVetoError("Replacement decision vetoed; discard candidate: " + proof["reason"])
            # Objective text comes from the frozen reviewed registry, never the LM.
            decision_objective = {"objective_id": scope["objective_id"], "objective_text": scope["objective_text"]}
            scope["decision_objective"] = entry["decision_objective"] = decision_objective
            scope["decision_plan"], scope["decision_proof"] = decision, proof
            entry["decision_plan"], entry["decision_proof"] = decision, proof
            if emit_taxonomy:
                stage = "taxonomy"
                from shared.question_taxonomy import generation_receipt
                with call_context(stage="taxonomy", candidate_id=entry.get("candidate_id"), index=index,
                                  attempt=1, calls_path=str(artifact) + ".calls.jsonl"):
                    entry["taxonomy"] = generation_receipt(scope)
            stage = "generation"
            entry["documentation_contexts"] = {"writer": {}}
            writer_context = writer_documentation_context(sources, proof, doc_context_chars=doc_context_chars,
                budget_metadata=entry["documentation_contexts"]["writer"])
            with call_context(stage="write", candidate_id=entry.get("candidate_id"), index=index,
                              attempt=1, calls_path=str(artifact) + ".calls.jsonl"):
                raw = generate_question(writer_decision_context(scope, decision, proof), writer_context, model=model,
                                        difficulty=difficulty, exam_subsection=scope["subsection"], include_evidence=True, cert_id=cert,
                                         doc_context_chars=doc_context_chars,
                                        **({"reasoning_effort": gen_effort} if codex else {}))
            stage = "schema"
            question = normalize_learner_prose(clean_question(raw), style_policy=scope["style_policy"])
            if tuned:
                entry["cert_style_check"] = check_cert_style(question, style_policy=scope["style_policy"])
            entry["candidate_id"] = candidate_id(index, scope, question)
            entry.update({"stem": question["stem"], "options": [
                {"label": label, "text": question[field]} for label, field in zip("ABCD", OPTION_FIELDS)],
                "rationales": {label: question[field] for label, field in zip("ABCD", RATIONALE_FIELDS)}})
            validation = validate_question(question, **({"style_policy": scope["style_policy"]} if tuned else {}))
            entry["schema_check"] = {"passed": validation.is_valid, "errors": validation.errors}
            if not validation.is_valid:
                reject_candidate(entry, stage, "Schema validation failed: " + "; ".join(validation.errors))
                return
            stage = "citation"
            checked = None
            for cite_attempt in range(2):
                if cite_attempt == 0:
                    citation = {"evidence": raw.get("evidence")}
                else:
                    citation_bundle = build_documentation_context(sources, max_chars=doc_context_chars,
                        plan=decision, receipts=proof["reasons"])
                    entry["documentation_contexts"]["citation"] = citation_bundle["metadata"]
                    with call_context(stage="cite", candidate_id=entry["candidate_id"], index=index,
                                      attempt=1, calls_path=str(artifact) + ".calls.jsonl"):
                        citation = cite_question(question, sources, model=model,
                            check_errors=checked["errors"], fetched_context=citation_bundle["context"], doc_context_chars=doc_context_chars,
                            **({"reasoning_effort": cite_effort} if codex else {}))
                checked = check_evidence(citation.get("evidence"), sources)
                for receipt in checked.get("options", []):
                    supplied_view = entry["documentation_contexts"]["writer" if cite_attempt == 0 else "citation"]
                    if not quote_in_context(receipt, sources, supplied_view):
                        checked["errors"].append(f"Option {receipt['option_label']}: quote absent from supplied documentation context")
                checked["passed"] = not checked["errors"]
                attempt = {"stage": "write" if cite_attempt == 0 else "cite", "evidence": citation.get("evidence"),
                           "mechanical_check": {"passed": checked["passed"], "errors": checked["errors"]}}
                # The citation helper returns only bounded, sanitized completion diagnostics.
                for key in ("parse_failure", "raw_response", "diagnostics", "documentation_context_budget"):
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
            store_options(entry, question, checked["options"])
            if tuned and not external:
                prior = [row for row in payload["candidates"] if row.get("near_duplicate_check", {}).get("passed")]
                entry["answer_pattern_check"] = check_answer_pattern(entry, bank["questions"] + prior, cert_id=cert)
                entry["product_share_check"] = check_product_share(product_share_row(question),
                    bank_actions + [product_share_row(row) for row in prior], product_budget)
                if not entry["answer_pattern_check"]["passed"]:
                    reject_candidate(entry, "answer_pattern", entry["answer_pattern_check"]["reason"])
                    return
            if not external:
                entry["near_duplicate_check"] = check_near_duplicate(entry, bank["questions"] +
                    [comparison_row(row) for row in payload["candidates"] if row.get("near_duplicate_check", {}).get("passed")])
                if not entry["near_duplicate_check"]["passed"]:
                    reject_candidate(entry, "near_duplicate", entry["near_duplicate_check"]["reason"])
                    return
                normalized = normalize_stem(question["stem"])
                if normalized in seen:
                    entry["duplicate"] = True
                    reject_candidate(entry, "duplicate", "Duplicate normalized stem within this batch")
                    return
                seen.add(normalized)
            if external:
                stage = "external_request"
                entry["candidate_id"] = candidate_id(index, scope, question)
                request = build_request(entry["candidate_id"], scope, question, sources, checked["options"], argon_gate=argon_gate,
                    execution_policy="short_circuit_v1", doc_context_chars=doc_context_chars)
                entry["documentation_contexts"]["external_judge"] = request["trimming"]["documentation_context_budget"]
                return  # Publish in plan order under the shared write lock.
            stage = "judge"
            judge_bundle = build_documentation_context(sources, max_chars=doc_context_chars, plan=decision,
                                                       receipts=checked["options"])
            context = judge_bundle["context"]
            entry["documentation_contexts"]["judge"] = judge_bundle["metadata"]
            with call_context(candidate_id=entry["candidate_id"], index=index, attempt=1,
                              calls_path=str(artifact) + ".calls.jsonl"):
                judge = judge_three_gates(question, scope["domain_prompt"], documentation_context=context,
                                       model=judge_model, generator_model=model, option_evidence=checked["options"],
                                       style_policy=scope["style_policy"], distractor_evidence=frozen_evidence)
            entry["judge_verdict"] = {"passed": judge.passed, "score": judge.score, "reason": judge.reason, "model": judge.model}
            if getattr(judge, "gate_results", None) is not None:
                entry["gate_verdicts"] = judge.gate_results
            if getattr(judge, "error_class", None):
                entry["judge_verdict"]["error_class"] = judge.error_class
            if not judge.passed and getattr(judge, "diagnostics", None):
                entry["judge_verdict"]["diagnostics"] = judge.diagnostics
            grounding = {k: scope[k] for k in ("cert_id", "objective_id", "guide_sha256")}
            grounding.update({"generator_model": model, "judge_model": judge_model,
                              "evidence": entry["evidence"], "option_order": entry["option_order"],
                              "mechanical_check": entry["mechanical_check"],
                              "rules_version": 5, "gate_version": 5, "style_policy": scope["style_policy"],
                              "distractor_evidence": dict(frozen_evidence),
                              "decision_objective": decision_objective,
                              "decision_plan": decision, "decision_proof": proof,
                              "decision_attempt_count": len(entry["decision_attempts"]),
                              "decision_veto_reasons": [attempt["proof"]["reason"] for attempt in entry["decision_attempts"]
                                                        if not attempt.get("proof", {}).get("passed", True)],
                              "key_length_rank": scope["key_length_rank"]})
            if tuned:
                grounding.update({key: scope[key] for key in TUNING_SCOPE_FIELDS})
                grounding["cert_style_check"] = entry["cert_style_check"]
                grounding["answer_pattern_check"] = entry["answer_pattern_check"]
            if getattr(judge, "gate_results", None) is not None:
                grounding["gate_verdicts"] = judge.gate_results
            entry["grounding"] = grounding
            stage = "persistence"
            stored = True  # Batch reports must pass before any question write.
            if not dry_run:
                pending_inline.append((entry, scope, question, judge, grounding))
            entry["accepted"] = judge.passed and stored
            if not judge.passed:
                reject_candidate(entry, "judge", judge.reason)
                if not stored:
                    entry["reason"] += "; candidate persistence also failed"
            elif not stored:
                reject_candidate(entry, stage, "Candidate persistence failed; founder approval remains blocked")
            accepted += int(entry["accepted"])
        except Exception as exc:
            # External request construction is local; provider failures stay generic.
            entry["error_class"] = type(exc).__name__
            if stage == "external_request":
                entry["error_message"] = _safe_completion(str(exc))[:1000]
            reject_candidate(entry, stage, str(exc) if stage == "external_request" or isinstance(exc, (CLIModelError, DecisionVetoError))
                             else stage.capitalize() + " request failed")
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
                            entry["near_duplicate_check"] = check_near_duplicate(entry, bank["questions"] +
                                [comparison_row(row) for row in payload["candidates"] if row.get("near_duplicate_check", {}).get("passed")])
                            normalized = normalize_stem(entry["stem"])
                            pattern_ok = True
                            if tuned:
                                prior = [row for row in payload["candidates"] if row.get("awaiting_external_judge")]
                                entry["answer_pattern_check"] = check_answer_pattern(entry, bank["questions"] + prior, cert_id=cert)
                                entry["product_share_check"] = check_product_share(product_share_row(question),
                                    bank_actions + [product_share_row(row) for row in prior], product_budget)
                                pattern_ok = entry["answer_pattern_check"]["passed"]
                            if not pattern_ok:
                                reject_candidate(entry, "answer_pattern", entry["answer_pattern_check"]["reason"])
                            elif not entry["near_duplicate_check"]["passed"]:
                                entry["duplicate"] = True
                                reject_candidate(entry, "near_duplicate", entry["near_duplicate_check"]["reason"])
                            elif normalized in seen:
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
                            reject_candidate(entry, "external_request_publication", _safe_completion(str(exc))[:1000])
                    if not entry["accepted"] and not entry.get("awaiting_external_judge") and not entry.get("reason") and not entry.get("error_class"):
                        reject_candidate(entry, stage, stage.capitalize() + " failed before acceptance")
                    planning_history.pop(index, None)
                    entry["decision_attempt_count"] = len(entry.get("decision_attempts", []))
                    entry["decision_veto_reasons"] = [attempt["proof"]["reason"] for attempt in entry.get("decision_attempts", [])
                                                      if not attempt.get("proof", {}).get("passed", True)]
                    payload["candidates"].append(entry)
                    payload["all_candidate_key_position_report"] = key_position_report(payload["candidates"])
                    payload["key_position_report"] = key_position_report([row for row in payload["candidates"]
                        if row.get("accepted") is True or row.get("persisted") is True])
                    payload["ml_practice_report"] = ml_practice_report(payload["candidates"])
                    payload["option_length_report"] = option_length_report(payload["candidates"])
                    payload["option_prefix_report"] = option_prefix_report(payload["candidates"])
                    write_artifact(artifact, payload)
                finally:
                    next_commit += 1
                    commit_order.notify_all()

    run_bounded(admissions(), process_candidate, effective_parallel, stop_event)
    if not external:
        payload["key_position_report"] = key_position_report([entry for entry in payload["candidates"]
            if entry.get("judge_verdict", {}).get("passed") is True])
        payload["template_diversity_report"] = template_diversity_report(payload["candidates"])
        # Inline mode retains failed DRAFTs for review; gate that write population too.
        payload["write_key_position_report"] = key_position_report([entry for entry, *_ in pending_inline]) if pending_inline else payload["key_position_report"]
    if tuned:
        eligible = [row for row in payload["candidates"] if row.get("awaiting_external_judge")
                    or row.get("judge_verdict", {}).get("passed") is True]
        payload["section_product_share_report"] = product_share_report([
            product_share_row(row) for row in eligible], cert_id=cert)
        payload["section_product_share_report"]["aggregate_blocker"] = False
        # External requests remain immutable and all still need independent
        # judging. Only ingestion can rank their passing publication population.
        publication_rows = eligible if external else [row for row in payload["candidates"]
                                                      if row.get("near_duplicate_check", {}).get("passed")
                                                      and "grounding" in row]
        selection = select_publication_products([
            {**product_share_row(row), "id": str(row["index"]),
             "score": (row.get("judge_verdict", {}).get("score", 0)
                       if external or row.get("judge_verdict", {}).get("passed") is True else -1)}
            for row in publication_rows], bank_actions, cert_id=cert,
            **({"full_plan_count": full_plan_count} if retry_manifest is not None else {}))
        payload["product_share_report"] = selection["report"]
        payload["product_share_report"]["publication_status"] = "awaiting_external_verdicts" if external else "selected"
        payload["topic_plan_report"] = topic_distribution(plan)
        if external:
            write_artifact(artifact, payload)
        else:
            keep = set(selection["selected_indices"])
            for index, row in enumerate(publication_rows):
                row["publication_selected"] = index in keep
                if index not in keep:
                    row["accepted"] = False
                    reject_candidate(row, "product_share", selection["vetoes"][index])
            pending_inline = [item for item in pending_inline if item[0].get("publication_selected") is not False]
            accepted = sum(row.get("accepted") is True for row in payload["candidates"])
            payload["key_position_report"] = key_position_report([row for row in eligible if row.get("publication_selected") is not False])
            payload["write_key_position_report"] = key_position_report([
                row for row in publication_rows if row.get("publication_selected") is not False])
            payload["write_product_share_report"] = selection["report"]
    reports_pass = payload["key_position_report"]["passed"] and (external or
        (payload["write_key_position_report"]["passed"] and (not payload["template_diversity_report"]["count"] or payload["template_diversity_report"]["passed"])))
    for entry, scope, question, judge, grounding in pending_inline:
        try:
            stored = reports_pass and persist_candidate(client, scope, question, judge, grounding,
                exam, domains[scope["domain_code"]], runs[scope["domain_code"]], difficulty)
        except Exception as exc:
            stored = False
            entry["error_class"] = type(exc).__name__
        entry["accepted"] = judge.passed and stored
        entry["persisted"] = bool(stored)
        if stored:
            run_counts[scope["domain_code"]] += 1
        else:
            reject_candidate(entry, "persistence", "Batch report blocked writes" if not reports_pass else "Candidate persistence failed; inspect for partial writes")
        write_artifact(artifact, payload)
    if pending_inline:
        accepted = sum(entry["accepted"] for entry in payload["candidates"])
        payload["key_position_report"] = key_position_report([entry for entry in payload["candidates"]
            if entry["accepted"] or entry.get("persisted") is True])
    if not external:
        write_artifact(artifact, payload)
    if client is not None:
        for code, run_id in runs.items():
            if not client.update_generation_run(run_id, {"generated_count": run_counts[code], "completed_at": datetime.now(timezone.utc).isoformat()}):
                raise click.ClickException("Run completion failed; founder approval remains blocked")
    click.echo("ML practice allowance: " + json.dumps(payload["ml_practice_report"]))
    click.echo(format_key_position_report(payload["key_position_report"]))
    generated_report = payload["all_candidate_key_position_report"]
    click.echo(f"Generated key positions (informational only): {generated_report['counts']}; N={generated_report['count']}")
    click.echo(format_option_length_report(payload["option_length_report"]))
    click.echo(format_option_prefix_report(payload["option_prefix_report"]))
    click.echo(f"Accepted {accepted}/{n_questions}; artifact: {artifact}")
    if batch_stop:
        raise click.ClickException(batch_stop["reason"])
    if payload["key_position_report"]["passed"] is False or (not external and payload["write_key_position_report"]["passed"] is False):
        raise click.ClickException("Key-position batch report failed; invalid keys or a position above 40% at N>=10 blocks the batch")
    if not external and payload["template_diversity_report"]["count"] and not payload["template_diversity_report"]["passed"]:
        raise click.ClickException("Template-diversity batch report failed; generic validation keys exceed 20%")
    if tuned:
        click.echo("PDE topic plan (hints only): " + json.dumps(payload["topic_plan_report"]))
        click.echo("PDE correct-answer products: " + json.dumps(payload["product_share_report"]))
    if external:
        click.echo(f"Awaiting external judge {awaiting}/{n_questions}; requests: {request_directory(artifact)}; no DB writes")
        if awaiting != n_questions:
            failures = [entry for entry in payload["candidates"] if not entry.get("awaiting_external_judge")]
            summary = generation_failure_summary(failures)
            click.echo("Pre-judge failures: " + json.dumps(summary))
            if (not continue_quality_rejections or len(payload["candidates"]) != n_questions
                    or not all(is_quality_rejection(entry) for entry in failures)):
                raise click.ClickException(
                    f"Some candidates failed before external judgment: quality vetoes={summary['quality_vetoes']}; "
                    f"system errors={summary['system_errors']}; inspect categorical diagnostics and the artifact")
            click.echo(f"Quality-only vetoes: {len(failures)}; remaining requests still require every gate")
    elif accepted != n_questions:
        raise click.ClickException("Some candidates failed; inspect the artifact before retrying")


if __name__ == "__main__":
    main()
