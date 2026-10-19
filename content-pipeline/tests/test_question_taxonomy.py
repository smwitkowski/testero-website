import copy
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from shared.question_taxonomy import (BOUNDS, TaxonomyError, QuestionTaxonomySignature,
    classify_question, validate_tags, validate_vocabulary)
from scripts.backfill_question_tags import (select_questions, frozen_inputs, validate_document,
    artifact_plans, persist)

ID = "00000000-0000-4000-8000-000000000001"

@pytest.fixture
def vocab():
    return {"version": 1, "dimensions": {d: {"min": lo, "max": hi,
        "values": [{"value_key": "one", "label": "One", "definition": "A decision",
                    "cert_scope": ["pmle"]}]} for d, (lo, hi) in BOUNDS.items()}}

@pytest.fixture
def tags():
    return [{"dimension": "decision_type", "value_key": "one", "confidence": 0.9}]

@pytest.mark.parametrize("mutation", [
    lambda t: t[0].update(confidence=True),
    lambda t: t[0].update(confidence="0.8"),
    lambda t: t[0].update(confidence=float("nan")),
    lambda t: t[0].update(confidence=float("inf")),
    lambda t: t[0].update(confidence=1.1),
    lambda t: t[0].update(extra=1),
    lambda t: t[0].update(value_key="unknown"),
    lambda t: t[0].update(dimension="unknown"),
    lambda t: t.append(dict(t[0])),
    lambda t: t.clear(),
])
def test_bad_tags(vocab, tags, mutation):
    mutation(tags)
    with pytest.raises(ValueError): validate_tags(tags, vocab, "pmle")

def test_scope_and_cardinality(vocab, tags):
    with pytest.raises(ValueError): validate_tags(tags, vocab, "other")
    for n in range(4):
        value = {"value_key": str(n), "label": "X", "definition": "Y", "cert_scope": ["pmle"]}
        vocab["dimensions"]["constraint"]["values"].append(value)
        tags.append({"dimension": "constraint", "value_key": str(n), "confidence": 0.8})
    with pytest.raises(ValueError): validate_tags(tags, vocab, "pmle")

def test_predictor(vocab, tags):
    predictor = Mock(return_value={"tags": tags})
    question = {"stem": "Choose", "answers": [{"is_correct": True, "explanation": "Why"}]}
    assert classify_question(question, vocab, "pmle", predictor=predictor) == tags
    assert predictor.call_args.args[:2] == ("claude", QuestionTaxonomySignature)
    assert "is_correct" in predictor.call_args.args[2]["question_json"]
    predictor.return_value = {"tags": tags, "extra": 1}
    with pytest.raises(ValueError): classify_question(question, vocab, "pmle", predictor=predictor)

def test_bad_vocab(vocab):
    vocab["dimensions"]["constraint"]["max"] = 4
    with pytest.raises(ValueError): validate_vocabulary(vocab)

def test_selection():
    row = {"id": ID, "status": "ACTIVE"}
    assert select_questions([row]) == [row]
    with pytest.raises(ValueError): select_questions([row, row])
    with pytest.raises(ValueError): select_questions([row], question_ids=[ID.replace("001", "002")])
    with pytest.raises(ValueError): select_questions([row], status="DRAFT", question_ids=[ID])


def test_frozen_review(vocab, tags):
    rows = [{"id": ID, "status": "ACTIVE", "exam": "pmle", "stem": "Test"}]
    meta, inputs = frozen_inputs(rows, vocab, "claude", {}, "ACTIVE", None)
    doc = {"metadata": meta, "reviewed": True, "questions": [{**inputs[0][1], "tags": tags}]}
    assert validate_document(doc, meta, inputs, vocab, complete=True)
    for field in ("input_hash", "question_id", "cert_id"):
        bad = copy.deepcopy(doc); bad["questions"][0][field] = "stale"
        with pytest.raises(ValueError): validate_document(bad, meta, inputs, vocab, complete=True)
    bad = copy.deepcopy(doc); bad["reviewed"] = False
    with pytest.raises(ValueError): validate_document(bad, meta, inputs, vocab, complete=True)
    changed = copy.deepcopy(rows); changed[0]["stem"] = "Changed"
    _, changed_inputs = frozen_inputs(changed, vocab, "claude", {}, "ACTIVE", None)
    with pytest.raises(ValueError): validate_document(doc, meta, changed_inputs, vocab, complete=True)
    changed_meta = {**meta, "vocabulary_hash": "changed"}
    with pytest.raises(ValueError): validate_document(doc, changed_meta, inputs, vocab, complete=True)


def test_artifact_exact_ids(tmp_path):
    import json
    (tmp_path / "artifact.json").write_text(json.dumps({"results": [
        {"candidate_id": "candidate-1", "decision_plan": {"x": "ignore"}},
        {"inserted_question_id": ID, "decision_plan": {"x": "correct"}},
        {"repairs": [{"question_id": ID, "decision_plan": {"x": "correct"}}]}]}))
    assert artifact_plans(tmp_path) == {ID: {"x": "correct"}}
    (tmp_path / "artifact.json").write_text(json.dumps({"decision_plan": {"x": "repaired"},
        "candidate_id": "not-a-uuid-r1", "repair": {"storage_question_id": ID}}))
    assert artifact_plans(tmp_path) == {ID: {"x": "repaired"}}


