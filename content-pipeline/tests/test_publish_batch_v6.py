"""Offline publisher contracts and recorded council replay, never live model/DB IO."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import click
from click.testing import CliRunner

from scripts import publish_batch as publisher, ingest_external_verdicts as ingest
from shared.external_judge import build_request, canonical_sha256, candidate_question
from shared.content_hash import question_content_sha256
from shared.option_order import canonical_evidence
from shared.product_freshness import freshness_errors
from test_external_ingest import case, save_input
from test_three_gates_v4 import v4
from test_pipeline_v5 import prepare_v5
from test_judge_short_circuit import DATA, request as replay_request


@pytest.fixture
def publish_case(v4):
    case, _, _ = v4
    prepare_v5(case, argon=True)
    path, verdict_dir, payload, client, factory, raw, request_path = case
    entry, scope = payload["candidates"][0], payload["plan"][0]
    question = candidate_question(entry)
    payload["execution_policy"] = "short_circuit_v2"
    frozen = build_request(entry["candidate_id"], scope, question, entry["sources"], canonical_evidence(entry),
        argon_gate=True, execution_policy="short_circuit_v2")
    request_path.write_text(json.dumps(frozen))
    entry["external_judge_request"]["sha256"] = hashlib.sha256(request_path.read_bytes()).hexdigest()
    raw = json.loads((verdict_dir / request_path.name).read_text())
    raw["argon"]["version"] = 3
    raw["argon"]["request_sha256"] = canonical_sha256(frozen["argon"])
    (verdict_dir / request_path.name).write_text(json.dumps(raw))
    save_input(case)
    ingest.ingest(path, verdict_dir)
    assert json.loads(path.read_text())["candidates"][0]["accepted"] is True
    payload = json.loads(path.read_text())
    entry = payload["candidates"][0]
    # Read the exact row/receipts the ordinary DRAFT ingest produced.
    row = deepcopy(client.insert_question.call_args.args[0])
    row.update(status="DRAFT", review_status="GOOD", revision=1,
        content_sha256=question_content_sha256(question),
        review_notes=client.update_question_review.call_args.args[3],
        answers=deepcopy(client.insert_answers_batch.call_args.args[0]),
        domain={"id": row["domain_id"], "code": scope["domain_code"], "exam": row["exam"]})
    return case, payload, question, scope, frozen, raw, row


def test_shadow_is_read_only_and_matches_exact_hash(publish_case):
    case, payload, question, scope, request, verdict, row = publish_case
    before = case[0].read_bytes()
    report, bindings = publisher.plan_publication(case[0], case[1], [row])
    assert report["would_publish"] == 1, report
    assert report["published"] == 0
    assert report["candidates"][0]["content_sha256"] == question_content_sha256(question)
    assert case[0].read_bytes() == before
    assert len(bindings) == 3


@pytest.mark.parametrize("mutation", ["stem", "answer", "explanation", "key", "no_explanation", "status", "quarantine", "cert", "domain", "grounding", "journal"])
def test_publish_blocks_row_and_journal_mismatch(publish_case, mutation):
    case, payload, question, scope, request, verdict, row = publish_case
    if mutation == "stem": row["stem"] += " changed"
    elif mutation == "answer": row["answers"][0]["choice_text"] += " changed"
    elif mutation == "explanation": row["answers"][0]["explanation_text"] += " changed"
    elif mutation == "key": row["answers"][0]["is_correct"] = not row["answers"][0]["is_correct"]
    elif mutation == "no_explanation": row["answers"][0]["explanation_text"] = ""
    elif mutation == "status": row["status"] = "ACTIVE"
    elif mutation == "quarantine": row["review_status"] = "QUARANTINED"
    elif mutation == "cert": row["exam"] = "wrong"
    elif mutation == "domain": row["domain"]["code"] = "wrong"
    elif mutation == "grounding": row["review_notes"] = "{}"
    elif mutation == "journal":
        payload["candidates"][0].pop("inserted_question_id")
        case[0].write_text(json.dumps(payload))
    try:
        report, _ = publisher.plan_publication(case[0], case[1], [row])
        assert report["would_publish"] == 0
    except (ValueError, click.ClickException):
        # Journal/schema errors fail whole preflight, never authorize a publish.
        assert mutation in ("journal", "key")


@pytest.mark.parametrize("seat", ["blind_solver", "style", "evidence", "argon"])
def test_full_seat_schema_and_no_skips(publish_case, seat):
    _, _, question, scope, request, raw, _ = publish_case
    raw[seat] = {"status": "skipped", "reason": "prior_gate_failed"}
    assert publisher.publication_errors(question, scope, request, raw)


def _reject_short_circuit(raw, seat):
    raw[seat]["verdict"] = "FAIL"
    order = ("style", "evidence", "blind_solver")
    for name in order[order.index(seat) + 1:]:
        raw[name] = {"status": "skipped", "reason": "prior_gate_failed", "gate": seat}
    raw["argon"] = {"status": "skipped", "reason": "prior_gate_failed"}


@pytest.mark.parametrize("seat", ["style", "evidence", "blind_solver"])
@pytest.mark.parametrize("defect", ["FAIL", "UNCERTAIN", "low_score"])
def test_short_circuit_quality_refusal_names_failed_seat(publish_case, seat, defect):
    _, _, question, scope, request, raw, _ = publish_case
    _reject_short_circuit(raw, seat)
    raw[seat]["verdict"] = "PASS" if defect == "low_score" else defect
    if defect == "low_score":
        raw[seat]["confidence" if seat == "blind_solver" else "score"] = .79
    assert publisher.publication_errors(question, scope, request, raw) == ["council_rejected:" + seat]


@pytest.mark.parametrize("seat", ["style", "evidence", "blind_solver"])
def test_short_circuit_report_never_publishes(publish_case, seat):
    case, _, _, _, _, raw, row = publish_case
    _reject_short_circuit(raw, seat)
    (case[1] / case[6].name).write_text(json.dumps(raw))
    report, _ = publisher.plan_publication(case[0], case[1], [row])
    assert report["would_publish"] == report["published"] == 0
    assert report["candidates"][0]["would_publish"] is False
    assert report["candidates"][0]["reasons"] == ["council_rejected:" + seat]


@pytest.mark.parametrize("defect", ["wrong_key", "low_confidence", "uncertain"])
def test_argon_blind_short_circuit_names_failed_seat(publish_case, defect):
    _, _, question, scope, request, raw, _ = publish_case
    blind = raw["argon"]["blind"]
    if defect == "wrong_key":
        blind["choice"] = next(choice for choice in "ABCD" if choice != blind["choice"])
    elif defect == "low_confidence":
        blind["confidence"] = .79
    else:
        blind["verdict"] = "UNCERTAIN"
    raw["argon"]["review"] = {"status": "skipped", "reason": "prior_gate_failed", "gate": "argon.blind"}
    assert publisher.publication_errors(question, scope, request, raw) == ["council_rejected:argon.blind"]


@pytest.mark.parametrize("defect", ["wrong_gate", "wrong_reason", "extra_field", "no_failure",
    "malformed_failure", "malformed_later_seat", "malformed_argon_skip"])
def test_malformed_short_circuits_remain_invalid(publish_case, defect):
    _, _, question, scope, request, raw, _ = publish_case
    _reject_short_circuit(raw, "style")
    if defect == "wrong_gate": raw["evidence"]["gate"] = "evidence"
    elif defect == "wrong_reason": raw["evidence"]["reason"] = "private provider detail"
    elif defect == "extra_field": raw["evidence"]["extra"] = True
    elif defect == "no_failure": raw["style"]["verdict"] = "PASS"
    elif defect == "malformed_failure": raw["style"]["score"] = "0.1"
    elif defect == "malformed_later_seat": raw["blind_solver"] = {"verdict": "FAIL"}
    elif defect == "malformed_argon_skip": raw["argon"]["gate"] = "style"
    errors = publisher.publication_errors(question, scope, request, raw)
    assert errors and all(error.startswith("invalid_council:") for error in errors)
    assert "private provider detail" not in json.dumps(errors)


@pytest.mark.parametrize("defect", ["wrong_gate", "no_blind_failure", "bad_receipt", "bad_schema"])
def test_malformed_argon_review_skip_remains_invalid(publish_case, defect):
    _, _, question, scope, request, raw, _ = publish_case
    raw["argon"]["blind"]["confidence"] = .79
    raw["argon"]["review"] = {"status": "skipped", "reason": "prior_gate_failed", "gate": "argon.blind"}
    if defect == "wrong_gate": raw["argon"]["review"]["gate"] = "style"
    elif defect == "no_blind_failure": raw["argon"]["blind"]["confidence"] = .9
    elif defect == "bad_receipt": raw["argon"]["request_sha256"] = "0" * 64
    elif defect == "bad_schema": raw["argon"]["blind"]["confidence"] = "0.1"
    errors = publisher.publication_errors(question, scope, request, raw)
    assert errors and all(error.startswith("invalid_council:") for error in errors)


@pytest.mark.parametrize("seat", ["blind_solver", "argon"])
@pytest.mark.parametrize("defect", ["wrong", "low", "ambiguous", "missing", "uncertain"])
def test_both_blind_solvers_must_match_at_point_eight(publish_case, seat, defect):
    _, _, question, scope, request, raw, _ = publish_case
    blind = raw[seat]["blind"] if seat == "argon" else raw[seat]
    if defect == "wrong": blind["choice"] = next(k for k in "ABCD" if k != blind["choice"])
    elif defect == "low": blind["confidence"] = .799999
    elif defect == "ambiguous": blind["ambiguous_answers"] = True
    elif defect == "missing": blind.pop("confidence")
    elif defect == "uncertain": blind["verdict"] = "UNCERTAIN"
    assert publisher.publication_errors(question, scope, request, raw)


def test_freshness_rejects_learner_prose_not_urls_or_receipts(publish_case):
    _, _, question, scope, request, raw, _ = publish_case
    assert not freshness_errors(question)
    question["stem"] += " Use Vertex AI Pipelines."
    assert freshness_errors(question)
    assert publisher.publication_errors(question, scope, request, raw)
    question["stem"] = "Which option? https://cloud.google.com/vertex-ai/docs/start"
    assert not freshness_errors(question)


def test_old_review_only_council_can_never_publish(publish_case):
    _, _, question, scope, request, raw, _ = publish_case
    request["execution_policy"] = "short_circuit_v1"
    request["argon"]["version"] = 2
    request["argon"]["calls"].pop("blind")
    assert publisher.publication_errors(question, scope, request, raw)


def test_apply_uses_atomic_hash_rpc_and_final_input_fences(publish_case):
    case, _, _, _, _, _, row = publish_case
    report, bindings = publisher.plan_publication(case[0], case[1], [row])
    client = Mock()
    client.rpc.return_value.execute.return_value = SimpleNamespace(data={"changed": True})
    publisher.apply_publication(client, report, bindings)
    name, args = client.rpc.call_args.args
    assert name == "publish_question" and args["p_expected_sha256"] == row["content_sha256"]
    assert args["p_payload"]["expected_revision"] == 1
    assert report["published"] == 1
    client.reset_mock()
    case[6].write_text(case[6].read_text()+" ")
    with pytest.raises(ValueError): publisher.apply_publication(client, report, bindings)
    client.rpc.assert_not_called()


def test_canaries_refused_before_client_creation(publish_case, monkeypatch):
    case, _, _, _, _, _, row = publish_case
    marker = case[0].parent/".council-canaries"
    marker.touch()
    factory = Mock(side_effect=AssertionError("No DB client for canary"))
    monkeypatch.setattr(publisher, "database_client", factory)
    result = CliRunner().invoke(publisher.main, ["--artifact", str(case[0]), "--verdicts", str(case[1]),
        "--apply", "--report", str(case[0].parent/"report.json")])
    assert result.exit_code != 0
    factory.assert_not_called()


@pytest.mark.parametrize("artifact", DATA, ids=lambda a:a["source"])
def test_real_frozen_council_replay_never_upgrades_old_policy(artifact):
    # Recorded vendor responses are replayed, not fabricated fresh model proof.
    for row in artifact["rows"]:
        request = replay_request(row, False)
        assert publisher.publication_errors(row["question"], {}, request, row["verdict"])


def test_recorded_mixed_pilot_publisher_quality_labels():
    # Minimal, recorded pilot replay. No live model, provider or database calls.
    fixture = json.loads((Path(__file__).parent / "fixtures/v6_mixed_pilot.json").read_text())
    payload = fixture["artifact"]
    results = {}
    for entry in payload["candidates"]:
        ident = entry["candidate_id"]
        if ident not in fixture["verdicts"]:
            continue
        scope = payload["plan"][entry["index"] - 1]
        question = candidate_question(entry)
        request = build_request(ident, scope, question, entry["sources"], canonical_evidence(entry),
            argon_gate=True, execution_policy=payload["execution_policy"],
            doc_context_chars=payload["documentation_context_policy"]["max_chars"])
        raw = deepcopy(fixture["verdicts"][ident])
        if "request_sha256" in raw["argon"]:
            raw["argon"]["request_sha256"] = canonical_sha256(request["argon"])
        results[ident] = publisher.publication_errors(question, scope, request, raw)
    assert sorted(results.values()) == [[], ["council_rejected:style"]]


def test_new_draft_without_cached_hash_uses_recomputed_content(publish_case):
    case, _, _, _, _, _, row = publish_case
    row["content_sha256"] = None
    report, _ = publisher.plan_publication(case[0], case[1], [row])
    assert report["would_publish"] == 1


def test_strict_preflight_cannot_mask_artifact_change(publish_case, monkeypatch):
    case, _, _, _, _, _, row = publish_case
    original = publisher.ingest._strict_preflight
    def mutate(*args):
        original(*args)
        case[0].write_text(case[0].read_text()+" ")
    monkeypatch.setattr(publisher.ingest, "_strict_preflight", mutate)
    with pytest.raises(ValueError, match="Frozen inputs changed"):
        publisher.plan_publication(case[0], case[1], [row])


def test_candidate_evaluation_cannot_mask_verdict_change(publish_case, monkeypatch):
    case, _, _, _, _, _, row = publish_case
    original = publisher.publication_errors
    def mutate(*args, **kwargs):
        result = original(*args, **kwargs)
        path = case[1]/case[6].name
        path.write_text(path.read_text()+" ")
        return result
    monkeypatch.setattr(publisher, "publication_errors", mutate)
    with pytest.raises(ValueError, match="Frozen inputs changed"):
        publisher.plan_publication(case[0], case[1], [row])


def test_cli_defaults_offline_shadow_and_requires_explicit_database_read(publish_case, monkeypatch):
    case, _, _, _, _, _, row = publish_case
    export = case[0].parent/"rows.json"
    export.write_text(json.dumps({"questions": [row]}))
    report = case[0].parent/"shadow.json"
    factory = Mock(side_effect=AssertionError("No offline DB"))
    monkeypatch.setattr(publisher, "database_client", factory)
    args = ["--artifact",str(case[0]),"--verdicts",str(case[1]),"--questions",str(export),"--report",str(report)]
    result = CliRunner().invoke(publisher.main,args)
    assert result.exit_code == 0, result.output
    assert json.loads(report.read_text())["would_publish"] == 1
    factory.assert_not_called()
    result = CliRunner().invoke(publisher.main,args+["--apply"])
    assert result.exit_code != 0
    factory.assert_not_called()


def test_ambiguous_apply_keeps_durable_intent(publish_case):
    case, _, _, _, _, _, row = publish_case
    report, bindings = publisher.plan_publication(case[0], case[1], [row])
    client = Mock()
    client.rpc.return_value.execute.side_effect = RuntimeError("private provider body")
    checkpoints = []
    with pytest.raises(RuntimeError):
        publisher.apply_publication(client,report,bindings,checkpoint=lambda r: checkpoints.append(deepcopy(r)))
    assert checkpoints[0]["candidates"][0]["write_status"] == "unknown"
    assert checkpoints[-1]["published"] == 0
    assert "private provider body" not in json.dumps(checkpoints)


@pytest.mark.parametrize("field", ["stem","correct_answer","correct_explanation","distractor_1","distractor_1_explanation","distractor_2","distractor_2_explanation","distractor_3","distractor_3_explanation"])
@pytest.mark.parametrize("old", ["AI Platform","Gemini Enterprise Agent Platform","Vertex AI"])
def test_style_s11_names_veto_all_learner_fields(publish_case,field,old):
    _,_,question,_,_,_,_=publish_case
    question[field] += " " + old
    assert freshness_errors(question)


def test_variant_uses_real_parent_column_not_an_invented_alias(publish_case):
    case,_,_,_,_,_,row=publish_case
    row["parent_question_id"]="00000000-0000-0000-0000-000000000001"
    report,_=publisher.plan_publication(case[0],case[1],[row])
    assert not report["would_publish"]
    assert "variants_not_original_publications" in report["candidates"][0]["reasons"]
