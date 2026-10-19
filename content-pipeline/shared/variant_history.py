"""Offline, history-only replay of frozen variant judgments.

History is a conservative dedupe input, not a new serving approval. In particular,
round 2 predates option-rewrite/shortest-key and batch industry-allocation rules.
Rebuilding its requests with today's writer/reviewer would silently lose accepted
scenarios. Instead bind the saved DSPy inputs to the actual content and receipts,
and replay the original v5 gates (including the then-valid v5.1 style waiver).
Round4 artifacts use a lazy current report replay for their strict style and
reviewed-sibling/prior-history policy, plus independent request/gate verification.
No saved candidate accepted flag or report accepted-ID list is used as sole proof.
"""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

HISTORY_POLICY = "frozen_v5_history_v1"
ROUND4_HISTORY_POLICY = "frozen_v5_round4_history_v1"
HISTORY_NOTE = (
    "History-only comparison rows, not publication approval. Frozen v5 gates use "
    "their original style policy, including the historical v5.1 allowance waiver. "
    "Later option-rewrite, shortest-key, industry-allocation and strict variant "
    "style rules are not applied retroactively."
)
ROUND4_HISTORY_NOTE = (
    "History-only comparison rows, not publication approval. Round4 acceptance "
    "replays strict variant style, frozen prior history, and reviewed sibling "
    "eligibility through the offline report, plus independent request/gate binding."
)


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate history JSON key")
        result[key] = value
    return result


def _json(text):
    return json.loads(text, object_pairs_hook=_pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(
                          ValueError("Non-finite history JSON number")))


def _read(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"History input must be a regular, non-symlink file: {path}")
    raw = path.read_bytes()
    return _json(raw), hashlib.sha256(raw).hexdigest()


def _inputs(call):
    """Read only DSPy's frozen USER input fields, never the system placeholders."""
    prompt = call["judge_prompt"]
    if prompt.count("\n\nUSER:\n") != 1:
        raise ValueError("Unsupported frozen DSPy request")
    user = prompt.split("\n\nUSER:\n", 1)[1]
    tail = "\n\nRespond with a JSON object in the following order of fields:"
    if tail not in user:
        raise ValueError("Unsupported frozen DSPy response instructions")
    user = user.rsplit(tail, 1)[0]
    markers = list(re.finditer(r"(?m)^\[\[ ## ([a-z_]+) ## \]\]\n", user))
    result = {}
    for index, match in enumerate(markers):
        name = match.group(1)
        if name in result:
            raise ValueError("Repeated frozen DSPy input")
        end = markers[index + 1].start() if index + 1 < len(markers) else len(user)
        value = user[match.end():end].rstrip("\n")
        result[name] = _json(value) if name in ("question_data", "options", "option_evidence") else value
    return result


def _request_path(artifact, entry):
    meta = entry["external_judge_request"]
    given = Path(meta["path"])
    if (given.is_absolute() or ".." in given.parts
            or given.name != entry["candidate_id"] + ".json"):
        raise ValueError("Unsafe historical request path")
    path = artifact.parent / given
    if (not path.resolve().is_relative_to(artifact.parent)
            or any(p.is_symlink() for p in (path, *path.parents))):
        raise ValueError("Unsafe historical request path")
    request, digest = _read(path)
    if digest != meta.get("sha256"):
        raise ValueError("Historical request hash mismatch")
    return path, request, digest


