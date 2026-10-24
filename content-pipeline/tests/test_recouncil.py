"""Offline re-council infrastructure tests; synthetic verdicts are not live quality proof."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import uuid

from click.testing import CliRunner
import pytest

from scripts import recouncil
from shared.content_hash import content_sha256
from shared.external_judge import canonical_sha256
from shared.evidence import check_evidence
from shared.gates import blind_choice_map, STYLE_CHECKS, EVIDENCE_CHECKS
from shared.option_order import OPTION_FIELDS, RATIONALE_FIELDS, store_options

FIXTURES = Path(__file__).parent / "fixtures/cli_models"


@pytest.fixture
def case():
    context = json.loads((FIXTURES / "context.json").read_text())
    question = json.loads((FIXTURES / "generation-output.json").read_text())
    citations = json.loads((FIXTURES / "citation-output.json").read_text())["evidence"]
    evidence = check_evidence(citations, context["sources"])["options"]
    answers = [{"choice_label": label, "choice_text": question[field],
                "explanation_text": question[rationale], "is_correct": index == 0}
               for index, (label, field, rationale) in enumerate(zip("ABCD", OPTION_FIELDS, RATIONALE_FIELDS))]
    ident = "a0e2a8c2-7d52-5b75-a7ca-e24dbff60322"
    row = {"id": ident, "stem": question["stem"], "answers": answers,
           "status": "DRAFT", "review_status": "QUARANTINED", "revision": 1,
           "exam": "GCP_PM_ML_ENG", "domain_id": "test-domain",
           "domain": {"id": "test-domain", "exam": "GCP_PM_ML_ENG", "code": context["scope"]["domain_code"]},
           "content_sha256": content_sha256(question["stem"], answers),
           "review_notes": {"grounding": {**{k: context["scope"][k] for k in
                           ("cert_id", "domain_code", "objective_id", "guide_sha256")},
                           "evidence": evidence}},
           "question_events": [{"id": "00000000-0000-0000-0000-000000000001", "at": "2026-10-24T00:00:00Z",
                                "revision": 1, "action": "quarantined"}]}
    entry = {"candidate_id": ident, "inserted_question_id": ident, "index": 1,
             "stem": question["stem"], "sources": context["sources"]}
    store_options(entry, question, evidence)
    artifact = {"entry": entry, "payload": {"candidates": [entry], "plan": [context["scope"]]}}
    return row, artifact, question


def verdict(prepared):
    question, request = prepared["question"], prepared["request"]
    key = next(k for k, v in blind_choice_map(question).items() if v == "A")
    blind = {"verdict": "PASS", "choice": key, "confidence": .9, "ambiguous_answers": False,
             "reason": "Synthetic unique answer"}
    from shared.gates import gate_signatures
    signatures = gate_signatures(5, cert_id=prepared["scope"]["cert_id"],
        style_policy=request.get("style_policy"), distractor_evidence=request.get("distractor_evidence"))
    raw = {"blind_solver": deepcopy(blind),
            "style": {"verdict": "PASS", "score": .9, "reason": "Synthetic good style",
                      **{k: True for k, field in signatures["style"].output_fields.items()
                         if field.annotation is bool}, "generic_validation_key": False},
            "evidence": {"verdict": "PASS", "score": .9, "reason": "Synthetic complete support",
                         **{k: True for k in EVIDENCE_CHECKS}},
            "argon": {"model": request["argon"]["model"], "version": 3,
                      "request_sha256": canonical_sha256(request["argon"]), "blind": deepcopy(blind),
                      "review": {"verdict": "PASS", "key_correct": True, "other_defensible_option": False,
                                 "issues": [], "fix": "No changes needed"}}}
    if "distractor_evidence" in request:
        raw["distractor_evidence"] = deepcopy(request["distractor_evidence"])
    return raw


def test_frozen_real_content_artifact_reexport_is_hash_bound_and_does_not_mutate(case):
    row, artifact, question = case
    before = deepcopy(artifact)
    prepared = recouncil.prepare_question(row, artifact)
    assert prepared["source"] == "artifact"
    assert prepared["question"] == question
    assert prepared["request"]["execution_policy"] == "short_circuit_v2"
    assert prepared["request"]["argon"]["version"] == 3
    assert artifact == before
    assert recouncil.evaluate_question(row, prepared, verdict(prepared))["outcome"] == "restore"


@pytest.mark.parametrize("field", ["stem", "correct_answer", "correct_explanation", "distractor_2_explanation"])
def test_artifact_hash_mismatch_never_falls_back_or_retires(case, field):
    row, artifact, _ = case
    entry = artifact["entry"]
    if field == "stem":
        entry["stem"] += " changed"
    else:
        mapping = entry["option_order"]
        canonical = "A" if field.startswith("correct") else "C"
        label = next(k for k, v in mapping.items() if v == canonical)
        if field.endswith("explanation"):
            entry["rationales"][label] += " changed"
        else:
            next(o for o in entry["options"] if o["label"] == label)["text"] += " changed"
    prepared = recouncil.prepare_question(row, artifact)
    assert "request" not in prepared
    assert prepared["outcome"] == "quarantined"


def test_missing_artifact_builds_fresh_db_request_with_only_real_receipts(case):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    assert prepared["source"] == "db"
    assert "Stored documentation receipts only" in prepared["request"]["gates"]["evidence"]["judge_prompt"]
    assert "Stored documentation receipts only" not in prepared["request"]["gates"]["blind_solver"]["judge_prompt"]
    assert recouncil.evaluate_question(row, prepared, verdict(prepared))["outcome"] == "restore"


def test_db_relabel_and_order_still_bind_hash_and_receipts(case):
    row, _, _ = case
    labels = dict(zip("ABCD", "CDAB"))
    for answer in row["answers"]:
        answer["choice_label"] = labels[answer["choice_label"]]
    row["answers"].reverse()
    for receipt in row["review_notes"]["grounding"]["evidence"]:
        receipt["option_label"] = labels[receipt["option_label"]]
    prepared = recouncil.prepare_question(row)
    assert "request" in prepared
    assert prepared["question"]["correct_answer"] == next(a["choice_text"] for a in row["answers"] if a["is_correct"])
    assert recouncil.evaluate_question(row, prepared, verdict(prepared))["outcome"] == "restore"


@pytest.mark.parametrize("defect", ["no_receipts", "bad_receipt", "no_key", "two_keys", "missing_explanation", "stale_hash", "not_quarantined", "no_cycle", "bad_objective"])
def test_insufficient_db_provenance_stays_quarantined(case, defect):
    row, _, _ = case
    if defect == "no_receipts": row["review_notes"]["grounding"]["evidence"] = []
    elif defect == "bad_receipt": row["review_notes"]["grounding"]["evidence"][0]["retrieved_at"] = "invalid"
    elif defect == "no_key": row["answers"][0]["is_correct"] = False
    elif defect == "two_keys": row["answers"][1]["is_correct"] = True
    elif defect == "missing_explanation": row["answers"][2]["explanation_text"] = ""
    elif defect == "stale_hash": row["stem"] += " changed"
    elif defect == "not_quarantined": row["review_status"] = "GOOD"
    elif defect == "no_cycle": row["question_events"] = []
    elif defect == "bad_objective": row["review_notes"]["grounding"]["objective_id"] = "bad"
    prepared = recouncil.prepare_question(row)
    assert prepared["outcome"] == "quarantined"
    assert "request" not in prepared


@pytest.mark.parametrize("seat", ["blind_solver", "argon"])
def test_confirmed_blind_disagreement_retires(case, seat):
    row, artifact, _ = case
    prepared = recouncil.prepare_question(row, artifact)
    raw = verdict(prepared)
    blind = raw[seat] if seat == "blind_solver" else raw[seat]["blind"]
    blind["choice"] = next(k for k, v in blind_choice_map(prepared["question"]).items() if v != "A")
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "retire"


def test_evidence_confirmed_failure_retires(case):
    row, artifact, _ = case
    prepared = recouncil.prepare_question(row, artifact)
    raw = verdict(prepared)
    raw["evidence"].update(verdict="FAIL", evidence_supported=False)
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "retire"


@pytest.mark.parametrize("defect", ["missing_seat", "malformed", "uncertain", "argon_uncertain", "argon_skipped", "argon_provenance", "low_confidence", "style_fail", "review_revise"])
def test_errors_uncertainty_and_style_rejection_do_not_retire(case, defect):
    row, artifact, _ = case
    prepared = recouncil.prepare_question(row, artifact)
    raw = verdict(prepared)
    if defect == "missing_seat": del raw["style"]
    elif defect == "malformed": raw["evidence"]["score"] = "yes"
    elif defect == "uncertain": raw["evidence"]["verdict"] = "UNCERTAIN"
    elif defect == "argon_uncertain": raw["argon"]["blind"]["verdict"] = "UNCERTAIN"
    elif defect == "argon_skipped": raw["argon"]["review"] = {"status": "skipped", "reason": "prior_gate_failed", "gate": "argon.blind"}
    elif defect == "argon_provenance": raw["argon"]["request_sha256"] = "0" * 64
    elif defect == "low_confidence": raw["blind_solver"]["confidence"] = .4
    elif defect == "style_fail": raw["style"].update(verdict="FAIL", current_names=False)
    elif defect == "review_revise": raw["argon"]["review"].update(verdict="REVISE", issues=["Synthetic style issue"])
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "quarantined"


def test_uncertain_or_schema_error_takes_precedence_over_confirmed_defect(case):
    row, artifact, _ = case
    prepared = recouncil.prepare_question(row, artifact)
    raw = verdict(prepared)
    raw["evidence"].update(verdict="FAIL", evidence_supported=False)
    raw["blind_solver"]["verdict"] = "UNCERTAIN"
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "quarantined"
    raw["blind_solver"]["verdict"] = "PASS"
    raw["style"]["score"] = "invalid"
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "quarantined"


def test_repeat_report_pages_only_after_restoration_same_revision(case):
    row, _, _ = case
    events = [{"id": str(i), "question_id": row["id"], "revision": revision, "at": f"2026-10-24T00:00:0{i}Z", "action": action}
              for i, (action, revision) in enumerate([( "report", 1), ("restored", 1), ("report", 2), ("report", 1)])]
    pages = recouncil.repeat_report_pages(list(reversed(events)))
    assert len(pages) == 1
    assert pages[0]["event_id"] == "3"
    assert pages[0]["restored_event_id"] == "1"


def test_repeat_quarantine_changes_request_and_rejects_old_verdict(case):
    row, _, _ = case
    original = recouncil.prepare_question(row)
    old = verdict(original)
    row["question_events"].append({"id": str(uuid.uuid4()), "revision": 1, "action": "quarantined", "at": "2026-10-25T00:00:00Z"})
    prepared = recouncil.prepare_question(row)
    assert original["request"]["candidate_id"] != prepared["request"]["candidate_id"]
    # Argon prompt hashes are unchanged when learner content is unchanged; old
    # verdict files cannot be reused because the new cycle gets a different ID.
    assert prepared["quarantine_event_id"] != original["quarantine_event_id"]


def test_cli_default_prepares_offline_and_apply_only_uses_rpc(case, tmp_path, monkeypatch):
    row, _, _ = case
    queue = tmp_path / "queue.json"
    queue.write_text(json.dumps({"questions": [row]}))
    client = Mock()
    client.rpc.return_value.execute.return_value = SimpleNamespace(data={"changed": True})
    factory = Mock(return_value=client)
    monkeypatch.setattr(recouncil, "get_client", factory)
    args = ["--queue", str(queue), "--output-dir", str(tmp_path / "run")]
    result = CliRunner().invoke(recouncil.main, args)
    assert result.exit_code == 0, result.output
    factory.assert_not_called()
    report = json.loads((tmp_path / "run/recouncil-report.json").read_text())
    prepared = recouncil.prepare_question(row)
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    (verdict_dir / (prepared["request"]["candidate_id"] + ".json")).write_text(json.dumps(verdict(prepared)))
    dry = CliRunner().invoke(recouncil.main, args + ["--verdict-dir", str(verdict_dir)])
    assert dry.exit_code == 0, dry.output
    factory.assert_not_called()
    applied = CliRunner().invoke(recouncil.main, args + ["--verdict-dir", str(verdict_dir), "--apply"])
    assert applied.exit_code == 0, applied.output
    assert client.rpc.call_count == 1
    name, params = client.rpc.call_args.args
    assert name == "restore_question"
    assert params["p_expected_sha256"] == row["content_sha256"]
    assert params["p_payload"]["expected_revision"] == 1
    assert params["p_payload"]["quarantine_event_id"] == row["question_events"][0]["id"]


@pytest.mark.parametrize("response", [{"changed": False, "outcome": "floor_blocked"}, False, None])
def test_refused_rpc_never_claims_applied(case, tmp_path, response):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    (verdict_dir / (prepared["request"]["candidate_id"] + ".json")).write_text(json.dumps(verdict(prepared)))
    client = Mock()
    client.rpc.return_value.execute.return_value = SimpleNamespace(data=response)
    result = recouncil.run_recouncil([row], tmp_path / "run", verdict_dir=verdict_dir, apply=True, client=client)
    assert result["questions"][0]["outcome"] == "quarantined"
    assert result["questions"][0]["applied"] is False


def test_offline_cli_rejects_environment_and_symlink_input(tmp_path):
    forbidden = tmp_path / ".env"
    forbidden.write_text("Do not read")
    result = CliRunner().invoke(recouncil.main, ["--queue", str(forbidden)])
    assert result.exit_code != 0
    link = tmp_path / "queue.json"
    link.symlink_to(forbidden)
    result = CliRunner().invoke(recouncil.main, ["--queue", str(link)])
    assert result.exit_code != 0


def test_confirmed_freshness_failure_retires(case):
    row, _, _ = case
    row["stem"] += " Use " + json.loads((Path(__file__).parents[1] / "certs/product-lexicon.json").read_text())["products"][0]["old"] + "."
    row["content_sha256"] = content_sha256(row["stem"], row["answers"])
    prepared = recouncil.prepare_question(row)
    result = recouncil.evaluate_question(row, prepared, verdict(prepared))
    assert result["outcome"] == "retire"
    assert "Deterministic freshness failure" in result["reasons"]


def test_system_error_never_becomes_a_defect_retirement(case, monkeypatch):
    from scripts import publish_batch
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    raw = verdict(prepared)
    raw["evidence"].update(verdict="FAIL", evidence_supported=False)
    monkeypatch.setattr(publish_batch, "publication_errors", Mock(side_effect=RuntimeError("private provider error")))
    result = recouncil.evaluate_question(row, prepared, raw)
    assert result["outcome"] == "quarantined"
    assert "private provider error" not in json.dumps(result)


def test_artifact_discovery_and_absence_fallback(case, tmp_path):
    row, artifact, _ = case
    artifacts = tmp_path / "artifacts"
    artifacts.mkdir()
    assert recouncil.find_artifact(row, artifacts) is None
    stored = artifacts / "stored.json"
    stored.write_text(json.dumps(artifact["payload"]))
    found = recouncil.find_artifact(row, artifacts)
    assert found == artifact
    result = recouncil.run_recouncil([row], tmp_path / "run", artifact_root=artifacts)
    assert result["questions"][0]["source"] == "artifact"
    (artifacts / "copy.json").write_text(stored.read_text())
    result = recouncil.run_recouncil([row], tmp_path / "other", artifact_root=artifacts)
    assert result["questions"][0]["outcome"] == "quarantined"
    assert "source" not in result["questions"][0]


@pytest.mark.parametrize("field", ["exam", "domain_id", "domain"])
def test_wrong_database_domain_or_cert_stays_quarantined(case, field):
    row, _, _ = case
    row[field] = "wrong"
    assert "request" not in recouncil.prepare_question(row)


def test_prepared_request_is_native_runner_compatible(case, tmp_path):
    from scripts import judge_requests
    from shared.quality_gate import QuestionQualitySignature
    from shared.cli_models import output_model
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    request = prepared["request"]
    destination = tmp_path / (request["candidate_id"] + ".json")
    destination.write_text(json.dumps(request, ensure_ascii=False, indent=2) + "\n")
    assert judge_requests._read_request(destination, request["candidate_id"], output_model(QuestionQualitySignature).model_json_schema()) == request


def test_existing_changed_request_is_never_overwritten(case, tmp_path):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    destination = tmp_path / "run/judge-requests" / (prepared["request"]["candidate_id"] + ".json")
    destination.parent.mkdir(parents=True)
    destination.write_text("{}")
    result = recouncil.run_recouncil([row], tmp_path / "run")
    assert result["questions"][0]["outcome"] == "quarantined"
    assert destination.read_text() == "{}"


def test_retirement_only_calls_atomic_retire_rpc_with_hash(case, tmp_path):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    raw = verdict(prepared)
    raw["evidence"].update(verdict="FAIL", evidence_supported=False)
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    (verdict_dir / (prepared["request"]["candidate_id"] + ".json")).write_text(json.dumps(raw))
    client = Mock()
    client.rpc.return_value.execute.return_value = SimpleNamespace(data={"changed": True})
    result = recouncil.run_recouncil([row], tmp_path / "run", verdict_dir=verdict_dir, apply=True, client=client)
    assert result["questions"][0]["applied"] is True
    name, params = client.rpc.call_args.args
    assert name == "retire_question"
    assert params["p_expected_sha256"] == row["content_sha256"]
    assert params["p_reason"] == "Evidence reviewer confirmed defect"


def test_rpc_error_is_redacted_and_never_falls_back_to_retire(case, tmp_path):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    (verdict_dir / (prepared["request"]["candidate_id"] + ".json")).write_text(json.dumps(verdict(prepared)))
    client = Mock()
    client.rpc.return_value.execute.side_effect = RuntimeError("private secret token")
    result = recouncil.run_recouncil([row], tmp_path / "run", verdict_dir=verdict_dir, apply=True, client=client)
    assert client.rpc.call_count == 1
    assert client.rpc.call_args.args[0] == "restore_question"
    assert result["questions"][0]["outcome"] == "quarantined"
    assert "private secret token" not in json.dumps(result)


def test_canary_artifacts_and_marked_paths_are_blocked(case, tmp_path):
    from shared.council_safety import CANARY_MARKER
    row, artifact, _ = case
    artifact["payload"]["council_canary"] = True
    assert "request" not in recouncil.prepare_question(row, artifact)
    base = tmp_path / "marked"
    base.mkdir()
    (base / CANARY_MARKER).touch()
    with pytest.raises(ValueError):
        recouncil.run_recouncil([row], base)


def test_apply_final_local_fence_refuses_changed_verdict(case, tmp_path, monkeypatch):
    row, _, _ = case
    prepared = recouncil.prepare_question(row)
    verdict_dir = tmp_path / "verdicts"
    verdict_dir.mkdir()
    verdict_path = verdict_dir / (prepared["request"]["candidate_id"] + ".json")
    verdict_path.write_text(json.dumps(verdict(prepared)))
    client = Mock()
    def connect():
        verdict_path.write_text("{}")
        return client
    monkeypatch.setattr(recouncil, "get_client", connect)
    result = recouncil.run_recouncil([row], tmp_path / "run", verdict_dir=verdict_dir, apply=True)
    client.rpc.assert_not_called()
    assert result["questions"][0]["outcome"] == "quarantined"


@pytest.fixture
def pde_case(case):
    """Real saved learner text, recertified only for synthetic policy plumbing tests."""
    from shared.cert_context import plan_questions
    row, artifact, question = case
    scope = plan_questions("data-engineer", 1,
        objective_ids=["data-engineer:standard:2.2:5"], seed=0, generation_tuning=False)[0]
    assert scope["style_policy"]["version"] == "5.3"
    grounding = row["review_notes"]["grounding"]
    grounding.update({k: scope[k] for k in ("cert_id", "domain_code", "objective_id", "guide_sha256")})
    row["exam"] = "data-engineer"
    row["domain"].update(code=scope["domain_code"], exam="data-engineer")
    artifact["payload"]["plan"] = [scope]
    return row, artifact, question


@pytest.mark.parametrize("source", ["artifact", "receipts"])
@pytest.mark.parametrize("mode", [None, "strict", "consistent"])
def test_pde_current_policy_full_council_restores_without_schema_weakening(pde_case, source, mode):
    from shared.gates import gate_signatures
    from shared.cli_models import output_model
    row, artifact, _ = pde_case
    if mode:
        policy = {"version": 1, "mode": mode}
        row["review_notes"]["grounding"]["distractor_evidence"] = deepcopy(policy)
        artifact["payload"]["distractor_evidence"] = deepcopy(policy)
        artifact["payload"]["plan"][0]["distractor_evidence"] = deepcopy(policy)
        artifact["entry"]["distractor_evidence"] = deepcopy(policy)
    prepared = recouncil.prepare_question(row, artifact if source == "artifact" else None)
    request = prepared["request"]
    assert request["style_policy"]["version"] == "5.3"
    signatures = gate_signatures(5, cert_id="data-engineer", style_policy=request["style_policy"],
                                  distractor_evidence=request.get("distractor_evidence"))
    for name, signature in signatures.items():
        assert request["gates"][name]["verdict_schema"] == output_model(signature).model_json_schema()
    raw = verdict(prepared)
    assert raw["style"]["distractors_no_generic_filler"] is True
    assert raw["style"]["inference_required"] is True
    assert raw["style"]["options_no_goal_restatement"] is True
    if mode == "consistent":
        assert "consistent v1" in request["gates"]["evidence"]["judge_prompt"]
        assert raw["distractor_evidence"] == {"version": 1, "mode": "consistent"}
    from scripts.publish_batch import publication_errors
    assert publication_errors(prepared["question"], prepared["scope"], request, raw) == []
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "restore"


@pytest.mark.parametrize("defect", ["missing_filler_check", "missing_inference_check", "extra_check", "bad_score", "uncertain", "wrong_evidence_policy"])
def test_pde_consistent_council_remains_strict(pde_case, defect):
    row, _, _ = pde_case
    row["review_notes"]["grounding"]["distractor_evidence"] = {"version": 1, "mode": "consistent"}
    prepared = recouncil.prepare_question(row)
    raw = verdict(prepared)
    if defect == "missing_filler_check": del raw["style"]["distractors_no_generic_filler"]
    elif defect == "missing_inference_check": del raw["style"]["inference_required"]
    elif defect == "extra_check": raw["style"]["unknown_check"] = True
    elif defect == "bad_score": raw["style"]["score"] = 1.1
    elif defect == "uncertain": raw["evidence"]["verdict"] = "UNCERTAIN"
    elif defect == "wrong_evidence_policy": raw["distractor_evidence"] = {"version": 1, "mode": "strict"}
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "quarantined"


def test_pde_consistent_confirmed_defect_can_retire(pde_case):
    row, _, _ = pde_case
    row["review_notes"]["grounding"]["distractor_evidence"] = {"version": 1, "mode": "consistent"}
    prepared = recouncil.prepare_question(row)
    raw = verdict(prepared)
    raw["evidence"].update(verdict="FAIL", evidence_supported=False)
    assert recouncil.evaluate_question(row, prepared, raw)["outcome"] == "retire"


def test_artifact_mixed_evidence_policy_is_not_silently_changed(pde_case):
    row, artifact, _ = pde_case
    artifact["payload"]["distractor_evidence"] = {"version": 1, "mode": "consistent"}
    artifact["entry"]["distractor_evidence"] = {"version": 1, "mode": "strict"}
    assert "request" not in recouncil.prepare_question(row, artifact)
