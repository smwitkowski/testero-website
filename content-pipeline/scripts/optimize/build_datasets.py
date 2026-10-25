"""Build offline writer datasets from frozen production artifacts, never judges.

Run from content-pipeline with PYTHON_DOTENV_DISABLED=1. Outputs contain private
question text and fetched docs; keep them in an ignored cache, not in git.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
from typing import Iterable

from shared.cli_models import CLISchemaError, parse_output
from shared.decision_planner import (
    DecisionPlan, decision_proof_signature, planning_prompt,
    writer_decision_context, writer_documentation_context,
)
from shared.doc_search import documentation_context
from shared.evidence import check_evidence
from shared.external_judge import (
    candidate_question, candidate_storage_id, canonical_sha256, documentation_context_limit,
)
from shared.gates import evaluate_gate
from shared.llm_generator import QUESTION_FIELDS
from shared.option_order import canonical_evidence

SPLITS = ("train", "dev", "test")
FLAGS = ("supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas")


def _read(path):
    path = Path(path).absolute()
    if path.suffix != ".json" or path.name.startswith(".env"):
        raise ValueError("Only JSON artifacts may be read")
    raw = path.read_bytes()
    def reject_constant(value):
        raise ValueError("Non-finite JSON number")
    def unique_pairs(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(raw, parse_constant=reject_constant, object_pairs_hook=unique_pairs), hashlib.sha256(raw).hexdigest()


def _files(paths):
    if isinstance(paths, (str, Path)):
        paths = [paths]
    found = set()
    for given in paths:
        path = Path(given).absolute()
        if path.is_dir():
            found.update(p for p in path.glob("*.json") if not p.name.startswith(".env"))
        elif path.is_file():
            found.add(path)
        else:
            raise ValueError("Dataset input does not exist: " + str(path))
    return sorted(found)


def _cohort(value):
    if not isinstance(value, dict):
        return False
    return (value.get("kind") in ("gold", "canary", "canaries")
            or value.get("cohort") in ("gold", "canary", "canaries")
            or any(value.get(k) is True for k in ("council_canary", "canary", "gold", "is_canary", "is_gold")))


def _monitor_path(path):
    return (bool(re.search(r"(?:^|[-_.])(canar(?:y|ies)|gold)(?:[-_.]|$)", path.stem, re.I))
            or any((part / ".council-canaries").exists() for part in path.parents))


def _objective_ids(payload):
    """Include cohort originals, even if the mutated candidate is malformed."""
    if not isinstance(payload, dict):
        return set()
    ids = set()
    for key in ("plan", "candidates", "rows"):
        for row in payload.get(key, []) if isinstance(payload.get(key), list) else []:
            if not isinstance(row, dict):
                continue
            for obj in (row, row.get("scope", {}), row.get("entry", {})):
                if isinstance(obj, dict) and isinstance(obj.get("objective_id"), str) and obj["objective_id"].strip():
                    ids.add(obj["objective_id"])
    return ids


def _scope(payload, entry):
    index = entry.get("index")
    plan = payload.get("plan")
    if not isinstance(plan, list) or type(index) is not int or not 1 <= index <= len(plan):
        raise ValueError("Missing indexed production scope")
    scope = plan[index - 1]
    if not isinstance(scope, dict) or any(not isinstance(scope.get(k), str) or not scope[k].strip()
                                         for k in ("objective_id", "domain_code", "domain_prompt")):
        raise ValueError("Missing objective/domain/prompt")
    if entry.get("objective_id") != scope["objective_id"] or entry.get("domain_code") != scope["domain_code"]:
        raise ValueError("Candidate and scope disagree")
    return scope


def _plan_proof(scope, plan, proof, sources):
    parsed_plan = DecisionPlan.model_validate(plan).model_dump()
    if parsed_plan["objective_id"] != scope["objective_id"]:
        raise ValueError("Plan objective mismatch")
    actions = [parsed_plan["best_action"], *(m["action"] for m in parsed_plan["mistakes"])]
    if len(set(a.casefold() for a in actions)) != 4:
        raise ValueError("Duplicate plan actions")
    documentation_context(sources)  # Validates fetched text, URLs, timestamps, hashes; no retrieval.
    if not isinstance(proof, dict) or type(proof.get("passed")) is not bool:
        raise ValueError("Missing proof result")
    signature = decision_proof_signature(scope.get("distractor_evidence"),
                                         doccheck_policy=scope.get("doccheck_policy", "v5"))
    parsed = parse_output(json.dumps({k: proof[k] for k in signature.output_fields}), signature)
    mechanical = proof.get("mechanical_check")
    if (not parsed["reason"].strip() or not isinstance(mechanical, dict)
            or type(mechanical.get("passed")) is not bool or not isinstance(mechanical.get("errors"), list)
            or any(not isinstance(e, str) for e in mechanical["errors"])):
        raise ValueError("Malformed proof feedback/mechanical check")
    expected = (all(parsed[k] is True for k in FLAGS) and mechanical["passed"]
                and not mechanical["errors"] and not parsed.get("failing_options"))
    if proof["passed"] != expected:
        raise ValueError("Inconsistent proof acceptance")
    if proof["passed"]:
        receipts = [{k: row[k] for k in ("option_label", "url", "quote")} for row in parsed["reasons"]]
        if not check_evidence(receipts, sources)["passed"]:
            raise ValueError("Proof receipts are invalid")
    return parsed_plan


def _request(path, entry, scope):
    reference = entry.get("external_judge_request")
    if not isinstance(reference, dict) or not isinstance(reference.get("path"), str):
        raise ValueError("Missing frozen judge request")
    target = (path.parent / reference["path"]).absolute()
    # A reference is data, not permission to read arbitrary files or credentials.
    if target.parent != path.with_suffix(".judge-requests") or target.name != entry["candidate_id"] + ".json":
        raise ValueError("Judge request outside its artifact")
    request, digest = _read(target)
    if (digest != reference.get("sha256") or request.get("candidate_id") != entry["candidate_id"]
            or request.get("objective_id") != scope["objective_id"]):
        raise ValueError("Frozen judge request binding mismatch")
    return request


def _council(path, payload, entry, scope, question):
    """All five actual production seats, using their unchanged offline checks."""
    from shared.argon_gate import evaluate_argon
    from shared.distractor_evidence import verdict_gates
    if entry.get("accepted") is not True:
        raise ValueError("Candidate not accepted")
    raw = verdict_gates(entry.get("external_verdict"), scope.get("distractor_evidence"))
    if not isinstance(raw, dict) or set(raw) != {"style", "evidence", "blind_solver", "argon"}:
        raise ValueError("Missing council seats")
    request = _request(path, entry, scope)
    for name in ("style", "evidence", "blind_solver"):
        if not isinstance(raw[name], dict) or raw[name].get("verdict") != "PASS":
            raise ValueError("Council seat not explicit PASS")
        passed, _ = evaluate_gate(name, raw[name], question,
                                  version=request["gate_version"], style_policy=scope.get("style_policy"))
        if not passed:
            raise ValueError("Council seat checks failed")
    argon = raw["argon"]
    if (not isinstance(argon, dict) or type(argon.get("version")) is not int or argon["version"] not in (1, 3)
            or any(not isinstance(argon.get(k), dict) or argon[k].get("verdict") != "PASS"
                   for k in ("blind", "review"))):
        raise ValueError("Both Argon seats must explicitly PASS")
    passed, _ = evaluate_argon(question, argon, request["argon"])
    if not passed:
        raise ValueError("Argon checks failed")
    return {"gate_version": request["gate_version"], "argon_version": argon["version"],
            "seats": ["style", "evidence", "blind_solver", "argon.blind", "argon.review"],
            "execution_policy": request.get("execution_policy"),
            "distractor_evidence": scope.get("distractor_evidence"), "style_policy": scope.get("style_policy")}


def _normalize(text):
    import unicodedata
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def _strings(value):
    if isinstance(value, str):
        yield _normalize(value)
    elif isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def _text_hash(text):
    return hashlib.sha256(_normalize(text).encode()).hexdigest()


def build_datasets(paths: Iterable[str | Path], output_dir: str | Path, seed: int = 42, *,
                   excluded_objectives: Iterable[str] = (), cohort_paths: Iterable[str | Path] = ()) -> dict:
    """Write deterministic JSON arrays and return their objective-disjoint manifest.

    Canary/gold objectives, including originals in monitor manifests, are held in
    test as whole objectives. Monitor rows never become positive examples. Train
    records containing held-out question stems are removed, including plan inputs'
    prior-scenario hints. Missing/malformed acceptance data can never create demos.
    Source paths are explicit audit references; no live/model/database calls occur.
    """
    if type(seed) is not int:
        raise ValueError("Seed must be an integer")
    files = _files(paths)
    cohort_files = _files(cohort_paths)
    heldout = set(excluded_objectives)
    if any(not isinstance(i, str) or not i.strip() for i in heldout):
        raise ValueError("Excluded objectives must be nonempty strings")
    stats = Counter({"cross_split_text_filtered": 0})
    source_files = []
    # First pass discovers objective/cohort membership and all held-out text,
    # including rejected questions (not merely successful dataset records).
    objectives, stems = set(), {}
    for path in sorted(set(files + cohort_files)):
        try:
            payload, digest = _read(path)
        except (OSError, ValueError):
            stats["malformed_artifacts"] += 1
            continue
        ids = _objective_ids(payload)
        objectives.update(ids)
        monitor = path in cohort_files or _cohort(payload) or _monitor_path(path)
        if monitor:
            heldout.update(ids)
        source_files.append({"path": str(path), "sha256": digest, "monitor": monitor})
        for entry in payload.get("candidates", []) if isinstance(payload, dict) else []:
            if not isinstance(entry, dict):
                continue
            ident, stem = entry.get("objective_id"), entry.get("stem")
            if isinstance(ident, str) and isinstance(stem, str) and stem.strip():
                stems.setdefault(ident, set()).add(stem)
            if _cohort(entry):
                if isinstance(ident, str) and ident.strip():
                    heldout.add(ident)
                else:
                    raise ValueError("Cohort entry missing objective identity")
    objectives.update(heldout)
    ordinary = sorted(objectives - heldout, key=lambda i: (hashlib.sha256(f"{seed}:{i}".encode()).hexdigest(), i))
    ntrain, ndev = int(len(ordinary) * .7), int(len(ordinary) * .15)
    assignment = {i: "train" if n < ntrain else "dev" if n < ntrain + ndev else "test"
                  for n, i in enumerate(ordinary)}
    assignment.update({i: "test" for i in heldout})
    heldout_stems = {text for i, texts in stems.items() if assignment.get(i) != "train" for text in texts}
    heldout_hashes = {_text_hash(text) for text in heldout_stems}
    datasets = {stage: {split: [] for split in SPLITS} for stage in ("plan", "draft")}
    seen = set()
    for metadata in source_files:
        if metadata["monitor"] or Path(metadata["path"]) not in files:
            continue
        path = Path(metadata["path"])
        payload, digest = _read(path)
        if digest != metadata["sha256"]:
            raise ValueError("Artifact changed during dataset build")
        if not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list):
            continue
        for entry in payload["candidates"]:
            if not isinstance(entry, dict) or _cohort(entry):
                continue
            stats["candidates"] += 1
            if entry.get("accepted") is True:
                stats["accepted_candidates"] += 1
                raw_argon = (entry.get("external_verdict") or {}).get("argon", {}) if isinstance(entry.get("external_verdict"), dict) else {}
                if isinstance(raw_argon, dict) and raw_argon.get("version") == 2:
                    stats["excluded_review_only_argon"] += 1
            try:
                scope = _scope(payload, entry)
                ident = scope["objective_id"]
                split = assignment[ident]
                candidate = entry["candidate_id"]
                if not isinstance(candidate, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", candidate):
                    raise ValueError("Invalid candidate ID")
                difficulty = payload["difficulty"]
                if difficulty not in ("EASY", "MEDIUM", "HARD"):
                    raise ValueError("Missing production difficulty")
            except (KeyError, TypeError, ValueError, CLISchemaError):
                stats["invalid_scope"] += 1
                continue
            source = {"artifact": str(path), "artifact_sha256": digest, "candidate_id": candidate,
                      "stem_sha256": _text_hash(entry["stem"]) if isinstance(entry.get("stem"), str) else None}
            base = {"objective_id": ident, "domain": scope["domain_code"], "scope": scope, "source": source}
            attempts = entry.get("decision_attempts", [])
            if not isinstance(attempts, list):
                attempts = []
            for ordinal, attempt in enumerate(attempts, 1):
                try:
                    if not isinstance(attempt, dict):
                        raise ValueError("Invalid attempt")
                    feedback_value = attempt.get("replacement_feedback")
                    try:
                        feedback_object = json.loads(feedback_value) if isinstance(feedback_value, str) else None
                    except ValueError:
                        feedback_object = None
                    if ("repair_options" in attempt or (isinstance(feedback_object, dict)
                            and ("repair_options" in feedback_object or "frozen_plan" in feedback_object))):
                        stats["excluded_option_local_repairs"] += 1
                        raise ValueError("Option-local repair requires a different effective signature")
                    plan = _plan_proof(scope, attempt["plan"], attempt["proof"], attempt["sources"])
                    # Older artifacts without recorded feedback/hints are not exact
                    # production inputs; do not invent their missing prompt fields.
                    feedback, scenarios = attempt["replacement_feedback"], attempt["existing_scenarios"]
                    if not isinstance(feedback, str) or not isinstance(scenarios, list):
                        raise ValueError("Missing production planning fields")
                    _, inputs = planning_prompt(scope, difficulty=difficulty,
                                                 replacement_feedback=feedback, existing_scenarios=scenarios)
                    row = {**base, "signature": "DecisionPlanSignature", "inputs": inputs,
                           "outputs": {"plan": plan}, "plan": plan, "proof": attempt["proof"],
                           "sources": attempt["sources"], "source": {**source, "attempt": ordinal},
                           "documentation_context_reference": {"artifact": str(path), "candidate_id": candidate,
                               "attempt": ordinal, "field": "decision_attempts.sources"}}
                    _append(datasets, "plan", split, row, seen, heldout_hashes, heldout_stems, stats)
                except (KeyError, TypeError, ValueError, CLISchemaError):
                    stats["invalid_plan_attempts"] += 1
            try:
                question = candidate_question(entry)
                candidate_storage_id(entry, scope, question)
                council = _council(path, payload, entry, scope, question)
                plan = _plan_proof(scope, entry["decision_plan"], entry["decision_proof"], entry["sources"])
                if entry["decision_proof"]["passed"] is not True:
                    raise ValueError("Draft without verified decision")
                receipts = [{k: r[k] for k in ("option_label", "url", "quote")} for r in canonical_evidence(entry)]
                if not check_evidence(receipts, entry["sources"])["passed"]:
                    raise ValueError("Draft receipts failed")
                cap = documentation_context_limit(payload, entry)
                context = writer_documentation_context(entry["sources"], entry["decision_proof"],
                                                        **({"doc_context_chars": cap} if cap is not None else {}))
                inputs = {"domain_context": writer_decision_context(scope, plan, entry["decision_proof"]),
                          "documentation_context": context, "difficulty": difficulty,
                          "exam_subsection": scope.get("subsection") or "", "gap_analysis_guidance": ""}
                row = {**base, "signature": "QuestionWithEvidenceSignature", "inputs": inputs,
                       "outputs": {**question, "evidence": receipts}, "sources": entry["sources"],
                       "plan": plan, "proof": entry["decision_proof"], "council": council}
                _append(datasets, "draft", split, row, seen, heldout_hashes, heldout_stems, stats)
            except (KeyError, TypeError, ValueError, CLISchemaError):
                stats["excluded_drafts"] += 1
    out = Path(output_dir).absolute()
    if any(out == p.parent or out in p.parents for p in files):
        raise ValueError("Output directory cannot contain input artifacts")
    out.mkdir(parents=True, exist_ok=True)
    counts, hashes = {}, {}
    for stage, splits in datasets.items():
        counts[stage] = {}
        for split, rows in splits.items():
            rows.sort(key=lambda r: (r["objective_id"], r["source"]["artifact"], r["source"]["candidate_id"], r["source"].get("attempt", 0)))
            name = f"{stage}.{split}.json"
            text = json.dumps(rows, sort_keys=True, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
            (out / name).write_text(text)
            counts[stage][split] = len(rows)
            hashes[name] = hashlib.sha256(text.encode()).hexdigest()
    manifest = {"version": 1, "seed": seed, "splits": {s: sorted(i for i, v in assignment.items() if v == s) for s in SPLITS},
                "objective_splits": dict(sorted(assignment.items())), "excluded_train_objectives": sorted(heldout),
                "counts": counts, "filters": dict(sorted(stats.items())), "files": hashes,
                "eligible_splits": {stage: {s: sorted({r["objective_id"] for r in rows}) for s, rows in splits.items()}
                                    for stage, splits in datasets.items()},
                "empty_objectives": {stage: sorted(objectives - {r["objective_id"] for rows in splits.values() for r in rows})
                                     for stage, splits in datasets.items()},
                "source_artifacts": source_files,
                "policy": {"draft": "all five production seats PASS; Argon versions 1/3 only",
                           "plan_inputs": "production planning_prompt; missing recorded inputs and option-local repair signatures excluded",
                           "holdout": "whole canary/gold objectives held in test; monitor rows never demos",
                           "text_leakage": "NFKC/casefold/whitespace stem hashes plus prior-scenario substring guard"}}
    (out / "manifest.json").write_text(json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False) + "\n")
    return manifest


def _append(datasets, stage, split, row, seen, heldout_hashes, heldout_stems, stats):
    outputs = row["outputs"]
    if split == "train":
        stem = outputs.get("stem", "")
        serialized = " ".join(_strings(row["inputs"]))
        # Question text in previous-scenario hints is not exempt from holdout.
        if ((stem and _text_hash(stem) in heldout_hashes)
                or row["source"].get("stem_sha256") in heldout_hashes
                or any(_normalize(text) in serialized for text in heldout_stems)):
            stats["cross_split_text_filtered"] += 1
            return
    fingerprint = (stage, row["objective_id"], canonical_sha256({"inputs": row["inputs"], "outputs": outputs}))
    if fingerprint in seen:
        stats["duplicate_examples"] += 1
        return
    seen.add(fingerprint)
    datasets[stage][split].append(row)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="Saved artifact JSON paths or generation directories")
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--exclude-objective", action="append", default=[])
    parser.add_argument("--cohort", action="append", default=[], type=Path,
                        help="Gold/canary manifest or directory; originals held out as whole objectives")
    args = parser.parse_args(argv)
    result = build_datasets(args.paths, args.output_dir, args.seed,
                            excluded_objectives=args.exclude_objective, cohort_paths=args.cohort)
    print(json.dumps({"counts": result["counts"], "filters": result["filters"]}, sort_keys=True))


if __name__ == "__main__":
    main()