def _lineage(payload, entry):
    # Imports stay lazy: variants' parent replay imports the ingest coordinator.
    from shared.external_judge import (candidate_question, candidate_storage_id,
                                      canonical_sha256, validate_decision_provenance)
    from shared.variants import parent_snapshot, SKELETON_FIELDS, family_threshold
    from shared.option_order import canonical_evidence
    from shared.evidence import check_evidence
    from shared.validator import validate_question

    index = entry["index"]
    if type(index) is not int or not 1 <= index <= len(payload["plan"]):
        raise ValueError("Invalid historical plan index")
    scope = payload["plan"][index - 1]
    for field in ("cert_id", "domain_code", "objective_id", "guide_sha256",
                  "scenario_moment", "opening_style", "question_line", "style_policy"):
        if entry.get(field) != scope.get(field):
            raise ValueError("Historical candidate differs from frozen scope")
    if scope["cert_id"] != payload["cert_id"]:
        raise ValueError("Historical certification mismatch")
    validate_decision_provenance(scope, entry)
    question = candidate_question(entry)
    candidate_storage_id(entry, scope, question)
    if not validate_question(question, industry_only=True).is_valid:
        raise ValueError("Historical candidate schema failed")
    meta = entry["variant"]
    fields = {"version", "parent_question_id", "parent_snapshot_sha256",
              "decision_sha256", "ordinal", "surface"}
    if not isinstance(meta, dict) or set(meta) not in (
            fields | {"family_stem_threshold"}, fields | {"parent_stem_threshold"}):
        raise ValueError("Invalid historical variant metadata")
    if (type(meta["version"]) is not int or meta["version"] != 1
            or type(meta["ordinal"]) is not int or meta["ordinal"] < 1
            or entry["parent_question_id"] != meta["parent_question_id"]):
        raise ValueError("Invalid historical variant origin")
    if "family_stem_threshold" in meta:
        if family_threshold(meta["family_stem_threshold"]) != payload.get("family_stem_threshold"):
            raise ValueError("Historical family policy mismatch")
    elif meta["parent_stem_threshold"] != .20 or "family_stem_threshold" in payload:
        raise ValueError("Invalid historical family policy")
    parent = payload["variant_parents"][entry["parent_question_id"]]
    if meta["parent_snapshot_sha256"] != canonical_sha256(parent):
        raise ValueError("Historical parent snapshot hash mismatch")
    original = parent["entry"]
    parent_payload = {**parent["policy"], "plan": [parent["scope"]] * original["index"]}
    verified = parent_snapshot(parent_payload, original, [parent["published"]],
                               persistence=parent["persistence"])
    evidence = canonical_evidence(entry)
    if (any(parent[name] != verified[name] for name in ("question", "evidence", "sources"))
            or parent["question_id"] != entry["parent_question_id"]
            or meta["decision_sha256"] != canonical_sha256(parent["scope"]["decision_plan"])
            or any(entry.get(name) != parent["scope"].get(name) for name in SKELETON_FIELDS)
            or entry["sources"] != parent["sources"] or evidence != parent["evidence"]):
        raise ValueError("Historical decision/source/receipt binding changed")
    surface = meta["surface"]
    if (not isinstance(surface, dict) or set(surface) != {"industry", "setting"}
            or any(not isinstance(value, str) or not value.strip() for value in surface.values())
            or surface["industry"] != scope.get("industry")
            or scope.get("variant_origin") != {"parent_question_id": parent["question_id"], "ordinal": meta["ordinal"]}
            or scope["objective_id"] != parent["scope"]["objective_id"]
            or scope["opening_style"] == parent["scope"]["opening_style"]
            or scope["scenario_moment"] == parent["scope"]["scenario_moment"]):
        raise ValueError("Historical surface/scope binding changed")
    checked = check_evidence(evidence, entry["sources"])
    if not checked["passed"] or checked["options"] != evidence:
        raise ValueError("Historical receipts failed validation")
    return scope, question, parent, evidence


