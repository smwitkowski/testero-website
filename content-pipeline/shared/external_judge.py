"""Canonical external judge requests, sharing the Claude DSPy prompt and schema."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
import uuid

from shared.cli_models import output_model, signature_prompt
from shared.doc_search import documentation_context
from shared.evidence import check_evidence, normalize_whitespace
from shared.model_policy import EXTERNAL_JUDGE_PROVENANCE
from shared.quality_gate import QUESTION_FIELDS, QuestionQualitySignature

EXTERNAL_POLICY_MODEL = "anthropic/claude-sonnet-5.5"
REQUEST_CHARACTER_LIMIT = 150000
QUOTE_WINDOW_MARGIN = 8000
ARGON_QUOTE_WINDOW_MARGIN = 4000
BLIND_ARGON_POLICY = "short_circuit_v2"
EXECUTION_POLICIES = ("short_circuit_v1", BLIND_ARGON_POLICY)


def request_directory(artifact_path):
    path = Path(artifact_path)
    return path.with_name(path.stem + ".judge-requests")


def candidate_id(index, scope, question):
    """Stable content-bound UUID, with index ensuring uniqueness within a plan."""
    content = json.dumps({"index": index, "objective_id": scope["objective_id"],
                          "guide_sha256": scope["guide_sha256"], "question": question},
                         sort_keys=True, ensure_ascii=False, allow_nan=False)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "testero-external:" + content))


def candidate_question(entry):
    """Rebuild the exact cleaned A-key question without cleaning it a second time."""
    from shared.option_order import stored_order
    order = stored_order(entry)
    options = entry.get("options")
    rationales = entry.get("rationales")
    if (not isinstance(options, list) or len(options) != 4
            or any(not isinstance(item, dict) for item in options)
            or sorted(item.get("label", "") for item in options) != list("ABCD")
            or not isinstance(rationales, dict) or set(rationales) != set("ABCD")):
        raise ValueError("External candidate must contain exact A-D options and rationales")
    mapping = {order[item["label"]]: item.get("text") for item in options}
    canonical_rationales = {order[label]: text for label, text in rationales.items()}
    question = {"stem": entry.get("stem")}
    for label, answer, rationale in zip("ABCD", QUESTION_FIELDS[1:5], QUESTION_FIELDS[5:]):
        question[answer], question[rationale] = mapping[label], canonical_rationales[label]
    if any(not isinstance(value, str) or not value.strip() for value in question.values()):
        raise ValueError("External candidate has missing or mistyped question fields")
    return {name: question[name] for name in QUESTION_FIELDS}


REPAIR_FIELDS = {"parent_candidate_id", "attempt", "parent_question_sha256", "question_sha256",
                 "storage_question_id", "original_verdict", "original_verdict_sha256"}
SCOPE_FIELDS = ("cert_id", "domain_code", "objective_id", "guide_sha256", "scenario_moment",
                "opening_style", "question_line", "style_policy", "distractor_evidence")


def canonical_sha256(value):
    """Hash strict sorted JSON independently of file formatting."""
    text = json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def question_sha256(question):
    """Hash only the exact canonical question fields."""
    return canonical_sha256({name: question[name] for name in QUESTION_FIELDS})


def eligible_repair_verdict(raw, *, gate_version=None, distractor_evidence=None, style_policy=None):
    """Require a strict FAIL with intact factual checks and a repairable defect.

    Raises:
        ValueError: The verdict is malformed or is not eligible for repair.
    """
    from shared.cli_models import parse_output
    from shared.distractor_evidence import verdict_gates
    raw = verdict_gates(raw, distractor_evidence)
    from shared.quality_gate import ACCURACY_CHECKS
    from shared.gates import eligible_gate_repair, GATE_SIGNATURES
    if gate_version not in (None, 1, 2):
        raise ValueError("Unsupported repair gate version")
    if gate_version == 2 or (gate_version is None and isinstance(raw, dict) and set(raw) == set(GATE_SIGNATURES)):
        eligible_gate_repair(raw, style_policy=style_policy)
        return
    try:
        parsed = parse_output(json.dumps(raw, allow_nan=False), QuestionQualitySignature)
        allowed = {"distractors_need_knowledge", "constraints_as_wants", "distractors_plausible",
                   "decisions_not_syntax", "scenario_clear", "options_distinct_approaches"}
        if (parsed["verdict"] != "FAIL" or any(parsed[key] is not True for key in ACCURACY_CHECKS if key not in allowed)
                or not any(parsed[key] is False for key in allowed)
                or not 0 <= parsed["score"] <= 1 or not parsed["reason"].strip()):
            raise ValueError("Verdict is not eligible for repair")
    except Exception:
        raise ValueError("Verdict is not eligible for repair") from None


def candidate_storage_id(entry, scope, question):
    """Return a verified content-bound UUID, never a repair label, for storage.

    Raises:
        ValueError: The original ID or repair content binding is invalid.
    """
    expected = candidate_id(entry.get("index"), scope, question)
    if "repair" not in entry:
        if entry.get("candidate_id") != expected:
            raise ValueError("Candidate ID does not match its frozen question")
        return expected
    repair = entry["repair"]
    if (not isinstance(repair, dict) or set(repair) != REPAIR_FIELDS
            or type(repair.get("attempt")) is not int or repair["attempt"] != 1
            or not isinstance(repair.get("parent_candidate_id"), str)
            or entry.get("candidate_id") != repair["parent_candidate_id"] + "-r1"
            or repair.get("question_sha256") != question_sha256(question)
            or repair.get("storage_question_id") != expected
            or not re.fullmatch(r"[0-9a-f]{64}", str(repair.get("parent_question_sha256", "")))
            or repair["parent_question_sha256"] == repair["question_sha256"]
            or repair.get("original_verdict_sha256") != canonical_sha256(repair.get("original_verdict"))):
        raise ValueError("Invalid repair content binding")
    try:
        if str(uuid.UUID(repair["parent_candidate_id"])) != repair["parent_candidate_id"]:
            raise ValueError("Invalid parent UUID")
    except (ValueError, AttributeError):
        raise ValueError("Invalid repair parent UUID") from None
    eligible_repair_verdict(repair["original_verdict"], distractor_evidence=scope.get("distractor_evidence"),
                            style_policy=scope.get("style_policy"))
    return expected


def validate_candidate_records(payload):
    """Validate unique IDs and the sole permitted original/r1 index pair.

    Raises:
        ValueError: IDs, indices, attempts, frozen lineage or verdicts are invalid.
    """
    try:
        _validate_candidate_records(payload)
    except (KeyError, TypeError, ValueError, OverflowError, RecursionError):
        raise ValueError("Invalid candidate records or repair lineage") from None


def _validate_candidate_records(payload):
    entries, plan = payload["candidates"], payload["plan"]
    if not isinstance(entries, list) or not entries or not isinstance(plan, list) or not plan:
        raise ValueError("Invalid candidates or plan")
    from shared.distractor_evidence import validate_policy
    frozen = payload.get("distractor_evidence")
    if "distractor_evidence" in payload:
        validate_policy(frozen)
    for row in [*plan, *entries]:
        if not isinstance(row, dict):
            raise ValueError("Invalid frozen plan or candidate")
        if "distractor_evidence" in payload:
            validate_policy(row.get("distractor_evidence"))
            if row["distractor_evidence"] != frozen:
                raise ValueError("Mixed frozen distractor-evidence modes")
        elif "distractor_evidence" in row:
            raise ValueError("Distractor-evidence mode requires batch provenance")
    by_id, by_index = {}, {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Invalid candidate")
        ident, index = entry.get("candidate_id"), entry.get("index")
        if (not isinstance(ident, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", ident)
                or ident in by_id or type(index) is not int or not 1 <= index <= len(plan)):
            raise ValueError("Duplicate or unsafe IDs or indices")
        if "repair" not in entry and re.search(r"-r[0-9]+$", ident):
            raise ValueError("Repair label without lineage")
        by_id[ident] = entry
        by_index.setdefault(index, []).append(entry)
    attempts = payload.get("repair_attempts", {})
    if not isinstance(attempts, dict):
        raise ValueError("Invalid repair journal")
    required = {"attempt", "status", "candidate_id", "calls_started", "parent_question_sha256",
                "original_verdict_sha256", "parent_entry_sha256"}
    for parent_id, record in attempts.items():
        parent = by_id.get(parent_id)
        if (not isinstance(parent, dict) or "repair" in parent or not isinstance(record, dict)
                or not required <= set(record) <= required | {
                    "reason", "error_class", "gen_effort", "cite_effort",
                    "documentation_context_budget", "citation_documentation_context_budget"}
                or any(not isinstance(record[key], dict) for key in (
                    "documentation_context_budget", "citation_documentation_context_budget") if key in record)
                or any(record[key] not in ("low", "medium", "high")
                       for key in ("gen_effort", "cite_effort") if key in record)
                or type(record["attempt"]) is not int or record["attempt"] != 1
                or record["candidate_id"] != parent_id + "-r1"
                or record["status"] not in ("started", "failed", "unknown", "awaiting_external_judge")
                or type(record["calls_started"]) is not int or not 0 <= record["calls_started"] <= 2
                or any(not isinstance(record[key], str) or not re.fullmatch(r"[0-9a-f]{64}", record[key])
                       for key in ("parent_question_sha256", "original_verdict_sha256", "parent_entry_sha256"))
                or record["parent_question_sha256"] != question_sha256(candidate_question(parent))):
            raise ValueError("Invalid repair journal")
        if record["status"] == "awaiting_external_judge" and record["candidate_id"] not in by_id:
            raise ValueError("Missing completed repair")
    for entry in entries:
        if "repair" not in entry:
            continue
        question, repair = candidate_question(entry), entry["repair"]
        scope = plan[entry["index"] - 1]
        eligible_repair_verdict(repair.get("original_verdict"), gate_version=payload.get("external_judge_version"),
                                distractor_evidence=entry.get("distractor_evidence"), style_policy=scope.get("style_policy"))
        candidate_storage_id(entry, scope, question)
        parent_id = repair["parent_candidate_id"]
        parent, record = by_id.get(parent_id), attempts.get(parent_id)
        if (not isinstance(parent, dict) or "repair" in parent or not isinstance(record, dict)
                or record["status"] != "awaiting_external_judge"
                or parent["index"] != entry["index"] or parent.get("accepted") is not False
                or parent.get("persistence_status") is not None or parent.get("inserted_question_id") is not None
                or parent.get("persistence_validation_failed")
                or any(entry.get(key) != parent.get(key) or parent.get(key) != scope.get(key) for key in SCOPE_FIELDS)
                or any(entry.get(key) != parent.get(key) or parent.get(key) != scope.get(key)
                       for key in ("decision_plan", "decision_proof", "decision_objective", "key_length_rank"))
                or canonical_sha256(entry.get("sources")) != canonical_sha256(parent.get("sources"))):
            raise ValueError("Invalid repair parent or scope")
        parent_question = candidate_question(parent)
        candidate_storage_id(parent, scope, parent_question)
        if (question["correct_answer"] != parent_question["correct_answer"]
                or repair["question_sha256"] == repair["parent_question_sha256"]
                or repair["parent_question_sha256"] != question_sha256(parent_question)
                or repair["original_verdict_sha256"] != canonical_sha256(repair["original_verdict"])
                or record["parent_entry_sha256"] != canonical_sha256(parent)
                or record["parent_question_sha256"] != repair["parent_question_sha256"]
                or record["original_verdict_sha256"] != repair["original_verdict_sha256"]):
            raise ValueError("Repair hashes or frozen answer do not match")
        if (parent.get("external_verdict") is not None
                and canonical_sha256(parent["external_verdict"]) != repair["original_verdict_sha256"]):
            raise ValueError("Stored parent verdict does not match repair snapshot")
        eligible_repair_verdict(repair["original_verdict"], distractor_evidence=scope.get("distractor_evidence"),
                                style_policy=scope.get("style_policy"))
    for group in by_index.values():
        originals = [entry for entry in group if "repair" not in entry]
        repairs = [entry for entry in group if "repair" in entry]
        if len(originals) != 1 or len(repairs) > 1 or len(group) > 2:
            raise ValueError("Only one original and its first repair may share an index")
        if repairs and repairs[0]["repair"]["parent_candidate_id"] != originals[0]["candidate_id"]:
            raise ValueError("Index pair does not match parent")


def _merge_windows(windows):
    merged = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def _source_context(cited, evidence, trimmed_urls, *, margin=QUOTE_WINDOW_MARGIN):
    excerpts, records = [], []
    for source in cited:
        text = source["text"]
        record = {"url": source["url"], "original_text_sha256": source["text_sha256"],
                  "original_characters": len(text), "included_characters": len(text),
                  "trimmed": False, "windows": [[0, len(text)]]}
        if source["url"] not in trimmed_urls:
            excerpts.append(source)
            records.append(record)
            continue
        normalized = normalize_whitespace(text)
        windows = []
        for item in evidence:
            if item["url"] == source["url"]:
                quote = normalize_whitespace(item["quote"])
                start = normalized.index(quote)
                windows.append([max(0, start - margin),
                                min(len(normalized), start + len(quote) + margin)])
        windows = _merge_windows(windows)
        # If the wide windows cover everything, retain the original full fetch.
        if windows == [[0, len(normalized)]]:
            excerpts.append(source)
            records.append(record)
            continue
        excerpt = "\n[... source text omitted ...]\n".join(normalized[start:end] for start, end in windows)
        digest = hashlib.sha256(excerpt.encode()).hexdigest()
        excerpts.append({**source, "text": excerpt, "text_sha256": digest})
        record.update({"trimmed": True, "excerpt_sha256": digest,
                       "normalized_characters": len(normalized),
                       "included_characters": sum(end-start for start, end in windows),
                       "margin": margin, "windows": windows})
        records.append(record)
    enabled = any(record["trimmed"] for record in records)
    metadata = {"enabled": enabled,
                "method": ("largest sources first; wide quote-centered windows in whitespace-normalized fetched text"
                           if enabled else "full cited sources"),
                "character_limit": REQUEST_CHARACTER_LIMIT, "sources": records}
    context = documentation_context(excerpts)
    if enabled:
        context = ("Some cited sources use wide quote-centered excerpts; others retain their full fetched text. "
                   "Omitted context is marked. Text SHA-256 identifies the included text. "
                   "Original fetch hashes and offsets are recorded here: " + json.dumps(records, ensure_ascii=False) +
                   "\n\n" + context)
    return context, metadata


def documentation_context_limit(payload, entry=None):
    """Read a new artifact's frozen cap; absent policy preserves legacy requests."""
    if entry is not None and "documentation_context_policy" in entry:
        policy = entry["documentation_context_policy"]
    elif "documentation_context_policy" in payload:
        policy = payload["documentation_context_policy"]
    else:
        return None
    if (not isinstance(policy, dict) or set(policy) != {"version", "max_chars"}
            or type(policy["version"]) is not int or policy["version"] != 1
            or type(policy["max_chars"]) is not int or policy["max_chars"] <= 0):
        raise ValueError("Invalid documentation-context policy")
    return policy["max_chars"]


