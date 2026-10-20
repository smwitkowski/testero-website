"""PDE projections preserve alternatives; all other cert projections stay exact."""
import json
from shared.near_duplicates import comparison_row, load_export


def row(cert="data-engineer", answers=False):
    result = {"id": "q", "cert_id": cert, "status": "ACTIVE", "stem": "Your team needs job scoped compute."}
    texts = ["Use an ephemeral cluster", "Keep a persistent cluster", "Stop the cluster", "Autoscale workers"]
    if answers:
        result["answers"] = [{"choice_text": text, "is_correct": i == 0} for i, text in enumerate(texts)]
    else:
        result["key"] = "B"
        result["options"] = [{"label": label, "text": text} for label, text in zip("BACD", texts)]
    return result


def test_pde_preserves_distractor_text_for_options_and_export_answers(tmp_path):
    for answers in (False, True):
        question = row(answers=answers)
        projected = comparison_row(question)
        assert projected["key"] == "Use an ephemeral cluster"
        assert projected["distractors"] == ["Keep a persistent cluster", "Stop the cluster", "Autoscale workers"]
        assert projected["answer_pattern_source"] == ("answers" if answers else "options")
        # Real exports may identify certification by exam instead of cert_id.
        question["exam"] = question.pop("cert_id")
        path = tmp_path / "bank.json"
        path.write_text(json.dumps([question]))
        assert load_export(path, cert_id="data-engineer")["questions"] == [projected]


def test_pmle_and_other_cert_comparison_output_is_exactly_unchanged(tmp_path):
    for cert in ("machine-learning-engineer", "cloud-engineer", "cloud-architect"):
        for answers in (False, True):
            question = row(cert, answers)
            expected = {"id": "q", "stem": question["stem"], "key": "Use an ephemeral cluster", "cert_id": cert}
            assert comparison_row(question) == expected
            path = tmp_path / "bank.json"
            path.write_text(json.dumps([question]))
            assert load_export(path, cert_id=cert)["questions"] == [expected]
    historical = row("machine-learning-engineer")
    historical.pop("cert_id")
    assert comparison_row(historical) == {"id": "q", "stem": historical["stem"], "key": "Use an ephemeral cluster"}
    path.write_text(json.dumps([historical]))
    assert load_export(path, cert_id="machine-learning-engineer")["questions"] == [
        {"id": "q", "stem": historical["stem"], "key": "Use an ephemeral cluster", "cert_id": "machine-learning-engineer"}]
