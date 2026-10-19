#!/usr/bin/env python3
"""Offline founder-approved variant SQL export; no database or model calls."""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
import sys

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.generate_pmle_questions import persist_candidate
from scripts.ingest_external_verdicts import (_validate_candidate,
    _external_decision, _run_id, _pairs)
from shared.external_judge import EXTERNAL_JUDGE_PROVENANCE
from shared.cli_models import CLISchemaError

ARTIFACT_NAMES = {2: "ab-six-industry-live.json", 3: "ab-six-r3-live.json", 4: "ab-six-r4-live.json"}
ROUND5_ARTIFACT = "repair-r5-live.json"
ROUND5_WINNERS = (
    ("d4b10e1f-bfe3-51d6-b74b-4481d2207d19", "a31d11b8-8dd5-55ed-9ba4-a4b4e8400bcf", "hospital operations"),
    ("5fe281b2-b348-5829-ad5a-80de90cd4235", "57b9d0c7-8d93-5858-a699-4fc0afeae507", "public transit"),
)



class RecordingClient:
    """Capture the existing persistence projection without constructing a DB client."""
    def __init__(self):
        self.question = None
        self.answers = []
        self.explanation = None

    def insert_question(self, row):
        self.question = deepcopy(row)
        return {"id": row["id"]}

    def insert_answers_batch(self, rows):
        self.answers = deepcopy(rows)
        return rows

    def insert_explanation(self, row):
        self.explanation = deepcopy(row)
        return {"id": "offline-explanation"}

    def update_question_review(self, ident, run_id, status, notes):
        if ident != self.question["id"] or run_id != self.question["generation_run_id"]:
            raise ValueError("Persistence projection identity changed")
        self.question.update(review_status=status, review_notes=notes)
        return True


def approvals(review_text):
    marker = "**Publish now: 13 variants.**"
    if review_text.count(marker) != 1:
        raise ValueError("Expected one explicit publish-now table")
    section = review_text.split(marker, 1)[1].split("**Dropped", 1)[0]
    result = []
    for line in section.splitlines():
        if not re.match(r"\| [0-9a-f]{8} \(", line):
            continue
        parent = re.match(r"\| ([0-9a-f]{8})", line).group(1)
        for round_no, prefix in re.findall(r"\br([234]) ([0-9a-f]{8})\b", line):
            result.append({"round": int(round_no), "prefix": prefix, "parent_prefix": parent})
    if len(result) != 13 or len({row["prefix"] for row in result}) != 13:
        raise ValueError("Publish-now table must resolve exactly 13 unique approvals")
    return result


def strict_json(raw):
    """Parse the exact hashed bytes with the ingest path's strict JSON rules."""
    def invalid_constant(_):
        raise ValueError("Non-finite source JSON")
    return json.loads(raw.decode("utf-8"), object_pairs_hook=_pairs, parse_constant=invalid_constant)


def round5_approvals(review_text):
    """Read only the two Winner cells in the unique Decision table."""
    headings = list(re.finditer(r"^## Decision\s*$", review_text, re.MULTILINE))
    if len(headings) != 1:
        raise ValueError("Expected one round-5 Decision section")
    section = re.split(r"^## ", review_text[headings[0].end():], maxsplit=1, flags=re.MULTILINE)[0]
    lines = [line.strip() for line in section.splitlines() if line.strip().startswith("|")]
    if (len(lines) != 4 or lines[0] != "| Slot | Winner | Backup | Why |"
            or not re.fullmatch(r"\|[-: ]+\|[-: ]+\|[-: ]+\|[-: ]+\|", lines[1])):
        raise ValueError("Decision table must contain exactly two winner rows")
    expected = {ident[:8]: (ident, parent, industry) for ident, parent, industry in ROUND5_WINNERS}
    result = []
    for line in lines[2:]:
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 4:
            raise ValueError("Ambiguous Decision row")
        winner = re.fullmatch(r"\*\*([0-9a-f]{8})\*\* \(([^()]+)\)", cells[1])
        parent = re.match(r"([0-9a-f]{8})\b", cells[0])
        if not winner or not parent or winner[1] not in expected:
            raise ValueError("Unapproved round-5 winner")
        ident, parent_id, industry = expected[winner[1]]
        if parent[1] != parent_id[:8] or winner[2] != industry:
            raise ValueError("Round-5 winner parent or industry differs from approval profile")
        result.append({"round": 5, "prefix": ident[:8], "parent_prefix": parent_id[:8],
                       "id": ident, "parent_id": parent_id, "industry": industry})
    if {row["id"] for row in result} != {row[0] for row in ROUND5_WINNERS}:
        raise ValueError("Decision table must approve exactly the two distinct round-5 winners")
    return result


