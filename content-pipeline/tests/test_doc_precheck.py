from copy import deepcopy
import hashlib
from unittest.mock import Mock

import pytest

from shared.doc_precheck import check_doc_commitments, fetch_commitment_sources
from shared.doc_search import DocumentationError, _ConflictingDocumentationError

URL = "https://docs.cloud.google.com/vertex-ai/docs/example"


def fixture():
    plan = {"best_action": "Choose A", "mistakes": [
        {"scenario_reason": "Reason " + label} for label in "BCD"]}
    commitments = {"anchors": [{"option_label": label,
        "target_claim": "Choose A" if label == "A" else "Reason " + label,
        "support_claim": "A behavior needing verification", "url": URL + "#section",
        "section": "Overview"} for label in "ABCD"], "unresolved_issues": []}
    text = "Overview: documented behavior"
    source = {"url": URL, "requested_url": URL, "text": text,
              "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
              "retrieved_at": "2026-10-19T00:00:00+00:00"}
    return plan, commitments, [source]


def test_eligible_is_not_semantic_verification():
    result = check_doc_commitments(*fixture())
    assert result["passed"]
    assert not result["semantic_support_verified"]
    assert len(result["checks"]) == 4
    assert result["provenance"]


@pytest.mark.parametrize("metadata", [None, {}, {"anchors": []}, {"anchors": [None]*4, "unresolved_issues": []}])
def test_incomplete_metadata_fails_without_throwing(metadata):
    plan, _, sources = fixture()
    assert not check_doc_commitments(plan, metadata, sources)["passed"]


@pytest.mark.parametrize("change", ["label", "target", "url", "section", "hash", "issue"])
def test_invalid_anchor_and_unresolved_issue_fail(change):
    plan, commitments, sources = fixture()
    if change == "label": commitments["anchors"][0]["option_label"] = "B"
    if change == "target": commitments["anchors"][0]["target_claim"] = "Something else"
    if change == "url": commitments["anchors"][0]["url"] = "https://evil.example/page"
    if change == "section": commitments["anchors"][0]["section"] = "Absent heading"
    if change == "hash": sources[0]["text_sha256"] = "0" * 64
    if change == "issue": commitments["unresolved_issues"] = [{"kind": "prerequisite", "detail": "Unknown runtime"}]
    assert not check_doc_commitments(plan, commitments, sources)["passed"]


def test_section_must_be_on_same_page():
    plan, commitments, sources = fixture()
    commitments["anchors"][0]["url"] = URL + "-other"
    assert not check_doc_commitments(plan, commitments, sources)["passed"]


def test_fetch_uses_cache_once_strips_fragment_and_deduplicates():
    _, commitments, sources = fixture()
    cache = Mock()
    cache._fetch.return_value = sources[0]
    result, errors = fetch_commitment_sources(commitments, cache, [])
    cache._fetch.assert_called_once_with(URL)
    assert result == sources
    assert errors == []


def test_fetch_validates_all_metadata_before_network():
    _, commitments, _ = fixture()
    commitments["anchors"][3]["url"] = "http://localhost/"
    cache = Mock()
    _, errors = fetch_commitment_sources(commitments, cache, [])
    assert errors
    cache._fetch.assert_not_called()


def test_fetch_records_network_failure_but_does_not_hide_conflicts():
    _, commitments, _ = fixture()
    cache = Mock()
    cache._fetch.side_effect = DocumentationError("failed")
    result, errors = fetch_commitment_sources(commitments, cache, [])
    assert result == [] and len(errors) == 1
    cache._fetch.side_effect = _ConflictingDocumentationError("conflict")
    with pytest.raises(_ConflictingDocumentationError):
        fetch_commitment_sources(commitments, cache, [])


def test_redirect_matches_requested_alias_and_conflict_not_concealed():
    plan, commitments, sources = fixture()
    cache = Mock()
    redirected = deepcopy(sources[0])
    redirected["url"] += "-final"
    cache._fetch.return_value = redirected
    result, errors = fetch_commitment_sources(commitments, cache, [])
    assert not errors
    assert check_doc_commitments(plan, commitments, result)["passed"]
    conflicting = deepcopy(redirected)
    conflicting["text_sha256"] = "0" * 64
    conflicting["requested_url"] = URL + "-alias"
    with pytest.raises(_ConflictingDocumentationError):
        fetch_commitment_sources(commitments, cache, [conflicting])


def test_shared_schema_rejects_extra_fields_and_issue_overflow():
    plan, commitments, sources = fixture()
    commitments["invented"] = True
    assert not check_doc_commitments(plan, commitments, sources)["passed"]
    del commitments["invented"]
    commitments["unresolved_issues"] = [{"kind": "ambiguity", "detail": "Unknown"}] * 9
    assert not check_doc_commitments(plan, commitments, sources)["passed"]


def test_whitespace_normalization_is_case_sensitive():
    plan, commitments, sources = fixture()
    commitments["anchors"][0]["section"] = "Overview: documented\n behavior"
    assert check_doc_commitments(plan, commitments, sources)["passed"]
    commitments["anchors"][0]["section"] = "overview"
    assert not check_doc_commitments(plan, commitments, sources)["passed"]