def _bind_request(payload, entry, scope, question, parent, evidence, request):
    from shared.external_judge import canonical_sha256, _source_context
    from shared.gates import gate_signatures, build_gate_inputs
    from shared.cli_models import output_model
    from shared.argon_gate import validate_request
    from shared.objective_style import validate_style_policy, policy_instructions

    policy = scope.get("style_policy")
    if payload.get("style_policy_version") == "5.1":
        validate_style_policy(policy, scope["objective_id"])
    elif policy is not None:
        raise ValueError("Historical style policy lacks batch provenance")
    if (request.get("candidate_id") != entry["candidate_id"]
            or request.get("objective_id") != scope["objective_id"]
            or request.get("gate_version") != 5
            or request.get("execution_policy") != payload["execution_policy"]
            or request.get("style_policy") != policy
            or request.get("distractor_evidence") != scope.get("distractor_evidence")
            or request.get("decision_provenance_sha256") != canonical_sha256({
                name: scope.get(name) for name in
                ("decision_objective", "decision_plan", "decision_proof", "key_length_rank")})):
        raise ValueError("Historical request identity/policy mismatch")
    signatures = gate_signatures(5, distractor_evidence=scope.get("distractor_evidence"),
                                 cert_id=scope["cert_id"])
    if set(request["gates"]) != set(signatures):
        raise ValueError("Historical request requires three gates")
    for name, signature in signatures.items():
        if request["gates"][name]["verdict_schema"] != output_model(signature).model_json_schema():
            raise ValueError("Unsupported historical gate schema")
    validate_request(request["argon"])
    if request["argon"]["version"] != 2:
        raise ValueError("Historical variants require full Argon review")
    inputs = {name: _inputs(call) for name, call in request["gates"].items()}
    review = _inputs(request["argon"]["calls"]["review"])
    learner = build_gate_inputs(question, "", "", evidence)["blind_solver"]
    if (inputs["blind_solver"] != learner
            or {key: inputs["style"].get(key) for key in learner} != learner
            or set(inputs["style"]) != {*learner, "style_reference"}
            or inputs["evidence"].get("question_data") != question
            or inputs["evidence"].get("option_evidence") != evidence
            or set(inputs["evidence"]) != {"question_data", "option_evidence", "documentation_context", "domain_context"}
            or set(review) != {*inputs["evidence"], "style_reference"}
            or any(review[name] != value for name, value in inputs["evidence"].items())
            or not review["style_reference"].strip()
            or inputs["style"]["style_reference"] != review["style_reference"] + policy_instructions(policy)):
        raise ValueError("Historical request question/receipt inputs changed")
    context = inputs["evidence"]["domain_context"]
    frozen_parent = {"parent_stem": parent["question"]["stem"],
                     "decision_plan": parent["scope"]["decision_plan"], "variant": entry["variant"]}
    if (not context.startswith(scope["domain_prompt"] + "\n\nVARIANT INVARIANTS:")
            or "Frozen parent:\n" not in context
            or _json(context.rsplit("Frozen parent:\n", 1)[1]) != frozen_parent):
        raise ValueError("Historical request parent/context inputs changed")
    trimming = request["trimming"]
    records = trimming["sources"]
    trimmed = {record["url"] for record in records if record["trimmed"]}
    margins = {record["margin"] for record in records if record["trimmed"]}
    if len(margins) > 1:
        raise ValueError("Unsupported mixed historical excerpt margins")
    cited = {item["url"] for item in evidence}
    sources = [source for source in entry["sources"] if source["url"] in cited]
    docs, rebuilt = _source_context(sources, evidence, trimmed, **({"margin": margins.pop()} if margins else {}))
    if rebuilt != trimming or inputs["evidence"]["documentation_context"] != docs:
        raise ValueError("Historical request documentation changed")