def _round5_source(path, payload):
    """Copy and validate the frozen source, without accepting saved PASS flags."""
    from scripts.ingest_external_verdicts import _scope
    from shared.external_judge import validate_candidate_records
    from shared.near_duplicates import tokens
    from shared.option_order import balance_options
    if (payload.get("rules_version") != 5 or payload.get("external_judge_version") != 2
            or payload.get("judge_model") != "external" or payload.get("variant_mode") != 1
            or payload.get("argon_gate") is not True or payload.get("style_policy_version") != "5.1"
            or payload.get("cert_id") != "machine-learning-engineer"
            or payload.get("difficulty") not in ("EASY", "MEDIUM", "HARD")
            or payload.get("generation_runs") != {} or payload.get("external_run_journal", {}) != {}):
        raise ValueError("Round-5 requires unpersisted rules-5/policy-5 source with empty run journals")
    validate_candidate_records(payload)
    for row in [payload, *payload["plan"], *payload["candidates"]]:
        if (not isinstance(row.get("options", []), list)
                or row.get("question_type", "single_select") != "single_select"
                or row.get("answer_mode", "single_select") != "single_select"
                or any(key in row for key in ("keys", "correct_labels", "correct_answers"))
                or ("key" in row and not isinstance(row["key"], str))
                or any(isinstance(option, dict) and "is_correct" in option for option in row.get("options", []))):
            raise ValueError("Only single_select candidates are supported")
    if any(scope.get("variant_policy_version") != 5 for scope in payload["plan"]):
        raise ValueError("Round-5 requires policy-5 scope")
    for index, scope in enumerate(payload["plan"], 1):
        _scope(payload, {**scope, "index": index})
    for entry in payload["candidates"]:
        if (entry.get("persistence_status") is not None or entry.get("inserted_question_id") is not None
                or entry.get("persistence_validation_failed")
                or entry.get("status") in ("ACTIVE", "active", "persisted", "inserted")):
            raise ValueError("Round-5 persistence journals require human reconciliation")
    bank = payload.get("existing_questions")
    if (not isinstance(bank, dict) or set(bank) != {"sha256", "questions"}
            or not isinstance(bank["questions"], list)
            or (bank["sha256"] is not None and not re.fullmatch(r"[0-9a-f]{64}", str(bank["sha256"])))):
        raise ValueError("Missing or malformed local export snapshot")
    for row in bank["questions"]:
        if (not isinstance(row, dict) or not {"id", "stem", "key"} <= set(row)
                or set(row) - {"id", "stem", "key", "cert_id", "objective_id"}
                or not isinstance(row["id"], str) or not row["id"].strip()
                or row.get("cert_id", payload["cert_id"]) != payload["cert_id"]
                or ("objective_id" in row and (not isinstance(row["objective_id"], str) or not row["objective_id"].strip()))):
            raise ValueError("Malformed local export snapshot")
        tokens(row["stem"]); tokens(row["key"])
    copied = deepcopy(payload)
    selected = []
    for ident, parent, industry in ROUND5_WINNERS:
        matches = [entry for entry in copied["candidates"] if entry["candidate_id"] == ident]
        if len(matches) != 1:
            raise ValueError("Missing or ambiguous round-5 winner ID")
        entry = matches[0]
        if (entry.get("parent_question_id") != parent
                or entry.get("variant", {}).get("surface", {}).get("industry") != industry):
            raise ValueError("Round-5 winner parent or industry differs from approval profile")
        # Validate the original layout before balancing only the copied, selected population.
        _validate_candidate(path, copied, entry)
        selected.append(entry)
    balance_options(selected)
    return copied, selected


