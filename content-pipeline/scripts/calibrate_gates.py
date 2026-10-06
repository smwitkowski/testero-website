#!/usr/bin/env python3
"""Replay founder-reviewed originals with round holdouts and a durable call budget."""
from __future__ import annotations

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import sys
from threading import Event, Lock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

GATES = ("blind_solver", "style", "evidence")
QUESTION_FIELDS = ("stem", "correct_answer", "distractor_1", "distractor_2", "distractor_3",
                   "correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w") as stream:
        json.dump(value, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def append_json(path, value):
    with Path(path).open("a") as stream:
        stream.write(json.dumps(value, ensure_ascii=False, allow_nan=False) + "\n")
        stream.flush()
        os.fsync(stream.fileno())


def timestamp():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def locked(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


class CallBudget:
    """Reserve and fsync every attempt before contacting the subscription backend."""
    def __init__(self, directory, maximum=150):
        if type(maximum) is not int or not 1 <= maximum <= 150:
            raise ValueError("Call budget must be from 1 to 150")
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.journal = self.directory / "calls.jsonl"
        self.lock = Lock()
        with locked(self.directory / "budget.lock"):
            config = self.directory / "budget.json"
            if config.exists() and json.loads(config.read_text()) != {"maximum": maximum}:
                raise ValueError("Existing call budget cannot change")
            if not config.exists():
                write_json(config, {"maximum": maximum})
        self.maximum = maximum

    def records(self):
        return [json.loads(line) for line in self.journal.read_text().splitlines()] if self.journal.exists() else []

    def counts(self):
        records = self.records()
        reserved = sum(r["event"] == "reserved" for r in records)
        completed = sum(r["event"] == "completed" for r in records)
        failed = sum(r["event"] == "failed" for r in records)
        return {"maximum": self.maximum, "reserved": reserved,
                "completed": completed, "failed": failed,
                "unresolved": reserved - completed - failed,
                "remaining": self.maximum - reserved}

    def reserve(self, iteration, item_id, gate, input_sha256):
        with self.lock, locked(self.directory / "budget.lock"):
            if self.counts()["remaining"] <= 0:
                raise BudgetExhausted("Call budget exhausted")
            attempt = self.counts()["reserved"] + 1
            append_json(self.journal, {"ts": timestamp(), "event": "reserved", "attempt": attempt,
                        "iteration": iteration, "item_id": item_id, "gate": gate,
                        "input_sha256": input_sha256})
            return attempt

    def finish(self, attempt, event, error_class=None):
        with self.lock, locked(self.directory / "budget.lock"):
            append_json(self.journal, {"ts": timestamp(), "event": event,
                        "attempt": attempt, "error_class": error_class})


class BudgetExhausted(RuntimeError):
    """No further subscription calls are authorized."""


def load_items(pack):
    items = json.loads((Path(pack) / "founder-reviewed-questions.json").read_text())
    if not isinstance(items, list) or not items:
        raise ValueError("Reviewed pack must contain items")
    for item in items:
        if (item.get("founder_verdict") not in ("ok", "flag") or not isinstance(item.get("round"), str)
                or not isinstance(item.get("stem"), str) or not item["stem"].strip()
                or not isinstance(item.get("options"), list) or len(item["options"]) != 4
                or any(type(o.get("correct")) is not bool or not isinstance(o.get("text"), str)
                       or not o["text"].strip() for o in item["options"])
                or sum(o["correct"] for o in item["options"]) != 1):
            raise ValueError("Malformed reviewed item")
    return items


def learner_item(item):
    """Allowlist learner prose; labels, notes, answers and rationales never cross."""
    return {"stem": item["stem"], "options": {label: option["text"]
            for label, option in zip("ABCD", item["options"])}}


def heldout_style(items, round_name, rules):
    examples = [learner_item(item) for item in items
                if item["founder_verdict"] == "ok" and item["round"] != round_name]
    return (rules + "\n\nOriginal voice/decision-zoom exemplars only. Current rules override exemplars; "
            "technical claims are not factual authority. No exemplar supplies a key.\n"
            + json.dumps(examples, ensure_ascii=False)), examples


def normalized(text):
    return " ".join((text or "").split())


def matching_entry(item, artifacts):
    expected = learner_item(item)
    found = []
    for name, artifact in artifacts:
        for entry in artifact.get("candidates", []):
            if (normalized(entry.get("stem")) == normalized(expected["stem"])
                    and [normalized(o.get("text")) for o in entry.get("options", [])]
                    == [normalized(text) for text in expected["options"].values()]):
                found.append((name, entry, artifact["plan"][entry["index"] - 1]))
    if not found:
        return None
    # Multiple exact captures are permitted only when their key and evidence agree.
    if len({digest({k: e.get(k) for k in ("key", "rationales", "sources", "evidence")})
            for _, e, _ in found}) != 1:
        raise ValueError("Conflicting frozen evidence captures")
    return found[0]


def canonical_question(item, match):
    correct = next(i for i, o in enumerate(item["options"]) if o["correct"])
    order = [correct] + [i for i in range(4) if i != correct]
    if match and match[1].get("key") != "ABCD"[correct]:
        raise ValueError("Frozen key does not match reviewed content key")
    rationales = match[1].get("rationales", {}) if match else {}
    q = {"stem": item["stem"]}
    q.update({field: item["options"][i]["text"] for field, i in zip(QUESTION_FIELDS[1:5], order)})
    q.update({field: rationales.get("ABCD"[i], "") for field, i in zip(QUESTION_FIELDS[5:], order)})
    return q, order


def frozen_evidence(match, order):
    from shared.evidence import check_evidence
    if not match:
        return [], [], "No exact frozen question/options capture"
    _, entry, _ = match
    sources = entry.get("sources", [])
    evidence = entry.get("evidence", [])
    if (not sources or any(not isinstance(s.get("text"), str) or not s["text"].strip()
            or hashlib.sha256(s["text"].encode()).hexdigest() != s.get("text_sha256") for s in sources)):
        return [], [], "Missing frozen product text or source hash mismatch"
    mapping = {"ABCD"[i]: label for label, i in zip("ABCD", order)}
    evidence = [{**e, "option_label": mapping.get(e.get("option_label"))} for e in evidence]
    checked = check_evidence(evidence, sources)
    if not checked["passed"]:
        return [], [], "Frozen option receipts fail quote membership/provenance"
    return sources, checked["options"], None


def gate_pass(name, raw, question):
    from shared.gates import evaluate_gate
    return evaluate_gate(name, raw, question)[0]

def prepare(items, artifacts):
    from shared.gates import build_gate_inputs, GATE_SIGNATURES
    from shared.cli_models import output_model, signature_prompt
    from shared.doc_search import documentation_context
    from shared.question_style import STYLE_RULES
    prepared = []
    for number, item in enumerate(items, 1):
        match = matching_entry(item, artifacts)
        question, order = canonical_question(item, match)
        sources, evidence, skip = frozen_evidence(match, order)
        style, examples = heldout_style(items, item["round"], STYLE_RULES)
        scope = match[2].get("domain_prompt", "") if match else item.get("objective", "")
        inputs = build_gate_inputs(question, scope, documentation_context(sources) if sources else "", evidence,
                                   style_reference=style)
        requests = {}
        trimming = None
        for gate in GATES:
            if gate == "evidence" and skip:
                continue
            signature = GATE_SIGNATURES[gate]
            schema = output_model(signature).model_json_schema()
            if gate == "evidence":
                from shared.external_judge import _source_context
                cited_urls = {e["url"] for e in evidence}
                cited = [s for s in sources if s["url"] in cited_urls]
                largest = sorted(cited, key=lambda s: len(s["text"]), reverse=True)
                trimmed = set()
                for count in range(len(largest) + 1):
                    if count:
                        trimmed.add(largest[count - 1]["url"])
                    context, trimming = _source_context(cited, evidence, trimmed)
                    gate_inputs = {**inputs[gate], "documentation_context": context}
                    prompt = signature_prompt(signature, gate_inputs)
                    request = {"prompt": prompt, "schema": schema,
                               "input_sha256": digest({"prompt": prompt, "schema": schema})}
                    if len(json.dumps(request, indent=2, ensure_ascii=False)) + 1 <= 150000:
                        break
                else:
                    raise ValueError("Evidence exceeds request bound even with fixed wide quote windows")
            else:
                prompt = signature_prompt(signature, inputs[gate])
                request = {"prompt": prompt, "schema": schema,
                           "input_sha256": digest({"prompt": prompt, "schema": schema})}
                if len(json.dumps(request, indent=2, ensure_ascii=False)) + 1 > 150000:
                    raise ValueError("Learner-only gate exceeds request bound")
            requests[gate] = request
        prepared.append({"item_id": number, "round": item["round"], "founder": item["founder_verdict"],
                         "question": question, "requests": requests, "evidence_skip": skip,
                         "capture": match[0] if match else None, "exemplar_count": len(examples),
                         "exemplar_sha256": digest(examples),
                         "source_sha256": [s["text_sha256"] for s in sources],
                         "source_integrity": "VERIFIED" if sources else "SKIP",
                         "quote_integrity": "VERIFIED" if evidence else "SKIP",
                         "trimming": trimming})
    return prepared


def verify_corrected_reason_schemas(prepared):
    """Require actual emitted reason bounds before admitting corrected-schema work."""
    for item in prepared:
        for request in item["requests"].values():
            reason = request["schema"].get("properties", {}).get("reason", {})
            if reason.get("minLength") != 1 or reason.get("maxLength") != 300:
                raise ValueError("Corrected gate schema must export reason minLength1/maxLength300")


def reuse_blind(prepared, source, destination):
    """Reuse only exact learner prompts with strict revalidation and old hashes."""
    source, destination = Path(source), Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    from shared.gates import parse_gate_output
    for item in prepared:
        base = f"{item['item_id']:02d}-blind_solver"
        original_request = json.loads((source / (base + ".request.json")).read_text())
        original_result = json.loads((source / (base + ".json")).read_text())
        fresh = item["requests"]["blind_solver"]
        if original_request["prompt"] != fresh["prompt"]:
            raise ValueError("Blind reuse requires identical learner prompt bytes")
        if (original_result.get("error_class") or "raw" not in original_result
                or original_result.get("input_sha256") != original_request["input_sha256"]
                or original_request["input_sha256"] != digest({"prompt": original_request["prompt"],
                                                               "schema": original_request["schema"]})):
            raise ValueError("Blind reuse requires a hash-bound parsed original output")
        parse_gate_output("blind_solver", original_result["raw"])
        record = {**original_result, "passed": gate_pass("blind_solver", original_result["raw"], item["question"]),
                  "reused": True, "source_iteration": source.name,
                  "source_input_sha256": original_request["input_sha256"],
                  "source_schema_sha256": digest(original_request["schema"]),
                  "prompt_sha256": digest(original_request["prompt"]),
                  "revalidated_schema_sha256": digest(fresh["schema"])}
        item["requests"]["blind_solver"] = original_request
        for suffix, value in ((".request.json", original_request), (".json", record)):
            path = destination / (base + suffix)
            if path.exists() and json.loads(path.read_text()) != value:
                raise ValueError("Reuse refuses replacing another frozen record")
            if not path.exists():
                write_json(path, value)


def run(prepared, output, budget, iteration, *, live=False, parallel=3, backend=None, retry_failed=False, selected_gates=None):
    from shared.cli_models import run_claude_request, CLIUsageLimitError, CLIAuthError
    if type(parallel) is not int or not 1 <= parallel <= 3:
        raise ValueError("Parallel must be 1 to 3")
    backend = backend or run_claude_request
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    stop, admission = Event(), Lock()
    if retry_failed:
        failures = [p for p in output.glob("*.json") if not p.name.endswith(".request.json")
                    and json.loads(p.read_text()).get("error_class")]
        if len(failures) > 12:
            raise ValueError("Manual diagnostic retry is limited to 12 failures")
    jobs = [(item, gate, request) for item in prepared for gate, request in item["requests"].items()
            if selected_gates is None or gate in selected_gates]

    def execute(job):
        item, gate, request = job
        destination = output / f"{item['item_id']:02d}-{gate}.json"
        saved, prior = None, None
        if retry_failed and not destination.exists():
            return
        if destination.exists():
            saved = json.loads(destination.read_text())
            if saved["input_sha256"] != request["input_sha256"]:
                raise ValueError("Resume refuses changed gate input")
            if not (live and retry_failed and saved.get("error_class")):
                return
            prior = output / "prior-attempts" / f"{item['item_id']:02d}-{gate}-attempt-{saved['attempt']}.json"
            if prior.exists():
                raise ValueError("Retry archive already exists")
        request_path = output / f"{item['item_id']:02d}-{gate}.request.json"
        if request_path.exists() and json.loads(request_path.read_text()) != request:
            raise ValueError("Resume refuses changed frozen request")
        if not request_path.exists():
            write_json(request_path, request)
        if not live:
            return
        with admission:
            if stop.is_set():
                return
            try:
                attempt = budget.reserve(iteration, item["item_id"], gate, request["input_sha256"])
            except BudgetExhausted:
                stop.set()
                return
        if prior is not None:
            write_json(prior, saved)
        stage, raw = "backend", None
        try:
            raw = backend("claude/claude-sonnet-5-5", request["prompt"], request["schema"])
            stage = "local_validation"
            passed = gate_pass(gate, raw, item["question"])
            stage = "storage"
            write_json(destination, {"input_sha256": request["input_sha256"], "raw": raw,
                                     "passed": passed, "attempt": attempt})
            budget.finish(attempt, "completed")
        except Exception as error:
            if isinstance(error, (CLIUsageLimitError, CLIAuthError)):
                with admission:
                    stop.set()
            failure = {"input_sha256": request["input_sha256"], "error_class": type(error).__name__,
                       "passed": False, "attempt": attempt, "stage": stage}
            if stage == "local_validation" and isinstance(raw, dict):
                failure["invalid_raw"] = raw
                failure["reason_length"] = len(raw["reason"]) if isinstance(raw.get("reason"), str) else None
            write_json(destination, failure)
            budget.finish(attempt, "failed", type(error).__name__)

    with locked(output / "run.lock"), ThreadPoolExecutor(max_workers=parallel) as executor:
        iterator, pending = iter(jobs), set()
        def fill():
            while len(pending) < parallel and not stop.is_set():
                job = next(iterator, None)
                if job is None:
                    break
                pending.add(executor.submit(execute, job))
        fill()
        while pending:
            done, pending = wait(pending, return_when=FIRST_COMPLETED)
            for future in done:
                future.result()
            fill()
    report = summarize(prepared, output, budget, iteration)
    report["parallel"] = parallel
    return report


def summarize(prepared, output, budget, iteration):
    rows = []
    for item in prepared:
        gates = {}
        for gate in GATES:
            path = Path(output) / f"{item['item_id']:02d}-{gate}.json"
            if path.exists():
                record = json.loads(path.read_text())
                expected = item["requests"][gate]["input_sha256"]
                if record.get("input_sha256") != expected:
                    raise ValueError("Report refuses stale gate output")
                passed = gate_pass(gate, record["raw"], item["question"]) if "raw" in record else False
                raw = record.get("raw", {})
                gates[gate] = {"status": "ERROR" if record.get("error_class") else "PASS" if passed else "FAIL", "input_sha256": expected,
                               "schema_sha256": digest(item["requests"][gate]["schema"]),
                               "reason": raw.get("reason"),
                               "checks": {k: v for k, v in raw.items() if type(v) is bool},
                               "score": raw.get("confidence" if gate == "blind_solver" else "score"),
                               "choice": raw.get("choice") if gate == "blind_solver" else None,
                               "error_class": record.get("error_class"),
                               "error_stage": record.get("stage"), "reason_length": record.get("reason_length"),
                               "reused": record.get("reused", False),
                               "source_iteration": record.get("source_iteration", iteration),
                               "source_input_sha256": record.get("source_input_sha256", expected),
                               "source_schema_sha256": record.get("source_schema_sha256", digest(item["requests"][gate]["schema"])),
                               "prompt_sha256": digest(item["requests"][gate]["prompt"]),
                               "revalidated_schema_sha256": record.get("revalidated_schema_sha256")}
            else:
                gates[gate] = {"status": "SKIP", "reason": item["evidence_skip"] if gate == "evidence"
                               and item["evidence_skip"] else "Not called or interrupted"}
        style_blind = all(gates[g]["status"] == "PASS" for g in GATES[:2])
        complete = all(gates[g]["status"] != "SKIP" for g in GATES)
        rows.append({k: item[k] for k in ("item_id", "round", "founder", "capture", "exemplar_count",
                                          "exemplar_sha256", "source_sha256")} | {
            "source_integrity": item.get("source_integrity", "SKIP"),
            "quote_integrity": item.get("quote_integrity", "SKIP"),
            "trimming": item.get("trimming"),
            "gates": gates, "blind_style_pass": style_blind,
            "all_gates": "PASS" if complete and all(g["status"] == "PASS" for g in gates.values())
                         else "FAIL" if any(g["status"] == "FAIL" for g in gates.values())
                         else "ERROR" if any(g["status"] == "ERROR" for g in gates.values()) else "SKIP"})
    def totals(field):
        return {"flagged": sum(r["founder"] == "flag" for r in rows),
                "ok": sum(r["founder"] == "ok" for r in rows),
                "rejected_flagged": sum(r["founder"] == "flag" and field(r) == "FAIL" for r in rows),
                "retained_ok": sum(r["founder"] == "ok" and field(r) == "PASS" for r in rows)}
    blind_style = totals(lambda r: "FAIL" if any(r["gates"][g]["status"] == "FAIL" for g in GATES[:2])
                         else "PASS" if r["blind_style_pass"]
                         else "ERROR" if any(r["gates"][g]["status"] == "ERROR" for g in GATES[:2]) else "SKIP")
    combined = totals(lambda r: r["all_gates"])
    return {"version": 4, "iteration": iteration, "backend": "claude/claude-sonnet-5-5", "parallel": 3,
            "call_budget": budget.counts(),
            "iteration_calls_reserved": sum(r["event"] == "reserved" and r.get("iteration") == iteration
                                            for r in budget.records()),
            "blind_style_totals": blind_style, "all_gates_totals": combined,
            "targets": {"reject_flagged_at_least": 11, "retain_ok_at_least": 6},
            "targets_met": combined["rejected_flagged"] >= 11 and combined["retained_ok"] >= 6,
            "mixed_provenance": any(g.get("reused") for r in rows for g in r["gates"].values()),
            "gate_status_totals": {g: {s: sum(r["gates"][g]["status"] == s for r in rows)
                for s in ("PASS", "FAIL", "ERROR", "SKIP")} for g in GATES},
            "founder_ok_policy_conflicts": [r["item_id"] for r in rows if r["founder"] == "ok"
                and r["gates"]["style"].get("checks", {}).get("current_names") is False],
            "limitations": ["Small-sample calibration, not validation or approval.",
                            "Whole round held out from founder-ok learner-only exemplars.",
                            "Frozen product documentation only; no retrieval or database access.",
                            "Founder labels/notes used only in selection and reporting, never in gate inputs.",
                            "Reservations count against budget even after interruption; no automatic retries."],
            "items": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", type=Path, required=True)
    parser.add_argument("--artifact-dir", type=Path, default=Path(".cache/generation"))
    parser.add_argument("--output-dir", type=Path, default=Path(".cache/calibration"))
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--iteration", default="baseline")
    parser.add_argument("--parallel", type=int, choices=(1, 2, 3), default=3)
    parser.add_argument("--max-calls", type=int, default=150)
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--retry-failed", action="store_true", help="Explicitly retry error records only; never content FAIL/UNCERTAIN")
    parser.add_argument("--frozen-requests", action="store_true", help="Use exact saved requests for replay/reporting, never rebuild baseline prompts")
    parser.add_argument("--item", type=int, action="append", help="Replay selected 1-based IDs; holdouts still use the full pack")
    parser.add_argument("--gate", choices=GATES, action="append", help="Diagnostic subset, never an approval waiver")
    parser.add_argument("--reuse-blind-from", type=Path, help="Explicit mixed-provenance recovery; source learner prompts must match exactly")
    args = parser.parse_args()
    if not args.iteration.replace("-", "").replace("_", "").isalnum():
        parser.error("Iteration must be an alphanumeric safe name")
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    items = load_items(args.pack)
    artifacts = [(p.name, json.loads(p.read_text())) for p in sorted(args.artifact_dir.glob("*.json"))
                 if not p.name.startswith(".env")]
    prepared = prepare(items, artifacts)
    if args.item:
        if any(i < 1 or i > len(items) for i in args.item):
            parser.error("Item ID is outside the reviewed pack")
        prepared = [item for item in prepared if item["item_id"] in args.item]
    if args.retry_failed and args.report.exists():
        parser.error("Diagnostic retries require a fresh report path; preserve prior reports")
    if args.retry_failed or args.frozen_requests:
        frozen_dir = args.output_dir / args.iteration
        for item in prepared:
            for gate in item["requests"]:
                path = frozen_dir / f"{item['item_id']:02d}-{gate}.request.json"
                if not path.exists():
                    parser.error("Manual retries require existing frozen requests")
                item["requests"][gate] = json.loads(path.read_text())
    budget = CallBudget(args.output_dir, args.max_calls)
    run_dir = args.output_dir / args.iteration
    if args.reuse_blind_from:
        if set(args.gate or []) != {"style", "evidence"}:
            parser.error("Mixed recovery must call style and evidence only")
        verify_corrected_reason_schemas(prepared)
        reuse_blind(prepared, args.reuse_blind_from, run_dir)
    report = run(prepared, run_dir, budget, args.iteration, live=args.live, parallel=args.parallel,
                 retry_failed=args.retry_failed, selected_gates=args.gate)
    report["parallel"] = args.parallel
    write_json(args.report, report)
    print(json.dumps({k: report[k] for k in ("call_budget", "blind_style_totals", "all_gates_totals", "targets_met")}))
    return 0 if report["targets_met"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
