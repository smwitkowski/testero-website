"""Grounded retrieval contracts with mocked HTTP and Exa; never live clients."""
import hashlib
import importlib
import sys
from email.message import Message
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.request import Request

import pytest

from shared import doc_search as docs


class Response:
    status = 200
    def __init__(self, url, html, content_type="text/html; charset=utf-8"):
        self.url = url
        self.html = html.encode("utf-8")
        self.headers = Message()
        self.headers["Content-Type"] = content_type
    def geturl(self):
        return self.url
    def read(self, size):
        return self.html[:size]
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return None


def mock_exa(monkeypatch, results):
    search = Mock(return_value=SimpleNamespace(results=[SimpleNamespace(**r) for r in results]))
    client = Mock(return_value=SimpleNamespace(search=search))
    monkeypatch.setenv("EXA_API_KEY", "offline-test-only")
    monkeypatch.setitem(sys.modules, "exa_py", SimpleNamespace(Exa=client))
    return client, search


def test_discovery_and_fetch_bind_exact_urls_and_html(monkeypatch):
    first = "https://docs.cloud.google.com/storage/docs/old"
    final = "https://docs.cloud.google.com/storage/docs/new"
    second = "https://docs.cloud.google.com/bigquery/docs/query"
    client, search = mock_exa(monkeypatch, [
        {"url": first, "text": "Exa text must not become proof"},
        {"url": "https://example.com/not-official"},
        {"url": "https://cloud.google.com/not-a-discovery-host"},
        {"url": first}, {"url": second},
    ])
    responses = {
        first: Response(final, "<nav>Bad menu</nav><main><p>Fetched storage fact.</p><script>Bad JS</script></main>"),
        second: Response(second, "<devsite-content><p>Fetched query fact.</p></devsite-content><footer>Bad footer</footer>"),
    }
    opened = []
    def open_request(request, timeout):
        opened.append(request.full_url)
        assert timeout == 30
        return responses[request.full_url]
    opener = SimpleNamespace(open=open_request)
    monkeypatch.setattr(docs, "build_opener", lambda handler: opener)
    sources = docs.search_objective_docs("Select an analytical query tool", ["BigQuery", "Cloud Storage"])
    assert opened == [first, second]
    assert len(sources) == 2
    assert sources[0]["requested_url"] == first
    assert sources[0]["url"] == final
    assert sources[0]["text"] == "Fetched storage fact."
    assert sources[1]["text"] == "Fetched query fact."
    for source in sources:
        assert set(source) == {"requested_url", "url", "text", "retrieved_at", "text_sha256"}
        assert source["text_sha256"] == hashlib.sha256(source["text"].encode()).hexdigest()
        assert "+00:00" in source["retrieved_at"]
    assert search.call_args.kwargs == {
        "query": "Google Cloud Select an analytical query tool BigQuery, Cloud Storage",
        "type": "neural", "num_results": 5, "include_domains": ["docs.cloud.google.com"],
    }
    context = docs.documentation_context(sources)
    assert "Fetched storage fact." in context
    assert "Exa text" not in context and "Bad" not in context
    assert first in context and final in context


@pytest.mark.parametrize("url", [
    "http://docs.cloud.google.com/x", "https://evil.docs.cloud.google.com/x",
    "https://docs.cloud.google.com.evil.example/x", "https://example.com/x",
    "https://user@docs.cloud.google.com/x", "https://docs.cloud.google.com:8443/x",
    "https://docs.cloud.google.com/x\n", "https://docs.cloud.google.com\\evil/x",
])
def test_unapproved_redirect_rejected_before_following(url, monkeypatch):
    follow = Mock()
    monkeypatch.setattr(docs.HTTPRedirectHandler, "redirect_request", follow)
    with pytest.raises(docs.DocumentationError):
        docs.OfficialDocsRedirectHandler().redirect_request(
            Request("https://docs.cloud.google.com/start"), None, 302, "Moved", {}, url,
        )
    follow.assert_not_called()


