"""Run-local documentation caching with offline discovery and fetch backends."""
import hashlib
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from unittest.mock import Mock

import pytest

from shared import doc_search as docs


URL = "https://docs.cloud.google.com/storage/docs/source"
ALIAS = "https://docs.cloud.google.com/storage/docs/alias"
FINAL = "https://docs.cloud.google.com/storage/docs/final"


def source(url=URL, *, final=FINAL, text="Fetched storage fact.", timestamp="2026-10-05T00:00:00+00:00"):
    return {
        "requested_url": url, "url": final, "text": text,
        "retrieved_at": timestamp,
        "text_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
    }


@pytest.fixture
def backends(monkeypatch):
    discover = Mock(return_value=[URL])
    fetch = Mock(side_effect=lambda url: source(url))
    monkeypatch.setattr(docs, "_discover_urls", discover)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    return discover, fetch


def search(cache, text="Objective", services=None, objective_id="1.1"):
    return docs.search_objective_docs(
        text, [] if services is None else services,
        cache=cache, objective_id=objective_id,
    )


def test_hits_keep_exact_provenance_and_isolate_caller_mutations(backends):
    discover, fetch = backends
    cache = docs.DocumentationCache()
    first = search(cache)
    assert first == [source()]
    first[0]["text"] = "Caller mutation"
    first[0]["text_sha256"] = "bad"
    first.append({"url": "https://example.com/not-evidence"})
    second = search(cache)
    assert second == [source()]
    assert "Fetched storage fact." in docs.documentation_context(second)
    assert second is not first and second[0] is not first[0]
    discover.assert_called_once_with("Objective", [], 5)
    fetch.assert_called_once_with(URL)


def test_different_objectives_share_the_requested_url(backends):
    discover, fetch = backends
    cache = docs.DocumentationCache()
    assert search(cache) == search(cache, "Other objective", objective_id="1.2")
    assert discover.call_count == 2
    fetch.assert_called_once_with(URL)


@pytest.mark.parametrize("text,services,objective_id", [
    ("Changed text", [], "1.1"),
    ("Objective", ["Cloud Storage"], "1.1"),
    ("Objective", [], "1.2"),
])
def test_discovery_keys_do_not_reuse_changed_inputs(backends, text, services, objective_id):
    discover, fetch = backends
    cache = docs.DocumentationCache()
    search(cache)
    search(cache, text, services, objective_id)
    assert discover.call_count == 2
    assert fetch.call_count == 1


def test_cache_without_objective_id_uses_exact_inputs(backends):
    discover, fetch = backends
    cache = docs.DocumentationCache()
    search(cache, objective_id=None)
    search(cache, objective_id=None)
    assert discover.call_count == fetch.call_count == 1


def test_per_run_isolation_and_unchanged_no_cache_path(backends):
    discover, fetch = backends
    for cache in (docs.DocumentationCache(), docs.DocumentationCache(), None, None):
        search(cache)
    assert discover.call_count == fetch.call_count == 4


@pytest.mark.parametrize("phase", ["discovery", "fetch"])
def test_same_key_concurrent_singleflight(backends, phase):
    discover, fetch = backends
    entered, release = Event(), Event()
    start = Barrier(9)

    def blocked(*args):
        entered.set()
        assert release.wait(3), "Test did not release backend"
        return [URL] if phase == "discovery" else source(args[0])

    (discover if phase == "discovery" else fetch).side_effect = blocked
    cache = docs.DocumentationCache()

    def worker():
        start.wait(timeout=3)
        return search(cache)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(worker) for _ in range(8)]
        try:
            start.wait(timeout=3)
            assert entered.wait(3)
        finally:
            release.set()
        results = [future.result(timeout=3) for future in futures]
    assert all(result == [source()] for result in results)
    assert discover.call_count == fetch.call_count == 1
    assert len({id(result[0]) for result in results}) == 8


@pytest.mark.parametrize("phase", ["discovery", "fetch"])
def test_distinct_keys_load_in_parallel(backends, phase):
    discover, fetch = backends
    rendezvous = Barrier(2)

    def discover_urls(text, services, count):
        if phase == "discovery":
            rendezvous.wait(timeout=3)
        return [URL + "/" + text]

    def fetch_url(url):
        if phase == "fetch":
            rendezvous.wait(timeout=3)
        return source(url, final=url)

    discover.side_effect = discover_urls
    fetch.side_effect = fetch_url
    cache = docs.DocumentationCache()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(search, cache, text, None, text) for text in ("a", "b")]
        results = [future.result(timeout=5) for future in futures]
    assert {result[0]["url"] for result in results} == {URL + "/a", URL + "/b"}
    assert discover.call_count == fetch.call_count == 2


def test_shared_final_urls_have_one_provenance_record(backends):
    discover, fetch = backends
    discover.side_effect = [[URL], [ALIAS], [FINAL]]
    fetch.side_effect = [source(), source(ALIAS, timestamp="2026-10-05T00:00:01+00:00")]
    cache = docs.DocumentationCache()
    first = search(cache)[0]
    second = search(cache, "Alias objective", objective_id="2")[0]
    third = search(cache, "Final objective", objective_id="3")[0]
    for result, requested in ((first, URL), (second, ALIAS), (third, FINAL)):
        assert result == {**source(), "requested_url": requested}
        assert docs.documentation_context([result])
    assert fetch.call_count == 2  # Final URL is already known, so is not fetched again.


