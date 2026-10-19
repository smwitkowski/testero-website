"""Offline two-winner profile tests; canonical gates/projection, no live calls."""
from copy import deepcopy
import hashlib
import json
from unittest.mock import Mock

import pytest
from click.testing import CliRunner
from scripts import export_approved_variants_sql as exporter
from shared.external_judge import candidate_question, canonical_sha256
from shared.option_order import canonical_evidence, store_options
from shared.argon_gate import MODEL
from shared.gates import blind_choice_map
from shared.cli_models import CLISchemaError
from test_approved_variant_sql import bundle  # legacy fixture, retained unchanged
from test_generation_gate import QUESTION
from test_variant_round5_gates import policy5_bundle, frozen_request

REVIEW = """## Decision

| Slot | Winner | Backup | Why |
|---|---|---|---|
| a31d11b8 Cloud Run job | **d4b10e1f** (hospital operations) | 788d3e62 (mining safety) | selected |
| 57b9d0c7 group split | **5fe281b2** (public transit) | 388fe57b (sports broadcasting) | selected |

## Checks and recommendations
| 788d3e62 | **Winner** |
Recommendation: **Publish now: 13 variants.** r4 deadbeef
"""


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("No live model, retrieval, database or ingest writes")
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr("shared.cli_models.run_signature", forbidden)
    monkeypatch.setattr("shared.argon_gate.run_argon", forbidden)
    monkeypatch.setattr("shared.doc_search.search_objective_docs", forbidden)
    monkeypatch.setattr("scripts.ingest_external_verdicts.database_client", forbidden)
    monkeypatch.setattr("scripts.ingest_external_verdicts._flush", forbidden)


@pytest.fixture
def round5(tmp_path, monkeypatch):
    # Unit fixture isolates registry/parent replay. Actual four-gate evaluator,
    # balancing, duplicate and batch reports, and persistence projection are real.
    from scripts import ingest_external_verdicts as ingest
    monkeypatch.setattr(ingest, "_scope", lambda payload, entry: payload["plan"][entry["index"] - 1])
    review = tmp_path / "approval.md"
    review.write_text(REVIEW)
    path = tmp_path / exporter.ROUND5_ARTIFACT
    (tmp_path / "requests").mkdir()
    path.with_suffix(".verdicts").mkdir()
    argon = frozen_request(context=True)["argon"]
    raw = policy5_bundle()
    raw["argon"] = {"model": MODEL, "version": 2, "request_sha256": canonical_sha256(argon),
        "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False,
                   "issues": [], "fix": "No fix required"}}
    scope = {"cert_id": "machine-learning-engineer", "objective_id": "objective", "guide_sha256": "guide",
        "domain_code": "DOMAIN", "decision_objective": {}, "decision_plan": {}, "decision_proof": {},
        "variant_policy_version": 5, "variant_origin": {}, "key_length_rank": 4}
    entries = []
    for index, (ident, parent, industry) in enumerate(exporter.ROUND5_WINNERS, 1):
        question = deepcopy(QUESTION)
        lengths = (29, 27, 26, 27) if index == 1 else (27, 24, 28, 31)
        for field, count in zip(("correct_answer", "distractor_1", "distractor_2", "distractor_3"), lengths):
            question[field] = " ".join([field + str(index)] * count)
        question["stem"] = ("Your hospital processes clinical workshop recordings with transcription timeouts?"
                            if index == 1 else "Your transit team transfers archived vehicle photos for grouped evaluation?")
        entry = {"index": index, "candidate_id": ident, "parent_question_id": parent,
            "variant": {"ordinal": 1, "surface": {"industry": industry}, "family_stem_threshold": .45},
            "sources": [], "stem": question["stem"], "accepted": True,
            "judge_verdict": {"passed": True}, "external_judge_request": {"path": "requests/" + ident + ".json"}}
        evidence = [{"option_label": "A", "url": "https://docs.cloud.google.com/test", "quote": "quote"}]
        store_options(entry, question, evidence)
        req = json.dumps({"argon": argon}).encode()
        (tmp_path / entry["external_judge_request"]["path"]).write_bytes(req)
        entry["external_judge_request"]["sha256"] = hashlib.sha256(req).hexdigest()
        bound = deepcopy(raw)
        bound["blind_solver"]["choice"] = next(label for label, origin in blind_choice_map(question).items() if origin == "A")
        (path.with_suffix(".verdicts") / (ident + ".json")).write_text(json.dumps(bound))
        entries.append(entry)
    # Accepted backups must never be projected or included in selected batch stats.
    backup = deepcopy(entries[0])
    backup.update(candidate_id="788d3e62-a344-5d22-a96e-787fe4dddc08", index=3)
    entries.append(backup)
    payload = {"cert_id": "machine-learning-engineer", "exam": "GCP_PM_ML_ENG", "difficulty": "MEDIUM",
        "model": "codex", "judge_model": "external", "rules_version": 5, "external_judge_version": 2,
        "argon_gate": True, "style_policy_version": "5.1", "variant_mode": 1,
        "generation_runs": {}, "plan": [deepcopy(scope) for _ in entries], "candidates": entries,
        "existing_questions": {"sha256": None, "questions": []}, "variant_parents": {}}
    for _, parent, _ in exporter.ROUND5_WINNERS:
        parent_entry = deepcopy(entries[0])
        parent_question = deepcopy(QUESTION)
        parent_question["stem"] = "Your retailer predicts seasonal inventory demand and refreshes product forecasts?"
        parent_entry.update(candidate_id=parent, stem=parent_question["stem"])
        store_options(parent_entry, parent_question, [])
        payload["variant_parents"][parent] = {"question_id": parent, "entry": parent_entry}
    path.write_text(json.dumps(payload))
    def validate(path, payload, entry):
        question = candidate_question(entry)
        if not question["stem"].endswith("?"):
            raise ValueError("Question schema validation failed")
        return payload["plan"][entry["index"] - 1], question, {"options": canonical_evidence(entry)}
    validated = Mock(side_effect=validate)
    monkeypatch.setattr(exporter, "_validate_candidate", validated)
    return review, path, payload, validated


