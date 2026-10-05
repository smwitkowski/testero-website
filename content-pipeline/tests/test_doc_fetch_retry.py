"""Offline retry boundaries for official documentation fetches only."""
import errno
import hashlib
import socket
import ssl
import sys
from email.message import Message
from types import SimpleNamespace
from unittest.mock import Mock
from urllib.error import HTTPError, URLError

import pytest

from shared import doc_search as docs


URL = "https://docs.cloud.google.com/storage/docs/old"
FINAL_URL = "https://cloud.google.com/storage/docs/final"
HTML = b"<main><p>Fetched storage fact.</p></main>"


class Response:
    def __init__(self, *, url=FINAL_URL, raw=HTML, content_type="text/html; charset=utf-8",
                 status=200, read_error=None):
        self.url = url
        self.raw = raw
        self.status = status
        self.read_error = read_error
        self.read_sizes = []
        self.closed = False
        self.headers = Message()
        self.headers["Content-Type"] = content_type

    def geturl(self):
        return self.url

    def read(self, size):
        self.read_sizes.append(size)
        if self.read_error is not None:
            raise self.read_error
        return self.raw[:size]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True


@pytest.fixture
def fake_transport(monkeypatch):
    opened = []
    handlers = []
    effects = []
    sleep = Mock()
    monkeypatch.setattr(docs.time, "sleep", sleep)

    def build(handler):
        assert isinstance(handler, docs.OfficialDocsRedirectHandler)
        handlers.append(handler)

        def open_request(request, timeout):
            assert timeout == 30
            assert request.full_url == URL
            assert request.get_header("User-agent") == "Testero-documentation/1.0"
            opened.append(request)
            effect = effects.pop(0)
            if isinstance(effect, BaseException):
                raise effect
            if callable(effect):
                return effect(handler, request)
            return effect

        return SimpleNamespace(open=open_request)

    monkeypatch.setattr(docs, "build_opener", build)
    return SimpleNamespace(effects=effects, opened=opened, handlers=handlers, sleep=sleep)


@pytest.mark.parametrize("error", [
    TimeoutError(), socket.timeout(), URLError(TimeoutError()),
    ConnectionResetError(), ConnectionAbortedError(), ConnectionRefusedError(),
    BrokenPipeError(), URLError(ConnectionResetError()),
    OSError(errno.ETIMEDOUT, "typed failure"),
    OSError(errno.EHOSTUNREACH, "typed failure"),
    OSError(errno.ENETUNREACH, "typed failure"),
    OSError(errno.ENETDOWN, "typed failure"),
    OSError(errno.ENETRESET, "typed failure"),
    socket.gaierror(socket.EAI_AGAIN, "typed DNS failure"),
    URLError(socket.gaierror(socket.EAI_AGAIN, "typed DNS failure")),
    # CPython reports an SSL handshake timeout as TimeoutError, not SSLError.
    URLError(TimeoutError("The handshake operation timed out")),
])
def test_transient_error_then_success_retries_once(fake_transport, error):
    response = Response()
    fake_transport.effects[:] = [error, response]
    source = docs._fetch_documentation(URL)
    assert len(fake_transport.opened) == 2
    assert len(fake_transport.handlers) == 2
    assert fake_transport.handlers[0] is not fake_transport.handlers[1]
    assert response.closed
    assert response.read_sizes == [docs.MAX_HTML_BYTES + 1]
    assert source["requested_url"] == URL and source["url"] == FINAL_URL
    assert source["text"] == "Fetched storage fact."
    assert source["text_sha256"] == hashlib.sha256(source["text"].encode()).hexdigest()
    assert "+00:00" in source["retrieved_at"]
    assert fake_transport.sleep.call_count == 2
    assert all(call.args == (0.3,) for call in fake_transport.sleep.call_args_list)


@pytest.mark.parametrize("second", [TimeoutError(), URLError(TimeoutError()), ConnectionResetError()])
def test_two_transient_errors_stop_and_preserve_second_error(fake_transport, second):
    fake_transport.effects[:] = [TimeoutError(), second, Response()]
    with pytest.raises(type(second)) as caught:
        docs._fetch_documentation(URL)
    assert caught.value is second
    assert len(fake_transport.opened) == 2
    assert len(fake_transport.effects) == 1


@pytest.mark.parametrize("error", [
    ssl.SSLCertVerificationError(1, "certificate verify failed"),
    URLError(ssl.SSLCertVerificationError(1, "certificate verify failed")),
    ssl.SSLCertVerificationError(errno.ETIMEDOUT, "typed SSL failure"),
    URLError(ssl.SSLError(errno.ECONNRESET, "typed SSL failure")),
    ssl.SSLError(1, "The handshake operation timed out"),
    ssl.SSLWantReadError(ssl.SSL_ERROR_WANT_READ, "typed SSL failure"),
    URLError("connection reset; timed out"),
    OSError("connection reset; timed out"),
    OSError(errno.EACCES, "typed failure"),
    OSError(errno.EINVAL, "typed failure"),
    socket.gaierror(socket.EAI_NONAME, "typed DNS failure"),
    URLError(socket.gaierror(socket.EAI_NONAME, "typed DNS failure")),
    docs.DocumentationError("Security validation failed"),
])
def test_nontransient_errors_are_not_retried(fake_transport, error):
    fake_transport.effects[:] = [error, Response()]
    with pytest.raises(type(error)) as caught:
        docs._fetch_documentation(URL)
    assert caught.value is error
    assert len(fake_transport.opened) == 1


