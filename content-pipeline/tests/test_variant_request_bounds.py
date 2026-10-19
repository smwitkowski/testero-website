"""Offline request-size regressions. Synthetic documents; no paid calls or artifacts."""
from copy import deepcopy
import hashlib
import json

import pytest

from shared import external_judge as judge
from shared.argon_gate import build_argon_request
from shared.cli_models import output_model, signature_prompt
from shared.evidence import check_evidence, normalize_whitespace
from shared.gates import build_gate_inputs, gate_signatures
from test_generation_gate import QUESTION, QUOTES
from test_variant_round5_gates import frozen_request


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Request building must stay offline")
    monkeypatch.setattr("dspy.LM", forbidden)
    monkeypatch.setattr("shared.cli_models.run_signature", forbidden)
    monkeypatch.setattr("shared.cli_models.run_claude_request", forbidden)
    monkeypatch.setattr("shared.argon_gate.run_argon", forbidden)
    monkeypatch.setattr("shared.doc_search.search_objective_docs", forbidden)


def large_inputs(padding=9000, policy=5):
    sources, evidence = [], []
    for label, quote in zip("ABCD", QUOTES):
        url = "https://docs.cloud.google.com/synthetic/" + label
        text = "before " * 5000 + quote + " after" * 5000
        sources.append({"requested_url": url + "?requested=1", "url": url,
                        "text": text, "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
                        "retrieved_at": "2026-10-04T00:00:00+00:00"})
        evidence.append({"option_label": label, "url": url, "quote": quote})
    scope = {"objective_id": "machine-learning-engineer:standard:5.1:1",
             "domain_prompt": "Frozen scope. " + "x" * padding}
    if policy is not None:
        scope["variant_policy_version"] = policy
    return scope, sources, evidence


def build(scope, sources, evidence):
    return judge.build_request("synthetic", scope, QUESTION, sources, evidence,
                               argon_gate=True, execution_policy="short_circuit_v1")


def characters(request):
    # Match the actual pretty-printed export, including the final newline.
    return len(json.dumps(request, indent=2, ensure_ascii=False, allow_nan=False)) + 1


@pytest.mark.parametrize("padding,margin", [(9000, 3000), (17000, 2000), (25000, 1000)])
def test_policy5_tightens_only_as_needed_and_preserves_complete_request(padding, margin, monkeypatch):
    scope, sources, evidence = large_inputs(padding)
    frozen = deepcopy((scope, sources, evidence))
    original = judge._source_context
    attempts = []

    def context(*args, **kwargs):
        result = original(*args, **kwargs)
        attempts.append((kwargs["margin"], result))
        return result

    monkeypatch.setattr(judge, "_source_context", context)
    request = build(scope, sources, evidence)
    assert judge.REQUEST_CHARACTER_LIMIT == 150000
    assert characters(request) <= 150000
    assert [item[0] for item in attempts] == (
        [8000] * 5 + [4000] + [m for m in (3000, 2000, 1000) if m >= margin])
    assert request["variant_policy_version"] == 5
    assert request["execution_policy"] == "short_circuit_v1"
    assert (scope, sources, evidence) == frozen
    included_context, metadata = attempts[-1][1]
    assert request["trimming"] == metadata
    assert metadata["enabled"] is True and metadata["character_limit"] == 150000
    assert len(metadata["sources"]) == 4
    for source, record, receipt in zip(sources, metadata["sources"], evidence):
        normalized = normalize_whitespace(source["text"])
        excerpt = "\n[... source text omitted ...]\n".join(normalized[a:b] for a, b in record["windows"])
        assert receipt["quote"] in excerpt
        assert record["margin"] == margin and record["trimmed"] is True
        assert record["original_text_sha256"] == source["text_sha256"]
        assert record["original_characters"] == len(source["text"])
        assert record["normalized_characters"] == len(normalized)
        assert record["included_characters"] == sum(b - a for a, b in record["windows"])
        assert record["excerpt_sha256"] == hashlib.sha256(excerpt.encode()).hexdigest()
        for provenance in (source["url"], source["requested_url"], source["retrieved_at"],
                           source["text_sha256"], record["excerpt_sha256"], excerpt):
            assert provenance in included_context
    checked = check_evidence(evidence, sources)
    assert checked["passed"]
    inputs = build_gate_inputs(QUESTION, scope["domain_prompt"], included_context, checked["options"],
                               variant_policy_version=5)
    for name, signature in gate_signatures(variant_policy_version=5).items():
        assert request["gates"][name] == {
            "judge_prompt": signature_prompt(signature, inputs[name]),
            "verdict_schema": output_model(signature).model_json_schema()}
    assert request["argon"] == build_argon_request(QUESTION, scope, included_context,
                                                   checked["options"], review_only=True)


@pytest.mark.parametrize("policy", [None, 3, 4])
def test_historical_large_requests_still_fail_at_legacy_margin(policy, monkeypatch):
    scope, sources, evidence = large_inputs(padding=17000, policy=policy)
    margins = []
    original = judge._source_context

    def context(*args, **kwargs):
        margins.append(kwargs["margin"])
        return original(*args, **kwargs)

    monkeypatch.setattr(judge, "_source_context", context)
    with pytest.raises(ValueError, match="exceeds the character bound"):
        build(scope, sources, evidence)
    assert margins == [8000] * 5 + [4000]


def test_policy5_still_fails_closed_when_minimum_context_cannot_fit():
    with pytest.raises(ValueError, match="exceeds the character bound"):
        build(*large_inputs(padding=40000))


def test_policy5_cannot_trim_around_unverified_receipts():
    scope, sources, evidence = large_inputs()
    evidence[0]["quote"] = "This quote is not in any fetched source."
    with pytest.raises(ValueError, match="without verified A-D evidence"):
        build(scope, sources, evidence)


@pytest.mark.parametrize("policy,mode,expected", [
    (3, "strict", "9d91f325e1ceaea8520c4013dc9793a81f6c0efbcb781dc35aacbb5fb3b1900d"),
    (3, "consistent", "3582a061ef89a592832c73b32827170a545073c48593d1f144e3d779cfeeed5b"),
    (4, "strict", "b5a4eaee288fa6af4068d4df127763ad443b524bbb99511acea2178f36251c88"),
    (4, "consistent", "a8cdaba95b17cca5f544c14f71098316f5dcb0bd3739b995f14dd99486f4dbed"),
])
def test_historical_full_request_sha_stays_identical(policy, mode, expected):
    # Same entire-request baselines as the existing round-5 gate regression.
    request = frozen_request(policy=policy, mode=mode, context=True)
    assert judge.canonical_sha256(request) == expected
