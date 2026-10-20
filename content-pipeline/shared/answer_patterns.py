"""Offline PDE answer-pattern veto, additional to scenario/key Jaccard checks.

Only explicitly recognized families have canonical semantics. Join-rewrite
families also require row-expansion evidence in the saved scenario. Other actions
use conservative lexical thresholds. This is not a semantic guarantee for unseen paraphrases. Missing comparison provenance
blocks instead of assigning a guessed category. No model or service is called.
"""
import hashlib
import itertools
import json
import re
import unicodedata
from collections.abc import Mapping

CERT_ID = "data-engineer"
METHOD = "answer-pattern-v1: canonical families + order-independent lexical skeleton"
KEY_THRESHOLD = 0.65
DISTRACTOR_THRESHOLD = 0.55
_STOP = frozenset("a an and are as at be been being by do each for from has have in into is it its of on or should that the their these this to using use when which with you your then after once so per".split())


def _mapping(value):
    if hasattr(value, "model_dump"):
        value = value.model_dump()
    if not isinstance(value, Mapping):
        raise ValueError("Answer-pattern input must be a plan or question mapping")
    return value


def _text(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Answer-pattern action text is missing")
    return unicodedata.normalize("NFKC", value).casefold()


def _normalized(value):
    text = _text(value)
    aliases = (
        (r"managed service for apache spark", "dataproc"),
        (r"\b(?:transient|short[- ]lived|job[- ]scoped|per[- ]job|temporary)\b", "ephemeral"),
        (r"\b(?:tear(?:s)? down|torn down|remov(?:e|es|ed|ing)|delet(?:e|es|ed|ing)|destroy(?:s|ed|ing)?|deprovision(?:s|ed|ing)?)\b", "delete"),
        (r"\b(?:finish(?:es|ed|ing)?|complet(?:e|es|ed|ing|ion))\b", "complete"),
        (r"\b(?:unique|deduplicat(?:e|ed|ion))\b", "distinct"),
        (r"\b(?:hyperloglog|hll(?:_count)?)\b", "sketch"),
        (r"\b(?:summ(?:ed|ing)|sum|add(?:ed|ing)?)\b", "sum"),
        (r"\b(?:automatically|automatic)\b", "auto"),
        (r"\b(?:persistent|long[- ]lived|always[- ]on)\b", "persistent"),
        (r"\b(?:reus(?:e|es|ed|ing))\b", "reuse"),
        (r"\b(?:clusters|workers|jobs|runs|counts|rows|records|templates)\b", lambda m: m[0][:-1]),
    )
    for pattern, replacement in aliases:
        text = re.sub(pattern, replacement, text)
    return text


def _tokens(text):
    return sorted(set(re.findall(r"[a-z][a-z0-9_]*", _normalized(text))) - _STOP)


def _has_contrast(text):
    # A category cannot safely be inferred from a named action that is being
    # negated or contrasted. Do not guess which side of a contrast is the key.
    return bool(re.search(
        r"\b(?:not|no|never|without|avoid(?:s|ed|ing)?|disabl(?:e|es|ed|ing)|"
        r"prevent(?:s|ed|ing)?|rather\s+than|instead\s+of|[a-z]+n['’]t)\b", text))


def _mechanism(text, *, context=""):
    text = _normalized(text)
    scenario = _normalized(context) if context else ""
    if _has_contrast(text):
        return None
    # Require the typed nested representation, not ARRAY storage in general.
    if (re.search(r"\barray\s*(?:<\s*struct\b|of\s+structs?\b)", text)
            and re.search(r"\b(?:store|keep|keeping)\b", text)):
        return "nested_repeated_child_storage"
    if ("bigquery" in text + " " + scenario and re.search(r"\b(?:separate|dedicated)\b", text)
            and "reservation" in text and "baseline" in text
            and re.search(r"\bassign\b.{0,120}\bproject\b", text)):
        # Assigning the storage/data project is a different (usually losing)
        # decision. Do not collapse it into execution-project isolation.
        if re.search(r"\bassign\b.{0,70}\b(?:data|storage) project\b", text):
            return "reservation_storage_project_assignment"
        return "workload_baseline_reservation_isolation"
    # Neither LAG alone nor aggregation alone establishes the repeated decision.
    # The scenario must identify the excess intermediate rows at a join/lookup.
    expansion = bool(re.search(
        r"(?:join output|intermediate row count|intermediate row).{0,65}"
        r"(?:exceed|far above|expan|multip)|(?:row.{0,20}(?:expan|multip))", scenario))
    join_context = bool(re.search(r"\bjoin|\breferences.{0,40}twice|predecessor lookup", scenario))
    rewrite = (bool(re.search(r"\blag\b", text)) and bool(re.search(r"rewrite|replac", text))
               or bool(re.search(r"\bjoin\b", text))
               and bool(re.search(r"summar|smaller result|preaggregat", text)))
    if "bigquery" in scenario and expansion and join_context and rewrite:
        return "rewrite_row_multiplying_join"
    cluster = "cluster" in text
    workflow = bool(re.search(r"workflow|managed cluster|execution|workload|task", text))
    lifecycle = "ephemeral" in text or ("delete" in text and bool(re.search(r"complete|after|end|termination", text)))
    if cluster and lifecycle and (workflow or "job" in text or "run" in text):
        return "job_scoped_cluster_lifecycle"
    distinct = bool(re.search(r"count\s*\(\s*distinct|(?:exact|distinct).{0,45}(?:count|cardinality)|count.{0,45}distinct", text))
    approximate = bool(re.search(r"approx|sketch", text))
    summed = bool(re.search(r"\bsum\b", text))
    if distinct and not approximate and not summed:
        return "exact_distinct_at_target_grain"
    return None


def _distractor_has_contrast(text, mechanism):
    # A false guarantee of "no shuffle" is an effect claimed by a positive
    # keep-the-join alternative, not a negated storage action. Restrict this
    # exception to that exact new family and claim; all old families keep the
    # original broad negation/contrast guard unchanged.
    if (mechanism == "nested_repeated_child_storage"
            and re.search(r"\bkeep separate tables and cluster\b", text)
            and re.search(r"\bguarantee that their joins require no shuffle\b", text)):
        text = text.replace("no shuffle", "zero shuffle")
    return _has_contrast(text)


def _archetype(text, mechanism):
    text = _normalized(text)
    if _distractor_has_contrast(text, mechanism):
        return None
    if mechanism == "nested_repeated_child_storage":
        if re.search(r"\bflatten|\bone row per|\ba row per", text) and re.search(r"repeat|duplicat", text):
            return "flatten_repeating_parent_attributes"
        if re.search(r"\b(?:retain|keep|separate)\b", text) and re.search(r"\bjoins?\b", text):
            return "retain_normalized_child_join"
        if "json" in text and "string" in text:
            return "serialize_children_as_string"
    if mechanism == "workload_baseline_reservation_isolation":
        # These alternatives all retain competition in the same slot pool.
        # Require explicit shared/existing assignments; merely mentioning slots
        # or a reservation is not enough to classify an alternative.
        if (re.search(r"shared reservation|common (?:slot )?pool|both.{0,45}(?:assigned|assignment)|assignments?.{0,25}both projects", text)
                and re.search(r"increas|autoscal|concurrency|commitment|batch priority", text)):
            return "tune_shared_pool_without_isolation"
    if mechanism == "rewrite_row_multiplying_join":
        if re.search(r"\bcluster\b", text) and re.search(r"\btables?\b", text):
            return "cluster_join_inputs"
        if re.search(r"\b(?:raise|increase|larger|additional|more)\b", text) and re.search(r"\bslots?\b", text):
            return "add_slots_to_existing_join"
    if mechanism == "exact_distinct_at_target_grain":
        if re.search(r"approx|sketch", text):
            return "approximate_distinct"
        if re.search(r"\bsum\b", text) and re.search(r"count|distinct|cardinalit|subtotal", text):
            return "sum_partial_counts"
        if re.search(r"count\s*\(\s*\*|count.{0,25}(?:row|record)|(?:row|record).{0,25}count", text) and "distinct" not in text:
            return "count_rows_not_entities"
    if mechanism == "job_scoped_cluster_lifecycle" and "cluster" in text:
        if re.search(r"autoscal|scale.{0,25}(?:worker|zero)|zero.{0,25}worker", text):
            return "autoscale_cluster"
        if re.search(r"stop|restart|suspend|resume", text):
            return "stop_restart_cluster"
        if re.search(r"idle.{0,30}(?:timeout|delete)|(?:delete|timeout).{0,30}idle", text):
            return "idle_timeout_cluster"
        if "manual" in text or "script" in text:
            return "manual_cluster_lifecycle"
        if re.search(r"persistent|reuse|keep|retain|existing", text):
            return "persistent_cluster"
    return None


def _cert(entry):
    values = [entry.get("cert_id"), entry.get("exam")]
    plan = entry.get("decision_plan")
    for item in (entry, _mapping(plan) if plan is not None else {}):
        objective = item.get("objective_id")
        if isinstance(objective, str) and ":standard:" in objective:
            values.append(objective.split(":standard:", 1)[0])
    values = ["machine-learning-engineer" if v == "GCP_PM_ML_ENG" else v for v in values if v is not None]
    if any(not isinstance(v, str) or not v.strip() for v in values) or len(set(values)) > 1:
        raise ValueError("Conflicting or invalid answer-pattern certification provenance")
    return values[0] if values else None


def _actions(entry):
    # Written options take priority over an earlier plan: inspect what was written.
    if "options" in entry or "answers" in entry:
        options = entry.get("options", entry.get("answers"))
        if not isinstance(options, list) or len(options) != 4:
            raise ValueError("Answer-pattern question needs four options")
        options = [_mapping(option) for option in options]
        if "key" in entry:
            labels = [o.get("label") for o in options]
            if (not isinstance(entry["key"], str) or entry["key"] not in tuple("ABCD")
                    or any(not isinstance(label, str) for label in labels) or set(labels) != set("ABCD")):
                raise ValueError("Answer-pattern options need A-D labels and one valid key")
        elif any(type(o.get("is_correct")) is not bool for o in options):
            raise ValueError("Answer-pattern answers need explicit boolean is_correct flags")
        correct, wrong = [], []
        for option in options:
            option = _mapping(option)
            action = option.get("text", option.get("choice_text"))
            _text(action)
            keyed = option.get("label") == entry["key"] if "key" in entry else option.get("is_correct") is True
            (correct if keyed else wrong).append(action)
        if len(correct) != 1:
            raise ValueError("Answer-pattern question needs exactly one correct option")
        return correct[0], wrong, "options" if "options" in entry else "answers"
    if "distractors" in entry:
        return entry.get("key"), entry["distractors"], entry.get("answer_pattern_source", "comparison_row")
    plan = _mapping(entry.get("decision_plan", entry))
    mistakes = plan.get("mistakes")
    if not isinstance(mistakes, list):
        raise ValueError("Answer-pattern plan needs three mistake actions")
    return plan.get("best_action"), [_mapping(m).get("action") for m in mistakes], "decision_plan"


def _pattern(entry):
    action, distractors, source = _actions(entry)
    _text(action)
    if not isinstance(distractors, list) or len(distractors) != 3:
        raise ValueError("Answer-pattern comparison needs three distractor actions")
    plan = _mapping(entry.get("decision_plan", entry))
    context = entry.get("stem") or plan.get("existing_system", "")
    mechanism = _mechanism(action, context=context)
    # Keep lexical content even for canonical actions, for inspectable provenance.
    alternatives = [{"archetype": _archetype(text, mechanism), "tokens": _tokens(text),
                     "has_contrast": _distractor_has_contrast(_normalized(text), mechanism)} for text in distractors]
    key_tokens = _tokens(action)
    if not key_tokens or any(not alt["tokens"] for alt in alternatives):
        raise ValueError("Answer-pattern action has no normalized comparison tokens")
    alternatives.sort(key=lambda item: json.dumps(item, sort_keys=True))
    skeleton = {"version": 1, "mechanism": mechanism, "key_tokens": key_tokens, "distractors": alternatives,
                "has_contrast": _has_contrast(_normalized(action))}
    identity = {"version": 1, "mechanism": mechanism or key_tokens,
                "distractors": sorted([alt["archetype"] or alt["tokens"] for alt in alternatives],
                                      key=lambda item: json.dumps(item, sort_keys=True))}
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {**skeleton, "sha256": digest, "source": source}


def _lexical(a, b, minimum_shared):
    a, b = set(a), set(b)
    if len(a & b) < minimum_shared:
        return 0.0
    return len(a & b) / len(a | b)


def _match(a, b):
    # Otherwise an explicit "Do not COUNT(DISTINCT ...)" could match its
    # positive counterpart through near-identical lexical tokens alone.
    if a["has_contrast"] != b["has_contrast"]:
        return None
    canonical = a["mechanism"] is not None and a["mechanism"] == b["mechanism"]
    if a["mechanism"] is not None and b["mechanism"] is not None and not canonical:
        return None
    key_score = 1.0 if canonical else _lexical(a["key_tokens"], b["key_tokens"], 3)
    if key_score < KEY_THRESHOLD:
        return None
    best = None
    for perm in itertools.permutations(b["distractors"]):
        scores = [0.0 if left["has_contrast"] != right["has_contrast"] else
                  1.0 if left["archetype"] is not None and left["archetype"] == right["archetype"]
                  else _lexical(left["tokens"], right["tokens"], 2)
                  for left, right in zip(a["distractors"], perm)]
        # Known families allow one changed alternative (e.g. HLL vs approximate
        # count). Fallback requires all three alternatives, not only a product.
        required = 2 if canonical else 3
        if sum(score >= DISTRACTOR_THRESHOLD for score in scores) >= required:
            current = {"key_score": key_score, "distractor_scores": sorted(scores),
                       "method": "canonical" if canonical else "lexical"}
            if best is None or sum(scores) > sum(best["distractor_scores"]):
                best = current
    return best


def _identifier(entry, pattern=None):
    ident = entry.get("candidate_id", entry.get("id"))
    if isinstance(ident, str) and ident.strip():
        return ident
    if pattern is None:
        return "unidentified"
    # Do not use the normalized pattern hash as identity: two differently
    # worded plans may share a pattern but must remain separately excludable.
    action, wrong, _ = _actions(entry)
    plan = _mapping(entry.get("decision_plan", entry))
    identity = {"action": action, "wrong": sorted(wrong),
                "objective_id": plan.get("objective_id"),
                "existing_system": plan.get("existing_system", entry.get("stem")),
                "business_consequence": plan.get("business_consequence")}
    digest = hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return "decision-plan:" + digest[:16]


def check_answer_pattern(plan_or_entry, existing, *, cert_id=None, exclude=()):
    """Reject a PDE skeleton repeated in the bank or earlier same-batch entries.

    Accept a bare best_action/mistakes plan, a decision_plan wrapper, a written
    options/key or answers question, or a PDE comparison_row projection. Existing
    entries require cert_id/exam or objective_id provenance. Explicit cert_id may
    scope a bare candidate plan. Exclude uses stored IDs or stable synthetic plan
    IDs returned in matches. Non-PDE certifications are not subject to this gate.
    Incomplete PDE metadata produces a rejecting report, never a guessed pattern.
    """
    result = {"passed": False, "signature": None, "method": METHOD, "matches": [], "errors": [],
              "thresholds": {"key_jaccard": KEY_THRESHOLD, "distractor_jaccard": DISTRACTOR_THRESHOLD}}
    try:
        candidate = _mapping(plan_or_entry)
        if cert_id is not None and (not isinstance(cert_id, str) or not cert_id.strip()):
            raise ValueError("Invalid selected answer-pattern certification")
        own_cert = _cert(candidate)
        if cert_id is not None and own_cert is not None and own_cert != cert_id:
            raise ValueError("Candidate and selected answer-pattern certification disagree")
        selected = cert_id or own_cert
        if selected is None:
            raise ValueError("Missing candidate answer-pattern certification provenance")
        if selected != CERT_ID:
            return {**result, "passed": True, "reason": "Answer-pattern policy does not apply to this certification"}
        pattern = _pattern(candidate)
        result["signature"] = pattern
    except ValueError as exc:
        result["errors"].append({"matched_id": "candidate", "reason": str(exc)})
        return {**result, "reason": "Incomplete or invalid answer-pattern provenance"}
    if isinstance(existing, (str, bytes, Mapping)):
        result["errors"].append({"matched_id": "existing", "reason": "Existing comparisons must be an iterable of entries"})
        return {**result, "reason": "Incomplete or invalid answer-pattern provenance"}
    try:
        existing = iter(existing)
    except TypeError:
        result["errors"].append({"matched_id": "existing", "reason": "Existing comparisons must be an iterable of entries"})
        return {**result, "reason": "Incomplete or invalid answer-pattern provenance"}
    excluded = set(exclude)
    for value in existing:
        ident = "unidentified"
        try:
            entry = _mapping(value)
            ident = _identifier(entry)
            if ident in excluded or entry.get("status") == "RETIRED":
                continue
            provenance = _cert(entry)
            if provenance is None:
                raise ValueError("Missing existing answer-pattern certification provenance")
            if provenance != selected:
                continue
            other = _pattern(entry)
            ident = _identifier(entry, other)
            if ident in excluded:
                continue
            match = _match(pattern, other)
            if match is not None:
                result["matches"].append({"matched_id": ident, "signature": other, **match})
        except ValueError as exc:
            result["errors"].append({"matched_id": ident, "reason": str(exc)})
    result["matches"].sort(key=lambda row: row["matched_id"])
    result["errors"].sort(key=lambda row: (row["matched_id"], row["reason"]))
    result["passed"] = not result["matches"] and not result["errors"]
    result["reason"] = ("Incomplete or invalid answer-pattern provenance" if result["errors"] else
                        "Repeated correct-answer mechanism and distractor skeleton" if result["matches"] else
                        "No repeated answer pattern found by deterministic rules")
    return result
