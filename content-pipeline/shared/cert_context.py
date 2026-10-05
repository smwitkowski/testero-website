"""Offline certification scope and deterministic question planning from reviewed guides.

No database domain seeds are needed. PMLE retains its historical domain codes;
other certifications use cert-prefixed virtual codes. Only the current standard
exam guide is supported. Registry ambiguity is an error, not a guessed version.
"""

from __future__ import annotations

import json
import random
import re
from decimal import Decimal, InvalidOperation, ROUND_FLOOR
from pathlib import Path
from typing import Any, Iterator

DEFAULT_CERT = "machine-learning-engineer"
CERTS_DIR = Path(__file__).resolve().parents[1] / "certs"
PMLE_SECTION_CODES = {
    "1": "ARCHITECTING_LOW_CODE_ML_SOLUTIONS",
    "2": "COLLABORATING_TO_MANAGE_DATA_AND_MODELS",
    "3": "SCALING_PROTOTYPES_INTO_ML_MODELS",
    "4": "SERVING_AND_SCALING_MODELS",
    "5": "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES",
    "6": "MONITORING_ML_SOLUTIONS",
}

# A vocabulary, not per-cert facts: a service is emitted ONLY if mentioned in
# the reviewed objective or its guide context. Never expand an old brand alias.
_SERVICE_NAMES = (
    "Gemini Enterprise Agent Platform", "Agent Platform AutoML",
    "Agent Platform Workbench", "Agent Platform Pipelines",
    "Agent Platform Feature Store", "Agent Platform ML Metadata",
    "Agent Platform custom training", "Vertex AI", "BigQuery ML", "BigQuery",
    "Cloud Storage", "Cloud SQL", "Spanner", "AlloyDB", "Bigtable", "Firestore",
    "Compute Engine", "Google Kubernetes Engine", "GKE", "Cloud Run",
    "Cloud Functions", "App Engine", "Cloud Build", "Cloud Deploy",
    "Artifact Registry", "Container Registry", "Cloud Composer", "Dataflow",
    "Dataproc", "Pub/Sub", "Cloud Data Fusion", "Datastream", "Dataform",
    "Dataplex", "Looker", "Cloud Monitoring", "Cloud Logging", "Cloud Trace",
    "Cloud Profiler", "Cloud Audit Logs", "Google Cloud Observability",
    "Cloud Identity", "Identity and Access Management", "IAM",
    "Workforce Identity Federation", "Workload Identity Federation",
    "Cloud Asset Inventory", "Gemini Cloud Assist", "Cloud Billing",
    "Secret Manager", "Cloud KMS", "Cloud Armor", "Security Command Center",
    "Cloud VPN", "Cloud Interconnect", "Cloud Router", "Cloud DNS", "Cloud NAT",
    "Cloud Load Balancing", "VPC", "Cloud CDN", "Network Intelligence Center",
    "Document AI API", "Document AI", "Vision API", "Translate API",
    "Speech-to-Text", "Text-to-Speech", "Model Garden", "AutoML",
    "Colab Enterprise", "Kubeflow Pipelines", "Kubeflow", "Tabular Workflows",
    "TensorFlow Extended", "TensorFlow", "PyTorch", "Apache Spark",
    "Gemini", "Imagen", "Veo", "Cloud TPU", "TPU",
    "Google Security Operations", "Chronicle", "Google Workspace",
)
_SERVICE_PATTERN = re.compile(
    r"(?<!\w)(?:" + "|".join(re.escape(s) for s in sorted(_SERVICE_NAMES, key=len, reverse=True)) + r")(?!\w)",
    re.IGNORECASE,
)


def services_in_text(text: str) -> list[str]:
    """Extract only explicit service mentions, retaining the guide's spelling."""
    result = []
    seen = set()
    for match in _SERVICE_PATTERN.finditer(text):
        service = match.group(0)
        if service.casefold() not in seen:
            result.append(service)
            seen.add(service.casefold())
    return result


def _flatten_objectives(objectives: list[dict], ancestors: tuple[str, ...] = ()) -> Iterator[dict]:
    """Preorder includes parent AND every nested child as distinct targets."""
    for objective in objectives:
        text = objective.get("text", "")
        objective_id = objective.get("id")
        if not objective_id or not isinstance(text, str) or not text.strip():
            raise ValueError("Guide objective requires an id and nonempty text")
        yield {
            "objective_id": objective_id,
            "objective_text": text,
            "objective_context": "\n".join((*ancestors, text)),
        }
        yield from _flatten_objectives(objective.get("children", []), (*ancestors, text))