def _round5_batch(payload, selected):
    """Apply normal ingest's duplicate and batch gates to the actual two PASSes."""
    from shared.dedupe import normalize_stem
    from shared.external_judge import candidate_question
    from shared.near_duplicates import comparison_row
    from shared.variants import variant_duplicates
    from shared.variant_plan import key_length_batch_report
    from shared.batch_report import key_position_report, template_diversity_report
    seen, normalized = list(payload["existing_questions"]["questions"]), set()
    duplicates = []
    for entry in selected:
        stem = normalize_stem(candidate_question(entry)["stem"])
        if stem in normalized:
            raise ValueError("Duplicate normalized selected stem")
        normalized.add(stem)
        report = variant_duplicates(entry, seen, payload["variant_parents"][entry["parent_question_id"]],
            siblings=selected, prior=payload.get("prior_variants", {}).get("questions", []))
        if not report["passed"]:
            raise ValueError("Round-5 duplicate gate failed: " + report["reason"])
        duplicates.append({"id": entry["candidate_id"], "report": report})
        seen.append(comparison_row(entry))
    reports = {"key_length": key_length_batch_report(payload, selected),
               "key_position": key_position_report(selected),
               "template_diversity": template_diversity_report(selected)}
    if any(report["passed"] is not True for report in reports.values()):
        raise ValueError("Round-5 selected batch gates failed")
    return {**reports, "duplicates": duplicates}