def _historical_duplicate(entry, existing, parent, siblings):
    """Freeze the old all-written-siblings cohort, including rejected siblings."""
    from shared.near_duplicates import comparison_row, check_near_duplicate, similarity
    from shared.variants import family_threshold
    meta = entry["variant"]
    threshold = family_threshold(meta.get("family_stem_threshold", meta.get("parent_stem_threshold")))
    family = {parent["question_id"]: comparison_row(parent["entry"])}
    for sibling in siblings:
        if sibling.get("parent_question_id") == parent["question_id"] and sibling.get("options"):
            family[sibling["candidate_id"]] = comparison_row(sibling)
    for row in existing:
        if row.get("parent_question_id") == parent["question_id"]:
            family[row["id"]] = row
    result = check_near_duplicate(entry, existing, exclude=(*family, entry["candidate_id"]))
    row = comparison_row(entry)
    return result["passed"] and all(
        similarity(row["stem"], row["key"], other["stem"], other["key"])["stem_score"] < threshold
        for ident, other in family.items() if ident != entry["candidate_id"])


def _load_prior_variants(paths):
    """Return JSON-serializable frozen ``{artifacts: [...], questions: [...]}``.

    Paths must be absolute artifact JSON paths. Their sibling ``<stem>.verdicts``
    directories must contain a verdict for every exported request. Missing or
    malformed evidence blocks the load rather than silently dropping history.
    Repeated artifact paths and conflicting repeated accepted IDs are rejected.
    Identical rows from distinct artifacts retain their separate provenance.
    No models, retrieval, database access or writes occur. Legacy requests are
    not rebuilt; round4 also uses the coordinator's current request validation.
    """
    from shared.external_judge import validate_candidate_records
    from shared.near_duplicates import comparison_row
    from shared.gates import aggregate_gate_verdict
    from shared.argon_gate import evaluate_argon, MODEL
    from shared.quality_gate import require_independent_models
    from shared.distractor_evidence import verdict_gates, verdict_with_policy

    if isinstance(paths, (str, Path)):
        raise ValueError("History paths must be an iterable of absolute paths")
    result = {"artifacts": [], "questions": []}
    seen_paths, seen_ids = set(), {}
    for given in paths:
        path = Path(given)
        if not path.is_absolute() or path.suffix != ".json" or path.is_symlink():
            raise ValueError("History requires absolute, non-symlink JSON artifact paths")
        path = path.resolve()
        if str(path) in seen_paths:
            raise ValueError("Repeated history artifact path")
        seen_paths.add(str(path))
        payload, digest = _read(path)
        if (payload.get("variant_mode") != 1 or payload.get("rules_version") != 5
                or payload.get("external_judge_version") != 2 or payload.get("argon_gate") is not True
                or payload.get("execution_policy") != "short_circuit_v1"):
            raise ValueError("Unsupported historical variant policy")
        validate_candidate_records(payload)
        versions = {scope.get("variant_policy_version", 3) for scope in payload["plan"]}
        if versions not in ({3}, {4}):
            raise ValueError("Mixed or unsupported historical variant presentation policies")
        round4 = versions == {4}
        require_independent_models(payload["model"], "claude")
        require_independent_models(payload["model"], MODEL)
        verdict_dir = path.with_suffix(".verdicts")
        if not verdict_dir.is_dir() or verdict_dir.is_symlink():
            raise ValueError("Missing or unsafe historical verdict directory")
        report_ids = None
        if round4:
            # Lazy import avoids the coordinator -> generator -> history cycle.
            # Its reviewed-sibling/prior-family policy is part of round4 acceptance.
            from scripts.variants_ab import report
            report_ids = set(report(path, verdict_dir)["accepted_variant_ids"])
        provenance = {"path": str(path), "sha256": digest,
                      "policy": ROUND4_HISTORY_POLICY if round4 else HISTORY_POLICY,
                      "note": ROUND4_HISTORY_NOTE if round4 else HISTORY_NOTE,
                      "accepted_variant_ids": [], "judgments": []}
        for entry in payload["candidates"]:
            if not entry.get("external_judge_request"):
                if entry.get("accepted") is True:
                    raise ValueError("Historical acceptance has no saved request")
                continue
            scope, question, parent, evidence = _lineage(payload, entry)
            request_path, request, request_digest = _request_path(path, entry)
            _bind_request(payload, entry, scope, question, parent, evidence, request)
            raw_path = verdict_dir / (entry["candidate_id"] + ".json")
            raw, verdict_digest = _read(raw_path)
            policy = scope.get("distractor_evidence")
            gates = verdict_gates(raw, policy)
            if not isinstance(gates, dict) or set(gates) != {"style", "evidence", "blind_solver", "argon"}:
                raise ValueError("Historical judgment requires all four gates")
            base = {name: gates[name] for name in ("style", "evidence", "blind_solver")}
            decision = aggregate_gate_verdict(question, verdict_with_policy(base, policy), version=5,
                style_policy=scope.get("style_policy"), distractor_evidence=policy, variant=round4)
            if gates["argon"] == {"status": "skipped", "reason": "prior_gate_failed"}:
                if decision.passed:
                    raise ValueError("Historical Argon skip cannot approve content")
                argon_passed = False
            else:
                argon_passed, _ = evaluate_argon(question, gates["argon"], request["argon"])
            others = payload["existing_questions"]["questions"] + [comparison_row(other)
                for other in payload["candidates"] if other is not entry and other.get("variant") and other.get("options")]
            duplicate_passed = (entry["candidate_id"] in report_ids if round4 else
                                _historical_duplicate(entry, others, parent, payload["candidates"]))
            accepted = decision.passed and argon_passed and duplicate_passed
            provenance["judgments"].append({"candidate_id": entry["candidate_id"],
                "request_path": str(request_path), "request_sha256": request_digest,
                "verdict_path": str(raw_path), "verdict_sha256": verdict_digest,
                "accepted": accepted})
            if not accepted:
                continue
            row = {**comparison_row(entry), "parent_question_id": entry["parent_question_id"],
                   "industry": scope["industry"], "source_artifact_path": str(path),
                   "source_artifact_sha256": digest}
            content = {name: row[name] for name in ("stem", "key", "parent_question_id", "industry")}
            if row["id"] in seen_ids and seen_ids[row["id"]] != content:
                raise ValueError("Conflicting accepted history question ID")
            seen_ids[row["id"]] = content
            provenance["accepted_variant_ids"].append(row["id"])
            result["questions"].append(row)
        # A concurrent offline rewrite must not produce mismatched artifact rows.
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError("Historical artifact changed during replay")
        result["artifacts"].append(provenance)
    from shared.external_judge import canonical_sha256
    result["snapshot_sha256"] = canonical_sha256(result)
    validate_prior_variants(result)
    return deepcopy(result)


