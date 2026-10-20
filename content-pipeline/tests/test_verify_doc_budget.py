"""Offline stage budgeting and section-1-sized request regression tests."""
from copy import deepcopy
import hashlib
import json

import pytest
from scripts.probe_cli_input_limit import build_replay
from shared import decision_planner as planner
from shared.cli_models import signature_prompt
from shared.doc_context_budget import build_documentation_context, quote_in_context
from shared.doc_search import documentation_context
from test_decision_first_v4 import decision, scope, proof, pipeline


def page(text, name="page", **extra):
    url = "https://docs.cloud.google.com/" + name
    return dict(url=url, requested_url=url, text=text, retrieved_at="2026-10-20T00:00:00Z",
                text_sha256=hashlib.sha256(text.encode()).hexdigest(), **extra)


def test_section1_sized_replay_fits_with_sources_unchanged():
    # Synthetic reconstruction of the six historical section-1 page sizes.
    # The opt-in --artifact probe separately measures the exact saved snapshot.
    sizes = [245895, 200005, 274973, 10110, 33294, 281937]
    texts = ["BigQuery Job User runs query jobs. Data Viewer reads. Data Editor updates. " * (size // 70 + 2)
             for size in sizes]
    sources = [page(text[:size], f"bigquery/section-{index}")
               for index, (size, text) in enumerate(zip(sizes, texts))]
    plan = {**decision(), "best_action": "BigQuery Job User and dataset roles",
            "decisive_constraints": ["Use the runtime service account for reads and writes"]}
    selected = {**scope(), "objective_id": plan["objective_id"]}
    artifact = {"plan": [selected], "candidates": [{"sources": sources,
                "decision_attempts": [{"plan": plan, "sources": sources}]}]}
    frozen = deepcopy(artifact)
    replay = build_replay(artifact)
    assert len(replay["before_prompt"]) > 1_048_576
    assert len(replay["after_prompt"]) < 425_000
    assert replay["metadata"]["after_chars"] <= 400_000
    assert any(p["trimmed"] for p in replay["metadata"]["pages"])
    assert artifact == frozen
    assert replay["before_prompt"] != replay["after_prompt"]


def test_verifier_rejects_quote_in_original_but_outside_supplied_view():
    sources = [page("Cloud Run serves HTTPS. evidence anchor", "decisive", discovery_options=list("ABCD")),
               page("NOT_IN_VIEW_UNIQUE_QUOTE " + "z" * 600000, "unrelated")]
    metadata = {}
    planner.verification_prompt(scope(), decision(), sources, doc_context_chars=20000, budget_metadata=metadata)
    receipt = {"url": sources[1]["url"], "quote": "NOT_IN_VIEW_UNIQUE_QUOTE"}
    assert not quote_in_context(receipt, sources, metadata)
    raw = proof(True)
    raw["reasons"] = [{"option_label": label, **receipt, "scenario_reason": "Synthetic reason"}
                      for label in "ABCD"]
    result = planner.verify_decision(scope(), decision(), sources, model="codex", doc_context_chars=20000,
                                      predictor=lambda **_: raw)
    assert result["passed"] is False
    assert all("absent from supplied documentation context" in error
               for error in result["mechanical_check"]["errors"])
    assert "documentation_context_budget" not in result  # Strict proof contract stays unchanged.
    assert planner.evidence_missing_veto(result)


def test_writer_preserves_all_receipts_and_span_provenance_under_smaller_cap():
    sources = [page("prefix " * 6000 + f"decisive quote {label}" + " suffix" * 6000, label) for label in "ABCD"]
    frozen = deepcopy(sources)
    receipts = [{"option_label": label, "url": source["url"], "quote": f"decisive quote {label}"}
                for label, source in zip("ABCD", sources)]
    metadata = {}
    context = planner.writer_documentation_context(sources, {"passed": True, "reasons": receipts},
                                                   doc_context_chars=12000, budget_metadata=metadata)
    assert len(context) <= 12000 == metadata["max_chars"]
    assert all(quote_in_context(receipt, sources, metadata) for receipt in receipts)
    assert sources == frozen
    assert metadata["before_chars"] == len(documentation_context(sources))


def test_generation_records_budget_even_if_verifier_fails(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, output, invoke = pipeline
    sources = [page("Cloud Run runtime context. " * 30000, "run")]
    monkeypatch.setattr(generate, "search_objective_docs", lambda *args, **kwargs: sources)
    monkeypatch.setattr(generate, "verify_decision", planner.verify_decision)
    def fail(*args, **kwargs):
        raise RuntimeError("offline fixture transport failure")
    monkeypatch.setattr(planner, "_predict", fail)
    result = invoke("--doc-context-chars", "20000")
    assert result.exit_code == 1
    payload = json.loads((output / "batch.json").read_text())
    assert payload["documentation_context_policy"] == {"version": 1, "max_chars": 20000}
    entry = payload["candidates"][0]
    metadata = entry["decision_attempts"][0]["documentation_contexts"]["verify"]
    assert metadata["before_chars"] > metadata["after_chars"]
    assert metadata["after_chars"] <= 20000
    assert entry["sources"] == sources
    assert "writer" not in events


def test_stable_prefix_reorders_same_budgeted_values():
    sources = [page("Cloud Run serves HTTPS. " * 30000)]
    _, before = planner.verification_prompt(scope(), decision(), sources, doc_context_chars=30000)
    _, ordered = planner.verification_prompt(scope(), decision(), sources, doc_context_chars=30000, stable_prefix=True)
    assert before == ordered
    assert len(ordered["fetched_documentation"]) <= 30000


@pytest.mark.parametrize("payload,entry", [
    ({"documentation_context_policy": None}, None),
    ({"documentation_context_policy": {"version": 1, "max_chars": 1000}}, {"documentation_context_policy": None}),
    ({"documentation_context_policy": {"version": True, "max_chars": 1000}}, None),
    ({"documentation_context_policy": {"version": 1, "max_chars": False}}, None),
])
def test_explicit_bad_frozen_policy_cannot_disable_cap(payload, entry):
    from shared.external_judge import documentation_context_limit
    with pytest.raises(ValueError, match="Invalid documentation-context policy"):
        documentation_context_limit(payload, entry)


def test_missing_policy_preserves_legacy_but_child_cap_is_frozen():
    from shared.external_judge import documentation_context_limit
    assert documentation_context_limit({}, {}) is None
    assert documentation_context_limit({"documentation_context_policy": {"version": 1, "max_chars": 400000}},
        {"documentation_context_policy": {"version": 1, "max_chars": 200000}}) == 200000


def test_custom_cap_reaches_writer_citation_and_frozen_request(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, output, invoke = pipeline
    calls = []
    for stage, name in (("writer", "generate_question"), ("citation", "cite_question")):
        original = getattr(generate, name)
        def record(*args, _original=original, _stage=stage, **kwargs):
            calls.append((_stage, kwargs["doc_context_chars"]))
            return _original(*args, **kwargs)
        monkeypatch.setattr(generate, name, record)
    result = invoke("--doc-context-chars", "20000")
    assert result.exit_code == 0, result.output
    payload = json.loads((output / "batch.json").read_text())
    entry = payload["candidates"][0]
    assert calls == [("writer", 20000), ("citation", 20000)]
    for stage in ("writer", "citation", "external_judge"):
        assert entry["documentation_contexts"][stage]["max_chars"] == 20000
        assert entry["documentation_contexts"][stage]["after_chars"] <= 20000
    request = json.loads((output / entry["external_judge_request"]["path"]).read_text())
    assert request["trimming"]["documentation_context_budget"]["max_chars"] == 20000