def build_export(review, artifacts, *, approval_profile="legacy13"):
    """Bind approval, actual independent verdicts and canonical persistence rows."""
    os.environ["PYTHON_DOTENV_DISABLED"] = "1"
    review = Path(review).resolve()
    review_bytes = review.read_bytes()
    if approval_profile not in ("legacy13", "round5-winners"):
        raise ValueError("Unknown approval profile")
    round5 = approval_profile == "round5-winners"
    chosen = (round5_approvals if round5 else approvals)(review_bytes.decode("utf-8"))
    artifact_names = {5: ROUND5_ARTIFACT} if round5 else ARTIFACT_NAMES
    expected_count = 2 if round5 else 13
    by_name = {}
    source_bytes = {}
    for given in artifacts:
        path = Path(given).resolve()
        if path.name in by_name:
            raise ValueError("Artifact basename supplied more than once")
        raw = path.read_bytes()
        by_name[path.name] = (path, strict_json(raw))
        source_bytes[path] = raw
    if set(by_name) != set(artifact_names.values()):
        raise ValueError("Supply exactly " + ", ".join(artifact_names.values()))
    if round5:
        source_path, source = by_name[ROUND5_ARTIFACT]
        source, selected = _round5_source(source_path, source)
        by_name[ROUND5_ARTIFACT] = (source_path, source)
    bound_inputs = {}
    result = {"approval": {"path": str(review), "sha256": hashlib.sha256(review_bytes).hexdigest()},
              "artifacts": [{"path": str(path), "sha256": hashlib.sha256(raw).hexdigest()}
                            for path, raw in source_bytes.items()], "runs": [], "questions": []}
    if round5:
        result["approval_profile"] = approval_profile
    runs = {}
    for approved in chosen:
        path, payload = by_name[artifact_names[approved["round"]]]
        matches = [entry for entry in payload["candidates"]
                   if entry["candidate_id"].startswith(approved["prefix"])]
        if len(matches) != 1:
            raise ValueError("Approved prefix must resolve to exactly one source candidate")
        entry = matches[0]
        ident = entry["candidate_id"]
        parent_id = entry["parent_question_id"]
        if not parent_id.startswith(approved["parent_prefix"]):
            raise ValueError("Approved parent does not match the table")
        if (payload.get("exam") != "GCP_PM_ML_ENG" or entry.get("inserted_question_id")
                or entry.get("persistence_status") is not None):
            raise ValueError("Require unpersisted PMLE variants")
        scope, question, checked = _validate_candidate(path, payload, entry)
        request_path = path.parent / entry["external_judge_request"]["path"]
        request_bytes = request_path.read_bytes()
        if hashlib.sha256(request_bytes).hexdigest() != entry["external_judge_request"]["sha256"]:
            raise ValueError("Frozen request changed after validation")
        request = strict_json(request_bytes)
        verdict_path = path.with_suffix(".verdicts") / (ident + ".json")
        if round5 and verdict_path.is_symlink():
            raise ValueError("Unsafe verdict path")
        verdict_bytes = verdict_path.read_bytes()
        raw = strict_json(verdict_bytes)
        bound_inputs.update({request_path: request_bytes, verdict_path: verdict_bytes})
        judge = _external_decision(question, scope, entry["sources"], checked["options"], raw,
            payload["model"], gate_version=payload["external_judge_version"],
            rules_version=payload["rules_version"], argon_request=request["argon"])
        if not judge.passed:
            raise ValueError("Approved variant does not pass its actual bound independent verdicts: " + ident)
        if round5:
            entry.update(accepted=False, external_verdict=raw, judge_verdict={"passed": True},
                         awaiting_external_judge=True, near_duplicate_check={"passed": True})
            entry.pop("failure_stage", None)
            entry["status"] = "external_judge_passed"
        # Match ingest_external_verdicts' grounding fields and stored label map.
        grounding = {key: scope[key] for key in ("cert_id", "objective_id", "guide_sha256")}
        grounding.update(generator_model=payload["model"], judge_model=EXTERNAL_JUDGE_PROVENANCE,
            evidence=checked["options"], mechanical_check={"passed": True, "errors": []},
            gate_version=payload["rules_version"], rules_version=payload["rules_version"],
            gate_verdicts=raw, parent_question_id=parent_id, variant=entry["variant"], argon=raw["argon"],
            **{name: scope[name] for name in ("decision_objective", "decision_plan", "decision_proof", "key_length_rank")})
        for name in ("style_policy", "distractor_evidence"):
            if name in scope:
                grounding[name] = scope[name]
        grounding.update(option_order=entry["option_order"], evidence=entry["evidence"])
        if round5:
            grounding["option_balance"] = entry["option_balance"]
        run_id = _run_id(payload, scope["domain_code"])
        saved_run = payload.get("generation_runs", {}).get(scope["domain_code"])
        if saved_run is not None and saved_run != run_id:
            raise ValueError("Saved generation run identity differs from normal ingest")
        run = {"id": run_id, "exam": "GCP_PM_ML_ENG", "domain_code": scope["domain_code"],
               "target_count": sum(s["domain_code"] == scope["domain_code"] for s in payload["plan"]),
               "generated_count": 0, "model": payload["model"], "prompt_version": "registry-grounded-v1",
               "notes": json.dumps({"cert_id": payload["cert_id"], "judge_model": EXTERNAL_JUDGE_PROVENANCE,
                                    "founder_approval_sha256": result["approval"]["sha256"],
                                    "artifact": path.name, "artifact_sha256": hashlib.sha256(source_bytes[path]).hexdigest()},
                                   sort_keys=True, separators=(",", ":"))}
        if run_id in runs and any(runs[run_id][k] != v for k, v in run.items() if k != "generated_count"):
            raise ValueError("Conflicting deterministic generation run metadata")
        runs.setdefault(run_id, run)["generated_count"] += 1
        recording = RecordingClient()
        # Runtime SQL resolves the current parent's domain, never an invented UUID.
        if not persist_candidate(recording, scope, question, judge, grounding, "GCP_PM_ML_ENG",
                "FROM_PARENT", run_id, payload["difficulty"], question_id=ident):
            raise ValueError("Normal persistence projection failed")
        row = recording.question
        row.update(status="ACTIVE", review_status="GOOD", question_type="single_select",
                   parent_question_id=parent_id, source_ref="verified-parent-variant:" + path.name + ":" + ident)
        notes = json.loads(row["review_notes"])
        notes["founder_approved_variant"] = {"approval": result["approval"], "artifact": path.name,
            "artifact_sha256": hashlib.sha256(source_bytes[path]).hexdigest(),
            "request_sha256": entry["external_judge_request"]["sha256"],
            "verdict_sha256": hashlib.sha256(verdict_bytes).hexdigest(),
            "industry": entry["variant"]["surface"]["industry"]}
        row["review_notes"] = json.dumps(notes, allow_nan=False, separators=(",", ":"))
        result["questions"].append({"question": row, "answers": recording.answers,
            "explanation": recording.explanation, "domain_code": scope["domain_code"],
            "industry": entry["variant"]["surface"]["industry"], "artifact": path.name})
    result["runs"] = list(runs.values())
    if len({row["question"]["id"] for row in result["questions"]}) != expected_count:
        raise ValueError("Approved question IDs must be distinct")
    if round5:
        result["validation_reports"] = _round5_batch(source, selected)
    if (any(path.read_bytes() != raw for path, raw in {**source_bytes, **bound_inputs}.items())
            or review.read_bytes() != review_bytes):
        raise ValueError("Source artifact, bound judgment or approval changed during export")
    return result


