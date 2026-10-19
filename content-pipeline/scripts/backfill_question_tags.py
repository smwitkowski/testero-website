"""Offline classification and explicitly reviewed, hash-bound tag backfill."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys
from uuid import UUID
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared.question_taxonomy import (TaxonomyError, classify_question, digest, load_json,
                                      load_vocabulary, validate_tags, DEFAULT_VOCABULARY)
from shared.model_policy import DEFAULT_CLAUDE_MODEL

SOURCE = "taxonomy_classifier_v1"

def uuid(value):
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise TaxonomyError("Expected canonical UUID")
    return value

def select_questions(bank, status="ACTIVE", question_ids=None, limit=None):
    rows = bank["questions"] if isinstance(bank, dict) else bank
    if not isinstance(rows, list):
        raise TaxonomyError("Bank must contain question rows")
    indexed = {}
    for row in rows:
        key = uuid(row["id"])
        if key in indexed:
            raise TaxonomyError("Duplicate bank question")
        indexed[key] = row
    ids = [uuid(v) for v in (question_ids or [])]
    if len(ids) != len(set(ids)) or any(v not in indexed for v in ids):
        raise TaxonomyError("Duplicate or missing selected question")
    if ids and any(indexed[v].get("status") != status for v in ids):
        raise TaxonomyError("Selected question status mismatch")
    selected = [indexed[v] for v in sorted(ids or indexed) if indexed[v].get("status") == status]
    if limit is not None:
        if limit < 1:
            raise TaxonomyError("Limit must be positive")
        selected = selected[:limit]
    if not selected:
        raise TaxonomyError("No selected questions")
    return selected

def artifact_plans(directory):
    """Link plans by exact inserted/candidate question UUID, including repair records."""
    plans = {}
    def visit(node):
        if isinstance(node, list):
            for item in node: visit(item)
        elif isinstance(node, dict):
            if isinstance(node.get("decision_plan"), dict):
                for field in ("question_id", "inserted_question_id", "storage_question_id", "candidate_id"):
                    value = node.get(field)
                    if field == "storage_question_id" and value is None and isinstance(node.get("repair"), dict):
                        value = node["repair"].get(field)
                    try: key = uuid(value)
                    except (ValueError, TypeError, AttributeError): continue
                    plan = node["decision_plan"]
                    if key in plans and plans[key] != plan:
                        raise TaxonomyError("Conflicting artifact decision plans")
                    plans[key] = plan
            for value in node.values(): visit(value)
    if directory:
        for path in sorted(Path(directory).glob("*.json")):
            visit(load_json(path))
    return plans

def frozen_inputs(rows, vocabulary, model, plans, status, limit):
    resolved = DEFAULT_CLAUDE_MODEL if model == "claude" else model.removeprefix("claude/")
    metadata = {"version": 1, "source": SOURCE, "model": model, "resolved_model": resolved,
                "vocabulary_hash": digest(vocabulary), "status": status, "limit": limit,
                "question_ids": [row["id"] for row in rows]}
    inputs = []
    for row in rows:
        cert = row.get("cert_id") or row.get("exam")
        cert = {"GCP_PM_ML_ENG": "machine-learning-engineer"}.get(cert, cert)
        if not isinstance(cert, str) or not cert:
            raise TaxonomyError("Missing certification")
        evidence = dict(row)
        if row["id"] in plans: evidence["decision_plan"] = plans[row["id"]]
        inputs.append((evidence, {"question_id": row["id"], "cert_id": cert,
                                 "bank_hash": digest(row), "input_hash": digest(evidence)}))
    return metadata, inputs

def validate_document(document, metadata, inputs, vocabulary, *, complete=False):
    if set(document) != {"metadata", "reviewed", "questions"} or document["metadata"] != metadata or type(document["reviewed"]) is not bool:
        raise TaxonomyError("Classification metadata mismatch")
    records = document["questions"]
    if not isinstance(records, list) or len(records) > len(inputs):
        raise TaxonomyError("Invalid classification rows")
    if complete and (not document["reviewed"] or len(records) != len(inputs)):
        raise TaxonomyError("Write requires a complete reviewed classification")
    for record, (_, expected) in zip(records, inputs):
        if set(record) != {*expected, "tags"} or any(record[k] != v for k, v in expected.items()):
            raise TaxonomyError("Stale or reordered classification")
        validate_tags(record["tags"], vocabulary, expected["cert_id"])
    return records

def save(path, document):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(document, indent=2, allow_nan=False) + "\n")
    temporary.replace(path)

def persist(client, records):
    completed = 0
    try:
        for record in records:
            client.client.rpc("replace_question_tags", {"p_question_id": record["question_id"],
                "p_source": "backfill", "p_tags": record["tags"]}).execute()
            completed += 1
    except Exception:
        raise TaxonomyError(f"Tag persistence failed; {completed} questions completed; rerun reviewed input to resume") from None

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bank-export", type=Path, required=True)
    parser.add_argument("--vocabulary", type=Path, default=DEFAULT_VOCABULARY)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--input-tags", type=Path)
    parser.add_argument("--artifact-dir", type=Path)
    parser.add_argument("--status", choices=("ACTIVE", "DRAFT"), default="ACTIVE")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--question-id", action="append")
    parser.add_argument("--model", default="claude")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)
    try:
        if not (args.model == "claude" or args.model.startswith("claude/")):
            raise TaxonomyError("Unsupported model")
        if args.write and (not args.input_tags or args.output):
            raise TaxonomyError("Write requires --input-tags and forbids --output")
        if not args.write and not args.output:
            raise TaxonomyError("Dry run requires --output")
        vocabulary = load_vocabulary(args.vocabulary)
        rows = select_questions(load_json(args.bank_export), args.status, args.question_id, args.limit)
        metadata, inputs = frozen_inputs(rows, vocabulary, args.model, artifact_plans(args.artifact_dir), args.status, args.limit)
        if args.write:
            records = validate_document(load_json(args.input_tags), metadata, inputs, vocabulary, complete=True)
            # Import only after the entire write input has passed validation.
            import os
            os.environ["PYTHON_DOTENV_DISABLED"] = "1"
            from scripts.generate_pmle_questions import database_client
            persist(database_client(), records)
            print(f"Persisted tags for {len(records)} questions")
        else:
            document = load_json(args.output) if args.output.exists() else {"metadata": metadata, "reviewed": False, "questions": []}
            records = validate_document(document, metadata, inputs, vocabulary)
            if document["reviewed"]:
                raise TaxonomyError("Do not resume a reviewed output")
            for evidence, expected in inputs[len(records):]:
                tags = classify_question(evidence, vocabulary, expected["cert_id"], model=args.model)
                records.append({**expected, "tags": tags})
                save(args.output, document)
            print(f"Dry run: {len(records)} classified; review tags and set reviewed=true before --write")
        return 0
    except Exception as error:
        if isinstance(error, TaxonomyError) and str(error).startswith("Tag persistence failed;"):
            print(str(error), file=sys.stderr)
        else:
            print("Tagging failed; inputs, classification, or persistence could not be validated. No further writes attempted.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