def build(round5):
    review, path, *_ = round5
    return exporter.build_export(review, [path], approval_profile="round5-winners")


def rewrite(round5, change):
    _, path, payload, _ = round5
    change(payload)
    path.write_text(json.dumps(payload))


def test_legacy_default_export_and_sql_byte_binding(bundle, tmp_path):
    review, artifacts, *_ = bundle
    default = exporter.build_export(review, artifacts)
    assert default == exporter.build_export(review, artifacts, approval_profile="legacy13")
    assert "approval_profile" not in default and "validation_reports" not in default
    data = json.dumps(default, ensure_ascii=False, separators=(",", ":")).replace(str(tmp_path), "/fixture")
    assert hashlib.sha256(data.encode()).hexdigest() == "885ebbbc3642ce74029709abc8a6019c27e3e7ce7285786d8fc4baab4ef9dfdb"
    sql = exporter.render_sql(json.loads(data))
    assert hashlib.sha256(sql.encode()).hexdigest() == "7efcca6b5edca4a7e7141986c876a440313db8c5c1e9cd0cedbf94334b812a28"
    assert "Expected exactly 13 distinct approved variants" in sql


def test_only_decision_winner_cells_are_approvals():
    rows = exporter.round5_approvals(REVIEW)
    assert {row["id"] for row in rows} == {row[0] for row in exporter.ROUND5_WINNERS}
    assert all(row["prefix"] not in ("788d3e62", "388fe57b", "deadbeef") for row in rows)


@pytest.mark.parametrize("changed", [
    REVIEW.replace("**d4b10e1f**", "**788d3e62**"),
    REVIEW.replace("hospital operations", "mining safety"),
    REVIEW.replace("a31d11b8 Cloud", "ffffffff Cloud"),
    REVIEW.replace("**d4b10e1f**", "**d4b10e1f** or **788d3e62**"),
    REVIEW.replace("| 57b9d0c7 group split", "| a31d11b8 group split"),
    REVIEW.replace("## Decision", "## Choices"), REVIEW + "\n## Decision\n",
    REVIEW.replace("## Checks and recommendations", "| extra | **d4b10e1f** | backup | extra |\n## Checks and recommendations"),
    REVIEW.replace("| 57b9d0c7 group split | **5fe281b2** (public transit) | 388fe57b (sports broadcasting) | selected |\n", ""),
])
def test_ambiguous_extra_missing_or_changed_approval_fails(changed):
    with pytest.raises(ValueError): exporter.round5_approvals(changed)