def test_persistence(tags):
    client = SimpleNamespace(client=Mock())
    records = [{"question_id": ID, "tags": tags}]
    persist(client, records); persist(client, records)
    assert client.client.rpc.call_count == 2
    assert client.client.rpc.call_args.args[0] == "replace_question_tags"
    assert client.client.rpc.call_args.args[1]["p_question_id"] == ID
    client.client.rpc.return_value.execute.side_effect = RuntimeError("credential")
    with pytest.raises(TaxonomyError, match="0 questions completed") as error:
        persist(client, records)
    assert "credential" not in str(error.value)


def test_write_preflight_never_classifies_or_constructs_client(tmp_path, vocab, tags, monkeypatch):
    import json
    import scripts.backfill_question_tags as cli
    bank = tmp_path / "bank.json"; vocabulary = tmp_path / "vocab.json"; reviewed = tmp_path / "tags.json"
    rows = [{"id": ID, "status": "ACTIVE", "exam": "pmle", "stem": "Test"}]
    bank.write_text(json.dumps(rows)); vocabulary.write_text(json.dumps(vocab))
    metadata, inputs = frozen_inputs(rows, vocab, "claude", {}, "ACTIVE", None)
    reviewed.write_text(json.dumps({"metadata": metadata, "reviewed": False,
        "questions": [{**inputs[0][1], "tags": tags}]}))
    classifier = Mock(side_effect=AssertionError("Must not classify"))
    monkeypatch.setattr(cli, "classify_question", classifier)
    assert cli.main(["--bank-export", str(bank), "--vocabulary", str(vocabulary),
                     "--write", "--input-tags", str(reviewed)]) == 1
    classifier.assert_not_called()


def test_exam_mapping(vocab):
    _, inputs = frozen_inputs([{"id": ID, "exam": "GCP_PM_ML_ENG"}], vocab, "claude", {}, "ACTIVE", None)
    assert inputs[0][1]["cert_id"] == "machine-learning-engineer"


def test_generation_receipt_is_opt_in_plan_bound(monkeypatch):
    from shared.question_taxonomy import generation_receipt, validate_generation_receipt
    scope = {"cert_id": "machine-learning-engineer", "objective_id": "1.1",
             "decision_plan": {"decision": "choose managed endpoint capacity"}}
    predictor = Mock(return_value={"tags": [{"dimension": "decision_type", "value_key": "scale_capacity", "confidence": 0.9}]})
    receipt = generation_receipt(scope, predictor=predictor)
    assert validate_generation_receipt(receipt, scope) == receipt["tags"]
    with pytest.raises(ValueError):
        validate_generation_receipt(receipt, {**scope, "decision_plan": {"changed": True}})
    from scripts.ingest_external_verdicts import _taxonomy_tags
    assert _taxonomy_tags({}, {}, scope) is None
    with pytest.raises(ValueError):
        _taxonomy_tags({}, {"taxonomy": receipt}, scope)
    assert _taxonomy_tags({"taxonomy_enabled": True}, {"taxonomy": receipt}, scope) == receipt["tags"]


def test_evaluation_counts_sets_not_tag_order(vocab, tags):
    from scripts.evaluate_question_tags import evaluate
    from shared.question_taxonomy import digest
    gold = {"vocabulary_hash": digest(vocab), "questions": [{"question_id": ID, "cert_id": "pmle", "bank_hash": "frozen-evidence",
            "tags": [{"dimension": "decision_type", "value_key": "one"}]}]}
    predictions = {"reviewed": True, "metadata": {"vocabulary_hash": digest(vocab)},
                   "questions": [{"question_id": ID, "cert_id": "pmle", "bank_hash": "frozen-evidence", "tags": tags}]}
    result = evaluate(gold, predictions, vocab)
    assert result["dimensions"]["decision_type"]["exact_match"] == 1
    assert result["dimensions"]["constraint"]["f1"] is None
    predictions["questions"][0]["tags"] = [*tags, {"dimension": "constraint", "value_key": "one", "confidence": 0.8}]
    result = evaluate(gold, predictions, vocab)
    assert result["dimensions"]["constraint"]["fp"] == 1
    assert len(result["disagreements"]) == 1
    with pytest.raises(ValueError):
        evaluate(gold, {"questions": []}, vocab)


def test_frozen_gold_has_expected_population_and_valid_labels():
    from pathlib import Path
    from shared.question_taxonomy import load_json, load_vocabulary, digest
    vocabulary = load_vocabulary()
    gold = load_json(Path(__file__).parent / "fixtures/question-taxonomy-gold.json")
    assert gold["vocabulary_hash"] == digest(vocabulary)
    assert len(gold["questions"]) == len({r["question_id"] for r in gold["questions"]}) == 25
    for row in gold["questions"]:
        assert len(row["bank_hash"]) == 64
        validate_tags([{**t, "confidence": 1.0} for t in row["tags"]], vocabulary, row["cert_id"])