def build_request(candidate_id, scope, question, sources, evidence, *, signature=None, gate_version=5,
                  argon_gate=False, execution_policy=None, doc_context_chars=None):
    """Keep the rubric/schema intact; trim only fetched text around verified quotes."""
    if execution_policy is not None and execution_policy not in EXECUTION_POLICIES:
        raise ValueError("Unsupported execution policy")
    if doc_context_chars is not None and (type(doc_context_chars) is not int or doc_context_chars <= 0):
        raise ValueError("Documentation budget must be a positive integer")
    question = {name: question[name] for name in QUESTION_FIELDS}
    checked = check_evidence(evidence, sources)
    if not checked["passed"]:
        raise ValueError("Cannot request external judgment without verified A-D evidence")
    evidence = checked["options"]
    cited_urls = {item["url"] for item in evidence}
    cited = [source for source in sources if source["url"] in cited_urls]
    from shared.gates import gate_signatures, build_gate_inputs
    from shared.objective_style import validate_style_policy, uses_pde_style
    from shared.cert_generation_policy import TUNING_SCOPE_FIELDS
    policy = scope.get("style_policy")
    if "style_policy" in scope:
        validate_style_policy(policy, scope["objective_id"])
        if signature is not None or gate_version != 5:
            raise ValueError("Frozen style policy requires v5 independent gates")
    from shared.distractor_evidence import validate_policy
    frozen_evidence = scope.get("distractor_evidence")
    if "distractor_evidence" in scope:
        validate_policy(frozen_evidence)
        if signature is not None or gate_version != 5:
            raise ValueError("Distractor-evidence policy requires rules-v5 gates")
    signatures = gate_signatures(gate_version, distractor_evidence=frozen_evidence, cert_id=scope.get("cert_id"), style_policy=policy)
    schema = output_model(signature).model_json_schema() if signature is not None else None
    trimmed_urls = set()
    largest_first = sorted(cited, key=lambda source: len(source["text"]), reverse=True)
    before_context_chars = len(documentation_context(cited)) if doc_context_chars is not None else None
    # The optional full Argon review repeats documentation. Only that bundle may
    # retry with smaller, still-wide windows; historical requests keep 8000.
    for count in range(len(largest_first) + 1 + int(argon_gate)):
        tighter_argon = count > len(largest_first)
        if count and not tighter_argon:
            trimmed_urls.add(largest_first[count - 1]["url"])
        context, trimming = _source_context(cited, evidence, trimmed_urls,
            margin=ARGON_QUOTE_WINDOW_MARGIN if tighter_argon else QUOTE_WINDOW_MARGIN)
        if doc_context_chars is not None:
            # The frozen 150k bundle bound and fixed quote windows stay intact.
            # A smaller configured doc cap may veto, never silently narrow receipts.
            if len(context) > doc_context_chars:
                continue
            trimming["documentation_context_budget"] = {
                "version": 1, "max_chars": doc_context_chars,
                "before_chars": before_context_chars, "after_chars": len(context),
                "pages": trimming["sources"], "selection": "frozen_external_quote_windows"}
        if signature is not None:
            inputs = {"question_data": question, "domain_context": scope["domain_prompt"],
                      "documentation_context": context, "option_evidence": evidence}
            request = {"candidate_id": candidate_id, "objective_id": scope["objective_id"],
                       "judge_prompt": signature_prompt(signature, inputs),
                       "verdict_schema": schema, "trimming": trimming}
        else:
            from shared.question_style import RULES_V4_STYLE_INSTRUCTIONS
            inputs = build_gate_inputs(question, scope["domain_prompt"], context, evidence,
                                       style_reference=RULES_V4_STYLE_INSTRUCTIONS if gate_version == 4 else None,
                                       style_policy=policy)
            request = {"candidate_id": candidate_id, "objective_id": scope["objective_id"],
                       "gate_version": gate_version,
                       "decision_provenance_sha256": canonical_sha256({name: scope.get(name) for name in
                           (("decision_objective", "decision_plan", "decision_proof", "key_length_rank")
                            + (TUNING_SCOPE_FIELDS if uses_pde_style(policy) else ()))}),
                       "gates": {name: {"judge_prompt": signature_prompt(gate_signature, inputs[name]),
                                        "verdict_schema": output_model(gate_signature).model_json_schema()}
                                 for name, gate_signature in signatures.items()},
                       "trimming": trimming}
        if execution_policy is not None:
            if signature is not None:
                raise ValueError("Short circuit requires independent gates")
            request["execution_policy"] = execution_policy
        if frozen_evidence is not None:
            request["distractor_evidence"] = dict(frozen_evidence)
        if policy is not None:
            request["style_policy"] = policy
        if argon_gate:
            if signature is not None or gate_version != 5:
                raise ValueError("Argon requires rules-v5 independent gate requests")
            from shared.argon_gate import build_argon_request
            request["argon"] = build_argon_request(
                question, scope, context, evidence,
                review_only=execution_policy == "short_circuit_v1",
                version=3 if execution_policy == BLIND_ARGON_POLICY else None)
        if len(json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False)) + 1 <= REQUEST_CHARACTER_LIMIT:
            return request
    raise ValueError("External request exceeds the character bound even with wide quote-centered excerpts")


