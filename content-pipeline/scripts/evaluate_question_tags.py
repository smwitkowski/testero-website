"""Compare question-tag predictions with a manually labeled gold set, offline."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.question_taxonomy import digest, load_json, load_vocabulary, validate_tags, TaxonomyError


def evaluate(gold, predictions, vocabulary, *, unreviewed_ok=False):
    if gold["vocabulary_hash"] != digest(vocabulary):
        raise TaxonomyError("Gold vocabulary changed; adjudicate labels first")
    if not unreviewed_ok and predictions.get("reviewed") is not True:
        raise TaxonomyError("Predictions require review; use --unreviewed-ok for evaluation only")
    if predictions.get("metadata", {}).get("vocabulary_hash") != digest(vocabulary):
        raise TaxonomyError("Predictions require matching vocabulary")
    def index(rows):
        result = {}
        for row in rows:
            if row["question_id"] in result:
                raise TaxonomyError("Duplicate evaluation ID")
            result[row["question_id"]] = row
        return result
    expected = index(gold["questions"])
    actual = index(predictions["questions"])
    missing = sorted(set(expected) - set(actual))
    if missing:
        raise TaxonomyError(f"Missing {len(missing)} gold predictions")
    totals = {d: {"exact": 0, "tp": 0, "fp": 0, "fn": 0} for d in vocabulary["dimensions"]}
    disagreements = []
    for key, row in expected.items():
        cert = row["cert_id"]
        if (actual[key].get("cert_id") != cert
                or not row.get("bank_hash") or actual[key].get("bank_hash") != row["bank_hash"]):
            raise TaxonomyError("Prediction evidence or certification differs from gold")
        wanted = validate_tags([{**t, "confidence": 1.0} for t in row["tags"]], vocabulary, cert)
        observed = validate_tags(actual[key]["tags"], vocabulary, cert)
        for dimension, total in totals.items():
            left = {t["value_key"] for t in wanted if t["dimension"] == dimension}
            right = {t["value_key"] for t in observed if t["dimension"] == dimension}
            total["exact"] += left == right
            total["tp"] += len(left & right)
            total["fp"] += len(right - left)
            total["fn"] += len(left - right)
            if left != right:
                disagreements.append({"question_id": key, "dimension": dimension,
                                      "expected": sorted(left), "predicted": sorted(right)})
    count = len(expected)
    if not count:
        raise TaxonomyError("Empty gold set")
    for total in totals.values():
        total["exact_match"] = total["exact"] / count
        tp, fp, fn = total["tp"], total["fp"], total["fn"]
        total["precision"] = tp / (tp + fp) if tp + fp else None
        total["recall"] = tp / (tp + fn) if tp + fn else None
        total["f1"] = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None
    return {"questions": count, "ignored_non_gold_predictions": len(set(actual) - set(expected)),
            "dimensions": totals, "disagreements": disagreements,
            "note": "Agreement with one analyst's reference, not pedagogical validity or learner mastery."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gold", type=Path, default=Path(__file__).resolve().parents[1] / "tests/fixtures/question-taxonomy-gold.json")
    parser.add_argument("--predictions", type=Path, nargs="+", required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--unreviewed-ok", action="store_true",
                        help="Evaluate predictions without reviewed=true; does not authorize writes")
    args = parser.parse_args(argv)
    vocabulary = load_vocabulary()
    documents = [load_json(path) for path in args.predictions]
    if any(doc.get("metadata", {}).get("vocabulary_hash") != digest(vocabulary) for doc in documents):
        raise TaxonomyError("Each prediction file must match this vocabulary")
    combined = {"reviewed": all(doc.get("reviewed") is True for doc in documents),
                "metadata": {"vocabulary_hash": digest(vocabulary)},
                "questions": [row for doc in documents for row in doc["questions"]]}
    result = evaluate(load_json(args.gold), combined, vocabulary, unreviewed_ok=args.unreviewed_ok)
    text = json.dumps(result, indent=2) + "\n"
    if args.output:
        args.output.write_text(text)
    else:
        print(text, end="")

if __name__ == "__main__":
    main()
