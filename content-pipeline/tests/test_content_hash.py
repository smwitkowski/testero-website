import json
from pathlib import Path

import pytest

from shared.content_hash import canonical_content, content_sha256, question_content_sha256

VECTORS = json.loads((Path(__file__).parent / "fixtures/content_hash_vectors.json").read_text())


@pytest.mark.parametrize("vector", VECTORS, ids=lambda v: v["name"])
def test_shared_vectors(vector):
    assert canonical_content(vector["stem"], vector["answers"]) == vector["canonical"]
    assert content_sha256(vector["stem"], vector["answers"]) == vector["sha256"]
    assert content_sha256(vector["stem"], list(reversed(vector["answers"]))) == vector["sha256"]


def test_every_content_field_is_bound_but_labels_are_not():
    v = VECTORS[0]
    assert content_sha256(v["stem"] + " ", v["answers"]) != v["sha256"]
    for index in range(4):
        for field in ("choice_text", "explanation_text"):
            answers = [dict(a) for a in v["answers"]]
            answers[index][field] += "!"
            assert content_sha256(v["stem"], answers) != v["sha256"]
    answers = [dict(a, choice_label=str(i)) for i, a in enumerate(v["answers"])]
    assert content_sha256(v["stem"], answers) == v["sha256"]


def test_key_and_type_validation():
    for answers in ([], [{"choice_text": "A", "is_correct": 1}],
                    [{"choice_text": "A", "is_correct": True}] * 2):
        with pytest.raises(ValueError):
            content_sha256("Question", answers)
    with pytest.raises(ValueError):
        content_sha256("nul\x00", VECTORS[0]["answers"])


def test_pipeline_adapter():
    v = VECTORS[0]
    question = {"stem": v["stem"], "correct_answer": v["answers"][0]["choice_text"],
                "correct_explanation": v["answers"][0]["explanation_text"]}
    for i, answer in enumerate(v["answers"][1:], 1):
        question[f"distractor_{i}"] = answer["choice_text"]
        question[f"distractor_{i}_explanation"] = answer["explanation_text"]
    assert question_content_sha256(question) == v["sha256"]
