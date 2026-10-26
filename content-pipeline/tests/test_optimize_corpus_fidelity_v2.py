"""Objective corpus, production-query parity and serial fidelity contracts."""
from copy import deepcopy
import hashlib
from unittest.mock import Mock

import pytest

from scripts.optimize.corpus import (freeze_corpus, ranked_corpus_sources,
                                     discovery_queries, validate_corpus)
from scripts.optimize.fidelity import fidelity_report, replay_fidelity, main
from shared import doc_search
from shared.decision_planner import planning_prompt


def page(name, text, timestamp="2026-01-01T00:00:00Z", **extra):
    url = "https://docs.cloud.google.com/vertex-ai/docs/" + name
    return {"url": url, "requested_url": url, "text": text,
            "text_sha256": hashlib.sha256(text.encode()).hexdigest(), "retrieved_at": timestamp, **extra}


def example():
    scope = {"objective_id": "x", "objective_text": "Choose model serving", "domain_prompt": "Scope",
             "services": ["Vertex AI"], "doccheck_policy": "v6"}
    plan = {"objective_id": "x", "engineering_decision": "Choose model serving", "business_consequence": "Serve users",
            "existing_system": "Existing model", "decisive_constraints": ["Minimize maintenance"],
            "best_action": "Vertex AI custom prediction routine",
            "mistakes": [{"action": action, "scenario_reason": "Positive behavior plus want"}
                         for action in ("Cloud Run server", "GKE cluster", "Batch prediction")]}
    corpus = freeze_corpus("x", [page("serving", "Vertex AI custom prediction routine wraps server."),
                                page("gke", "GKE cluster runs Kubernetes containers.")])
    _, inputs = planning_prompt(scope)
    return {"objective_id": "x", "scope": scope, "plan": plan, "inputs": inputs,
            "proof": {"passed": True}, "objective_corpus": corpus}


def test_corpus_frozen_deterministic_dedup_newest_versions_and_tamper_refusal():
    first = page("same", "Old text", discovery_options=["D"])
    second = page("same", "New text", "2026-02-01T00:00:00Z")
    corpus = freeze_corpus("x", [first, first, second, page("other", "Other text")])
    assert corpus == freeze_corpus("x", [second, first, page("other", "Other text")])
    assert len(corpus["snapshots"]) == 3
    assert len(corpus["sources"]) == 2
    assert corpus["superseded_snapshots"] == 1
    assert all("discovery_options" not in row for row in corpus["sources"])
    changed = deepcopy(corpus)
    changed["sources"][0]["text"] = "tampered"
    with pytest.raises(ValueError, match="binding"):
        validate_corpus(changed, "x")
    with pytest.raises(ValueError):
        validate_corpus(corpus, "different-objective")


@pytest.mark.parametrize("policy", ["v5", "v6"])
def test_offline_queries_exactly_match_production_discovery_templates(monkeypatch, policy):
    row = example()
    row["scope"]["doccheck_policy"] = policy
    actual = []
    def frozen_search(text, services, limit, **kwargs):
        actual.append((doc_search._product_aliases(doc_search._discovery_query(text, services)), limit))
        return [page("sample", "Fetched source")]
    monkeypatch.setattr(doc_search, "_search_objective_docs", frozen_search)
    doc_search.search_objective_docs(row["scope"]["objective_text"], row["scope"]["services"],
                                    decision_plan=row["plan"], doccheck_policy=policy)
    assert [(q, n) for q, n, label in discovery_queries(row["scope"], row["plan"])] == actual


def test_ranked_corpus_uses_new_candidate_not_historical_hints_and_production_context():
    from shared.decision_planner import verification_prompt
    row = example()
    before = deepcopy(row["objective_corpus"])
    sources = ranked_corpus_sources(row["scope"], row["plan"], before)
    assert len(sources) == len(before["sources"])
    assert next(s for s in sources if s["url"].endswith("gke"))["discovery_options"]
    assert row["objective_corpus"] == before
    signature, inputs = verification_prompt(row["scope"], row["plan"], sources, stable_prefix=True)
    assert "GKE cluster" in inputs["fetched_documentation"]
    assert "custom prediction routine" in inputs["fetched_documentation"]


