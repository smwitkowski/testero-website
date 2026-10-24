"""Versioned, label/order-independent content hash shared with PostgreSQL.

No trimming or Unicode normalization is performed. Frames are UTF-8 byte-length,
colon, then text. SQL uses COLLATE "C"; Python sorts by UTF-8 bytes. Labels,
answer IDs, domain metadata and the overall explanation are not part of the hash.
Missing option explanations are encoded as empty strings for legacy backfill;
publication separately requires nonempty explanations and exactly four options.
"""
from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence

PREFIX = "testero-content-v1|"


def _frame(text: str) -> str:
    if not isinstance(text, str) or "\x00" in text:
        raise ValueError("Content fields must be PostgreSQL-compatible strings")
    return f"{len(text.encode('utf-8'))}:{text}"


def canonical_content(stem: str, answers: Sequence[Mapping]) -> str:
    """Serialize DB-shaped answer rows; require exactly one boolean key."""
    keys, distractors = [], []
    for answer in answers:
        if type(answer.get("is_correct")) is not bool:
            raise ValueError("is_correct must be boolean")
        text = answer["choice_text"]
        explanation = answer.get("explanation_text")
        if explanation is None:
            explanation = ""
        _frame(text)
        _frame(explanation)
        (keys if answer["is_correct"] else distractors).append((text, explanation))
    if len(keys) != 1:
        raise ValueError("Exactly one correct answer is required")
    distractors.sort(key=lambda pair: (pair[0].encode("utf-8"), pair[1].encode("utf-8")))
    fields = [stem, *keys[0], str(len(distractors))]
    for pair in distractors:
        fields.extend(pair)
    return PREFIX + "".join(_frame(field) for field in fields)


def content_sha256(stem: str, answers: Sequence[Mapping]) -> str:
    """Hash the canonical DB-shaped content, independent of labels and row order."""
    return hashlib.sha256(canonical_content(stem, answers).encode("utf-8")).hexdigest()


def question_content_sha256(question: Mapping) -> str:
    """Adapt exact cleaned pipeline QUESTION_FIELDS (correct answer plus three distractors)."""
    answers = [{"choice_text": question["correct_answer"],
                "explanation_text": question["correct_explanation"], "is_correct": True}]
    answers.extend({"choice_text": question[f"distractor_{i}"],
                    "explanation_text": question[f"distractor_{i}_explanation"], "is_correct": False}
                   for i in range(1, 4))
    return content_sha256(question["stem"], answers)
