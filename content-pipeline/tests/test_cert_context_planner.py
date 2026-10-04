"""Offline contract tests for registry context, planning and the thin CLI wrapper."""

import json
import sys
import types
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared import cert_context
from shared.cert_context import DEFAULT_CERT, PMLE_SECTION_CODES, largest_remainder, load_cert_context, plan_questions
from shared.domain_context import PMLE_DOMAIN_CONTEXT, build_domain_prompt_context, get_domain_context, get_subsection_context


def test_pmle_current_guide_hash_titles_weights_and_canonical_codes():
    context = load_cert_context()
    cert = json.loads((cert_context.CERTS_DIR / f"{DEFAULT_CERT}.json").read_text())
    guide = next(g for g in cert["guides"] if g["variant"] == "standard")
    assert context["cert_id"] == DEFAULT_CERT
    assert context["guide_sha256"] == guide["normalized_text_sha256"]
    assert list(context["domains"]) == list(PMLE_SECTION_CODES.values())
    assert [d["exam_weight"] for d in context["domains"].values()] == [13, 16, 21, 20, 18, 13]
    for section in guide["sections"]:
        domain = context["domains"][PMLE_SECTION_CODES[section["number"]]]
        assert domain["display_name"] == section["title"]
        assert list(domain["subsections"]) == [s["number"] for s in section["subsections"]]
    assert "1.3" not in context["domains"][PMLE_SECTION_CODES["1"]]["subsections"]
    assert PMLE_DOMAIN_CONTEXT == context["domains"]


@pytest.mark.parametrize("weights,total,expected", [
    ([13, 16, 21, 20, 18, 13], 101, [13, 16, 21, 20, 18, 13]),
    ([13, 16, 21, 20, 18, 13], 100, [13, 16, 20, 20, 18, 13]),
    ([1, 1, 1], 2, [1, 1, 0]),
    ([0, 20, 30], 7, [0, 3, 4]),
    ([17.5, 17.5, 15], 0, [0, 0, 0]),
])
def test_largest_remainder_normalizes_official_weights(weights, total, expected):
    assert largest_remainder(weights, total) == expected


@pytest.mark.parametrize("weights", [[], [0, 0], [-1, 2], [None], [float("nan")], [float("inf")]])
def test_invalid_weights_fail_explicitly(weights):
    with pytest.raises(ValueError, match="weights"):
        largest_remainder(weights, 5)


@pytest.mark.parametrize("count", [-1, 1.5, True, "2"])
def test_invalid_budget(count):
    with pytest.raises(ValueError, match="count"):
        plan_questions(DEFAULT_CERT, count)


@pytest.mark.parametrize("cert_id", [DEFAULT_CERT, "cloud-engineer", "cloud-digital-leader", "associate-google-workspace-administrator"])
def test_exact_budget_determinism_provenance_and_objective_round_robin(cert_id):
    context = load_cert_context(cert_id)
    plan = plan_questions(cert_id, 500)
    assert len(plan) == 500
    assert plan == plan_questions(cert_id, 500)
    expected = largest_remainder([d["exam_weight"] for d in context["domains"].values()], 500)
    counts = Counter(item["domain_code"] for item in plan)
    assert list(counts.values()) == expected
    for code, domain in context["domains"].items():
        items = [i for i in plan if i["domain_code"] == code]
        ids = [o["objective_id"] for o in domain["objectives"]]
        assert [i["objective_id"] for i in items] == [ids[n % len(ids)] for n in range(len(items))]
        for item in items:
            assert item["cert_id"] == cert_id
            assert item["guide_sha256"] == context["guide_sha256"]
            assert item["objective_text"] in item["domain_prompt"]
            assert item["objective_id"] in item["domain_prompt"]
            assert item["subsection"] in domain["subsections"]
            assert set(item["services"]) <= set(domain["services"])