def summary(export):
    return {"count": len(export["questions"]), "answers": sum(len(row["answers"]) for row in export["questions"]),
            "explanations": len(export["questions"]), "generation_runs": len(export["runs"]),
            "questions": [{"id": row["question"]["id"], "parent": row["question"]["parent_question_id"],
                           "industry": row["industry"], "artifact": row["artifact"]} for row in export["questions"]]}


def render_sql(export):
    data = json.dumps(export, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    digest = hashlib.sha256(data.encode()).hexdigest()[:16]
    tag, outer = "payload_" + digest, "$body_" + digest + "$"
    if "$" + tag + "$" in data or outer in data:
        raise ValueError("Unexpected dollar-quote collision")
    body = SQL_BODY
    if export.get("approval_profile") == "round5-winners":
        identities = [(row["question"]["id"], row["question"]["parent_question_id"], row["industry"])
                      for row in export["questions"]]
        if len(identities) != 2 or set(identities) != set(ROUND5_WINNERS):
            raise ValueError("Round-5 SQL requires only the two approved winners")
        body = body.replace("<>13", "<>2").replace("exactly 13 distinct", "exactly 2 distinct")
    elif export.get("approval_profile", "legacy13") != "legacy13":
        raise ValueError("Unknown approval profile")
    return (SQL_PREFIX.replace("$approved_variants$", outer) + "\n v_batch jsonb := $" + tag + "$"
            + data + "$" + tag + "$::jsonb;\n" + body.replace("$approved_variants$", outer))


SQL_PREFIX = """-- Founder-approved paid-practice variants, exported offline via persist_candidate.
-- Apply only AFTER the practice-only parent_question_id and taxonomy migrations.
-- Repeat-safe INSERT-ONLY: any existing variant ID aborts the WHOLE transaction.
-- No ON CONFLICT skip/overwrite. A successful second apply is deliberately forbidden.
-- Parent domains and generation-owned tags are resolved from locked current parents.
BEGIN;
SET LOCAL standard_conforming_strings = on;
DO $approved_variants$
DECLARE"""

SQL_BODY = """ v_row jsonb; v_run jsonb; v_answer jsonb; v_parent record; v_tags jsonb;
 v_count integer; v_tag_count integer;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.questions')
   AND attname='parent_question_id' AND NOT attisdropped) THEN
  RAISE EXCEPTION 'Apply the practice-only parent_question_id migration first';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.questions')
   AND attname='question_type' AND NOT attisdropped) THEN
  RAISE EXCEPTION 'Apply the single_select question_type foundation migration first';
 END IF;
 IF to_regclass('public.question_tags') IS NULL OR
    to_regprocedure('public.replace_question_tags(uuid,text,jsonb)') IS NULL THEN
  RAISE EXCEPTION 'Apply the question taxonomy migration first';
 END IF;
 IF jsonb_array_length(v_batch->'questions')<>13 OR
    (SELECT count(DISTINCT x->'question'->>'id') FROM jsonb_array_elements(v_batch->'questions') x)<>13 THEN
  RAISE EXCEPTION 'Expected exactly 13 distinct approved variants';
 END IF;
 -- Serialize the insert/existence check; parent row locks also stabilize tag RPC writers.
 LOCK TABLE public.questions IN SHARE ROW EXCLUSIVE MODE;
 FOR v_row IN SELECT value FROM jsonb_array_elements(v_batch->'questions')
   ORDER BY value->'question'->>'parent_question_id',value->'question'->>'id' LOOP
  IF EXISTS (SELECT 1 FROM public.questions WHERE id=(v_row->'question'->>'id')::uuid) THEN
   RAISE EXCEPTION 'Variant ID already exists: %', v_row->'question'->>'id';
  END IF;
  SELECT q.id,q.domain_id,q.status,q.exam,q.question_type,q.parent_question_id,d.code INTO v_parent
  FROM public.questions q JOIN public.exam_domains d ON d.id=q.domain_id AND d.exam=q.exam
  WHERE q.id=(v_row->'question'->>'parent_question_id')::uuid FOR UPDATE OF q;
  IF NOT FOUND OR v_parent.status IS DISTINCT FROM 'ACTIVE' OR v_parent.exam IS DISTINCT FROM 'GCP_PM_ML_ENG'
     OR v_parent.question_type IS DISTINCT FROM 'single_select'
     OR v_parent.parent_question_id IS NOT NULL OR v_parent.code IS DISTINCT FROM v_row->>'domain_code' THEN
   RAISE EXCEPTION 'Parent missing, inactive, non-original, wrong exam or domain: %', v_row->'question'->>'parent_question_id';
  END IF;
  IF jsonb_array_length(v_row->'answers')<>4 OR
     (SELECT count(DISTINCT x->>'choice_label') FROM jsonb_array_elements(v_row->'answers') x
      WHERE x->>'choice_label' IN ('A','B','C','D'))<>4 OR
     (SELECT count(*) FROM jsonb_array_elements(v_row->'answers') x WHERE (x->>'is_correct')::boolean)<>1 THEN
   RAISE EXCEPTION 'Invalid approved answer set';
  END IF;
 END LOOP;
 FOR v_run IN SELECT value FROM jsonb_array_elements(v_batch->'runs') LOOP
  IF EXISTS (SELECT 1 FROM public.question_generation_runs WHERE id=(v_run->>'id')::uuid) THEN
   RAISE EXCEPTION 'Generation run already exists; reconcile before retry: %', v_run->>'id';
  END IF;
 END LOOP;
 FOR v_run IN SELECT value FROM jsonb_array_elements(v_batch->'runs') LOOP
  INSERT INTO public.question_generation_runs(id,exam,domain_code,target_count,generated_count,model,prompt_version,notes,completed_at)
  VALUES ((v_run->>'id')::uuid,v_run->>'exam',v_run->>'domain_code',(v_run->>'target_count')::int,
    (v_run->>'generated_count')::int,v_run->>'model',v_run->>'prompt_version',v_run->>'notes',now());
 END LOOP;
 FOR v_row IN SELECT value FROM jsonb_array_elements(v_batch->'questions') LOOP
  INSERT INTO public.questions(id,exam,domain_id,stem,difficulty,status,review_status,review_notes,
     generation_run_id,question_type,parent_question_id,source_ref)
  SELECT (v_row->'question'->>'id')::uuid,'GCP_PM_ML_ENG',p.domain_id,v_row->'question'->>'stem',
     v_row->'question'->>'difficulty','ACTIVE','GOOD',v_row->'question'->>'review_notes',
     (v_row->'question'->>'generation_run_id')::uuid,'single_select',p.id,v_row->'question'->>'source_ref'
  FROM public.questions p WHERE p.id=(v_row->'question'->>'parent_question_id')::uuid;
  FOR v_answer IN SELECT value FROM jsonb_array_elements(v_row->'answers') LOOP
   INSERT INTO public.answers(question_id,choice_label,choice_text,is_correct,explanation_text)
   VALUES ((v_row->'question'->>'id')::uuid,v_answer->>'choice_label',v_answer->>'choice_text',
     (v_answer->>'is_correct')::boolean,v_answer->>'explanation_text');
  END LOOP;
  INSERT INTO public.explanations(question_id,explanation_text,doc_links)
  VALUES ((v_row->'question'->>'id')::uuid,v_row->'explanation'->>'explanation_text',v_row->'explanation'->'doc_links');
  SELECT coalesce(jsonb_agg(jsonb_build_object('dimension',dimension,'value_key',value_key,'confidence',confidence)
     ORDER BY dimension,value_key),'[]'::jsonb) INTO v_tags FROM public.question_tags
  WHERE question_id=(v_row->'question'->>'parent_question_id')::uuid;
  PERFORM public.replace_question_tags((v_row->'question'->>'id')::uuid,'generation',v_tags);
  v_tag_count := jsonb_array_length(v_tags);
  SELECT count(*) INTO v_count FROM public.answers WHERE question_id=(v_row->'question'->>'id')::uuid;
  IF v_count<>4 OR NOT EXISTS (SELECT 1 FROM public.explanations WHERE question_id=(v_row->'question'->>'id')::uuid)
     OR (SELECT count(*) FROM public.question_tags WHERE question_id=(v_row->'question'->>'id')::uuid
         AND source='generation')<>v_tag_count THEN
   RAISE EXCEPTION 'Post-insert content/tag verification failed';
  END IF;
  RAISE NOTICE 'Inserted variant %, parent %, industry %, copied % tags',
    v_row->'question'->>'id',v_row->'question'->>'parent_question_id',v_row->>'industry',v_tag_count;
 END LOOP;
END;
$approved_variants$;
COMMIT;
"""


@click.command()
@click.option("--review", required=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--artifact", "artifacts", required=True, multiple=True, type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--output", type=click.Path(path_type=Path))
@click.option("--dry-run", is_flag=True, help="Print approved IDs, parents and industries; write nothing.")
@click.option("--approval-profile", type=click.Choice(["legacy13", "round5-winners"]), default="legacy13",
              show_default=True, help="Select a separate approved batch; never combines the profiles.")
def main(review, artifacts, output, dry_run, approval_profile):
    try:
        export = build_export(review, artifacts, approval_profile=approval_profile)
        result = summary(export)
        if not dry_run:
            if output is None:
                raise ValueError("Use --dry-run or supply --output")
            if (output.suffix != ".sql" or output.is_symlink()
                    or (output.exists() and output.stat().st_nlink != 1)):
                raise ValueError("Output must be a non-symlink, non-hardlinked .sql file")
            protected = {Path(review).resolve(), *(Path(path).resolve() for path in artifacts)}
            if output.resolve() in protected:
                raise ValueError("SQL output cannot overwrite a source input")
            sql = render_sql(export)
            output.write_text(sql, encoding="utf-8")
            result.update(sql_path=str(output.resolve()), sql_sha256=hashlib.sha256(sql.encode()).hexdigest())
        click.echo(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, TypeError, OSError, CLISchemaError) as error:
        raise click.ClickException("Approved variant export failed: " + str(error)) from None


if __name__ == "__main__":
    main()
