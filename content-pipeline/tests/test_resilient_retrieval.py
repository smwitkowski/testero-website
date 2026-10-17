"""Replay recorded public HTTP responses; sockets remain blocked by conftest."""
from email.message import Message
from pathlib import Path
import hashlib
import io
import json
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPErrorProcessor, HTTPSHandler

import pytest
from shared import doc_search as docs

FIXTURES = Path(__file__).parent / "fixtures/doc-retrieval"
CAPTURE = json.loads((FIXTURES / "responses.json").read_text())["responses"]
DEAD = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning/distillation"
MOVED = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/generative-ai/docs/models/tune-models"
OLD = "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/tune-models"
FINAL = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning"


@pytest.fixture
def replay(monkeypatch):
    calls = []
    class Response(io.BytesIO):
        def __init__(self, url, row):
            super().__init__((FIXTURES / row["body_file"]).read_bytes() if "body_file" in row else b"")
            self.url, self.code, self.status, self.msg = url, row["status"], row["status"], "recorded"
            self.headers = Message()
            for key,value in row["headers"].items(): self.headers[key] = value
        def info(self): return self.headers
        def geturl(self): return self.url
    class RecordedHTTPS(HTTPSHandler):
        def https_open(self, request):
            calls.append(request.full_url)
            return Response(request.full_url, CAPTURE[request.full_url])
    # Exercise the real redirect handler and HTTP error processor, never a socket.
    monkeypatch.setattr(docs, "build_opener", lambda handler: build_opener(RecordedHTTPS(), handler))
    monkeypatch.setattr(docs.time, "sleep", lambda _: None)
    return calls


def test_recorded_404_path_recovery_and_official_redirect(replay):
    source = docs._fetch_with_path_recovery(MOVED, docs.DocumentationCache())
    assert replay == [MOVED, OLD, FINAL]
    assert source["requested_url"] == MOVED and source["url"] == FINAL
    assert "Tuning" in source["text"]
    assert source["text_sha256"] == hashlib.sha256(source["text"].encode()).hexdigest()
    docs.documentation_context([source])


def test_dead_and_duplicate_search_results_do_not_spend_success_budget(replay, monkeypatch):
    monkeypatch.setattr(docs, "_discover_urls", lambda *args: [DEAD, DEAD, MOVED, OLD, FINAL])
    result = docs._search_objective_docs("Tune models", [], 2, cache=docs.DocumentationCache())
    assert [s["url"] for s in result] == [FINAL]
    assert replay == [DEAD, DEAD.replace("gemini-enterprise-agent-platform", "vertex-ai"), MOVED, OLD, FINAL]


@pytest.mark.parametrize("code", [401, 403, 429, 500])
def test_recovery_is_only_for_404(monkeypatch, code):
    calls = []
    def fetch(url):
        calls.append(url)
        raise HTTPError(url, code, "fixture", {}, None)
    monkeypatch.setattr(docs, "_fetch_documentation", fetch)
    with pytest.raises(HTTPError): docs._fetch_with_path_recovery(MOVED, None)
    assert calls == [MOVED]


@pytest.mark.parametrize("target", ["https://example.com/evil", "http://docs.cloud.google.com/evil", "https://docs.cloud.google.com:8443/evil"])
def test_redirect_security_unchanged_before_transport(monkeypatch, target):
    from urllib.request import Request
    with pytest.raises(docs.DocumentationError):
        docs.OfficialDocsRedirectHandler().redirect_request(Request(OLD), None, 301, "Moved", {}, target)


def test_query_aliases_keep_current_and_legacy_names():
    for text in ("Agent Platform tuning", "Vertex AI tuning", "Gemini Enterprise Agent Platform tuning"):
        query = docs._product_aliases(text)
        assert "Agent Platform" in query and "Vertex AI" in query