def test_ace_virtual_scope_has_no_pmle_service_leakage():
    context = load_cert_context("cloud-engineer")
    assert all(code.startswith("cloud-engineer:standard:") for code in context["domains"])
    all_prompt = "\n".join(i["domain_prompt"] for i in plan_questions("cloud-engineer", 120))
    assert "PMLE" not in all_prompt
    assert "Machine Learning Engineer" not in all_prompt
    assert "Agent Platform AutoML" not in all_prompt
    services = {s for d in context["domains"].values() for s in d["services"]}
    assert "AutoML" not in services
    assert "Agent Platform Feature Store" not in services
    assert "BigQuery ML" not in services
    assert "Compute Engine" in services
    assert "Cloud SQL" in services
    assert "Gemini Cloud Assist" in services


def test_selection_and_legacy_cert_aware_helpers():
    code = PMLE_SECTION_CODES["1"]
    assert get_domain_context(code)["exam_weight"] == 13
    sub = get_subsection_context(code, "1.1")
    assert "Gemini Enterprise Agent Platform" in sub["title"]
    prompt = build_domain_prompt_context(code, "stale name", "1.1")
    assert "stale name" not in prompt
    assert "Architecting low-code AI solutions" in prompt
    assert "Professional Machine Learning Engineer" in prompt
    scoped = plan_questions(DEFAULT_CERT, 11, code, "1.1")
    assert len(scoped) == 11
    assert {i["domain_code"] for i in scoped} == {code}
    assert {i["subsection"] for i in scoped} == {"1.1"}
    assert plan_questions(DEFAULT_CERT, 0) == []
    assert plan_questions(DEFAULT_CERT, 11, subsection="1.1") == scoped
    ace_code = "cloud-engineer:standard:1"
    assert get_domain_context(ace_code, "cloud-engineer")["display_name"] == "Setting up a cloud solution environment"
    assert get_subsection_context(ace_code, "1.1", "cloud-engineer")["title"]
    assert "Associate Cloud Engineer" in build_domain_prompt_context(ace_code, "ignored", "1.1", "cloud-engineer")


@pytest.mark.parametrize("cert,domain,subsection", [
    ("unknown-cert", None, None),
    (DEFAULT_CERT, "cloud-engineer:standard:1", None),
    ("cloud-engineer", PMLE_SECTION_CODES["1"], None),
    (DEFAULT_CERT, PMLE_SECTION_CODES["1"], "2.1"),
    (DEFAULT_CERT, None, "99.99"),
])
def test_invalid_scope_fails_instead_of_falling_back(cert, domain, subsection):
    with pytest.raises(ValueError):
        plan_questions(cert, 3, domain, subsection)


def test_legacy_subsection_prompt_does_not_silently_ignore_invalid_scope():
    with pytest.raises(ValueError, match="Subsection"):
        build_domain_prompt_context(PMLE_SECTION_CODES["1"], "ignored", "1.3")


def test_beta_only_guide_is_not_silently_used_as_standard():
    with pytest.raises(ValueError, match="standard guide"):
        load_cert_context("agentic-architect")


def test_nested_objectives_are_distinct_with_ancestor_context(tmp_path, monkeypatch):
    data = json.loads((cert_context.CERTS_DIR / "cloud-engineer.json").read_text())
    guide = next(g for g in data["guides"] if g["variant"] == "standard")
    domain = guide["sections"][0]
    parent = domain["subsections"][0]["objectives"][0]
    parent["text"] = "Configure Compute Engine"
    parent["children"] = [{
        "id": parent["id"] + ":child",
        "text": "Select the instance size",
        "children": [{"id": parent["id"] + ":grandchild", "text": "Consider memory constraints", "children": []}],
    }]
    (tmp_path / "registry.json").write_text(json.dumps({"certifications": [{"cert_id": "cloud-engineer", "file": "cloud-engineer.json"}]}))
    (tmp_path / "cloud-engineer.json").write_text(json.dumps(data))
    monkeypatch.setattr(cert_context, "CERTS_DIR", tmp_path)
    plan = plan_questions("cloud-engineer", 3, subsection="1.1")
    assert [i["objective_id"] for i in plan] == [parent["id"], parent["id"] + ":child", parent["id"] + ":grandchild"]
    assert plan[2]["objective_text"] == "Consider memory constraints"
    assert "Configure Compute Engine\nSelect the instance size\nConsider memory constraints" in plan[2]["domain_prompt"]
    assert "Compute Engine" in plan[2]["services"]


