"""Offline opt-in cache, original-span retrieval and prompt-policy contracts."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import hashlib
import json
from concurrent.futures import ThreadPoolExecutor

import dspy
import pytest

from shared.doc_disk_cache import DiskDocumentationCache
from shared.doc_search import DocumentationCache, DocumentationError
from shared.doc_retrieval import BM25, RetrievalSession, chunk_sources, quote_in_chunks, plan_queries
from shared.decision_planner import verification_prompt, verify_decision
from shared.cli_models import signature_prompt
from test_decision_first_v4 import decision, scope, proof, pipeline
from test_external_generation import source


def page(text, suffix="test"):
    return {**source(), "url": "https://docs.cloud.google.com/" + suffix,
            "requested_url": "https://docs.cloud.google.com/" + suffix,
            "text": text, "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "retrieved_at": "2026-10-19T00:00:00+00:00"}


def test_disk_hit_preserves_original_time_hash_and_mutation_isolation(tmp_path, monkeypatch):
    cache = DiskDocumentationCache(tmp_path, clock=lambda: datetime(2026,10,20,tzinfo=timezone.utc))
    value = page("Cloud Run serves HTTP requests.")
    cache.put(value["url"], value)
    monkeypatch.setattr("shared.doc_search._fetch_documentation", lambda url: pytest.fail("network on cache hit"))
    retrieved = DocumentationCache(disk_cache=cache)._fetch(value["url"])
    assert retrieved == value
    retrieved["text"] = "mutated"
    assert cache.get(value["url"]) == value
    assert DocumentationCache(disk_cache=cache)._fetch(value["url"]) == value


@pytest.mark.parametrize("mutation", ["expired", "future", "hash", "version", "host", "binding", "naive", "json"])
def test_disk_invalid_records_are_misses(tmp_path, mutation):
    cache = DiskDocumentationCache(tmp_path, clock=lambda: datetime(2026,10,20,tzinfo=timezone.utc))
    value = page("Exact technical text")
    cache.put(value["url"], value)
    path = cache._path(value["url"])
    record = json.loads(path.read_text())
    if mutation == "expired": record["fetched_at"] = record["source"]["retrieved_at"] = "2026-10-01T00:00:00+00:00"
    elif mutation == "future": record["fetched_at"] = record["source"]["retrieved_at"] = "2026-10-21T00:00:00+00:00"
    elif mutation == "hash": record["source"]["text"] += "tampered"
    elif mutation == "version": record["version"] = 99
    elif mutation == "host": record["source"]["url"] = "https://example.com/"
    elif mutation == "binding": record["requested_url"] += "other"
    elif mutation == "naive": record["fetched_at"] = record["source"]["retrieved_at"] = "2026-10-19T00:00:00"
    path.write_text("{" if mutation == "json" else json.dumps(record))
    assert cache.get(value["url"]) is None


def test_disk_atomic_parallel_writers_and_exact_expiry(tmp_path):
    now = datetime(2026,10,26,tzinfo=timezone.utc)
    cache = DiskDocumentationCache(tmp_path, clock=lambda: now)
    value = page("parallel snapshot")
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: cache.put(value["url"], value), range(16)))
    assert json.loads(cache._path(value["url"]).read_text())["source"] == value
    assert not list(tmp_path.glob("*.tmp"))
    assert cache.get(value["url"]) is None  # exactly seven days
    with pytest.raises(DocumentationError): cache.get("https://example.com/not-official")


def test_cache_off_keeps_network_run_local_without_disk(monkeypatch, tmp_path):
    calls = []
    value = page("fresh")
    monkeypatch.setattr("shared.doc_search._fetch_documentation", lambda url: calls.append(url) or value)
    cache = DocumentationCache()
    assert cache._fetch(value["url"]) == value
    cache._fetch(value["url"])
    assert calls == [value["url"]]
    assert not list(tmp_path.iterdir())


def test_chunks_are_stable_exact_spans_cover_quote_boundaries_and_hash_changes():
    value = page(("A technical sentence about request billing. " * 180) + "Ω CaseSensitive tail")
    chunks = chunk_sources([value])
    assert chunks == chunk_sources([deepcopy(value)])
    assert all(chunk.text == value["text"][chunk.start:chunk.end] for chunk in chunks)
    for position in range(0, len(value["text"]) - 300, 101):
        receipt = {"url": value["url"], "quote": value["text"][position:position+300]}
        assert quote_in_chunks(receipt, chunks)
    changed = page(value["text"] + "new")
    assert {c.id for c in chunks}.isdisjoint(c.id for c in chunk_sources([changed]))


def test_ranker_targets_each_action_and_constraint_deterministically():
    plan, selected_scope = decision(), scope()
    pages = [page("Cloud Run HTTP handler requests. " * 50, "run"),
             page("BigQuery batch offline processing. " * 50, "bq"),
             page("Cloud Storage stored objects cannot execute application code. " * 50, "storage"),
             page("Compute Engine infrastructure management virtual machines. " * 50, "vm")]
    chunks = chunk_sources(pages)
    ranker = BM25(chunks)
    assert ranker.rank("Cloud Storage stored objects")[0].url.endswith("storage")
    assert ranker.rank("unfindablexyz") == []
    retrieved = RetrievalSession().prepare(selected_scope, plan, pages)
    assert all(any(action.casefold() in " ".join(plan_queries(selected_scope, plan)).casefold()
                   for action in [mistake["action"]]) for mistake in plan["mistakes"])
    assert len(retrieved["context"]) <= 60000
    assert {chunk.url for chunk in retrieved["chunks"]} == {p["url"] for p in pages}
    assert pages == retrieved["sources"] or set(p["url"] for p in pages) == set(p["url"] for p in retrieved["sources"])


@pytest.mark.parametrize("mode", ["strict", "consistent"])
def test_prefix_order_in_cli_and_native_adapter_preserves_typed_policy(mode):
    selected_scope = {**scope(), "distractor_evidence": {"version": 1, "mode": mode}}
    pages = [source()]
    signature, inputs = verification_prompt(selected_scope, decision(), pages, stable_prefix=True)
    assert list(signature.input_fields) == ["objective_documentation", "stable_objective", "fetched_documentation", "objective_scope", "proposed_plan"]
    assert set(signature.output_fields) == {"supported", "uniquely_best", "scenario_reasons_supported", "no_feature_gotchas", "reason", "reasons"}
    prompt = signature_prompt(signature, inputs)
    assert prompt.index("Official fetched Google Cloud") < prompt.index(json.dumps(decision(), ensure_ascii=False))
    messages = dspy.ChatAdapter().format(signature, [], inputs)
    user = messages[-1]["content"]
    assert user.index(inputs["fetched_documentation"]) < user.index(inputs["objective_scope"]) < user.index(inputs["proposed_plan"])


def test_verifier_rejects_quote_in_full_source_but_not_selected_chunk():
    selected_scope, plan, pages = scope(), decision(), [source()]
    retrieved = RetrievalSession().prepare(selected_scope, plan, pages)
    retrieved["chunks"] = []
    checked = verify_decision(selected_scope, plan, pages, model="codex", retrieval=retrieved, predictor=lambda **kw: proof())
    assert checked["passed"] is False
    assert any("absent from supplied retrieval chunks" in error for error in checked["mechanical_check"]["errors"])


def test_objective_prefix_stays_frozen_when_candidate_sources_change():
    session = RetrievalSession()
    selected_scope, plan = scope(), decision()
    first = session.prepare(selected_scope, plan, [page(selected_scope["objective_text"] + " Cloud Run managed HTTP application deployment.", "run")])
    second = session.prepare(selected_scope, plan, [page("New BigQuery batch documentation", "bq")])
    assert first["metadata"]["objective_prefix_sha256"] == second["metadata"]["objective_prefix_sha256"]
    assert second["context"].startswith(first["context"].split("Candidate-specific per-option passages:")[0])
    assert len(second["sources"]) == 2


@pytest.mark.parametrize("cap", [1, 2, 3])
def test_generator_attempt_cap_is_explicit_bounded_and_frozen(pipeline, monkeypatch, cap):
    from scripts import generate_pmle_questions as generate
    from test_decision_first_v4 import proof
    events, path, invoke = pipeline
    count = []
    def next_plan(*args, **kwargs):
        count.append(1)
        return decision("Distinct unsupported decision " + str(len(count)))
    monkeypatch.setattr(generate, "plan_decision", next_plan)
    monkeypatch.setattr(generate, "verify_decision", lambda *args, **kwargs: {
        **proof(False), "passed": False, "mechanical_check": {"passed": False, "errors": []}})
    result = invoke("--decision-attempts", str(cap))
    assert result.exit_code == 1
    artifact = json.loads((path / "batch.json").read_text())
    assert len(count) == cap
    assert artifact["retrieval_experiment"]["decision_attempts"] == cap
    assert artifact["retrieval_experiment"]["per_option_retrieval"] is False
    assert artifact["retrieval_experiment"]["disk_cache"] is False


def test_chunk_small_parameters_progress_and_budget_reuse():
    value = page("A sentence. " * 300)
    chunks = chunk_sources([value], size=400, overlap=350)
    assert chunks[-1].end == len(value["text"])
    assert all(a.start < b.start for a, b in zip(chunks, chunks[1:]))
    session = RetrievalSession()
    first = session.prepare(scope(), decision(), [value], budget=60000)
    second = session.prepare(scope(), decision(), [value], budget=4000)
    assert len(second["context"]) <= 4000
    with pytest.raises(ValueError): session.prepare(scope(), decision(), [value], budget=200)


def test_prefix_retains_matching_original_alias_time_and_exact_spans():
    selected_scope = scope()
    value = page(selected_scope["objective_text"] + " Cloud Run requests " * 80)
    session = RetrievalSession()
    session.prepare(selected_scope, decision(), [value])
    alias = {**value, "requested_url": "https://docs.cloud.google.com/alias", "retrieved_at": "2026-10-20T00:00:00+00:00"}
    second = session.prepare(selected_scope, decision(), [alias])
    assert second["sources"] == [value]
    assert all(chunk.requested_url == value["requested_url"] and chunk.retrieved_at == value["retrieved_at"] for chunk in second["chunks"])
    assert all(chunk.text == value["text"][chunk.start:chunk.end] for chunk in second["chunks"])


def test_failed_snapshot_write_does_not_discard_successful_fetch(tmp_path, monkeypatch):
    value = page("network source remains valid")
    disk = DiskDocumentationCache(tmp_path)
    monkeypatch.setattr("shared.doc_search._fetch_documentation", lambda url: value)
    monkeypatch.setattr(disk, "put", lambda *args: (_ for _ in ()).throw(OSError("read-only filesystem")))
    assert DocumentationCache(disk_cache=disk)._fetch(value["url"]) == value


def test_offline_replay_uses_candidate_scope_not_first_matching_objective(monkeypatch):
    from scripts import replay_doc_retrieval as replay_script
    selected_scope = scope()
    other_scope = {**selected_scope, "domain_prompt": "different presentation hints"}
    captured = []
    original = replay_script.verification_prompt
    def capture(selected_scope, *args, **kwargs):
        captured.append(selected_scope["domain_prompt"])
        return original(selected_scope, *args, **kwargs)
    monkeypatch.setattr(replay_script, "verification_prompt", capture)
    artifact = {"plan": [selected_scope, other_scope], "candidates": [{
        "index": 2, "objective_id": selected_scope["objective_id"],
        "decision_attempts": [{"attempt": 1, "sources": [source()], "plan": decision(), "proof": proof()}]}]}
    report = replay_script.replay(artifact)
    assert captured == [other_scope["domain_prompt"], other_scope["domain_prompt"]]
    assert report["quote_count"] == 4
    artifact["candidates"][0]["objective_id"] = "mismatched-rotation"
    with pytest.raises(ValueError, match="rotation"):
        replay_script.replay(artifact)


def test_ab_dry_plan_and_failed_recall_never_execute_models(tmp_path, monkeypatch, capsys):
    from scripts import run_retrieval_ab as runner
    bank = tmp_path / "bank.json"
    bank.write_text("[]")
    report = tmp_path / "replay.json"
    report.write_text(json.dumps({"recall_gate_passed": True, "quote_recall": 1.0,
                                  "budget_chars": 60000, "implementation_sha256": "stale"}))
    monkeypatch.setattr(runner.subprocess, "run", lambda *args, **kwargs: pytest.fail("unexpected process"))
    args = ["run_retrieval_ab", "--bank", str(bank), "--tag", "offline-test-cohort", "--replay-report", str(report)]
    monkeypatch.setattr("sys.argv", args)
    runner.main()
    assert "DRY PLAN ONLY" in capsys.readouterr().out
    monkeypatch.setattr("sys.argv", args + ["--execute"])
    with pytest.raises(SystemExit) as error: runner.main()
    assert error.value.code == 2


def test_generator_opt_in_retrieval_preserves_full_sources(pipeline, monkeypatch):
    from scripts import generate_pmle_questions as generate
    events, path, invoke = pipeline
    seen = []
    def verified(selected_scope, plan, sources, **kwargs):
        retrieved = kwargs["retrieval"]
        assert kwargs["stable_prefix"] is True
        assert sources == retrieved["sources"] == [source()]
        assert all(chunk.text == sources[0]["text"][chunk.start:chunk.end] for chunk in retrieved["chunks"])
        seen.append(retrieved["metadata"])
        return {**proof(), "passed": True, "mechanical_check": {"passed": True, "errors": []}}
    monkeypatch.setattr(generate, "verify_decision", verified)
    result = invoke("--verify-retrieval", "--verify-stable-prefix")
    assert result.exit_code == 0, result.output
    artifact = json.loads((path / "batch.json").read_text())
    assert artifact["candidates"][0]["decision_attempts"][0]["retrieval"] == seen[0]
    assert artifact["candidates"][0]["sources"] == [source()]