def test_fidelity_serial_codex_student_and_checker_no_temperature_fabrication(monkeypatch):
    row = example()
    calls = []
    def cli(model, signature, inputs, **kwargs):
        calls.append(("student", model, kwargs))
        return {"plan": row["plan"]}
    def verifier(scope, plan, sources, **kwargs):
        calls.append(("checker", kwargs["model"], kwargs))
        assert {s["url"] for s in sources} == {s["url"] for s in row["objective_corpus"]["sources"]}
        return {"passed": len(calls) == 1}
    monkeypatch.setattr("shared.cli_models.run_signature", cli)
    report = replay_fidelity([row], verifier=verifier)
    assert [c[0] for c in calls] == ["checker", "student", "checker"]
    assert all(c[1] == "codex" for c in calls)
    assert calls[0][2]["temperature"] == 0
    assert "temperature" not in calls[1][2]
    assert report["verdict_agreement"] == 1
    assert report["seed_program_pass_rate"] == 0
    assert report["ready_for_optimization"] is False


def test_fixture_report_never_claims_live_readiness_and_requires_actual_booleans():
    row = example()
    report = fidelity_report([row] * 40, [{"replay_passed": True, "seed_passed": True}] * 40, fixture=True)
    assert report["agreement_target_met"]
    assert not report["ready_for_optimization"]
    with pytest.raises(ValueError):
        fidelity_report([row], [{"replay_passed": "true", "seed_passed": True}])


def test_fidelity_cli_requires_approval_before_input_reads(tmp_path):
    with pytest.raises(SystemExit) as exc:
        main(["--datasets", str(tmp_path / "missing"), "--out", str(tmp_path / "out.json")])
    assert exc.value.code == 2


def test_openrouter_temperature_changes_only_explicit_checker_calls(monkeypatch):
    from shared.llm_generator import _generation_lm
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-test-not-a-key")
    calls = []
    monkeypatch.setattr("dspy.LM", lambda **kwargs: calls.append(kwargs) or object())
    _generation_lm("openrouter/deepseek/test", temperature=0)
    _generation_lm("openrouter/deepseek/test")
    assert [call["temperature"] for call in calls] == [0, .7]
    for bad in (True, -1, float("nan"), 3):
        with pytest.raises(ValueError):
            _generation_lm("openrouter/deepseek/test", temperature=bad)


def test_sidecar_hydration_hash_binding_paths_and_shared_immutable_contract(tmp_path):
    import json
    from scripts.optimize.corpus import hydrate_record_corpora
    corpus = example()["objective_corpus"]
    data = json.dumps({"x": corpus}).encode()
    (tmp_path / "corpora.json").write_bytes(data)
    manifest = {"files": {"corpora.json": hashlib.sha256(data).hexdigest()}}
    ref = {"corpus_file": "corpora.json", "objective_id": "x", "sha256": corpus["sha256"]}
    rows = [{"objective_id": "x", "objective_corpus": dict(ref)} for _ in range(2)]
    assert hydrate_record_corpora(rows, tmp_path, manifest) is rows
    assert rows[0]["objective_corpus"] is rows[1]["objective_corpus"]
    assert rows[0]["objective_corpus"] == corpus
    bad = [{"objective_id": "x", "objective_corpus": {**ref, "corpus_file": "../arbitrary.json"}}]
    with pytest.raises(ValueError, match="sidecar path"):
        hydrate_record_corpora(bad, tmp_path, manifest)
    (tmp_path / "corpora.json").write_bytes(data + b" ")
    with pytest.raises(ValueError, match="manifest hash"):
        hydrate_record_corpora([{"objective_id": "x", "objective_corpus": ref}], tmp_path, manifest)