def require_publishable_request(request):
    """Require the v6 blind-Argon request policy, not a passing verdict.

    Publishers must also rebuild/hash-bind the frozen request and strictly
    evaluate every raw verdict. Legacy requests remain valid for DRAFT ingest.

    Raises:
        ValueError: The request lacks the versioned v6 council contract.
    """
    from shared.argon_gate import validate_request
    from shared.cli_models import CLISchemaError
    from shared.gates import gate_signatures
    try:
        if (not isinstance(request, dict)
                or request.get("execution_policy") != BLIND_ARGON_POLICY
                or type(request.get("gate_version")) is not int or request["gate_version"] != 5
                or request.get("council_canary") is True
                or not isinstance(request.get("gates"), dict)):
            raise ValueError()
        argon = request["argon"]
        validate_request(argon)
        if argon["version"] != 3:
            raise ValueError()
        signatures = gate_signatures(5, distractor_evidence=request.get("distractor_evidence"),
            cert_id=request["objective_id"].split(":", 1)[0], style_policy=request.get("style_policy"))
        if set(request["gates"]) != set(signatures):
            raise ValueError()
        for name, signature in signatures.items():
            gate = request["gates"][name]
            if (not isinstance(gate, dict) or set(gate) != {"judge_prompt", "verdict_schema"}
                    or not isinstance(gate["judge_prompt"], str) or not gate["judge_prompt"].strip()
                    or gate["verdict_schema"] != output_model(signature).model_json_schema()):
                raise ValueError()
    except (KeyError, TypeError, ValueError, AttributeError, CLISchemaError):
        raise ValueError("Publishing requires short_circuit_v2 with separate blind Argon v3 and all strict gate schemas") from None


