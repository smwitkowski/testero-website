"""Deterministic stored labels; generation and judging retain canonical A-key views."""
import hashlib
import random

LABELS = "ABCD"
OPTION_FIELDS = ("correct_answer", "distractor_1", "distractor_2", "distractor_3")
RATIONALE_FIELDS = ("correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation")


def option_order(candidate_id):
    """Map stored labels to canonical labels using the candidate ID alone."""
    labels = list(LABELS)
    random.Random(int.from_bytes(hashlib.sha256(candidate_id.encode()).digest(), "big")).shuffle(labels)
    return dict(zip(LABELS, labels))


def store_options(entry, question, evidence):
    mapping = option_order(entry["candidate_id"])
    entry["option_order"] = mapping
    entry["key"] = next(label for label, origin in mapping.items() if origin == "A")
    entry["options"] = [{"label": label, "text": question[OPTION_FIELDS[LABELS.index(origin)]]}
                        for label, origin in mapping.items()]
    entry["rationales"] = {label: question[RATIONALE_FIELDS[LABELS.index(origin)]]
                           for label, origin in mapping.items()}
    inverse = {origin: label for label, origin in mapping.items()}
    entry["evidence"] = sorted([{**receipt, "option_label": inverse[receipt["option_label"]]}
                                for receipt in evidence], key=lambda row: row["option_label"])


def canonical_evidence(entry):
    """Recover receipts for canonical generator/judge fields, checking label binding."""
    mapping = entry.get("option_order")
    if mapping is None:
        if entry.get("key") != "A":
            raise ValueError("Non-A key requires deterministic option order")
        return entry["evidence"]
    if mapping != option_order(entry["candidate_id"]) or entry.get("key") != next(
            label for label, origin in mapping.items() if origin == "A"):
        raise ValueError("Invalid stored option order or key")
    return sorted([{**row, "option_label": mapping[row["option_label"]]} for row in entry["evidence"]],
                  key=lambda row: row["option_label"])