def test_concurrent_aliases_share_final_provenance(backends):
    discover, fetch = backends
    rendezvous = Barrier(2)
    discover.side_effect = lambda text, services, count: [URL if text == "a" else ALIAS]

    def fetch_alias(url):
        rendezvous.wait(timeout=3)
        return source(url, timestamp="first" if url == URL else "second")

    fetch.side_effect = fetch_alias
    cache = docs.DocumentationCache()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(search, cache, text, None, text) for text in ("a", "b")]
        first, second = [future.result(timeout=5)[0] for future in futures]
    assert first["requested_url"] == URL and second["requested_url"] == ALIAS
    assert {key: value for key, value in first.items() if key != "requested_url"} == {
        key: value for key, value in second.items() if key != "requested_url"
    }


def test_fetch_failures_are_skipped_and_cached_like_successes(backends, caplog):
    discover, fetch = backends
    discover.return_value = [URL, ALIAS]
    calls = Counter()

    def fetch_url(url):
        calls[url] += 1
        if url == URL:
            raise TimeoutError("Offline timeout")
        return source(url)

    fetch.side_effect = fetch_url
    cache = docs.DocumentationCache()
    for text in ("Objective", "Objective", "Other objective"):
        assert search(cache, text) == [source(ALIAS)]
    assert calls == {URL: 1, ALIAS: 1}
    assert "Could not fetch discovered documentation" in caplog.text


def test_all_failed_fetches_keep_existing_empty_error(backends):
    discover, fetch = backends
    fetch.side_effect = TimeoutError("Offline timeout")
    cache = docs.DocumentationCache()
    for _ in range(2):
        with pytest.raises(docs.DocumentationError, match="No official documentation"):
            search(cache)
    assert discover.call_count == fetch.call_count == 1


def test_discovery_failures_are_cached_and_still_propagate(backends):
    discover, fetch = backends
    discover.side_effect = TimeoutError("Offline discovery")
    cache = docs.DocumentationCache()
    for _ in range(2):
        with pytest.raises(TimeoutError, match="Offline discovery"):
            search(cache)
    discover.assert_called_once()
    fetch.assert_not_called()


@pytest.mark.parametrize("phase", ["discovery", "fetch"])
def test_concurrent_failure_singleflight(backends, phase):
    discover, fetch = backends
    start = Barrier(9)
    cache = docs.DocumentationCache()
    (discover if phase == "discovery" else fetch).side_effect = TimeoutError("Offline failure")

    def worker():
        start.wait(timeout=3)
        with pytest.raises(TimeoutError if phase == "discovery" else docs.DocumentationError):
            search(cache)

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(worker) for _ in range(8)]
        start.wait(timeout=3)
        for future in futures:
            future.result(timeout=3)
    discover.assert_called_once()
    assert fetch.call_count == (0 if phase == "discovery" else 1)


def test_empty_discovery_is_cached_without_guessing_urls(backends):
    discover, fetch = backends
    discover.return_value = []
    cache = docs.DocumentationCache()
    for _ in range(2):
        with pytest.raises(docs.DocumentationError, match="No official documentation"):
            search(cache)
    discover.assert_called_once()
    fetch.assert_not_called()


@pytest.mark.parametrize("text,services", [("", []), ("Objective", "Cloud Storage"), ("Objective", [1])])
def test_cached_path_preserves_input_validation(backends, text, services):
    discover, fetch = backends
    with pytest.raises(docs.DocumentationError):
        search(docs.DocumentationCache(), text, services)
    discover.assert_not_called()
    fetch.assert_not_called()



def test_conflicting_alias_text_fails_closed_and_is_cached(backends):
    discover, fetch = backends
    discover.return_value = [URL, ALIAS]
    fetch.side_effect = [source(), source(ALIAS, text="Conflicting fetched fact.")]
    cache = docs.DocumentationCache()
    for _ in range(2):
        with pytest.raises(docs.DocumentationError, match="Conflicting text"):
            search(cache)
    assert discover.call_count == 1
    assert fetch.call_count == 2


def test_different_objectives_concurrently_share_one_url_fetch(backends):
    discover, fetch = backends
    rendezvous = Barrier(8)

    def discover_urls(*args):
        rendezvous.wait(timeout=3)
        return [URL]

    discover.side_effect = discover_urls
    cache = docs.DocumentationCache()
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(search, cache, str(index), None, str(index)) for index in range(8)]
        assert all(future.result(timeout=5) == [source()] for future in futures)
    assert discover.call_count == 8
    fetch.assert_called_once_with(URL)


def test_new_run_can_fetch_after_previous_run_cached_a_failure(backends):
    discover, fetch = backends
    fetch.side_effect = [TimeoutError("Offline first run"), source()]
    failed_run = docs.DocumentationCache()
    for _ in range(2):
        with pytest.raises(docs.DocumentationError, match="No official documentation"):
            search(failed_run)
    assert search(docs.DocumentationCache()) == [source()]
    assert discover.call_count == fetch.call_count == 2


def test_no_cache_preserves_private_search_call_contract(monkeypatch):
    uncached = Mock(return_value=[source()])
    monkeypatch.setattr(docs, "_search_objective_docs", uncached)
    assert docs.search_objective_docs("Objective", [], objective_id="ignored") == [source()]
    uncached.assert_called_once_with("Objective", [], 5)