def _validate_prior_variants(history):
    """Validate a frozen history snapshot without opening any source paths.

    Return the validated mapping. The digest detects accidental edits; it is not
    a signature or a substitute for ``load_prior_variants``' original replay.
    """
    from shared.external_judge import canonical_sha256
    from shared.near_duplicates import tokens

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def digest(value):
        return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None

    def absolute(value):
        return text(value) and Path(value).is_absolute() and ".." not in Path(value).parts

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    require(isinstance(history, dict) and set(history) == {"artifacts", "questions", "snapshot_sha256"},
            "Invalid frozen variant history structure")
    require(isinstance(history["artifacts"], list) and isinstance(history["questions"], list),
            "Frozen variant history requires artifact and question lists")
    require(digest(history["snapshot_sha256"]) and history["snapshot_sha256"] == canonical_sha256({
        name: history[name] for name in ("artifacts", "questions")}), "Frozen variant history hash mismatch")
    artifacts, expected_rows = {}, set()
    for artifact in history["artifacts"]:
        require(isinstance(artifact, dict) and set(artifact) == {
            "path", "sha256", "policy", "note", "accepted_variant_ids", "judgments"},
            "Invalid frozen history artifact")
        path = artifact["path"]
        require(absolute(path) and Path(path).suffix == ".json" and path not in artifacts
                and digest(artifact["sha256"])
                and (artifact["policy"], artifact["note"]) in (
                    (HISTORY_POLICY, HISTORY_NOTE), (ROUND4_HISTORY_POLICY, ROUND4_HISTORY_NOTE)),
                "Invalid frozen history artifact provenance")
        require(isinstance(artifact["accepted_variant_ids"], list) and all(text(i) for i in artifact["accepted_variant_ids"])
                and len(set(artifact["accepted_variant_ids"])) == len(artifact["accepted_variant_ids"])
                and isinstance(artifact["judgments"], list), "Invalid frozen history accepted IDs")
        judged, accepted = set(), []
        for judgment in artifact["judgments"]:
            require(isinstance(judgment, dict) and set(judgment) == {
                "candidate_id", "request_path", "request_sha256", "verdict_path", "verdict_sha256", "accepted"},
                "Invalid frozen historical judgment")
            ident = judgment["candidate_id"]
            require(text(ident) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", ident) is not None
                    and ident not in judged and type(judgment["accepted"]) is bool
                    and digest(judgment["request_sha256"]) and digest(judgment["verdict_sha256"])
                    and absolute(judgment["request_path"]) and absolute(judgment["verdict_path"])
                    and Path(judgment["request_path"]).name == ident + ".json"
                    and Path(judgment["request_path"]).is_relative_to(Path(path).parent)
                    and Path(judgment["verdict_path"]) == Path(path).with_suffix(".verdicts") / (ident + ".json"),
                    "Invalid frozen historical judgment provenance")
            judged.add(ident)
            if judgment["accepted"]:
                accepted.append(ident)
        require(accepted == artifact["accepted_variant_ids"], "Frozen historical acceptance disagrees with judgments")
        artifacts[path] = artifact
        expected_rows.update((path, ident) for ident in accepted)
    seen_rows, content_by_id = set(), {}
    fields = {"id", "stem", "key", "parent_question_id", "industry", "source_artifact_path", "source_artifact_sha256"}
    for row in history["questions"]:
        require(isinstance(row, dict) and set(row) in (fields, fields | {"cert_id"})
                and all(text(row[name]) for name in fields)
                and ("cert_id" not in row or text(row["cert_id"])), "Invalid frozen historical question row")
        tokens(row["stem"]); tokens(row["key"])
        pair = (row["source_artifact_path"], row["id"])
        require(pair in expected_rows and pair not in seen_rows
                and row["source_artifact_sha256"] == artifacts[pair[0]]["sha256"],
                "Frozen historical question provenance mismatch")
        content = {name: row.get(name) for name in ("stem", "key", "parent_question_id", "industry", "cert_id")}
        require(row["id"] not in content_by_id or content_by_id[row["id"]] == content,
                "Conflicting frozen historical question ID")
        content_by_id[row["id"]] = content
        seen_rows.add(pair)
    require(seen_rows == expected_rows, "Missing frozen accepted historical question rows")
    return history


def load_prior_variants(paths):
    """Load absolute prior artifact paths and replay saved judgments offline.

    Return ``{artifacts, questions, snapshot_sha256}``. Malformed, incomplete or
    changed evidence raises ValueError; no history is silently dropped.
    """
    from shared.cli_models import CLISchemaError
    try:
        return _load_prior_variants(paths)
    except (CLISchemaError, KeyError, TypeError, OSError, UnicodeError, StopIteration) as error:
        raise ValueError(f"Invalid historical variant evidence ({type(error).__name__}): {error}") from error


def validate_prior_variants(history):
    """Return a structurally/hash-validated snapshot, without source-file reads.

    Raises ValueError for malformed snapshots or inconsistent provenance. The
    snapshot digest detects edits; it is not an authorization signature.
    """
    try:
        return _validate_prior_variants(history)
    except (KeyError, TypeError, UnicodeError) as error:
        raise ValueError(f"Invalid frozen variant history ({type(error).__name__})") from error
