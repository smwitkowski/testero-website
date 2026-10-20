"""Offline capture of explicit fetched language; text and evidence stay unchanged."""
from copy import deepcopy
from datetime import datetime
from email.message import Message
import hashlib
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from shared import doc_search as docs
from shared.doc_disk_cache import DiskDocumentationCache


URL = "https://docs.cloud.google.com/bigquery/docs/access-control"
FINAL = "https://cloud.google.com/bigquery/docs/access-control"
TEXT = "Exact fetched storage fact."


@pytest.fixture
def fetch_html(monkeypatch):
    monkeypatch.setattr(docs.time, "sleep", Mock())

    def fetch(html, *, content_language=None):
        headers = Message()
        headers["Content-Type"] = "text/html; charset=utf-8"
        if content_language is not None:
            headers["Content-Language"] = content_language
        response = SimpleNamespace(status=200, headers=headers, geturl=lambda: FINAL,
                                   read=lambda size: html.encode("utf-8")[:size])
        manager = SimpleNamespace()

        class OpenResponse:
            def __enter__(self):
                return response

            def __exit__(self, *args):
                return None

        manager.open = Mock(return_value=OpenResponse())
        monkeypatch.setattr(docs, "build_opener", Mock(return_value=manager))
        result = docs._fetch_documentation(URL)
        manager.open.assert_called_once()
        return result

    return fetch


@pytest.mark.parametrize("language", [
    "en", "en-US", "EN-us", "ja", "pt-br", "es-419", "zh-Hant-TW",
    "de-CH-1901", "sl-rozaj-biske", "en-u-ca-gregory", "en-x-private",
])
def test_explicit_html_language_preserves_original_text_and_hash(fetch_html, language):
    html = f'<html lang="{language}"><head><title>Not evidence</title></head><main>{TEXT}</main></html>'
    source = fetch_html(html)
    assert source["language"] == language
    assert source["requested_url"] == URL and source["url"] == FINAL
    assert source["text"] == TEXT == docs.content_node(html).text()
    assert source["text_sha256"] == hashlib.sha256(TEXT.encode("utf-8")).hexdigest()
    assert set(source) == {"requested_url", "url", "text", "retrieved_at", "text_sha256", "language"}


@pytest.mark.parametrize("attribute", [
    "", 'lang=""', 'lang="en_US"', 'lang="en ja"', 'lang="en,ja"',
    'lang="123"', 'lang="x-private"', 'lang="en-US-US"',
    'lang="de-1901-1901"', 'lang="en-u-ca-u-nu"', 'lang="eK"', 'lang="en-İS"',
])
def test_absent_or_malformed_html_language_keeps_legacy_source_shape(fetch_html, attribute):
    source = fetch_html(f"<html {attribute}><main>{TEXT}</main></html>")
    assert set(source) == {"requested_url", "url", "text", "retrieved_at", "text_sha256"}
    assert source["text"] == TEXT
    assert source["text_sha256"] == hashlib.sha256(TEXT.encode()).hexdigest()


def test_language_is_not_inferred_from_content_child_or_response_header(fetch_html):
    source = fetch_html('<html><main lang="ja">日本語 documentation text</main></html>',
                        content_language="ja")
    assert "language" not in source
    assert source["text"] == "日本語 documentation text"


def test_html_tag_case_and_outer_whitespace_are_supported(fetch_html):
    source = fetch_html(f'<HTML LANG=" en-US "><main>{TEXT}</main></HTML>')
    assert source["language"] == "en-US"


@pytest.mark.parametrize("language", [None, "ja", "en-US"])
def test_complete_source_roundtrips_both_caches_without_metadata_migration(
    fetch_html, monkeypatch, tmp_path, language,
):
    attribute = f'lang="{language}"' if language is not None else ""
    source = fetch_html(f"<html {attribute}><main>{TEXT}</main></html>")
    original = deepcopy(source)
    cache = DiskDocumentationCache(tmp_path, clock=lambda: datetime.fromisoformat(source["retrieved_at"]))
    cache.put(URL, source)
    assert cache.get(URL) == original
    forbidden_fetch = Mock(side_effect=AssertionError("A valid disk snapshot must not fetch"))
    monkeypatch.setattr(docs, "_fetch_documentation", forbidden_fetch)
    run_cache = docs.DocumentationCache(disk_cache=cache)
    first = run_cache._fetch(URL)
    assert first == original
    first["language"] = "caller mutation"
    assert run_cache._fetch(URL) == original
    assert cache.get(URL) == original
    forbidden_fetch.assert_not_called()
    assert source == original
    # Language is navigation metadata, not a change to rendered evidence headers.
    plain = {key: value for key, value in source.items() if key != "language"}
    assert docs.documentation_context([source]) == docs.documentation_context([plain])
