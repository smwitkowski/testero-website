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
REQUEST_CHARACTER_LIMIT = 150000
QUOTE_WINDOW_MARGIN = 8000


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


def _source_context(cited, evidence, trimmed_urls):
    excerpts, records = [], []
    for source in cited:
        text = source["text"]
        record = {"url": source["url"], "original_text_sha256": source["text_sha256"],
                  "original_characters": len(text), "included_characters": len(text),
                  "trimmed": False, "windows": [[0, len(text)]]}
        if source["url"] not in trimmed_urls:
            excerpts.append(source)
            records.append(record)
            continue
        normalized = normalize_whitespace(text)
        windows = []
        for item in evidence:
            if item["url"] == source["url"]:
                quote = normalize_whitespace(item["quote"])
                start = normalized.index(quote)
                windows.append([max(0, start - QUOTE_WINDOW_MARGIN),
                                min(len(normalized), start + len(quote) + QUOTE_WINDOW_MARGIN)])
        windows = _merge_windows(windows)
        # If the wide windows cover everything, retain the original full fetch.
        if windows == [[0, len(normalized)]]:
            excerpts.append(source)
            records.append(record)
            continue
        excerpt = "\n[... source text omitted ...]\n".join(normalized[start:end] for start, end in windows)
        digest = hashlib.sha256(excerpt.encode()).hexdigest()
        excerpts.append({**source, "text": excerpt, "text_sha256": digest})
        record.update({"trimmed": True, "excerpt_sha256": digest,
                       "normalized_characters": len(normalized),
                       "included_characters": sum(end-start for start, end in windows),
                       "margin": QUOTE_WINDOW_MARGIN, "windows": windows})
        records.append(record)
    enabled = any(record["trimmed"] for record in records)
    metadata = {"enabled": enabled,
                "method": ("largest sources first; wide quote-centered windows in whitespace-normalized fetched text"
                           if enabled else "full cited sources"),
                "character_limit": REQUEST_CHARACTER_LIMIT, "sources": records}
    context = documentation_context(excerpts)
    if enabled:
        context = ("Some cited sources use wide quote-centered excerpts; others retain their full fetched text. "
                   "Omitted context is marked. Text SHA-256 identifies the included text. "
                   "Original fetch hashes and offsets are recorded here: " + json.dumps(records, ensure_ascii=False) +
                   "\n\n" + context)
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
    trimmed_urls = set()
    largest_first = sorted(cited, key=lambda source: len(source["text"]), reverse=True)
    for count in range(len(largest_first) + 1):
        if count:
            trimmed_urls.add(largest_first[count - 1]["url"])
        context, trimming = _source_context(cited, evidence, trimmed_urls)
        inputs = {"question_data": question, "domain_context": scope["domain_prompt"],
                  "documentation_context": context, "option_evidence": evidence}
        request = {"candidate_id": candidate_id, "objective_id": scope["objective_id"],
                   "judge_prompt": signature_prompt(QuestionQualitySignature, inputs),
                   "verdict_schema": schema, "trimming": trimming}
        if len(json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False)) + 1 <= REQUEST_CHARACTER_LIMIT:
            return request
    raise ValueError("External request exceeds the character bound even with wide quote-centered excerpts")
