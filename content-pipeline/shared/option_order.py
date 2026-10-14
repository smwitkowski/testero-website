"""Deterministic stored labels with authoritative ingest balance and canonical judging."""
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


def balanced_order(candidate_id, balance):
    """Derive a stored-to-canonical map from the eligible population and ordinal."""
    if (not isinstance(balance, dict) or set(balance) != {"version", "population_sha256", "index"}
            or type(balance["version"]) is not int or balance["version"] != 1
            or not isinstance(balance["population_sha256"], str)
            or len(balance["population_sha256"]) != 64
            or any(char not in "0123456789abcdef" for char in balance["population_sha256"])
            or type(balance["index"]) is not int or balance["index"] < 0):
        raise ValueError("Invalid option balance provenance")
    positions = list(LABELS)
    random.Random(int(balance["population_sha256"], 16)).shuffle(positions)
    target = positions[balance["index"] % 4]
    mapping = option_order(candidate_id)
    previous = next(label for label, origin in mapping.items() if origin == "A")
    mapping[previous], mapping[target] = mapping[target], mapping[previous]
    return mapping


def stored_order(entry):
    """Check the generation shuffle or the authoritative ingest mapping."""
    expected = (balanced_order(entry["candidate_id"], entry["option_balance"])
                if "option_balance" in entry else option_order(entry["candidate_id"]))
    mapping = entry.get("option_order")
    if mapping is None:
        if "option_balance" in entry or entry.get("key") != "A":
            raise ValueError("Non-A key requires deterministic option order")
        return dict(zip(LABELS, LABELS))
    if mapping != expected or entry.get("key") != next(
            label for label, origin in expected.items() if origin == "A"):
        raise ValueError("Invalid stored option order or key")
    return mapping


def balance_options(entries):
    """Balance eligible candidates, preserving canonical judged content and receipts."""
    import json
    from shared.external_judge import candidate_question

    ordered = sorted(entries, key=lambda entry: entry["candidate_id"])
    ids = [entry["candidate_id"] for entry in ordered]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate eligible candidate IDs")
    digest = hashlib.sha256(json.dumps(ids, separators=(",", ":")).encode()).hexdigest()
    layouts = []
    for index, entry in enumerate(ordered):
        question, evidence = candidate_question(entry), canonical_evidence(entry)
        balance = {"version": 1, "population_sha256": digest, "index": index}
        mapping = balanced_order(entry["candidate_id"], balance)
        if entry.get("persistence_status") is not None:
            if entry.get("option_balance") != balance or entry.get("option_order") != mapping:
                raise ValueError("Persisted option layout requires human reconciliation")
        layouts.append((entry, question, evidence, balance, mapping))
    for entry, question, evidence, balance, mapping in layouts:
        if entry.get("persistence_status") is not None:
            continue
        entry["option_balance"] = balance
        _store_options(entry, question, evidence, mapping)
        if "grounding" in entry:
            entry["grounding"].update(option_balance=balance, option_order=mapping,
                                      evidence=entry["evidence"])


def store_options(entry, question, evidence):
    entry.pop("option_balance", None)
    _store_options(entry, question, evidence, option_order(entry["candidate_id"]))


def _store_options(entry, question, evidence, mapping):
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
    mapping = stored_order(entry)
    return sorted([{**row, "option_label": mapping[row["option_label"]]} for row in entry["evidence"]],
                  key=lambda row: row["option_label"])