def load_cert_context(cert_id: str = DEFAULT_CERT) -> dict[str, Any]:
    """Load a fresh context from the registry's single current standard guide.

    Returns cert_id, name, guide_sha256, guide_url and a domains mapping. Domain
    records also expose legacy display_name/exam_weight/subsections/services/
    topics/guidance fields. Invalid ids and missing or ambiguous guides fail.
    """
    registry = json.loads((CERTS_DIR / "registry.json").read_text())
    entries = [c for c in registry["certifications"] if c["cert_id"] == cert_id]
    if len(entries) != 1:
        raise ValueError(f"Unknown or ambiguous certification: {cert_id!r}")
    filename = entries[0]["file"]
    if not isinstance(filename, str) or Path(filename).name != filename or not filename.endswith(".json"):
        raise ValueError("Registry certification filename must be a local JSON file")
    cert = json.loads((CERTS_DIR / filename).read_text())
    if cert.get("cert_id") != cert_id:
        raise ValueError("Registry certification id does not match its guide file")
    guides = [g for g in cert["guides"] if g.get("variant") == "standard"]
    if len(guides) != 1:
        raise ValueError(f"Certification {cert_id!r} needs exactly one current standard guide")
    guide = guides[0]
    guide_hash = guide.get("normalized_text_sha256", "")
    if not isinstance(guide_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", guide_hash):
        raise ValueError("Standard guide requires normalized_text_sha256")
    domains = {}
    objective_ids = set()
    for section in guide["sections"]:
        if not section.get("included", True):
            continue
        number = str(section["number"])
        if cert_id == DEFAULT_CERT:
            if number not in PMLE_SECTION_CODES:
                raise ValueError(f"Unmapped PMLE section: {number}")
            code = PMLE_SECTION_CODES[number]
        else:
            code = f"{cert_id}:standard:{number}"
        if code in domains:
            raise ValueError(f"Duplicate guide domain: {code}")
        subsections = {}
        all_objectives = []
        for sub in section["subsections"]:
            sub_number = str(sub["number"])
            if sub_number in subsections:
                raise ValueError(f"Duplicate guide subsection: {sub_number}")
            objectives = list(_flatten_objectives(sub["objectives"]))
            for obj in objectives:
                if obj["objective_id"] in objective_ids:
                    raise ValueError(f"Duplicate objective id: {obj['objective_id']}")
                objective_ids.add(obj["objective_id"])
                obj["subsection"] = sub_number
                obj["services"] = services_in_text(sub["title"] + "\n" + obj["objective_context"])
            sub_text = sub["title"] + "\n" + "\n".join(o["objective_context"] for o in objectives)
            subsections[sub_number] = {
                "title": sub["title"], "services": services_in_text(sub_text),
                "considerations": [o["objective_text"] for o in objectives],
                "objectives": objectives,
            }
            all_objectives.extend(objectives)
        domain_text = section["title"] + "\n" + "\n".join(
            s["title"] + "\n" + "\n".join(s["considerations"]) for s in subsections.values()
        )
        domains[code] = {
            "domain_code": code, "section_number": number,
            "display_name": section["title"], "exam_weight": section["weight_percent"],
            "subsections": subsections, "objectives": all_objectives,
            "services": services_in_text(domain_text),
            "topics": [o["objective_text"] for o in all_objectives],
            "guidance": "Use the reviewed official guide objectives and current product names. Do not add unsupported exam scope.",
        }
    if not domains:
        raise ValueError(f"Certification {cert_id!r} has no included standard-guide domains")
    return {
        "cert_id": cert_id, "name": cert["name"], "guide_sha256": guide_hash,
        "guide_url": guide["url"], "domains": domains,
    }


def largest_remainder(weights: list[float], total: int) -> list[int]:
    """Normalize official weights and allocate exactly total, ties in input order."""
    if isinstance(total, bool) or not isinstance(total, int) or total < 0:
        raise ValueError("Question count must be a nonnegative integer")
    try:
        values = [Decimal(str(w)) for w in weights]
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Official weights must be finite nonnegative numbers") from exc
    if not values or any(not w.is_finite() or w < 0 for w in values) or sum(values) <= 0:
        raise ValueError("Official weights must be finite nonnegative numbers with positive sum")
    quotas = [Decimal(total) * w / sum(values) for w in values]
    counts = [int(q.to_integral_value(rounding=ROUND_FLOOR)) for q in quotas]
    ranked = sorted(range(len(values)), key=lambda i: (-(quotas[i] - counts[i]), i))
    for index in ranked[:total - sum(counts)]:
        counts[index] += 1
    return counts


def domain_prompt(context: dict, domain: dict, subsection: str | None = None) -> str:
    """Render cert-aware prompt scope without assuming PMLE for other exams."""
    lines = [
        f"Certification: {context['name']} ({context['cert_id']})",
        f"Guide SHA256: {context['guide_sha256']}",
        f"Domain: {domain['display_name']} ({domain['domain_code']})",
        f"Official Exam Weight: ~{domain['exam_weight']}% (normalized when planning)",
    ]
    if subsection is not None:
        if subsection not in domain["subsections"]:
            raise ValueError(f"Subsection {subsection!r} not found in domain {domain['domain_code']!r}")
        sub = domain["subsections"][subsection]
        lines += [f"Target Subsection: {sub['title']} ({subsection})",
                  "Explicit service mentions: " + ", ".join(sub["services"]),
                  "Official objectives:", *["- " + t for t in sub["considerations"]]]
    else:
        lines += ["Explicit service mentions: " + ", ".join(domain["services"]),
                  "Official objectives:", *["- " + t for t in domain["topics"]]]
    lines += [domain["guidance"], "Generate a realistic scenario-based certification question with specific constraints."]
    return "\n".join(lines)


def plan_questions(cert_id: str, n_questions: int, domain_code: str | None = None,
                   subsection: str | None = None, seed: int | None = None,
                   objective_ids: list[str] | tuple[str, ...] | None = None) -> list[dict[str, Any]]:
    """Plan weighted domains, or round-robin explicit objective IDs in input order.

    Explicit targets override domain weights and random offsets; duplicate IDs
    are de-duplicated without reordering. All targets must belong to the selected
    cert/domain/subsection. Without targets, a seed reproduces random domain
    offsets; None uses fresh local entropy. Children remain separate objectives.
    """
    context = load_cert_context(cert_id)
    domains = context["domains"]
    if domain_code is not None:
        if domain_code not in domains:
            raise ValueError(f"Domain {domain_code!r} not found for certification {cert_id!r}")
        domains = {domain_code: domains[domain_code]}
    if subsection is not None:
        domains = {code: domain for code, domain in domains.items() if subsection in domain["subsections"]}
        if not domains:
            raise ValueError(f"Subsection {subsection!r} not found in selected certification/domain")
    if objective_ids is not None and (not isinstance(objective_ids, (list, tuple))
            or any(not isinstance(ident, str) or not ident.strip() for ident in objective_ids)):
        raise ValueError("Objective IDs must be a list or tuple of nonempty registry IDs")
    scoped = {code: domain["objectives"] if subsection is None else domain["subsections"][subsection]["objectives"]
              for code, domain in domains.items()}
    if any(not objectives for objectives in scoped.values()):
        raise ValueError("Selected domain has no objectives in the selected scope")
    targets = []
    if objective_ids:
        index = {obj["objective_id"]: (code, domains[code], obj, 0)
                 for code, objectives in scoped.items() for obj in objectives}
        requested = list(dict.fromkeys(objective_ids))
        for ident in requested:
            if ident not in index:
                raise ValueError(f"Objective {ident!r} is not in the selected certification/domain/subsection")
        largest_remainder([1], n_questions)  # Reuse the existing budget validation.
        targets = [index[requested[i % len(requested)]] for i in range(n_questions)]
    else:
        counts = largest_remainder([d["exam_weight"] for d in domains.values()], n_questions)
        rng = random.Random(seed)
        for (code, domain), count in zip(domains.items(), counts):
            objectives = scoped[code]
            offset = rng.randrange(len(objectives))
            targets.extend((code, domain, objectives[(offset + i) % len(objectives)], offset) for i in range(count))
    plan = []
    for code, domain, objective, offset in targets:
        prompt = domain_prompt(context, domain, objective["subsection"])
        prompt += f"\nTarget Objective: {objective['objective_id']}\n{objective['objective_context']}\nTest this objective specifically."
        plan.append({
            "cert_id": cert_id, "domain_code": code, "domain_name": domain["display_name"],
            "objective_id": objective["objective_id"], "guide_sha256": context["guide_sha256"],
            "objective_offset": offset,
            "objective_text": objective["objective_text"], "objective_context": objective["objective_context"],
            "services": list(objective["services"]), "subsection": objective["subsection"],
            "domain_prompt": prompt,
        })
    return plan
