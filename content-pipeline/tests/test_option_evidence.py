"""Pure option evidence checks; no DSPy or network work."""
import copy
import hashlib

import pytest

from shared.evidence import OptionEvidence, check_evidence


def source(url="https://docs.cloud.google.com/one", text="Exact Cloud Storage fact. Another capability."):
    return {"requested_url": url + "/old", "url": url, "text": text,
            "retrieved_at": "2026-10-04T00:00:00+00:00", "text_sha256": hashlib.sha256(text.encode()).hexdigest()}


def evidence(url="https://docs.cloud.google.com/one", quote="Cloud Storage fact."):
    return [{"option_label": label, "url": url, "quote": quote} for label in "ABCD"]


def test_exact_evidence_passes_and_persists_only_fetched_provenance():
    sources = [source()]
    records = evidence()
    records[0].update(retrieved_at="forged", text_sha256="forged")
    result = check_evidence(records, sources)
    assert result["passed"] is True and result["errors"] == []
    assert len(result["options"]) == 4
    for record in result["options"]:
        assert set(record) == {"option_label", "url", "quote", "retrieved_at", "text_sha256"}
        assert record["retrieved_at"] == sources[0]["retrieved_at"]
        assert record["text_sha256"] == sources[0]["text_sha256"]


def test_explicit_requested_alias_and_typed_models_normalize_to_final_url():
    sources = [source()]
    models = [OptionEvidence(option_label=label, url=sources[0]["requested_url"], quote="Cloud\n Storage   fact.") for label in "DCBA"]
    result = check_evidence(models, sources)
    assert result["passed"]
    assert [r["option_label"] for r in result["options"]] == list("ABCD")
    assert all(r["url"] == sources[0]["url"] and r["quote"] == "Cloud Storage fact." for r in result["options"])


@pytest.mark.parametrize("labels", ["ABC", "ABCDE", "AABC", "ABCDABCD", "abcd", ""])
def test_labels_must_be_exactly_once(labels):
    records = [{"option_label": label, "url": source()["url"], "quote": "Cloud Storage fact."} for label in labels]
    result = check_evidence(records, [source()])
    assert not result["passed"]
    assert "exactly once" in result["errors"][0]


@pytest.mark.parametrize("quote", ["", "   ", "cloud Storage fact.", "Invented fact", "x" * 301, None, 5])
def test_bad_quote_fails_closed(quote):
    assert not check_evidence(evidence(quote=quote), [source()])["passed"]


def test_quote_cannot_be_borrowed_from_another_source():
    sources = [source(), source("https://docs.cloud.google.com/two", "Only second-source fact.")]
    result = check_evidence(evidence(quote="Only second-source fact."), sources)
    assert not result["passed"]
    assert all("own fetched source" in e for e in result["errors"])


@pytest.mark.parametrize("url", ["https://docs.cloud.google.com/ONE", "https://docs.cloud.google.com/one/", "https://docs.cloud.google.com/one?x=1", "https://docs.cloud.google.com/guessed", None])
def test_no_guessed_or_normalized_url_matches(url):
    assert not check_evidence(evidence(url=url), [source()])["passed"]


@pytest.mark.parametrize("field", ["requested_url", "url", "text", "retrieved_at", "text_sha256"])
def test_missing_fetch_provenance_fails_closed(field):
    record = source()
    del record[field]
    assert not check_evidence(evidence(), [record])["passed"]


def test_hash_tampering_and_ambiguous_aliases_fail_closed():
    changed = source()
    changed["text"] = "Tampered Cloud Storage fact."
    assert not check_evidence(evidence(), [changed])["passed"]
    conflicting = source(text="Different Cloud Storage fact.")
    assert not check_evidence(evidence(), [source(), conflicting])["passed"]


@pytest.mark.parametrize("records", [None, "not a list", {}, [None], ["A"]])
def test_malformed_evidence_never_raises(records):
    result = check_evidence(records, [source()])
    assert not result["passed"] and isinstance(result["errors"], list)


def test_checker_does_not_mutate_inputs():
    records, sources = evidence(), [source()]
    before = copy.deepcopy((records, sources))
    check_evidence(records, sources)
    assert (records, sources) == before


@pytest.mark.parametrize("url", ["https://example.com/page", "http://docs.cloud.google.com/page", "https://user@docs.cloud.google.com/page", "https://docs.cloud.google.com:8443/page"])
def test_unapproved_source_records_cannot_claim_fetch_proof(url):
    record = source(url=url)
    assert not check_evidence(evidence(url=url), [record])["passed"]
