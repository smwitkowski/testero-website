#!/usr/bin/env python3
"""Prepare and evaluate quarantine re-council offline; only --apply contacts the DB."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import uuid

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
from shared.external_judge import (BLIND_ARGON_POLICY, REQUEST_CHARACTER_LIMIT,
    build_request, candidate_question, canonical_sha256)
from shared.gates import (EVIDENCE_CHECKS, OPTION_FIELDS, blind_choice_map,
    gate_signatures, parse_gate_output, build_gate_inputs)
from shared.option_order import RATIONALE_FIELDS, canonical_evidence
from shared.cli_models import output_model, signature_prompt, parse_output
from shared.argon_gate import build_argon_request, evaluate_argon, ArgonReviewSignature
from shared.cert_context import plan_questions
from shared.distractor_evidence import verdict_gates


def _path(path):
    path = Path(path).absolute()
    from shared.council_safety import refuse_canary_paths
    refuse_canary_paths(path)
    if any(part.startswith(".env") for part in path.parts):
        raise ValueError("Environment-file paths are forbidden")
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError("Symlink paths are forbidden")
    return path


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def read_json(path):
    return json.loads(_path(path).read_text(encoding="utf-8"), object_pairs_hook=_pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def _write(path, value, *, frozen=False):
    """Atomically publish one complete JSON file."""
    path = _path(path)
    raw = json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name("." + path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        if frozen:
            try:
                os.link(temporary, path)
            except FileExistsError:
                if read_json(path) != value:
                    raise ValueError("Frozen re-council request changed")
        else:
            os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def _notes(row):
    notes = row.get("review_notes", {})
    if isinstance(notes, str):
        notes = json.loads(notes, object_pairs_hook=_pairs)
    if not isinstance(notes, dict):
        raise ValueError("Invalid stored review notes")
    return notes


def row_question(row):
    """Recover canonical key-first question and receipt-label mapping from DB rows."""
    answers = row.get("answers")
    if (not isinstance(answers, list) or len(answers) != 4
            or any(not isinstance(a, dict) for a in answers)
            or sorted(a.get("choice_label", "") for a in answers) != list("ABCD")
            or any(type(a.get("is_correct")) is not bool for a in answers)
            or sum(a["is_correct"] for a in answers) != 1):
        raise ValueError("Exactly four labeled options and one key required")
    ordered = sorted(answers, key=lambda a: (not a["is_correct"], a["choice_label"]))
    question = {"stem": row.get("stem")}
    mapping = {}
    for label, answer, field, rationale in zip("ABCD", ordered, OPTION_FIELDS, RATIONALE_FIELDS):
        question[field] = answer.get("choice_text")
        question[rationale] = answer.get("explanation_text")
        mapping[answer["choice_label"]] = label
    if any(not isinstance(v, str) or not v.strip() for v in question.values()):
        raise ValueError("Missing learner content or explanation")
    if len(set(question[name] for name in OPTION_FIELDS)) != 4:
        raise ValueError("Duplicate option text")
    return question, mapping


def _content_hash(stem, answers):
    from shared.content_hash import content_sha256
    return content_sha256(stem, answers)


def _question_hash(question):
    return _content_hash(question["stem"], [
        {"choice_text": question[field], "explanation_text": question[rationale], "is_correct": index == 0}
        for index, (field, rationale) in enumerate(zip(OPTION_FIELDS, RATIONALE_FIELDS))])


def _scope(row, grounding):
    cert = grounding.get("cert_id", row.get("cert_id"))
    objective = grounding.get("objective_id", row.get("objective_id"))
    if not isinstance(cert, str) or not isinstance(objective, str):
        raise ValueError("Missing certification/objective")
    scope = plan_questions(cert, 1, objective_ids=[objective], seed=0, generation_tuning=False)[0]
    for name in ("domain_code", "guide_sha256"):
        supplied = grounding.get(name, row.get(name))
        if supplied is not None and supplied != scope[name]:
            raise ValueError("Stored scope differs from current reviewed registry")
    return scope


def _receipt_errors(evidence):
    """Validate stored receipts without pretending receipt text is a fetched page."""
    from datetime import datetime
    from urllib.parse import urlsplit
    import re
    if (not isinstance(evidence, list) or len(evidence) != 4
            or any(not isinstance(e, dict) for e in evidence)
            or sorted(e.get("option_label", "") for e in evidence) != list("ABCD")):
        return ["Missing complete A-D stored receipts"]
    for receipt in evidence:
        try:
            url = urlsplit(receipt["url"])
            valid = (url.scheme == "https" and url.hostname in ("docs.cloud.google.com", "cloud.google.com")
                     and not url.username and not url.password and url.port in (None, 443)
                     and not any(c.isspace() for c in receipt["url"]) and "\\" not in receipt["url"]
                     and isinstance(receipt["quote"], str) and 0 < len(receipt["quote"].strip()) <= 300
                     and isinstance(receipt["text_sha256"], str)
                     and re.fullmatch("[0-9a-f]{64}", receipt["text_sha256"])
                     and datetime.fromisoformat(receipt["retrieved_at"].replace("Z", "+00:00")).tzinfo is not None)
        except (KeyError, ValueError, TypeError, AttributeError):
            valid = False
        if not valid:
            return ["Invalid stored receipt provenance"]
    return []


def repeat_report_pages(events):
    """Return founder page records for reports after a restored revision."""
    pages = []
    restored = {}
    for event in sorted(events, key=lambda e: (e.get("at", ""), str(e.get("id", "")))):
        key = (event.get("question_id"), event.get("revision"))
        if event.get("action") == "restored":
            restored[key] = event
        elif event.get("action") == "report" and key in restored:
            pages.append({"question_id": key[0], "revision": key[1],
                          "reason": "reported_again_after_recouncil", "event_id": event.get("id"),
                          "restored_event_id": restored[key].get("id")})
    return pages


def _receipt_request(ident, scope, question, evidence):
    context = ("Stored documentation receipts only; full fetched source bodies are unavailable. "
               "Do not infer missing context or current document availability. Return UNCERTAIN "
               "if these receipts do not support every decisive claim.\n" + json.dumps(evidence, ensure_ascii=False))
    inputs = build_gate_inputs(question, scope["domain_prompt"], context, evidence)
    return {"candidate_id": ident, "objective_id": scope["objective_id"], "gate_version": 5,
            "execution_policy": BLIND_ARGON_POLICY,
            "decision_provenance_sha256": canonical_sha256({"recouncil": "stored-receipts", "scope": scope}),
            "gates": {name: {"judge_prompt": signature_prompt(signature, inputs[name]),
                             "verdict_schema": output_model(signature).model_json_schema()}
                      for name, signature in gate_signatures(5).items()},
            "argon": build_argon_request(question, scope, context, evidence, version=3),
            "trimming": {"enabled": False, "method": "stored receipts only", "sources": []}}


def prepare_question(row, artifact=None):
    """Build a fresh hash-bound request; invalid inputs stay quarantined."""
    result = {"question_id": row.get("id"), "outcome": "quarantined", "reasons": []}
    try:
        uuid.UUID(row["id"])
        if row.get("review_status") != "QUARANTINED" or row.get("status") != "DRAFT":
            raise ValueError("Question is not quarantined")
        if type(row.get("revision")) is not int or row["revision"] < 1:
            raise ValueError("Invalid question revision")
        question, mapping = row_question(row)
        digest = _content_hash(row["stem"], row["answers"])
        if row.get("content_sha256") != digest:
            raise ValueError("DB content hash does not match exported row")
        grounding = _notes(row).get("grounding", {})
        if not isinstance(grounding, dict):
            raise ValueError("Invalid stored grounding")
        scope = _scope(row, grounding)
        expected_exam = "GCP_PM_ML_ENG" if scope["cert_id"] == "machine-learning-engineer" else scope["cert_id"]
        domain = row.get("domain")
        if (row.get("exam") != expected_exam or not isinstance(domain, dict)
                or domain.get("id") != row.get("domain_id") or domain.get("code") != scope["domain_code"]
                or domain.get("exam") != expected_exam):
            raise ValueError("DB certification/domain does not match reviewed objective")
        events = row.get("question_events", [])
        quarantine = [e for e in events if e.get("action") == "quarantined" and e.get("revision") == row["revision"]]
        if not quarantine:
            raise ValueError("Missing quarantine event; cannot bind a fresh re-council cycle")
        cycle = max(quarantine, key=lambda e: (e.get("at", ""), str(e.get("id", ""))))
        uuid.UUID(cycle["id"])
        ident = str(uuid.uuid5(uuid.NAMESPACE_URL, "testero-recouncil:" + canonical_sha256(
            {"id": row["id"], "revision": row["revision"], "content_sha256": digest, "cycle": cycle})))
        sources = grounding.get("sources", row.get("sources", []))
        evidence = grounding.get("evidence", [])
        evidence = [{**e, "option_label": mapping[e["option_label"]]} for e in evidence]
        if artifact is not None:
            entry, payload = artifact["entry"], artifact["payload"]
            if payload.get("council_canary") is True or entry.get("council_canary") is True:
                raise ValueError("Council canary artifacts cannot enter re-council")
            question = candidate_question(entry)
            if _question_hash(question) != digest:
                raise ValueError("Artifact/DB canonical content hash mismatch")
            frozen = payload["plan"][entry["index"] - 1]
            if any(frozen.get(k) != scope[k] for k in ("cert_id", "domain_code", "objective_id", "guide_sha256")):
                raise ValueError("Artifact scope differs from DB/current registry")
            sources, evidence = entry.get("sources", []), canonical_evidence(entry)
        errors = _receipt_errors(evidence)
        if errors:
            raise ValueError(errors[0])
        if sources:
            request = build_request(ident, scope, question, sources, evidence,
                                    gate_version=5, argon_gate=True, execution_policy=BLIND_ARGON_POLICY)
        else:
            request = _receipt_request(ident, scope, question, evidence)
        if len(json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False)) + 1 > REQUEST_CHARACTER_LIMIT:
            raise ValueError("Re-council request exceeds bound")
        result.update(request=request, question=question, scope=scope, content_sha256=digest,
                      revision=row["revision"], quarantine_event_id=cycle.get("id"),
                      source="artifact" if artifact is not None else "db",
                      request_sha256=canonical_sha256(request), reasons=["Awaiting fresh complete council verdicts"])
    except (KeyError, ValueError, TypeError, IndexError, AttributeError) as error:
        # Deliberately omit arbitrary error bodies (provider/input text may contain secrets).
        result["reasons"] = [str(error) if type(error) is ValueError else "Invalid question/artifact provenance"]
    return result


def evaluate_question(row, prepared, verdict):
    """Restore unanimity, retire a confirmed defect, otherwise retain quarantine."""
    result = {k: v for k, v in prepared.items() if k not in ("request", "question", "scope")}
    if "request" not in prepared or verdict is None:
        return result
    try:
        request, question, scope = (prepared[k] for k in ("request", "question", "scope"))
        raw = verdict_gates(verdict, request.get("distractor_evidence"))
        if set(raw) != {"blind_solver", "style", "evidence", "argon"}:
            raise ValueError("Incomplete council")
        parsed = {name: parse_gate_output(name, raw[name], version=5) for name in ("blind_solver", "style", "evidence")}
        # Evaluate provenance first; skipped/error Argon review is not a complete council.
        evaluate_argon(question, raw["argon"], request["argon"])
        argon_blind = parse_gate_output("blind_solver", raw["argon"]["blind"])
        parse_output(json.dumps(raw["argon"]["review"], allow_nan=False), ArgonReviewSignature)
        if any(p["verdict"] == "UNCERTAIN" for p in (*parsed.values(), argon_blind)):
            result["reasons"] = ["Council UNCERTAIN; remains quarantined"]
            return result
        from scripts.publish_batch import publication_errors
        errors = publication_errors(question, scope, request, verdict, rules_version=5)
        if not errors:
            result.update(outcome="restore", reasons=["All council seats and freshness passed"])
            return result
        disagreements = [name for name, output in (("Claude", parsed["blind_solver"]), ("Argon", argon_blind))
                         if output["confidence"] >= .8 and output["ambiguous_answers"] is False
                         and blind_choice_map(question)[output["choice"]] != "A"]
        evidence_failure = parsed["evidence"]["verdict"] == "FAIL" and any(
            parsed["evidence"][name] is False for name in EVIDENCE_CHECKS)
        from shared.product_freshness import freshness_errors
        freshness_failure = bool(freshness_errors(question, scope["cert_id"]))
        if disagreements or evidence_failure or freshness_failure:
            result.update(outcome="retire", reasons=(
                [name + " blind solver confirmed key disagreement" for name in disagreements]
                + (["Evidence reviewer confirmed defect"] if evidence_failure else [])
                + (["Deterministic freshness failure"] if freshness_failure else [])))
        else:
            result["reasons"] = ["Council did not unanimously pass; no confirmed factual defect"]
    except Exception:
        # A system/schema failure is never a quality verdict and never a retirement.
        result.update(outcome="quarantined", reasons=["Council error/incomplete schema; remains quarantined"])
    return result


def find_artifact(row, artifact_root):
    """Find one stored artifact; ambiguity is an error, not a DB fallback."""
    if artifact_root is None:
        return None
    base = _path(artifact_root)
    matches = []
    for path in sorted(base.rglob("*.json")):
        if any(p.startswith(".env") for p in path.relative_to(base).parts):
            continue
        if path.is_symlink():
            continue
        payload = read_json(path)
        if not isinstance(payload, dict) or not isinstance(payload.get("candidates"), list):
            continue
        for entry in payload["candidates"]:
            if isinstance(entry, dict) and (entry.get("inserted_question_id") == row["id"] or entry.get("candidate_id") == row["id"]):
                matches.append({"entry": entry, "payload": payload})
    if len(matches) > 1:
        raise ValueError("Ambiguous stored artifact matches")
    return matches[0] if matches else None


def get_client():
    """Explicit coordinator-only DB connection, using shell env, never dotenv."""
    from supabase import create_client
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def run_recouncil(rows, output_dir, *, artifact_root=None, verdict_dir=None, apply=False, client=None):
    output_dir = _path(output_dir)
    results, events = [], []
    for row in rows:
        events.extend([{**e, "question_id": row["id"]} for e in row.get("question_events", [])])
        try:
            prepared = prepare_question(row, find_artifact(row, artifact_root))
            if "request" in prepared:
                request = prepared["request"]
                path = output_dir / "judge-requests" / (request["candidate_id"] + ".json")
                if path.exists() and read_json(path) != request:
                    raise ValueError("Frozen re-council request changed")
                _write(path, request, frozen=True)
                verdict_path = (_path(verdict_dir) / path.name) if verdict_dir is not None else None
                verdict = read_json(verdict_path) if verdict_path is not None and verdict_path.exists() else None
                result = evaluate_question(row, prepared, verdict)
            else:
                result = prepared
            if apply and result["outcome"] in ("restore", "retire"):
                if client is None:
                    client = get_client()
                params = {"p_question_id": row["id"], "p_expected_sha256": result["content_sha256"],
                          "p_actor": "pipeline-recouncil", "p_payload": {
                              "recouncil": True, "expected_revision": result["revision"],
                              "quarantine_event_id": result["quarantine_event_id"], "reasons": result["reasons"],
                              "request_sha256": result["request_sha256"], "verdict_sha256": canonical_sha256(verdict)}}
                if result["outcome"] == "retire":
                    params["p_reason"] = "; ".join(result["reasons"])
                # Last local fences follow all slow preparation and client setup.
                if read_json(path) != request or read_json(verdict_path) != verdict:
                    raise ValueError("Frozen council inputs changed before apply")
                response = client.rpc(result["outcome"] + "_question", params).execute()
                if not isinstance(response.data, dict) or response.data.get("changed") is not True:
                    raise ValueError("RPC refused transition")
                result["applied"] = True
            results.append(result)
        except Exception:
            results.append({"question_id": row.get("id"), "outcome": "quarantined", "applied": False,
                            "reasons": ["Re-council operation failed; inspect coordinator logs before retrying"]})
    return {"version": 1, "mode": "apply" if apply else "dry-run", "questions": results,
            "pages": repeat_report_pages(events)}


@click.command()
@click.option("--questions", "--queue", "questions", required=True, type=click.Path(path_type=Path))
@click.option("--output-dir", type=click.Path(path_type=Path))
@click.option("--artifact-root", type=click.Path(path_type=Path))
@click.option("--verdict-dir", type=click.Path(path_type=Path))
@click.option("--report", type=click.Path(path_type=Path))
@click.option("--dry-run", is_flag=True, help="Offline prepare/evaluate (the default).")
@click.option("--apply", "apply_changes", is_flag=True, help="Coordinator only: apply restore/retire RPCs.")
def main(questions, output_dir, artifact_root, verdict_dir, report, dry_run, apply_changes):
    """Prepare requests and evaluate existing verdicts; never invoke models."""
    if dry_run and apply_changes:
        raise click.UsageError("--dry-run and --apply are mutually exclusive")
    try:
        payload = read_json(questions)
        rows = payload if isinstance(payload, list) else payload["questions"]
        if not isinstance(rows, list) or any(not isinstance(r, dict) for r in rows):
            raise ValueError("Queue must contain question rows")
        if len({r["id"] for r in rows}) != len(rows):
            raise ValueError("Duplicate queue question IDs")
        if isinstance(payload, dict) and "question_events" in payload:
            rows = [{**r, "question_events": [e for e in payload["question_events"] if e.get("question_id") == r["id"]]}
                    for r in rows]
        output_dir = output_dir or (report.parent / "recouncil" if report else questions.parent / "recouncil")
        result = run_recouncil(rows, output_dir, artifact_root=artifact_root, verdict_dir=verdict_dir, apply=apply_changes)
        _write(report or output_dir / "recouncil-report.json", result)
        click.echo(json.dumps({"questions": len(result["questions"]), "pages": len(result["pages"]), "mode": result["mode"]}))
    except (OSError, ValueError, KeyError, TypeError, UnicodeError):
        raise click.ClickException("Invalid offline re-council queue or output path") from None


if __name__ == "__main__":
    main()