def test_service_extraction_does_not_invent_scope_or_rename_products():
    assert cert_context.services_in_text("Grant IAM access to Cloud SQL; no machine learning required") == ["IAM", "Cloud SQL"]
    assert cert_context.services_in_text("BigQuery ML and BigQuery ML") == ["BigQuery ML"]
    assert cert_context.services_in_text("Use Gemini Enterprise Agent Platform, not historical names") == ["Gemini Enterprise Agent Platform"]
    assert cert_context.services_in_text("A generic API, VPCish or TPUish name") == []


def test_all_standard_registry_certifications_load_and_plan():
    registry = json.loads((cert_context.CERTS_DIR / "registry.json").read_text())
    for entry in registry["certifications"]:
        if entry["cert_id"] == "agentic-architect":
            continue
        context = load_cert_context(entry["cert_id"])
        assert context["domains"]
        assert len(plan_questions(entry["cert_id"], 17)) == 17


def test_thin_wrapper_forwards_flags_without_domain_loops(monkeypatch):
    from scripts import generate_all_domains

    calls = []
    stub = types.ModuleType("scripts.generate_pmle_questions")
    stub.main = lambda *a, **k: calls.append((a, k)) or 42
    monkeypatch.setitem(sys.modules, "scripts.generate_pmle_questions", stub)
    args = ["--cert", "cloud-engineer", "--n-questions", "25", "--dry-run", "--artifact", "batch.json", "--model", "builder", "--judge-model", "judge", "--difficulty", "MEDIUM"]
    assert generate_all_domains.main(args=args, standalone_mode=False) == 42
    assert calls == [((), {"args": args, "standalone_mode": False})]


@pytest.mark.parametrize("problem,match", [
    ("missing_hash", "normalized_text_sha256"),
    ("duplicate_standard", "standard guide"),
    ("duplicate_objective", "Duplicate objective"),
    ("no_objectives", "no objectives"),
])
def test_broken_guide_evidence_fails_explicitly(tmp_path, monkeypatch, problem, match):
    data = json.loads((cert_context.CERTS_DIR / "cloud-engineer.json").read_text())
    guide = next(g for g in data["guides"] if g["variant"] == "standard")
    sub = guide["sections"][0]["subsections"][0]
    if problem == "missing_hash":
        guide.pop("normalized_text_sha256")
    elif problem == "duplicate_standard":
        data["guides"].append(guide)
    elif problem == "duplicate_objective":
        sub["objectives"].append(sub["objectives"][0])
    elif problem == "no_objectives":
        sub["objectives"] = []
    (tmp_path / "registry.json").write_text(json.dumps({"certifications": [{"cert_id": "cloud-engineer", "file": "cloud-engineer.json"}]}))
    (tmp_path / "cloud-engineer.json").write_text(json.dumps(data))
    monkeypatch.setattr(cert_context, "CERTS_DIR", tmp_path)
    with pytest.raises(ValueError, match=match):
        plan_questions("cloud-engineer", 3, subsection="1.1")


def test_registry_paths_cannot_escape_reviewed_cert_directory(tmp_path, monkeypatch):
    (tmp_path / "registry.json").write_text(json.dumps({"certifications": [{"cert_id": "cloud-engineer", "file": "../unexpected.json"}]}))
    monkeypatch.setattr(cert_context, "CERTS_DIR", tmp_path)
    with pytest.raises(ValueError, match="local JSON"):
        load_cert_context("cloud-engineer")