@pytest.mark.parametrize("status", [301, 400, 401, 403, 404, 410, 429, 500, 503])
def test_http_errors_are_not_network_retries(fake_transport, status):
    error = HTTPError(URL, status, "HTTP failure", {}, None)
    fake_transport.effects[:] = [error, Response()]
    with pytest.raises(HTTPError) as caught:
        docs._fetch_documentation(URL)
    assert caught.value is error
    assert len(fake_transport.opened) == 1


@pytest.mark.parametrize("url", [
    "http://docs.cloud.google.com/x", "https://example.com/x",
    "https://cloud.google.com/storage/docs/final", "https://user@docs.cloud.google.com/x",
    "https://docs.cloud.google.com:8443/x", "https://docs.cloud.google.com/x\n",
])
def test_invalid_requested_url_never_attempted(fake_transport, url):
    with pytest.raises(docs.DocumentationError):
        docs._fetch_documentation(url)
    assert fake_transport.opened == []
    assert fake_transport.handlers == []
    fake_transport.sleep.assert_not_called()


@pytest.mark.parametrize("kwargs,error", [
    ({"url": "https://example.com/unapproved"}, docs.DocumentationError),
    ({"status": 404}, docs.DocumentationError),
    ({"content_type": "application/pdf"}, docs.DocumentationError),
    ({"raw": b"x" * (docs.MAX_HTML_BYTES + 1)}, docs.DocumentationError),
    ({"raw": b"<main></main>"}, docs.DocumentationError),
    ({"raw": b"<main>\xff</main>"}, UnicodeDecodeError),
])
@pytest.mark.parametrize("after_timeout", [False, True])
def test_security_and_content_failures_are_not_retried(fake_transport, kwargs, error, after_timeout):
    response = Response(**kwargs)
    fake_transport.effects[:] = ([TimeoutError()] if after_timeout else []) + [response, Response()]
    with pytest.raises(error):
        docs._fetch_documentation(URL)
    assert len(fake_transport.opened) == (2 if after_timeout else 1)
    assert response.closed
    assert len(fake_transport.effects) == 1


def test_timeout_during_read_discards_partial_attempt(fake_transport):
    first, second = Response(read_error=URLError(TimeoutError())), Response()
    fake_transport.effects[:] = [first, second]
    assert docs._fetch_documentation(URL)["text"] == "Fetched storage fact."
    assert len(fake_transport.opened) == 2
    assert first.closed and second.closed


def test_redirects_are_validated_on_both_attempts(fake_transport, monkeypatch):
    follow = Mock(side_effect=lambda req, fp, code, msg, headers, newurl: newurl)
    monkeypatch.setattr(docs.HTTPRedirectHandler, "redirect_request", follow)
    validate = Mock(wraps=docs.approved_documentation_url)
    monkeypatch.setattr(docs, "approved_documentation_url", validate)

    def first(handler, request):
        assert handler.redirect_request(request, None, 302, "Moved", {}, FINAL_URL) == FINAL_URL
        raise TimeoutError()

    def second(handler, request):
        assert handler.redirect_request(request, None, 302, "Moved", {}, FINAL_URL) == FINAL_URL
        return Response()

    fake_transport.effects[:] = [first, second]
    assert docs._fetch_documentation(URL)["url"] == FINAL_URL
    assert follow.call_count == 2
    assert [call.args for call in validate.call_args_list].count((FINAL_URL,)) == 3


@pytest.mark.parametrize("after_timeout", [False, True])
def test_unapproved_redirect_never_followed_or_retried(fake_transport, monkeypatch, after_timeout):
    follow = Mock(side_effect=AssertionError("Unapproved redirect must not be followed"))
    monkeypatch.setattr(docs.HTTPRedirectHandler, "redirect_request", follow)

    def redirect(handler, request):
        return handler.redirect_request(request, None, 302, "Moved", {}, "https://example.com/x")

    fake_transport.effects[:] = ([TimeoutError()] if after_timeout else []) + [redirect, Response()]
    with pytest.raises(docs.DocumentationError):
        docs._fetch_documentation(URL)
    assert len(fake_transport.opened) == (2 if after_timeout else 1)
    follow.assert_not_called()
    assert len(fake_transport.effects) == 1


def test_invalid_hash_context_does_not_trigger_fetch(fake_transport):
    source = {
        "requested_url": URL, "url": FINAL_URL, "text": "Fetched storage fact.",
        "retrieved_at": "2026-10-04T00:00:00+00:00", "text_sha256": "wrong",
    }
    with pytest.raises(docs.DocumentationError, match="inconsistent"):
        docs.documentation_context([source])
    assert fake_transport.opened == []


def test_discovery_timeout_has_no_retry(fake_transport, monkeypatch):
    search = Mock(side_effect=TimeoutError())
    monkeypatch.setenv("EXA_API_KEY", "offline-test-only")
    monkeypatch.setitem(sys.modules, "exa_py", SimpleNamespace(
        Exa=Mock(return_value=SimpleNamespace(search=search)),
    ))
    with pytest.raises(TimeoutError):
        docs._discover_urls("Objective", [], 1)
    search.assert_called_once()
    assert fake_transport.opened == []


def test_parser_error_is_outside_network_retry_scope(fake_transport, monkeypatch):
    parser = Mock(side_effect=TimeoutError())
    monkeypatch.setattr(docs, "content_node", parser)
    fake_transport.effects[:] = [Response(), Response()]
    with pytest.raises(TimeoutError):
        docs._fetch_documentation(URL)
    parser.assert_called_once()
    assert len(fake_transport.opened) == 1


def test_security_failure_is_not_retried_despite_transient_cause(fake_transport):
    error = docs.DocumentationError("Security validation failed")
    error.__cause__ = TimeoutError()
    fake_transport.effects[:] = [error, Response()]
    with pytest.raises(docs.DocumentationError):
        docs._fetch_documentation(URL)
    assert len(fake_transport.opened) == 1
