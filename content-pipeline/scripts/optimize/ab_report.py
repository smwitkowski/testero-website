"""Offline production A/B report. This command never generates, judges or publishes.

Sequential bounds use alpha spending across candidate-pair prefix lengths and
Hoeffding bounds on independent objective clusters. Dependence within each
objective is unrestricted. Promotion requires a predeclared cumulative schedule,
no interference across objectives, and no outcome-driven exclusions. Re-reading
the same prefix spends no new alpha. A descriptive clustered SE is not the
sequential decision. Small objective counts intentionally have wide bounds.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import re
from statistics import mean, stdev

from scripts.optimize.evaluate_pack import SEATS, promotion_decision, writer_token_usage

GUARDRAILS = ("argon_literal_elimination", "argon_evidence_gap", "generic_keys", "rubric_echoes", "mechanism_duplicates")
LITERAL = re.compile(r"literal|stem (?:text )?alone|reading.comprehension|explicit contradiction|without (?:product|domain|cloud).*knowledge", re.I)
EVIDENCE = re.compile(r"evidence|unsupported|undocumented|not supported|missing.*(?:quote|receipt|support)|(?:quote|receipt).*missing", re.I)
ECHO = re.compile(r"\b(?:[OS](?:[1-9]|1[0-3])|distractors_plausible|product_knowledge_hinge|cloud_specific_alternative|options_distinct_approaches|constraints_as_wants|generic_validation_key|supported_decision_hinge)\b")


def read(path):
    return json.loads(Path(path).read_text(), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def paired_statistics(rows, *, alpha=.05):
    """Equal-weight objective-cluster differences and a time-uniform bound.

    At each fixed pair-prefix N, objective means lie in [-1,1]. Hoeffding gives
    radius sqrt(2 log(2/alpha_N)/G); alpha_N=alpha/(N(N+1)) sums to alpha.
    The union bound does not require independence between successive looks.
    The fixed-prefix bound DOES require independent objective clusters and a
    predetermined sampling schedule, not outcome-adaptive objective rotation.
    """
    if not 0 < alpha < 1:
        raise ValueError("alpha must lie strictly between zero and one")
    pairs = defaultdict(dict)
    for row in rows:
        key = (row["cohort"], row["pair_id"])
        if row["arm"] in pairs[key]:
            raise ValueError("Duplicate arm in an A/B pair")
        pairs[key][row["arm"]] = row
    clusters = defaultdict(list)
    incomplete = 0
    for pair in pairs.values():
        if set(pair) != {"control", "challenger"}:
            incomplete += 1
            continue
        control, challenger = pair["control"], pair["challenger"]
        if control["objective_id"] != challenger["objective_id"]:
            raise ValueError("A/B pair crosses objectives")
        clusters[control["objective_id"]].append(int(challenger["accepted"]) - int(control["accepted"]))
    differences = {objective: mean(values) for objective, values in sorted(clusters.items())}
    values = list(differences.values())
    count = sum(map(len, clusters.values()))
    effect = mean(values) if values else None
    se = stdev(values) / math.sqrt(len(values)) if len(values) > 1 else None
    alpha_look = alpha / (count * (count + 1)) if count else None
    radius = math.sqrt(2 * math.log(2 / alpha_look) / len(values)) if values else None
    lower = max(-1., effect - radius) if values else None
    upper = min(1., effect + radius) if values else None
    return {"estimand": "equal-weight objective mean of paired challenger-minus-control accepted yield",
        "paired_candidates": count, "objective_clusters": len(values), "incomplete_pairs": incomplete,
        "objective_differences": differences, "difference": effect, "clustered_standard_error": se,
        "sequential": {"method": "objective-cluster Hoeffding with alpha/(N*(N+1)) spending",
            "alpha": alpha, "alpha_at_prefix": alpha_look, "radius": radius,
            "lower": lower, "upper": upper, "yield_improved": lower is not None and lower > 0,
            "assumptions": "Predeclared cumulative pair prefixes; independent objective clusters; no cross-objective interference or outcome-adaptive selection."}}


def _learner_text(entry):
    parts = [entry.get("stem") or ""]
    parts.extend(option.get("text", "") for option in entry.get("options", []))
    parts.extend(entry.get("rationales", {}).values())
    return "\n".join(value for value in parts if isinstance(value, str))


def candidate_row(payload, entry, artifact):
    """Replay frozen production gates locally; never infer missing votes as passes."""
    from shared.external_judge import candidate_question
    from shared.distractor_evidence import verdict_gates
    from shared.gates import evaluate_gate, parse_gate_output
    from shared.argon_gate import evaluate_argon
    from shared.cli_models import CLISchemaError
    assignment = entry["ab_assignment"]
    row = {**assignment, "objective_id": entry["objective_id"],
           "accepted": entry.get("accepted") is True,
           "doccheck_passed": entry.get("decision_proof", {}).get("passed") is True,
           "seats": {}, "council_passed": False, "complete": True,
           "guardrails": {name: None for name in GUARDRAILS}}
    learner = _learner_text(entry)
    if entry.get("stem"):
        row["guardrails"]["rubric_echoes"] = bool(ECHO.search(learner))
    mechanism = entry.get("decision_plan", {}).get("engineering_decision")
    row["mechanism"] = re.sub(r"\W+", " ", mechanism.casefold()).strip() if isinstance(mechanism, str) else None
    metadata = entry.get("external_judge_request")
    if metadata:
        try:
            request_path = (artifact.parent / metadata["path"]).resolve()
            if not request_path.is_relative_to(artifact.parent.resolve()):
                raise ValueError("External request escapes artifact folder")
            request = read(request_path)
            raw = entry.get("external_verdict")
            if raw is None:
                raw = read(artifact.with_suffix(".verdicts") / (entry["candidate_id"] + ".json"))
            if (metadata.get("sha256") != hashlib.sha256(request_path.read_bytes()).hexdigest()
                    or request.get("candidate_id") != entry.get("candidate_id")
                    or request.get("objective_id") != entry.get("objective_id")):
                raise ValueError("External request digest or candidate scope mismatch")
            gates = verdict_gates(raw, request.get("distractor_evidence"))
            question = candidate_question(entry)
            for name in ("blind_solver", "style", "evidence"):
                parse_gate_output(name, gates[name], version=payload.get("rules_version", 5), style_policy=entry.get("style_policy"))
                row["seats"]["claude." + name] = evaluate_gate(name, gates[name], question,
                    version=payload.get("rules_version", 5), style_policy=entry.get("style_policy"))[0]
            argon = gates["argon"]
            if request["argon"]["version"] != 3:
                raise ValueError("A/B requires independent Argon blind and review")
            argon_pass, _ = evaluate_argon(question, argon, request["argon"])
            row["seats"]["argon.blind"] = evaluate_gate("blind_solver", argon["blind"], question)[0]
            review = argon["review"]
            if review.get("status") == "skipped":
                raise ValueError("Incomplete Argon review")
            row["seats"]["argon.review"] = (review["verdict"] == "PASS" and review["key_correct"] is True
                and review["other_defensible_option"] is False and not review["issues"])
            if argon_pass != (row["seats"]["argon.blind"] and row["seats"]["argon.review"]):
                raise ValueError("Argon aggregate mismatch")
            row["council_passed"] = all(row["seats"].values())
            issues = " ".join(review["issues"])
            row["guardrails"].update(argon_literal_elimination=bool(LITERAL.search(issues)),
                argon_evidence_gap=bool(EVIDENCE.search(issues)),
                generic_keys=gates["style"]["generic_validation_key"])
        except (OSError, ValueError, KeyError, TypeError, CLISchemaError):
            row["complete"] = False
    else:
        from scripts.generate_pmle_questions import is_quality_rejection
        if not is_quality_rejection(entry):
            row["complete"] = False
    if row["accepted"] and not (row["doccheck_passed"] and row["council_passed"]):
        row["complete"] = False
    return row


def summarize(rows, calls):
    judged = [row for row in rows if set(row["seats"]) == set(SEATS) and row["complete"]]
    docpass = [row for row in rows if row["doccheck_passed"]]
    n = len(rows)
    guards = {}
    for name in GUARDRAILS:
        observed = [row["guardrails"][name] for row in rows if type(row["guardrails"][name]) is bool]
        guards[name] = {"count": sum(observed), "observed": len(observed),
                        "rate": sum(observed) / len(observed) if observed else None}
    usage = writer_token_usage(calls)
    return {"candidate_count": n, "accepted": sum(row["accepted"] for row in rows),
        "yield": sum(row["accepted"] for row in rows) / n if n else None,
        "doccheck_passed": len(docpass),
        "council_given_doccheck": sum(row["council_passed"] for row in docpass) / len(docpass) if docpass else None,
        "council_pass_rate": sum(row["council_passed"] for row in judged) / len(judged) if judged else None,
        "council_count": len(judged),
        "seat_pass_rates": {seat: sum(row["seats"][seat] for row in judged) / len(judged) if judged else None for seat in SEATS},
        "guardrails": guards, "writer_usage": usage,
        "complete": bool(rows) and all(row["complete"] for row in rows) and usage["complete"]}


def validate_plan(payload):
    """Recompute assignments, rather than trusting self-reported arm labels."""
    from shared.ab_experiment import interleave_plan
    meta = payload["ab_experiment"]
    plan = payload.get("plan")
    count = payload.get("planned_count")
    if (type(count) is not int or count < 2 or count % 2 or not isinstance(plan, list)
            or len(plan) != count or meta.get("generation_only") is not True
            or type(meta.get("seed")) is not int):
        raise ValueError("A/B artifact must contain its full even frozen plan")
    runtime = {"ab_assignment", "decision_objective", "decision_plan", "decision_proof"}
    base = [{key: value for key, value in scope.items() if key not in runtime} for scope in plan[::2]]
    cohort = plan[0].get("ab_assignment", {}).get("cohort")
    if not isinstance(cohort, str) or not cohort:
        raise ValueError("A/B frozen plan requires a cohort ID")
    expected = interleave_plan(base, experiment=meta["id"], seed=meta["seed"],
        pack_sha256=meta["challenger_sha256"], cohort=cohort)
    normalized = [{key: value for key, value in scope.items() if key not in runtime - {"ab_assignment"}} for scope in plan]
    if expected != normalized:
        raise ValueError("Frozen A/B plan does not match expected randomized objective pairs")
    return {index: scope for index, scope in enumerate(plan, 1)}


def make_report(artifacts, *, canary=None, spot_check=None, held_out=None, schedule=None, alpha=.05):
    """Read a complete chronological artifact prefix; missing slots block promotion."""
    paths = [Path(path).resolve() for path in artifacts]
    if not paths or len(set(paths)) != len(paths):
        raise ValueError("Supply distinct A/B artifact paths")
    rows, calls = [], {"control": [], "challenger": []}
    experiment = digest = None
    hashes = {}
    planned = 0
    for path in paths:
        payload = read(path)
        meta = payload["ab_experiment"]
        if experiment is None:
            experiment, digest = meta["id"], meta["challenger_sha256"]
        if (meta["id"], meta["challenger_sha256"]) != (experiment, digest):
            raise ValueError("Do not pool experiments or challenger packs")
        hashes[str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
        planned += payload["planned_count"]
        by_index = {}
        planned_by_index = validate_plan(payload)
        for entry in payload["candidates"]:
            index = entry.get("index")
            if type(index) is not int or index not in planned_by_index:
                raise ValueError("Candidate index is outside the frozen A/B plan")
            assignment = entry["ab_assignment"]
            scope = planned_by_index[index]
            scope_keys = ("cert_id", "domain_code", "guide_sha256", "scenario_moment", "opening_style", "question_line", "key_length_rank", "style_policy")
            if any(entry.get(key) != scope[key] for key in scope_keys if key in scope):
                raise ValueError("Candidate index scope differs from frozen A/B plan")
            if (assignment != scope.get("ab_assignment") or entry["objective_id"] != scope["objective_id"]
                    or assignment["experiment"] != experiment or assignment["challenger_sha256"] != digest
                    or assignment["arm"] not in calls
                    or assignment["prompt_pack_sha256"] != (digest if assignment["arm"] == "challenger" else None)
                    or entry["index"] in by_index):
                raise ValueError("Candidate differs from frozen A/B assignment")
            by_index[entry["index"]] = assignment["arm"]
            rows.append(candidate_row(payload, entry, path))
        callpath = Path(str(path) + ".calls.jsonl")
        if callpath.is_file():
            for line in callpath.read_text().splitlines():
                if line.strip():
                    call = json.loads(line)
                    if call.get("index") in by_index:
                        calls[by_index[call["index"]]].append(call)
    stats = paired_statistics(rows, alpha=alpha)
    for arm in calls:
        seen = set()
        for row in rows:
            if row["arm"] != arm or not row["mechanism"]:
                continue
            row["guardrails"]["mechanism_duplicates"] = row["mechanism"] in seen
            seen.add(row["mechanism"])
    arms = {arm: summarize([row for row in rows if row["arm"] == arm], calls[arm]) for arm in calls}
    decision = promotion_decision(arms["control"], arms["challenger"], canary)
    reasons = decision["reasons"]
    if (not isinstance(canary, dict) or not isinstance(canary.get("canaries"), dict)
            or any(type(canary["canaries"].get(name, {}).get("count")) is not int
                   or canary["canaries"][name]["count"] < 20 for name in ("swapped_key", "retired_name"))):
        reasons.append("Canaries require at least 20 observed cases per defect type")
    if len(rows) != planned or stats["incomplete_pairs"]:
        reasons.append("Incomplete planned candidates or arm pairs; no outcome-driven exclusions")
    if not stats["sequential"]["yield_improved"]:
        reasons.append("Always-valid objective-cluster lower bound does not exceed zero")
    if (not isinstance(schedule, dict) or schedule.get("experiment") != experiment
            or schedule.get("challenger_sha256") != digest
            or schedule.get("independent_objectives_no_interference") is not True
            or [str(Path(p).resolve()) for p in schedule.get("artifacts", [])][:len(paths)] != list(hashes)):
        reasons.append("Missing predeclared cumulative artifact schedule / independent-objective assumptions")
    before, after = (arms[name]["council_given_doccheck"] for name in ("control", "challenger"))
    if before is None or after is None or after < before - .05 - 1e-12:
        reasons.append("Missing conditional council evidence or >5pp regression given doccheck pass")
    for name in GUARDRAILS:
        old, new = (arms[arm]["guardrails"][name]["rate"] for arm in ("control", "challenger"))
        if old is None or new is None or (new > .20 + 1e-12 if name == "generic_keys" else new > old + 1e-12):
            reasons.append("Missing guardrail evidence or regression: " + name)
    def bound_audit(value):
        return (isinstance(value, dict) and value.get("complete") is True
            and value.get("experiment") == experiment and value.get("challenger_sha256") == digest)
    if (not bound_audit(spot_check) or type(spot_check.get("pairs")) is not int or spot_check["pairs"] < 10
            or type(spot_check.get("losses")) is not int or not 0 <= spot_check["losses"] < 7
            or spot_check["losses"] > spot_check["pairs"]
            or type(spot_check.get("factual_defects")) is not int or spot_check["factual_defects"] != 0):
        reasons.append("Missing clean blinded 10-pair human audit")
    if (not bound_audit(held_out) or type(held_out.get("count")) is not int
            or held_out["count"] < 30 or held_out.get("gain_persists") is not True):
        reasons.append("Missing fresh-family 30-item held-out judge confirmation")
    decision.update(promote=not reasons)
    return {"version": 1, "experiment": experiment, "challenger_sha256": digest,
        "artifact_sha256": hashes, "planned_candidates": planned, "arms": arms,
        "paired": stats, "promotion": decision,
        "guardrail_definitions": {
            "argon_literal_elimination": "Regex issue-text screen: literal/stem-only contradictions, among observed Argon reviews; not a semantic verdict",
            "argon_evidence_gap": "Regex evidence/unsupported issue-text screen, among observed Argon reviews; not a semantic verdict",
            "generic_keys": "Frozen Style generic_validation_key, observed Style outputs; maximum 20%",
            "rubric_echoes": "Rule IDs or frozen decision-check field names in learner stem/options/rationales only",
            "mechanism_duplicates": "Repeated normalized engineering_decision within each arm across this prefix"},
        "note": "Offline decision only; never changes publishing gates. Text screens are diagnostics, not independent factual review. Missing token usage, council evidence, canaries or human/held-out audits blocks promotion."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, action="append", required=True)
    parser.add_argument("--canary", type=Path)
    parser.add_argument("--spot-check", type=Path)
    parser.add_argument("--held-out", type=Path)
    parser.add_argument("--schedule", type=Path)
    parser.add_argument("--alpha", type=float, default=.05)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    result = make_report(args.artifact, canary=read(args.canary) if args.canary else None,
        spot_check=read(args.spot_check) if args.spot_check else None,
        held_out=read(args.held_out) if args.held_out else None,
        schedule=read(args.schedule) if args.schedule else None, alpha=args.alpha)
    text = json.dumps(result, indent=2, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