def test_official_redirect_is_allowed(monkeypatch):
    follow = Mock(return_value="allowed")
    monkeypatch.setattr(docs.HTTPRedirectHandler, "redirect_request", follow)
    assert docs.OfficialDocsRedirectHandler().redirect_request(
        Request("https://docs.cloud.google.com/start"), None, 302, "Moved", {},
        "https://cloud.google.com/storage/docs/final",
    ) == "allowed"
    follow.assert_called_once()


def test_fetch_failure_cannot_join_exa_snippet_to_another_url(monkeypatch):
    first = "https://docs.cloud.google.com/failed"
    second = "https://docs.cloud.google.com/fetched"
    mock_exa(monkeypatch, [{"url": first, "text": "First search text"}, {"url": second, "text": "Second search text"}])
    def fetch(url):
        if url == first:
            raise OSError("HTTP unavailable")
        text = "The second page actually fetched"
        return {"requested_url": url, "url": url, "text": text, "retrieved_at": "2026-10-04T00:00:00+00:00",
                "text_sha256": hashlib.sha256(text.encode()).hexdigest()}
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    sources = docs.search_objective_docs("Objective", ["Storage"])
    assert len(sources) == 1 and sources[0]["url"] == second
    assert first not in docs.documentation_context(sources)


@pytest.mark.parametrize("results", [[], [{"url": "https://example.com/"}]])
def test_no_fetched_sources_fail_closed_without_guessed_urls(monkeypatch, results):
    mock_exa(monkeypatch, results)
    with pytest.raises(docs.DocumentationError, match="No official documentation"):
        docs.search_objective_docs("Objective", ["Storage"])
    with pytest.raises(docs.DocumentationError):
        docs.search_google_docs("Objective", ["Storage"])
    with pytest.raises(docs.DocumentationError):
        docs.documentation_context([])


def test_missing_key_fails_without_initializing_exa(monkeypatch):
    monkeypatch.delenv("EXA_API_KEY", raising=False)
    fake = Mock()
    monkeypatch.setitem(sys.modules, "exa_py", SimpleNamespace(Exa=fake))
    with pytest.raises(docs.DocumentationError, match="environment"):
        docs.search_objective_docs("Objective", [])
    fake.assert_not_called()


def test_import_is_offline_and_never_loads_dotenv(monkeypatch):
    import dotenv
    load = Mock(side_effect=AssertionError("No dotenv loading"))
    monkeypatch.setattr(dotenv, "load_dotenv", load)
    monkeypatch.setitem(sys.modules, "exa_py", None)
    importlib.reload(docs)
    load.assert_not_called()


def test_wrapper_returns_fetched_final_links_and_scope(monkeypatch):
    text = "Fetched fact"
    source = {"requested_url": "https://docs.cloud.google.com/old", "url": "https://docs.cloud.google.com/new",
              "text": text, "retrieved_at": "2026-10-04T00:00:00+00:00",
              "text_sha256": hashlib.sha256(text.encode()).hexdigest()}
    search = Mock(return_value=[source])
    monkeypatch.setattr(docs, "_search_objective_docs", search)
    context, links = docs.search_google_docs("Objective", ["Cloud Storage"], 2, ["Specific consideration"])
    search.assert_called_once_with("Objective Specific consideration", ["Cloud Storage"], 2)
    assert links == [source["url"]]
    assert text in context


@pytest.mark.parametrize("html,content_type", [("", "text/html"), ("<main>Text</main>", "application/pdf")])
def test_unusable_http_content_fails_closed(monkeypatch, html, content_type):
    url = "https://docs.cloud.google.com/test"
    response = Response(url, html, content_type)
    monkeypatch.setattr(docs, "build_opener", lambda handler: SimpleNamespace(open=lambda *a, **k: response))
    with pytest.raises(docs.DocumentationError):
        docs._fetch_documentation(url)
