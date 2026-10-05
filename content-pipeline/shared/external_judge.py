"""Canonical external judge requests, sharing the Claude DSPy prompt and schema."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import uuid

from shared.cli_models import output_model, signature_prompt
from shared.doc_search import documentation_context
from shared.evidence import check_evidence, normalize_whitespace
from shared.model_policy import EXTERNAL_JUDGE_PROVENANCE
from shared.quality_gate import QUESTION_FIELDS, QuestionQualitySignature

EXTERNAL_POLICY_MODEL = "anthropic/claude-sonnet-5.5"
REQUEST_CHARACTER_LIMIT = 60000


def request_directory(artifact_path):
    path = Path(artifact_path)
    return path.with_name(path.stem + ".judge-requests")


def candidate_id(index, scope, question):
    """Stable content-bound UUID, with index ensuring uniqueness within a plan."""
    content = json.dumps({"index": index, "objective_id": scope["objective_id"],
                          "guide_sha256": scope["guide_sha256"], "question": question},
                         sort_keys=True, ensure_ascii=False, allow_nan=False)
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "testero-external:" + content))


def candidate_question(entry):
    """Rebuild the exact cleaned A-key question without cleaning it a second time."""
    if entry.get("key") != "A":
        raise ValueError("External candidate must have key A")
    options = entry.get("options")
    rationales = entry.get("rationales")
    if (not isinstance(options, list) or len(options) != 4
            or any(not isinstance(item, dict) for item in options)
            or sorted(item.get("label", "") for item in options) != list("ABCD")
            or not isinstance(rationales, dict) or set(rationales) != set("ABCD")):
        raise ValueError("External candidate must contain exact A-D options and rationales")
    mapping = {item["label"]: item.get("text") for item in options}
    question = {"stem": entry.get("stem")}
    for label, answer, rationale in zip("ABCD", QUESTION_FIELDS[1:5], QUESTION_FIELDS[5:]):
        question[answer], question[rationale] = mapping[label], rationales[label]
    if any(not isinstance(value, str) or not value.strip() for value in question.values()):
        raise ValueError("External candidate has missing or mistyped question fields")
    return {name: question[name] for name in QUESTION_FIELDS}


def _merge_windows(windows):
    merged = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def _source_context(cited, evidence, margin):
    if margin is None:
        metadata = {"enabled": False, "method": "full cited sources", "character_limit": REQUEST_CHARACTER_LIMIT,
                    "sources": [{"url": source["url"], "original_text_sha256": source["text_sha256"],
                                 "original_characters": len(source["text"]),
                                 "included_characters": len(source["text"]),
                                 "windows": [[0, len(source["text"])]]} for source in cited]}
        return documentation_context(cited), metadata
    excerpts, records = [], []
    for source in cited:
        text = normalize_whitespace(source["text"])
        quotes = [item["quote"] for item in evidence if item["url"] == source["url"]]
        windows = []
        for quote in quotes:
            start = text.index(normalize_whitespace(quote))
            windows.append([max(0, start - margin), min(len(text), start + len(quote) + margin)])
        windows = _merge_windows(windows)
        excerpt = "\n[... source text omitted ...]\n".join(text[start:end] for start, end in windows)
        excerpt_hash = hashlib.sha256(excerpt.encode()).hexdigest()
        excerpts.append({**source, "text": excerpt, "text_sha256": excerpt_hash})
        records.append({"url": source["url"], "original_text_sha256": source["text_sha256"],
                        "excerpt_sha256": excerpt_hash, "original_characters": len(source["text"]),
                        "normalized_characters": len(text), "included_characters": sum(b-a for a,b in windows),
                        "margin": margin, "windows": windows})
    metadata = {"enabled": True, "method": "quote-centered windows in whitespace-normalized fetched text",
                "character_limit": REQUEST_CHARACTER_LIMIT, "sources": records}
    context = ("Only quote-centered excerpts of the fetched sources are shown. Omitted context is marked. "
               "Text SHA-256 below identifies each excerpt, not the original full fetch. "
               "Original fetch hashes and offsets are recorded here: " + json.dumps(records, ensure_ascii=False) +
               "\n\n" + documentation_context(excerpts))
    return context, metadata


def build_request(candidate_id, scope, question, sources, evidence):
    """Keep the rubric/schema intact; trim only fetched text around verified quotes."""
    question = {name: question[name] for name in QUESTION_FIELDS}
    checked = check_evidence(evidence, sources)
    if not checked["passed"]:
        raise ValueError("Cannot request external judgment without verified A-D evidence")
    evidence = checked["options"]
    cited_urls = {item["url"] for item in evidence}
    cited = [source for source in sources if source["url"] in cited_urls]
    schema = output_model(QuestionQualitySignature).model_json_schema()
    for margin in (None, 2048, 1024, 512, 256, 128, 0):
        context, trimming = _source_context(cited, evidence, margin)
        inputs = {"question_data": question, "domain_context": scope["domain_prompt"],
                  "documentation_context": context, "option_evidence": evidence}
        request = {"candidate_id": candidate_id, "objective_id": scope["objective_id"],
                   "judge_prompt": signature_prompt(QuestionQualitySignature, inputs),
                   "verdict_schema": schema, "trimming": trimming}
        if len(json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False)) + 1 <= REQUEST_CHARACTER_LIMIT:
            return request
    raise ValueError("External request exceeds the character bound even with quote-only excerpts")