def _validate_retrieval_metadata(metadata, plan):
    """Validate optional v3 retrieval provenance, not the proof verdict."""
    from shared.doc_claims import plan_claims
    from shared.doc_retrieval import RetrievalConfig
    fields = {"version", "claims", "config", "budget_chars", "context_chars",
              "estimated_doc_tokens", "objective_prefix_sha256", "chunk_ids"}
    if not isinstance(metadata, dict) or set(metadata) != fields or type(metadata["version"]) is not int or metadata["version"] != 3:
        raise ValueError("Invalid retrieval metadata")
    config = metadata["config"]
    if (not isinstance(config, dict) or set(config) != set(RetrievalConfig.__dataclass_fields__)
            or any(type(config[key]) is not int for key in ("chunk_chars", "overlap", "top_k", "neighbors"))
            or type(config["sections"]) is not bool or not isinstance(config["query_mode"], str)):
        raise ValueError("Invalid retrieval configuration")
    RetrievalConfig(**config)
    if (any(type(metadata[key]) is not int for key in ("budget_chars", "context_chars", "estimated_doc_tokens"))
            or metadata["budget_chars"] < 4000 or metadata["context_chars"] < 0
            or metadata["estimated_doc_tokens"] != (metadata["context_chars"] + 3) // 4
            or not isinstance(metadata["objective_prefix_sha256"], str)
            or not re.fullmatch(r"[0-9a-f]{64}", metadata["objective_prefix_sha256"])):
        raise ValueError("Invalid retrieval context metadata")
    ids = metadata["chunk_ids"]
    if (not isinstance(ids, list) or any(not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{24}", value) for value in ids)):
        raise ValueError("Invalid retrieval chunk IDs")
    claims = metadata["claims"]
    expected = plan_claims(plan) if config["query_mode"] == "claims" else []
    if not isinstance(claims, list) or len(claims) != len(expected):
        raise ValueError("Invalid retrieval claims")
    for row, claim in zip(claims, expected):
        if (not isinstance(row, dict) or set(row) != {"claim", "chunk_ids"} or row["claim"] != claim
                or not isinstance(row["chunk_ids"], list) or len(row["chunk_ids"]) > 3
                or any(not isinstance(value, str) or value not in ids for value in row["chunk_ids"])):
            raise ValueError("Invalid retrieval claim provenance")


def validate_decision_provenance(scope, entry):
    """Validate a frozen v4 decision and the original docs veto offline.

    Raises:
        ValueError: Typed plan, selected objective or verified proof is invalid.
    """
    from shared.decision_planner import DecisionPlan, decision_proof_signature
    from shared.distractor_evidence import validate_policy
    from shared.cli_models import parse_output
    try:
        if (type(scope.get("key_length_rank")) is not int or not 1 <= scope["key_length_rank"] <= 4
                or entry.get("key_length_rank") != scope["key_length_rank"]
                or scope.get("decision_objective") != {"objective_id": scope["objective_id"],
                                                       "objective_text": scope["objective_text"]}
                or any(entry.get(name) != scope.get(name) for name in
                       ("decision_objective", "decision_plan", "decision_proof"))):
            raise ValueError()
        plan = DecisionPlan.model_validate(scope["decision_plan"]).model_dump()
        if plan["objective_id"] != scope["objective_id"]:
            raise ValueError()
        actions = [plan["best_action"], *(mistake["action"] for mistake in plan["mistakes"])]
        if len(set(action.casefold() for action in actions)) != 4:
            raise ValueError()
        proof = scope["decision_proof"]
        policy = scope.get("distractor_evidence")
        if "distractor_evidence" in scope:
            validate_policy(policy)
            validate_policy(proof.get("distractor_evidence"))
            validate_policy(entry["decision_proof"].get("distractor_evidence"))
            if entry.get("distractor_evidence") != policy or proof.get("distractor_evidence") != policy:
                raise ValueError()
        elif "distractor_evidence" in proof or "distractor_evidence" in entry:
            raise ValueError()
        signature = decision_proof_signature(policy)
        output_fields = set(signature.output_fields)
        if not isinstance(proof, dict) or set(proof) != output_fields | {"passed", "mechanical_check"} | ({"distractor_evidence"} if policy is not None else set()) | ({"retrieval"} if "retrieval" in proof else set()):
            raise ValueError()
        if "retrieval" in proof:
            _validate_retrieval_metadata(proof["retrieval"], plan)
        parsed = parse_output(json.dumps({name: proof[name] for name in output_fields}, allow_nan=False), signature)
        if (proof["passed"] is not True or not parsed["reason"].strip()
                or any(parsed[name] is not True for name in
                       ("supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas"))):
            raise ValueError()
        receipts = [{name: row[name] for name in ("option_label", "url", "quote")} for row in parsed["reasons"]]
        checked = check_evidence(receipts, entry["sources"])
        if (not checked["passed"] or proof["mechanical_check"] != {"passed": True, "errors": []}):
            raise ValueError()
    except Exception:
        raise ValueError("Invalid frozen decision plan or docs veto proof") from None
