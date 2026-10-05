#!/usr/bin/env python3
"""Offline PMLE bank triage; optional read-only documentation re-check."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import random
import re
import sys

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_ROOT))
from shared.cert_context import DEFAULT_CERT, domain_prompt, load_cert_context
from shared.model_policy import DEFAULT_GENERATOR_MODEL, DEFAULT_JUDGE_MODEL, require_independent_models

ARTIFACT_ROOT = PIPELINE_ROOT / ".cache/bank"
FLAGS = ("ok", "rename_only", "removed_topic", "unmapped")
GUIDE_URL = "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf"
CERT_URL = "https://cloud.google.com/learn/certification/machine-learning-engineer"
# The cert page explicitly announces the Vertex AI -> Gemini Enterprise Agent
# Platform transition. Guide locators support these names, not API/URL rewrites.
NAME_MAP = [
    {"old": old, "new": new, "source_url": GUIDE_URL, "locator": locator,
     "transition_source_url": CERT_URL}
    for old, new, locator in [
        ("Vertex AI Feature Store", "Agent Platform Feature Store", "2.1, 4.2"),
        ("Vertex AI Workbench", "Agent Platform Workbench", "2.2"),
        ("Vertex AI Pipelines", "Agent Platform Pipelines", "5.1"),
        ("Vertex AI Model Registry", "Gemini Enterprise Agent Platform Model Registry", "4.1"),
        ("Vertex AI Prediction", "Gemini Enterprise Agent Platform Inference", "4.2"),
        ("Vertex AI Experiments", "Experiments on Agent Platform", "2.3"),
        ("Vertex ML Metadata", "Gemini Enterprise Agent Platform ML Metadata", "2.3"),
        ("Vertex AI", "Gemini Enterprise Agent Platform", "guide-wide branding"),
    ]
]
# Historical scope from shared/domain_context.py at repo commit 2a01021.
# PMLE-DRIFT.md records removal of these subsection headings. Some bullets
# survive elsewhere; historical superiority is a review flag, not deprecation.
REMOVED_SUBSECTIONS = {
    "1.3": [
        "Preparing data for AutoML (e.g., feature selection, data labeling, Tabular Workflows on AutoML)",
        "Using available data (e.g., tabular, text, speech, images, videos) to train custom models",
        "Using AutoML for tabular data",
        "Creating forecasting models by using AutoML",
        "Configuring and debugging trained models",
    ],
    "5.3": [
        "Tracking and comparing model artifacts and versions (e.g., Vertex AI Experiments, Vertex ML Metadata)",
        "Hooking into model and dataset versioning",
        "Model and data lineage",
    ],
}
STOP_WORDS = set("a an the and or of for to in on into with by from as at is are be should when how what which can could must would will do does need needs using use e g eg given based appropriate different various available common choosing choose building build understanding option solution system requirement data model models ml ai google cloud agent platform enterprise".split())
INFLECTIONS = {
    "training": "train", "trained": "train", "serving": "serve",
    "tuning": "tune", "tuned": "tune", "monitoring": "monitor",
    "evaluating": "evaluate", "evaluation": "evaluate",
    "predictive": "predict", "prediction": "predict", "predictions": "predict",
    "forecasting": "forecast", "forecasts": "forecast", "validating": "validate",
    "validation": "validate", "deploying": "deploy", "deployment": "deploy",
    "preprocessing": "preprocess", "processing": "process", "tracking": "track",
    "comparing": "compare", "organizing": "organize", "versioning": "version",
    "scaling": "scale", "distributed": "distribute", "features": "feature",
    "notebooks": "notebook", "pipelines": "pipeline", "metrics": "metric",
    "interpretable": "interpretability", "explainable": "explainability",
}
NAME_PATTERN = re.compile(r"(?<!\w)(?:" + "|".join(re.escape(m["old"]) for m in NAME_MAP) + r")(?!\w)", re.I)


def stale_names(text):
    """Report longest non-overlapping old-name mentions, with source citations."""
    found = {m.group().casefold() for m in NAME_PATTERN.finditer(text)}
    return [dict(entry) for entry in NAME_MAP if entry["old"].casefold() in found]


def tokens(text):
    """Binary lowercase word tokens; explicit branding and inflection aliases."""
    aliases = {entry["old"].casefold(): entry["new"] for entry in NAME_MAP}
    text = NAME_PATTERN.sub(lambda m: aliases[m.group().casefold()], text)
    text = re.sub(r"(?:Gemini Enterprise )?Agent Platform", " ", text, flags=re.I)
    words = re.findall(r"[a-z][a-z0-9]*", text.casefold())
    result = set()
    for word in words:
        word = INFLECTIONS.get(word, word)
        if len(word) > 4 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        if len(word) > 1 and word not in STOP_WORDS:
            result.add(word)
    return result


def question_texts(question):
    """Match only stem plus marked answer; scan all learner prose for old names."""
    answers = question.get("answers", [])
    primary = " ".join([question.get("stem", "")] + [
        a.get("choice_text", "") for a in answers if a.get("is_correct") is True])
    prose = [question.get("stem", "")]
    for answer in answers:
        prose += [answer.get("choice_text", ""), answer.get("explanation_text") or ""]
    explanation = question.get("explanation")
    if isinstance(explanation, dict):
        prose.append(explanation.get("explanation_text") or "")
    return primary, " ".join(prose)


def objective_scopes(context):
    """Index all current objectives; ordinal IDs are local to this guide hash."""
    scopes = {}
    for code, domain in context["domains"].items():
        for obj in domain["objectives"]:
            prompt = domain_prompt(context, domain, obj["subsection"])
            scopes[obj["objective_id"]] = {
                **obj, "domain_code": code, "cert_id": context["cert_id"],
                "guide_sha256": context["guide_sha256"],
                "domain_prompt": prompt + "\nTarget Objective: " + obj["objective_id"] + "\n" + obj["objective_context"],
            }
    return scopes


def audit_bank(export, context):
    """Return repeatable lexical triage and ACTIVE coverage, without I/O."""
    scopes = objective_scopes(context)
    corpus = {ident: tokens(scope["objective_text"]) for ident, scope in scopes.items()}
    historical = {}
    for subsection, bullets in REMOVED_SUBSECTIONS.items():
        for i, text in enumerate(bullets, 1):
            ident = f"historical:{subsection}:{i}"
            historical[ident] = {"objective_text": text, "subsection": subsection}
            corpus[ident] = tokens(text)
    df = Counter(term for terms in corpus.values() for term in terms)
    idf = {term: 1 + math.log((1 + len(corpus)) / (1 + count)) for term, count in df.items()}

    def ranked(query, targets):
        query_terms = tokens(query)
        # Restrict the query vector to the objective vocabulary, so long business
        # scenarios are not penalized for names/constraints absent from the guide.
        query_norm = math.sqrt(sum(idf[t] ** 2 for t in query_terms if t in idf))
        matches = []
        for ident in targets:
            terms = corpus[ident]
            common = sorted(query_terms & terms)
            norm = query_norm * math.sqrt(sum(idf[t] ** 2 for t in terms))
            score = sum(idf[t] ** 2 for t in common) / norm if norm else 0.0
            if score >= 0.10 and (len(common) >= 2 or (len(terms) == 1 and common)):
                matches.append({"objective_id": ident, "score": round(score, 6), "matched_terms": common})
        return sorted(matches, key=lambda m: (-m["score"], m["objective_id"]))

    records = []
    counts = {code: {flag: 0 for flag in FLAGS} for code in context["domains"]}
    coverage = {ident: 0 for ident in scopes}
    for question in sorted(export["questions"], key=lambda q: q["id"]):
        if question["status"] not in {"ACTIVE", "DRAFT"}:
            continue
        primary, prose = question_texts(question)
        current = ranked(primary, scopes)
        old = ranked(primary, historical)
        best = [m for m in current if m["score"] == current[0]["score"]] if current else []
        names = stale_names(prose)
        # A fully matched current objective is a credible lexical successor:
        # e.g. train + AutoML survives despite the removed tabular subsection.
        complete_current = any(len(corpus[m["objective_id"]]) >= 2 and
                               corpus[m["objective_id"]].issubset(tokens(primary)) for m in best)
        removed = old[0] if old and not complete_current and (not best or old[0]["score"] > best[0]["score"] * 1.10) else None
        flag = "removed_topic" if removed else "unmapped" if not best else "rename_only" if names else "ok"
        record = {"question_id": question["id"], "status": question["status"],
                  "domain_code": question["domain_code"], "flag": flag,
                  "best_current_objective_ids": [m["objective_id"] for m in best],
                  "current_matches": best, "stale_product_names": names,
                  "historical_match": {**removed, **historical[removed["objective_id"]]} if removed else None}
        records.append(record)
        counts.setdefault(question["domain_code"], {f: 0 for f in FLAGS})[flag] += 1
        if question["status"] == "ACTIVE" and flag not in {"removed_topic", "unmapped"}:
            for match in best:
                coverage[match["objective_id"]] += 1
    objective_coverage = [{"objective_id": ident, "domain_code": scope["domain_code"],
                           "objective_text": scope["objective_text"], "active_questions": coverage[ident]}
                          for ident, scope in scopes.items()]
    return {"version": 1, "cert_id": context["cert_id"], "guide_sha256": context["guide_sha256"],
            "guide_url": context["guide_url"], "input_status_counts": dict(sorted(Counter(q["status"] for q in export["questions"]).items())),
            "method": {"match_text": "stem + marked correct choice; explanations/distractors used only for stale-name scan",
                       "score": "binary IDF-weighted cosine in objective vocabulary; IDF = 1 + log((1 + corpus size)/(1 + objective frequency))",
                       "minimum_score": 0.10, "minimum_shared_terms": "2, or 1 for a single-token objective",
                       "best_ids": "all top-score ties; current objectives compared globally, not restricted to old domain",
                       "removed_rule": "historical 1.3/5.3 bullet beats best current score by >10%, or no current match; suppress when a best current objective has >=2 tokens and all are matched",
                       "historical_source": "shared/domain_context.py at 2a01021; removals documented in certs/PMLE-DRIFT.md",
                       "coverage": "ACTIVE top-score ties excluding removed_topic/unmapped; provisional lexical coverage, not verified accuracy",
                       "inflections": INFLECTIONS, "stop_words": sorted(STOP_WORDS)},
            "name_map": NAME_MAP, "questions": records, "counts_by_domain_flag": counts,
            "totals_by_flag": dict(Counter(q["flag"] for q in records)),
            "coverage": objective_coverage,
            "zero_coverage_objectives": [c for c in objective_coverage if c["active_questions"] == 0]}


def markdown_summary(artifact):
    lines = ["# PMLE bank audit", "", f"Guide: {artifact['guide_url']}",
             f"Guide SHA256: `{artifact['guide_sha256']}`", "",
             "Offline lexical triage, **not** factual validation. Removed headings do not mean",
             "product deprecation: AutoML training and metadata/lineage have current successors.",
             "`rename_only` means only a detected lexical/name issue, not permission to publish.",
             "", "## ACTIVE + DRAFT counts", "", "| Domain | ok | rename_only | removed_topic | unmapped | Total |",
             "| --- | ---: | ---: | ---: | ---: | ---: |"]
    for domain, counts in artifact["counts_by_domain_flag"].items():
        lines.append("| " + domain + " | " + " | ".join(str(counts[f]) for f in FLAGS) + f" | {sum(counts.values())} |")
    totals = [sum(c[f] for c in artifact["counts_by_domain_flag"].values()) for f in FLAGS]
    lines += ["| **Total** | " + " | ".join(map(str, totals)) + f" | {sum(totals)} |", "",
              "Status inventory: " + ", ".join(f"{k}={v}" for k, v in artifact["input_status_counts"].items()) + ". RETIRED rows excluded.",
              "", "## ACTIVE coverage", "", artifact["method"]["coverage"] + ".",
              "Match input: stem + marked answer only. IDF-weighted cosine >=0.10; two shared terms",
              "(one for single-token objectives). All best-score ties count. Removed-topic rows do not count.",
              "Full scores, terms, token rules and all per-objective counts are in the JSON artifact.",
              f"Covered: {len(artifact['coverage']) - len(artifact['zero_coverage_objectives'])}/{len(artifact['coverage'])} objectives.",
              "", "### Zero ACTIVE coverage", ""]
    lines += [f"- `{c['objective_id']}` — {c['objective_text']}" for c in artifact["zero_coverage_objectives"]]
    return "\n".join(lines) + "\n"


def bank_question_data(question):
    """Project exact existing text to citer fields; correct option becomes A."""
    answers = question["answers"]
    if len(answers) != 4 or sum(a.get("is_correct") is True for a in answers) != 1:
        raise ValueError("Existing question needs four options and one marked correct answer")
    labels = [a.get("choice_label") for a in answers]
    if set(labels) != set("ABCD"):
        raise ValueError("Existing question needs distinct A-D labels")
    ordered = sorted(answers, key=lambda a: (a.get("is_correct") is not True, a["choice_label"]))
    fields = ("correct_answer", "distractor_1", "distractor_2", "distractor_3")
    explanations = ("correct_explanation", "distractor_1_explanation", "distractor_2_explanation", "distractor_3_explanation")
    native = {"stem": question["stem"]}
    for answer, field, explanation in zip(ordered, fields, explanations):
        native[field] = answer["choice_text"]
        native[explanation] = answer.get("explanation_text") or ""
    return native, {label: answer["choice_label"] for label, answer in zip("ABCD", ordered)}


def write_json(path, payload):
    """Atomically write strict JSON inside the ignored bank-artifact directory."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    temp.replace(path)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Read-only bank export JSON")
    parser.add_argument("--grounded", action="store_true", help="Re-check existing questions with fetched docs, citation and independent judge (requires shell keys)")
    parser.add_argument("--limit", type=int, default=10, help="Maximum grounded sample size (default 10)")
    parser.add_argument("--seed", type=int, default=0, help="Reproducible grounded sample, sorted IDs then random sample")
    parser.add_argument("--model", default=DEFAULT_GENERATOR_MODEL)
    parser.add_argument("--judge-model", default=DEFAULT_JUDGE_MODEL)
    args = parser.parse_args(argv)
    if args.limit < 1:
        parser.error("--limit must be at least 1")
    if args.grounded:
        try:
            require_independent_models(args.model, args.judge_model)
        except ValueError as exc:
            parser.error(str(exc))
    export = json.loads(args.input.read_text())
    context = load_cert_context(DEFAULT_CERT)
    artifact = audit_bank(export, context)
    artifact["input_sha256"] = hashlib.sha256(args.input.read_bytes()).hexdigest()
    basename = ARTIFACT_ROOT / (args.input.stem + "-audit")
    outputs = [Path(str(basename) + ".json"), Path(str(basename) + ".md"), ARTIFACT_ROOT / (args.input.stem + "-grounded.json")]
    if any(p.resolve() == args.input.resolve() for p in outputs):
        parser.error("Output paths must not overwrite the input export")
    write_json(outputs[0], artifact)
    outputs[1].write_text(markdown_summary(artifact))
    print(f"Audited {len(artifact['questions'])} ACTIVE/DRAFT questions; {outputs[0]}; {outputs[1]}")
    if not args.grounded:
        return 0
    # No DSPy, retrieval client or credential-dependent modules in offline mode.
    from shared.bank_grounding import check_existing_question
    from scripts.generate_pmle_questions import artifact_json_value
    scopes = objective_scopes(context)
    bank_by_id = {q["id"]: q for q in export["questions"]}
    sampled = random.Random(args.seed).sample(artifact["questions"], min(args.limit, len(artifact["questions"])))
    grounded = {"version": 2, "cert_id": context["cert_id"], "guide_sha256": context["guide_sha256"],
                "retrieval_policy": "marked answer + stem + question services; objective hint secondary",
                "relevance_policy": "full current exam blueprint; lexical mapping is not a relevance gate",
                "input_sha256": artifact["input_sha256"], "model": args.model, "judge_model": args.judge_model,
                "seed": args.seed, "limit": args.limit, "results": []}
    write_json(outputs[2], grounded)
    for row in sampled:
        result = {"question_id": row["question_id"], "flag": row["flag"], "status": row["status"],
                  "best_current_objective_ids": row["best_current_objective_ids"],
                  "passed": False, "reasons": ["No mapped current objective"]}
        ident = row["best_current_objective_ids"][0] if row["best_current_objective_ids"] else None
        result["objective_id"] = ident
        scope = scopes[ident] if ident else {"cert_id": context["cert_id"], "guide_sha256": context["guide_sha256"]}
        try:
            question, label_map = bank_question_data(bank_by_id[row["question_id"]])
            result["original_choice_labels"] = label_map
            result.update(check_existing_question(question, scope, model=args.model, judge_model=args.judge_model))
        except Exception as exc:
            result["reasons"] = ["Existing question re-check failed"]
            result["error_class"] = type(exc).__name__
        grounded["results"].append(result)
        write_json(outputs[2], artifact_json_value(grounded))
    passed = sum(r["passed"] for r in grounded["results"])
    print(f"Grounded PASS {passed}/{len(sampled)}; {outputs[2]}")
    return 0 if sampled and passed == len(sampled) else 1


if __name__ == "__main__":
    raise SystemExit(main())