def test_round5_exact_two_real_gates_balance_projection_and_no_mutation(round5, tmp_path):
    review, path, payload, validated = round5
    before = {file: file.read_bytes() for file in tmp_path.rglob("*") if file.is_file()}
    exported = build(round5)
    assert exporter.summary(exported)["answers"] == 8
    assert len(exported["questions"]) == 2
    assert {row["question"]["id"] for row in exported["questions"]} == {row[0] for row in exporter.ROUND5_WINNERS}
    assert {row["industry"] for row in exported["questions"]} == {"hospital operations", "public transit"}
    assert exported["validation_reports"]["key_length"]["count"] == 2
    assert exported["validation_reports"]["key_length"]["unique_longest_count"] == 1
    for row in exported["questions"]:
        q = row["question"]
        notes = json.loads(q["review_notes"])
        grounding = notes["grounding"]
        source = next(e for e in payload["candidates"] if e["candidate_id"] == q["id"])
        canonical = candidate_question(source)
        key = next(a for a in row["answers"] if a["is_correct"])
        assert key["choice_text"] == canonical["correct_answer"]
        assert key["explanation_text"] == canonical["correct_explanation"]
        assert grounding["option_balance"]["population_sha256"]
        assert notes["founder_approved_variant"]["verdict_sha256"]
        assert grounding["gate_verdicts"]["style"]["moment_fits_want"] is True
        assert q["domain_id"] == "FROM_PARENT" and q["status"] == "ACTIVE" and q["review_status"] == "GOOD"
        assert q["parent_question_id"] == source["parent_question_id"]
        for receipt in grounding["evidence"]:
            answer = next(a for a in row["answers"] if a["choice_label"] == receipt["option_label"])
            assert answer["is_correct"] is True
    assert validated.call_count == 4  # original stored layout, then balanced copy
    assert all(file.read_bytes() == raw for file, raw in before.items())


def test_default_and_profiles_cannot_be_combined(round5):
    review, path, *_ = round5
    with pytest.raises(ValueError): exporter.build_export(review, [path])
    with pytest.raises(ValueError): exporter.build_export(review, [path], approval_profile="combined15")
    with pytest.raises(ValueError): exporter.build_export(review, [path, path], approval_profile="round5-winners")
    other = path.with_name("ab-six-r4-live.json")
    other.write_bytes(path.read_bytes())
    with pytest.raises(ValueError): exporter.build_export(review, [other], approval_profile="round5-winners")
    with pytest.raises(ValueError): exporter.build_export(review, [path, other], approval_profile="round5-winners")


@pytest.mark.parametrize("defect", ["wrong_parent", "industry", "missing", "duplicate", "schema", "policy", "rules",
    "journal", "run", "backup_journal", "persisted", "inserted", "validation_failed", "bank", "multiple_select"])
def test_source_identity_schema_policy_and_journal_guards(round5, defect):
    def change(payload):
        entry = payload["candidates"][0]
        if defect == "wrong_parent": entry["parent_question_id"] = exporter.ROUND5_WINNERS[1][1]
        if defect == "industry": entry["variant"]["surface"]["industry"] = "mining safety"
        if defect == "missing": payload["candidates"].pop(0)
        if defect == "duplicate": payload["candidates"].append(deepcopy(entry))
        if defect == "schema": entry["stem"] = "Malformed non-question"
        if defect == "multiple_select": entry["answer_mode"] = "multiple_select"
        if defect == "policy": payload["plan"][0]["variant_policy_version"] = 4
        if defect == "rules": payload["rules_version"] = 4
        if defect == "journal": payload["external_run_journal"] = {"DOMAIN": {"status": "creating"}}
        if defect == "run": payload["generation_runs"] = {"DOMAIN": "unknown"}
        if defect == "backup_journal": payload["candidates"][-1]["persistence_status"] = "unknown"
        if defect == "persisted": entry["persistence_status"] = "complete"
        if defect == "inserted": entry["inserted_question_id"] = entry["candidate_id"]
        if defect == "validation_failed": entry["persistence_validation_failed"] = True
        if defect == "bank": payload["existing_questions"] = {}
    rewrite(round5, change)
    with pytest.raises(ValueError): build(round5)


@pytest.mark.parametrize("defect", ["false", "missing", "string", "argon", "missing_file", "nonfinite", "duplicate_json", "symlink"])
def test_actual_policy5_bound_verdicts_not_saved_acceptance(round5, defect):
    _, path, payload, _ = round5
    verdict = path.with_suffix(".verdicts") / (payload["candidates"][0]["candidate_id"] + ".json")
    raw = json.loads(verdict.read_text())
    if defect == "false": raw["style"]["moment_fits_want"] = False
    if defect == "missing": raw["style"].pop("moment_fits_want")
    if defect == "string": raw["style"]["moment_fits_want"] = "true"
    if defect == "argon": raw["argon"]["review"]["key_correct"] = False
    verdict.write_text(json.dumps(raw))
    if defect == "missing_file": verdict.unlink()
    if defect == "nonfinite": verdict.write_text('{"score":NaN}')
    if defect == "duplicate_json": verdict.write_text('{"argon":{},"argon":{}}')
    if defect == "symlink":
        target = verdict.with_suffix(".saved")
        verdict.rename(target)
        verdict.symlink_to(target)
    with pytest.raises((ValueError, OSError, CLISchemaError)): build(round5)


