#!/usr/bin/env python3
"""Offline canary preparation and frozen-verdict council health monitoring.

Only the explicit ``live`` subcommand runs judges. No command ingests or writes DB
rows. Monitor metadata never enters a judge request.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import random
import sys
import tempfile
import uuid

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))
from shared.council_safety import CANARY_MARKER
from shared.cli_models import CLISchemaError
from shared.external_judge import (build_request, candidate_question, canonical_sha256,
                                   documentation_context_limit)
from shared.option_order import (OPTION_FIELDS, RATIONALE_FIELDS, canonical_evidence,
                                 store_options)

DEFAULT_STATE = PIPELINE_ROOT.parents[1] / "hq/tools/council-health.json"
DEFECTS = ("swapped_key", "retired_name")


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(Path(path).read_text(), object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Non-finite JSON")))


def no_symlinks(path):
    path = Path(path).absolute()
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise ValueError("Council health paths cannot contain symlinks")
    return path


def write_json(path, value):
    path = no_symlinks(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    fd, temporary = tempfile.mkstemp(prefix=".health-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def mutate(question, evidence, defect, *, rng, products):
    """Mutate an accepted canonical question, retaining frozen source receipts."""
    question, evidence = deepcopy(question), deepcopy(evidence)
    if defect == "swapped_key":
        index = rng.randrange(1, 4)
        question[OPTION_FIELDS[0]], question[OPTION_FIELDS[index]] = (
            question[OPTION_FIELDS[index]], question[OPTION_FIELDS[0]])
        question[RATIONALE_FIELDS[0]], question[RATIONALE_FIELDS[index]] = (
            question[RATIONALE_FIELDS[index]], question[RATIONALE_FIELDS[0]])
        labels = {"A": "ABCD"[index], "ABCD"[index]: "A"}
        evidence = sorted([{**row, "option_label": labels.get(row["option_label"], row["option_label"])}
                           for row in evidence], key=lambda row: row["option_label"])
    elif defect == "retired_name":
        eligible = [row for row in products if row.get("status") in ("retired", "renamed")
                    and isinstance(row.get("old"), str) and row["old"].strip()
                    and isinstance(row.get("new"), str) and row["new"].strip()]
        if not eligible:
            raise ValueError("No retired/renamed product names configured")
        matches = [(field, row) for field in ("stem", *OPTION_FIELDS)
                   for row in eligible if row["new"] in question[field]]
        if matches:
            field, row = rng.choice(matches)
            question[field] = question[field].replace(row["new"], row["old"], 1)
        else:
            # Ordinary context, never an instruction or a canary label.
            row = rng.choice(eligible)
            question["stem"] = "Your team uses " + row["old"] + " in its Google Cloud environment. " + question["stem"]
    else:
        raise ValueError("Unsupported canary defect")
    return question, evidence


def accepted_rows(payload):
    """Select recorded accepted questions; never elevate historical rejections."""
    for entry in payload["candidates"]:
        if entry.get("accepted") is not True:
            continue
        index = entry["index"]
        if type(index) is not int or not 1 <= index <= len(payload["plan"]):
            raise ValueError("Invalid accepted candidate index")
        scope = payload["plan"][index - 1]
        question = candidate_question(entry)
        yield scope, entry, question, canonical_evidence(entry)


def prepare(artifacts, out, *, seed=45, per_type=20, gold=False, lexicon=None):
    """Create an isolated cohort from accepted frozen artifacts; leave inputs intact."""
    if type(per_type) is not int or per_type < 1:
        raise ValueError("per_type must be positive")
    out = no_symlinks(out)
    if out.exists():
        raise ValueError("Choose a fresh monitor directory; cohorts are immutable")
    products = read_json(lexicon or PIPELINE_ROOT / "certs/product-lexicon.json")["products"] if not gold else []
    sources = []
    for artifact in artifacts:
        artifact = no_symlinks(artifact)
        payload = read_json(artifact)
        for scope, entry, question, evidence in accepted_rows(payload):
            sources.append((artifact, payload, scope, entry, question, evidence))
    if not sources:
        raise ValueError("No accepted frozen candidates found")
    rng = random.Random(seed)
    tasks = [(None, source) for source in sources] if gold else [
        (defect, sources[rng.randrange(len(sources))]) for defect in DEFECTS for _ in range(per_type)]
    rows, requests = [], []
    for ordinal, (defect, source) in enumerate(tasks, 1):
        artifact, payload, scope, entry, question, evidence = source
        if defect:
            question, evidence = mutate(question, evidence, defect, rng=rng, products=products)
        # Content-bound ordinary UUID; no role/type/source labels visible to judges.
        ident = str(uuid.uuid5(uuid.NAMESPACE_URL, "testero-council:" + canonical_sha256({
            "seed": seed, "ordinal": ordinal, "question": question, "scope": scope,
            "source_candidate_id": entry["candidate_id"], "defect": defect})))
        request = build_request(ident, scope, question, entry["sources"], evidence,
                                gate_version=5, argon_gate=True, execution_policy="short_circuit_v2",
                                doc_context_chars=documentation_context_limit(payload, entry))
        frozen = {**{key: deepcopy(value) for key, value in scope.items()},
                  "index": 1, "candidate_id": ident, "stem": question["stem"],
                  "sources": deepcopy(entry["sources"]), "accepted": False,
                  "status": "awaiting_external_judge"}
        store_options(frozen, question, evidence)
        frozen["external_judge_request"] = {"path": "requests/" + ident + ".json",
                                               "sha256": canonical_sha256(request)}
        rows.append({"candidate_id": ident, "defect": defect, "question": question,
                     "scope": deepcopy(scope), "entry": frozen,
                     "source": str(artifact), "source_sha256": hashlib.sha256(artifact.read_bytes()).hexdigest(),
                     "source_candidate_id": entry["candidate_id"],
                     "request_sha256": canonical_sha256(request),
                     "doc_context_chars": documentation_context_limit(payload, entry)})
        requests.append(request)
    # Validate all builds before exposing any monitor directory.
    out.mkdir(parents=True, mode=0o700)
    (out / CANARY_MARKER).write_text("Monitor only. Never ingest or publish.\n")
    (out / "requests").mkdir()
    for request in requests:
        write_json(out / "requests" / (request["candidate_id"] + ".json"), request)
    manifest = {"version": 1, "kind": "gold" if gold else "canaries", "seed": seed, "rows": rows}
    write_json(out / "manifest.json", manifest)
    return {"root": str(out), "kind": manifest["kind"], "count": len(rows)}


def publication_errors(question, scope, request, verdict):
    # One authoritative rule shared with the publisher; no diagnostic shortcut.
    from scripts.publish_batch import publication_errors as strict_errors
    return strict_errors(question, scope, request, verdict, rules_version=5)


def validate_observation(question, scope, request, raw):
    """Require complete real seat outputs before measuring a health observation."""
    from shared.distractor_evidence import verdict_gates
    from shared.gates import parse_gate_output
    from shared.argon_gate import evaluate_argon, ArgonReviewSignature
    from shared.cli_models import parse_output
    raw = verdict_gates(raw, scope.get("distractor_evidence"))
    if not isinstance(raw, dict) or set(raw) != {"blind_solver", "style", "evidence", "argon"}:
        raise ValueError("Incomplete council verdict")
    for name in ("blind_solver", "style", "evidence"):
        parse_gate_output(name, raw[name], version=5, style_policy=scope.get("style_policy"))
    parse_gate_output("blind_solver", raw["argon"]["blind"], version=5)
    parse_output(json.dumps(raw["argon"]["review"], allow_nan=False), ArgonReviewSignature)
    evaluate_argon(question, raw["argon"], request["argon"])


def load_cohort(root):
    root = no_symlinks(root)
    if not (root / CANARY_MARKER).is_file():
        raise ValueError("Missing council monitor isolation marker")
    manifest = read_json(no_symlinks(root / "manifest.json"))
    if manifest.get("version") != 1 or manifest.get("kind") not in ("canaries", "gold") or not manifest.get("rows"):
        raise ValueError("Invalid monitor manifest")
    ids = [row["candidate_id"] for row in manifest["rows"]]
    if len(set(ids)) != len(ids) or any(str(uuid.UUID(ident)) != ident for ident in ids):
        raise ValueError("Invalid monitor candidate IDs")
    for row in manifest["rows"]:
        request = read_json(no_symlinks(root / "requests" / (row["candidate_id"] + ".json")))
        rebuilt = build_request(row["candidate_id"], row["scope"], row["question"],
                                row["entry"]["sources"], canonical_evidence(row["entry"]),
                                gate_version=5, argon_gate=True, execution_policy="short_circuit_v2",
                                doc_context_chars=row.get("doc_context_chars"))
        if (canonical_sha256(request) != row["request_sha256"] or request != rebuilt
                or request.get("candidate_id") != row["candidate_id"]):
            raise ValueError("Frozen monitor request changed")
        if manifest["kind"] == "canaries" and row.get("defect") not in DEFECTS:
            raise ValueError("Invalid monitor defect")
    return root, manifest


def evaluate(root, *, state=DEFAULT_STATE, pause=None, window=20, verdicts=None):
    """Evaluate frozen full-council verdicts, then persist rolling health state."""
    if type(window) is not int or window < 20:
        raise ValueError("Rolling window must contain at least 20 per defect type")
    root, manifest = load_cohort(root)
    verdicts = no_symlinks(verdicts or root / "verdicts")
    state = no_symlinks(state)
    pause = no_symlinks(pause or state.with_name("PIPELINE_PAUSED"))
    observations, errors = [], []
    for row in manifest["rows"]:
        ident = row["candidate_id"]
        try:
            request = read_json(no_symlinks(root / "requests" / (ident + ".json")))
            raw = read_json(no_symlinks(verdicts / (ident + ".json")))
            validate_observation(row["question"], row["scope"], request, raw)
            reasons = publication_errors(row["question"], row["scope"], request, raw)
            if any(reason.startswith("invalid_council:") for reason in reasons):
                raise ValueError("Invalid strict council evidence is not a catch")
            observations.append({"id": canonical_sha256({"request": request, "kind": manifest["kind"]}),
                                 "candidate_id": ident, "defect": row["defect"],
                                 "would_publish": not reasons, "reasons": reasons,
                                 "verdict_sha256": canonical_sha256(raw)})
        except (OSError, ValueError, KeyError, TypeError, CLISchemaError) as error:
            # System/schema failures neither prove a catch nor a gold rejection.
            errors.append({"candidate_id": ident, "error_class": type(error).__name__})
    # End slow validation with fresh request/manifest and verdict fences.
    _, current_manifest = load_cohort(root)
    if current_manifest != manifest:
        raise ValueError("Monitor manifest changed during evaluation")
    for observation in observations:
        frozen_raw = read_json(no_symlinks(verdicts / (observation["candidate_id"] + ".json")))
        if canonical_sha256(frozen_raw) != observation["verdict_sha256"]:
            raise ValueError("Monitor verdict changed during evaluation")
    state.parent.mkdir(parents=True, exist_ok=True)
    lock_path = no_symlinks(state.with_suffix(state.suffix + ".lock"))
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        saved = read_json(state) if state.exists() else {"version": 1, "windows": {d: [] for d in DEFECTS}, "gold": [], "seen": []}
        if saved.get("version") != 1 or set(saved.get("windows", {})) != set(DEFECTS):
            raise ValueError("Invalid rolling health state")
        if saved.get("window", window) != window:
            raise ValueError("Rolling window changed; migrate health state explicitly")
        saved["window"] = window
        receipts = saved.setdefault("verdict_receipts", {})
        seen = set(saved["seen"])
        reasons = []
        for observation in observations:
            # Critical escapes pause even if a previously rejected request was replayed.
            if manifest["kind"] == "canaries" and observation["would_publish"]:
                reasons.append("Canary would publish: " + observation["candidate_id"])
            if observation["id"] in seen:
                if receipts.get(observation["id"], observation["verdict_sha256"]) != observation["verdict_sha256"]:
                    errors.append({"candidate_id": observation["candidate_id"], "error_class": "FrozenVerdictChanged"})
                continue
            seen.add(observation["id"])
            receipts[observation["id"]] = observation["verdict_sha256"]
            if manifest["kind"] == "canaries":
                saved["windows"][observation["defect"]].append(observation)
                saved["windows"][observation["defect"]] = saved["windows"][observation["defect"]][-window:]
            else:
                saved["gold"].append(observation)
                saved["gold"] = saved["gold"][-window:]
        rates = {}
        for defect, rows in saved["windows"].items():
            rate = sum(not row["would_publish"] for row in rows) / len(rows) if rows else None
            rates[defect] = {"count": len(rows), "catch_rate": rate, "full": len(rows) >= window}
            if len(rows) >= window and rate < .95:
                reasons.append(defect + " rolling catch rate below 95%")
        gold_rows = saved["gold"]
        gold_rate = sum(row["would_publish"] for row in gold_rows) / len(gold_rows) if gold_rows else None
        pages = ["Gold replay pass rate below 80%"] if gold_rate is not None and gold_rate < .8 else []
        if manifest["kind"] == "gold" and errors:
            pages.append(f"gold replay incomplete: {len(observations)} of {len(manifest['rows'])} judged")
        if reasons:
            # Write pause first: a later state write failure must not permit publishing.
            write_json(pause, {"at": datetime.now(timezone.utc).isoformat(), "reasons": reasons})
        report = {"kind": manifest["kind"], "observed": len(observations), "errors": errors,
                  "canaries": rates, "gold": {"count": len(gold_rows), "pass_rate": gold_rate},
                  "paused": pause.exists(), "pause_reasons": reasons, "pages": pages,
                  "complete": not errors}
        saved.update(seen=sorted(seen), updated_at=datetime.now(timezone.utc).isoformat(), last_report=report)
        write_json(state, saved)
        return report


# Bounded schema/transport failures only. Budget, auth, quota, invalid frozen
# requests, persistence failures and unknown exceptions remain hard stops.
SYSTEM_ERRORS = {"CLISchemaError", "CLITimeoutError", "CLIExitError", "APIConnectionError",
                 "APITimeoutError", "TimeoutError", "ReadTimeout", "ConnectionError",
                 "MaxTokensTruncation", "ValidationError", "ValueError", "TypeError", "OSError"}


def system_error_ids(root):
    """Return missing verdict IDs only if every failure is a frozen seat error."""
    root, manifest = load_cohort(root)
    missing = []
    for row in manifest["rows"]:
        ident = row["candidate_id"]
        destination = no_symlinks(root / "verdicts" / (ident + ".json"))
        if destination.is_file():
            continue
        try:
            record = read_json(no_symlinks(root / "verdicts/.failures" / (ident + ".json")))
            request = no_symlinks(root / "requests" / (ident + ".json"))
            if (not isinstance(record, dict) or record.get("candidate_id") != ident
                    or record.get("error_class") not in SYSTEM_ERRORS
                    or not isinstance(record.get("sub_call"), str)
                    or not record["sub_call"].startswith(("claude.", "argon."))
                    or record["sub_call"] == "argon.validation"
                    or record.get("request_sha256") != hashlib.sha256(request.read_bytes()).hexdigest()):
                return None
        except (OSError, ValueError, TypeError):
            return None
        missing.append(ident)
    return missing


def live(root, *, coordinator_approved=False, parallel=2):
    """Judge frozen health requests; retry only system failures twice at most."""
    if not coordinator_approved:
        raise ValueError("Live judging requires --coordinator-approved")
    root, _ = load_cohort(root)
    from scripts.judge_requests import run_requests
    from scripts.run_domain_batch import retryable_judge_ids
    kwargs = {"judge_model": "claude", "parallel": parallel,
              "argon_gate": True, "full_gate_sample": 1}
    summary = run_requests(root / "requests", root / "verdicts", **kwargs)
    for _ in range(2):
        if summary.persistence_failed or summary.usage_stopped or summary.remaining or not summary.failed:
            break
        if system_error_ids(root) is None:
            break
        ids = retryable_judge_ids(root / "requests", root / "verdicts")
        if not ids:
            break
        # The normal runner reuses frozen requests and reserves each paid call.
        retried = run_requests(root / "requests", root / "verdicts", candidate_ids=ids, **kwargs)
        summary.completed += retried.completed
        summary.skipped += retried.skipped
        summary.failed -= retried.completed + retried.skipped
        summary.remaining = retried.remaining
        summary.usage_stopped = retried.usage_stopped
        summary.persistence_failed |= retried.persistence_failed
    return summary


def live_failed(root, summary):
    """Gold system-error exhaustion is monitor-only; safety failures still stop."""
    _, manifest = load_cohort(root)
    if summary.persistence_failed or summary.usage_stopped or summary.remaining:
        return True
    return bool(summary.failed and (manifest["kind"] != "gold" or system_error_ids(root) is None))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    prep = commands.add_parser("prepare", help="Offline: build fresh isolated requests")
    prep.add_argument("--artifact", action="append", required=True, type=Path)
    prep.add_argument("--out", required=True, type=Path)
    prep.add_argument("--seed", type=int, default=45)
    prep.add_argument("--per-type", type=int, default=20)
    prep.add_argument("--gold", action="store_true")
    prep.add_argument("--lexicon", type=Path)
    replay = commands.add_parser("evaluate", help="Offline: evaluate recorded verdicts")
    replay.add_argument("--root", required=True, type=Path)
    replay.add_argument("--verdicts", type=Path)
    replay.add_argument("--state", type=Path, default=DEFAULT_STATE)
    replay.add_argument("--pause", type=Path)
    replay.add_argument("--window", type=int, default=20)
    run = commands.add_parser("live", help="COORDINATOR ONLY: paid/model judge calls")
    run.add_argument("--root", required=True, type=Path)
    run.add_argument("--coordinator-approved", action="store_true")
    run.add_argument("--parallel", type=int, choices=range(1, 5), default=2)
    args = vars(parser.parse_args(argv))
    command = args.pop("command")
    try:
        result = {"prepare": prepare, "evaluate": evaluate, "live": live}[command](**(
            {"artifacts": args.pop("artifact"), **args} if command == "prepare" else args))
        if command == "live":
            return int(live_failed(args["root"], result))
        print(json.dumps(result, indent=2, allow_nan=False))
        return int(command == "evaluate" and (result["paused"] or
                   (result["kind"] == "canaries" and not result["complete"])))
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(2, "Council health failed: " + type(error).__name__ + "\n")


if __name__ == "__main__":
    raise SystemExit(main())