def test_changed_frozen_request_fails(round5):
    _, path, payload, validated = round5
    request = path.parent / payload["candidates"][0]["external_judge_request"]["path"]
    request.write_text('{"argon":{}}')
    with pytest.raises(ValueError, match="Frozen request changed"): build(round5)


def test_midexport_input_change_fails_closed(round5, monkeypatch):
    review, _, _, _ = round5
    persist = exporter.persist_candidate
    def mutate_after_projection(*args, **kwargs):
        result = persist(*args, **kwargs)
        review.write_text(review.read_text() + "\nchanged during export")
        return result
    monkeypatch.setattr(exporter, "persist_candidate", mutate_after_projection)
    with pytest.raises(ValueError, match="changed during export"): build(round5)


def test_selected_batch_gate_is_not_saved_report(round5):
    from shared.option_order import store_options
    def change(payload):
        entry = payload["candidates"][0]
        question = candidate_question(entry)
        question["correct_answer"] = "short key"
        store_options(entry, question, canonical_evidence(entry))
        payload["variant_key_length_batch_report"] = {"passed": True}
    rewrite(round5, change)
    _, path, _, _ = round5
    changed = json.loads(path.read_text())["candidates"][0]
    verdict = path.with_suffix(".verdicts") / (changed["candidate_id"] + ".json")
    raw = json.loads(verdict.read_text())
    raw["blind_solver"]["choice"] = next(label for label, origin in blind_choice_map(candidate_question(changed)).items() if origin == "A")
    verdict.write_text(json.dumps(raw))
    with pytest.raises(ValueError, match="batch gates failed"): build(round5)


def test_recomputed_bank_duplicate_cannot_hide_behind_saved_pass(round5):
    def change(payload):
        entry = payload["candidates"][0]
        question = candidate_question(entry)
        payload["existing_questions"]["questions"] = [{"id": "foreign", "stem": question["stem"], "key": question["correct_answer"]}]
        entry["near_duplicate_check"] = {"passed": True}
    rewrite(round5, change)
    with pytest.raises(ValueError, match="duplicate gate failed"): build(round5)


def test_sql_two_guard_payload_and_abort_before_writes_parent_semantics(round5):
    exported = build(round5)
    sql = exporter.render_sql(exported)
    marker = sql.split("v_batch jsonb := $", 1)[1].split("$", 1)[0]
    data = json.loads(sql.split("$" + marker + "$", 2)[1])
    assert len(data["questions"]) == 2
    assert sum(len(row["answers"]) for row in data["questions"]) == 8
    assert {row["question"]["id"] for row in data["questions"]} == {row[0] for row in exporter.ROUND5_WINNERS}
    assert "Expected exactly 2 distinct approved variants" in sql and "<>13" not in sql
    assert sql.count("BEGIN;\n") == 1 and sql.endswith("COMMIT;\n")
    first_write = sql.index("INSERT INTO public.question_generation_runs")
    assert sql.index("Variant ID already exists") < first_write
    assert sql.index("Generation run already exists") < first_write
    assert sql.index("FOR UPDATE OF q") < first_write
    assert "SELECT (v_row->'question'->>'id')::uuid,'GCP_PM_ML_ENG',p.domain_id" in sql
    assert "WHERE question_id=(v_row->'question'->>'parent_question_id')::uuid" in sql
    assert "public.replace_question_tags((v_row->'question'->>'id')::uuid,'generation',v_tags)" in sql
    assert "ON CONFLICT" not in sql[sql.index("DECLARE"):]
    assert "UPDATE public.questions" not in sql and "DELETE FROM" not in sql
    legacy_body = exporter.SQL_BODY.replace("<>13", "<>2").replace("exactly 13 distinct", "exactly 2 distinct")
    outer = sql.split("DO ", 1)[1].split("\n", 1)[0]
    assert sql.endswith(legacy_body.replace("$approved_variants$", outer))
    exported["questions"].append(deepcopy(exported["questions"][0]))
    with pytest.raises(ValueError): exporter.render_sql(exported)


def test_cli_explicit_round5_dry_run_writes_nothing(round5, tmp_path):
    review, artifact, *_ = round5
    output = tmp_path / "unused.sql"
    result = CliRunner().invoke(exporter.main, ["--approval-profile", "round5-winners", "--review", str(review),
        "--artifact", str(artifact), "--dry-run", "--output", str(output)])
    assert result.exit_code == 0, result.output
    summary = json.loads(result.output)
    assert summary["count"] == 2 and summary["answers"] == 8 and not output.exists()
