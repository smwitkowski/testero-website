"""Offline budget tests: source preservation is not a semantic support judgment."""
from copy import deepcopy
import hashlib
import json

import pytest

from shared.doc_context_budget import (
    DEFAULT_DOC_CONTEXT_CHARS, DocumentationBudgetError, build_documentation_context, quote_in_context,
)
from shared.doc_search import DocumentationError, documentation_context


def source(name, text, **extra):
    url = f"https://docs.cloud.google.com/{name}/docs/guide"
    return {"url": url, "requested_url": url, "text": text,
            "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
            "retrieved_at": "2026-10-20T00:00:00Z", **extra}


def plan():
    return {"best_action": "BigQuery authorized views share analytical results",
            "mistakes": [{"action": "Dataflow streaming pipeline"},
                         {"action": "Dataproc Spark cluster"},
                         {"action": "Spanner transactional database"}]}


def assert_audit(result, sources, cap):
    context, metadata = result["context"], result["metadata"]
    assert len(context) <= cap
    assert metadata["max_chars"] == cap
    assert metadata["after_chars"] == len(context)
    assert metadata["before_chars"] == len(documentation_context(sources))
    assert metadata["after_pages"] == sum(not page["omitted"] for page in metadata["pages"])
    assert json.loads(json.dumps(metadata)) == metadata
    for page, original in zip(metadata["pages"], sources):
        assert page["text_sha256"] == original["text_sha256"]
        assert page["retrieved_at"] == original["retrieved_at"]
        assert page["before_chars"] == len(original["text"])
        assert page["after_chars"] == sum(end - start for start, end in page["retained_offsets"])
        spans = [(start, end, "keep") for start, end in page["retained_offsets"]]
        spans += [(start, end, "omit") for start, end in page["trimmed_spans"]]
        previous = 0
        for start, end, kind in sorted(spans):
            assert start == previous
            assert start < end <= len(original["text"])
            if kind == "keep":
                assert original["text"][start:end] in context
            previous = end
        assert previous == len(original["text"])


def test_default_and_exact_legacy_under_budget_compatibility():
    sources = [source("bigquery", "Small full page.\nKeep whitespace.  "), source("dataflow", "Another page 🌐")]
    original = deepcopy(sources)
    result = build_documentation_context(sources)
    assert DEFAULT_DOC_CONTEXT_CHARS == 400_000
    assert result["context"] == documentation_context(sources)
    assert all(page["status"] == "full" for page in result["metadata"]["pages"])
    assert sources == original
    assert_audit(result, sources, DEFAULT_DOC_CONTEXT_CHARS)


def test_representative_decisive_product_pages_precede_overview():
    sources = [source("overview", "shared overview " * 1500, discovery_kind="overview")]
    for label, product in zip("ABCD", ("BigQuery", "Dataflow", "Dataproc", "Spanner")):
        sources.append(source(product.lower(), (f"{product} decisive action.\n\n" * 100),
                              discovery_options=[label], discovery_kind="option"))
    original = json.dumps(sources, sort_keys=True)
    result = build_documentation_context(sources, max_chars=7000, plan=plan())
    pages = result["metadata"]["pages"]
    assert pages[0]["omitted"]
    assert [p["mandatory_options"] for p in pages[1:]] == [[label] for label in "ABCD"]
    assert all(not page["omitted"] for page in pages[1:])
    assert json.dumps(sources, sort_keys=True) == original
    assert_audit(result, sources, 7000)


def test_historical_sources_use_action_overlap_for_each_option():
    sources = [source("overview", "unrelated infrastructure " * 1000)]
    for product in ("BigQuery", "Dataflow", "Dataproc", "Spanner"):
        sources.append(source(product.lower(), f"{product} documented behavior. " * 500))
    result = build_documentation_context(sources, max_chars=6000, plan=plan())
    assert result["metadata"]["pages"][0]["omitted"]
    assert [p["mandatory_options"] for p in result["metadata"]["pages"][1:]] == [[label] for label in "ABCD"]
    assert all("lexical" in p["priority_basis"] for p in result["metadata"]["pages"])
    assert_audit(result, sources, 6000)


def test_required_receipt_and_planned_decisive_quotes_survive_exactly():
    quote_a = "BigQuery supports exact CASE and  spacing."
    quote_d = "Spanner has\ntransactional behavior."
    sources = [source("overview", "boilerplate " * 4000),
               source("bigquery", "preface " * 3000 + quote_a + " tail " * 3000),
               source("spanner", "preface " * 3000 + quote_d + " tail " * 3000)]
    planned = {**plan(), "decisive_quote": {"url": sources[1]["url"], "quote": quote_a}}
    receipts = [{"url": sources[2]["url"], "quote": quote_d}]
    result = build_documentation_context(sources, max_chars=5000, plan=planned, receipts=receipts)
    assert quote_a in result["context"]
    assert quote_d in result["context"]
    assert all(not p["omitted"] for p in result["metadata"]["pages"][1:])
    assert all(p["required_quote_offsets"] for p in result["metadata"]["pages"][1:])
    assert_audit(result, sources, 5000)


def test_unbound_plan_quote_protects_every_matching_page():
    sources = [source("one", "filler " * 1500 + "Exact decisive quote"),
               source("two", "Exact decisive quote" + " filler" * 1500)]
    result = build_documentation_context(sources, max_chars=1400,
                                         plan={"planned_decisive_quote": "Exact decisive quote"})
    assert result["context"].count("Exact decisive quote") == 2
    assert all(page["required_quote_offsets"] for page in result["metadata"]["pages"])
    assert_audit(result, sources, 1400)


def test_required_span_overflow_fails_closed_without_mutating_sources():
    quote = "Very long required quote. " * 500
    sources = [source("bigquery", quote)]
    original = deepcopy(sources)
    with pytest.raises(DocumentationBudgetError, match="Required quote spans"):
        build_documentation_context(sources, max_chars=1000, receipts=[{"url": sources[0]["url"], "quote": quote}])
    assert sources == original


def test_mandatory_option_headers_fail_closed_when_they_do_not_fit():
    sources = [source(label, "Documented behavior.", discovery_options=[label]) for label in "ABCD"]
    with pytest.raises(DocumentationBudgetError, match="mandatory option pages"):
        build_documentation_context(sources, max_chars=800)


@pytest.mark.parametrize("quote", ["wrong CASE", "", None])
def test_quotes_require_case_sensitive_nonempty_match_even_under_budget(quote):
    sources = [source("bigquery", "wrong case; exact whitespace")]
    with pytest.raises(DocumentationBudgetError):
        build_documentation_context(sources, receipts=[{"url": sources[0]["url"], "quote": quote}])


def test_only_explicit_fetched_url_alias_is_accepted():
    sources = [source("bigquery", "A supported action")]
    sources[0]["requested_url"] += "?original=true"
    result = build_documentation_context(sources, receipts=[{"url": sources[0]["requested_url"], "quote": "supported action"}])
    assert "supported action" in result["context"]
    with pytest.raises(DocumentationBudgetError, match="not fetched"):
        build_documentation_context(sources, receipts=[{"url": sources[0]["url"] + "/invented", "quote": "supported action"}])


def test_giant_section_uses_late_action_excerpt_not_first_n_truncation():
    text = "unrelated preface " * 3000 + "BigQuery authorized views share analytical results. " + "tail filler " * 3000
    sources = [source("bigquery", text)]
    result = build_documentation_context(sources, max_chars=2500, plan=plan())
    assert "BigQuery authorized views share analytical results." in result["context"]
    assert result["metadata"]["pages"][0]["retained_offsets"][0][0] > 10000
    assert_audit(result, sources, 2500)


def test_whole_sections_preferred_over_arbitrary_cut():
    first = "# Overview\n" + "background " * 200 + "\n"
    decisive = "# Authorized views\nBigQuery authorized views share analytical results.\n"
    final = "# Other\n" + "irrelevant " * 200
    sources = [source("bigquery", first + decisive + final)]
    cap = len(documentation_context([source("bigquery", decisive)])) + 100
    result = build_documentation_context(sources, max_chars=cap, plan=plan())
    assert decisive in result["context"]
    assert result["metadata"]["pages"][0]["retained_offsets"] == [[len(first), len(first + decisive)]]
    assert_audit(result, sources, cap)


def test_deterministic_byte_identical_metadata_and_context():
    sources = [source("bigquery", "BigQuery authorized views " * 1500), source("overview", "overview " * 2000)]
    args = dict(max_chars=3000, plan=plan())
    first = build_documentation_context(sources, **args)
    second = build_documentation_context(deepcopy(sources), **args)
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
    assert_audit(first, sources, 3000)


def test_equal_priority_longest_page_trimmed_first():
    sources = [source("short", "small " * 150), source("long", "large " * 700)]
    cap = len(documentation_context(sources)) - 1200
    result = build_documentation_context(sources, max_chars=cap)
    assert result["metadata"]["pages"][0]["status"] == "full"
    assert result["metadata"]["pages"][1]["status"] == "trimmed"
    assert_audit(result, sources, cap)


def test_all_rendered_unicode_characters_including_headers_count():
    sources = [source("unicode", "🌐 résumé " * 1000)]
    result = build_documentation_context(sources, max_chars=1700)
    assert_audit(result, sources, 1700)
    assert len(result["context"].encode("utf-8")) > len(result["context"])


@pytest.mark.parametrize("cap", [True, 0, -1, 1.5, "1000"])
def test_invalid_budgets_fail(cap):
    with pytest.raises(DocumentationBudgetError):
        build_documentation_context([source("bigquery", "valid source")], max_chars=cap)


def test_original_hash_validation_is_not_bypassed_by_trimming():
    sources = [source("bigquery", "valid source")]
    sources[0]["text"] += "tampered"
    with pytest.raises(DocumentationError, match="inconsistent"):
        build_documentation_context(sources, max_chars=1)


def test_no_sources_remains_an_error():
    with pytest.raises(DocumentationError):
        build_documentation_context([])


def test_normalized_receipts_map_to_original_raw_offsets():
    sources = [source("bigquery", "preface " * 1000 + "evidence\n  anchor" + " tail" * 1000)]
    receipt = {"url": sources[0]["url"], "quote": " evidence anchor "}
    result = build_documentation_context(sources, max_chars=1300, receipts=[receipt])
    assert "evidence\n  anchor" in result["context"]
    assert quote_in_context(receipt, sources, result["metadata"])
    offsets = result["metadata"]["pages"][0]["required_quote_offsets"]
    assert [sources[0]["text"][start:end] for start, end in offsets] == ["evidence\n  anchor"]
    assert not quote_in_context({**receipt, "quote": "Evidence anchor"}, sources, result["metadata"])
    assert_audit(result, sources, 1300)


def test_quote_checker_rejects_cross_excerpt_cross_page_and_header_matches():
    sources = [source("one", "First segment lost middle Last segment"), source("two", "Different page quote")]
    result = build_documentation_context(sources)
    metadata = deepcopy(result["metadata"])
    metadata["pages"][0]["retained_offsets"] = [[0, 13], [26, len(sources[0]["text"])]]
    assert not quote_in_context({"url": sources[0]["url"], "quote": "First segment Last segment"}, sources, metadata)
    assert not quote_in_context({"url": sources[0]["url"], "quote": "Different page quote"}, sources, metadata)
    assert not quote_in_context({"url": sources[0]["url"], "quote": sources[0]["text_sha256"]}, sources, metadata)
    assert not quote_in_context({"url": sources[0]["url"], "quote": "lost middle"}, sources, metadata)
    assert quote_in_context({"url": sources[0]["url"], "quote": "First segment"}, sources, metadata)
    metadata["pages"][0]["text_sha256"] = "wrong"
    assert not quote_in_context({"url": sources[0]["url"], "quote": "First segment"}, sources, metadata)


def test_default_budget_keeps_complete_small_distractor_pages_with_giant_key_page():
    products = ["AlphaCompute", "BetaQueue", "GammaStream", "DeltaBatch"]
    texts = ["AlphaCompute serving classifier " + "useful alpha documentation " * 16000]
    for product in products[1:]:
        texts.append(product + " reference material. " * 550 + f" {product} decisive rejection: cannot serve online classifier requests.")
    sources = [source(product.lower(), text, discovery_options=[label], discovery_kind="option")
               for label, product, text in zip("ABCD", products, texts)]
    planned = {"best_action": "AlphaCompute serving classifier", "decisive_constraints": ["online latency"],
               "mistakes": [{"action": product, "scenario_reason": "Cannot serve online classifier requests"}
                            for product in products[1:]]}
    result = build_documentation_context(sources, plan=planned)
    pages = result["metadata"]["pages"]
    assert pages[0]["status"] == "trimmed"
    assert all(page["status"] == "full" for page in pages[1:])
    assert all(source_record["text"] in result["context"] for source_record in sources[1:])
    assert len(result["context"]) > 390_000
    assert_audit(result, sources, DEFAULT_DOC_CONTEXT_CHARS)


def test_small_budget_reserves_meaningful_context_for_all_four_options():
    sources = [source(product.lower(), f"{product} documented behavior and decisive rejection. " * 200,
                      discovery_options=[label])
               for label, product in zip("ABCD", ["BigQuery", "Dataflow", "Dataproc", "Spanner"])]
    result = build_documentation_context(sources, max_chars=6000, plan=plan())
    assert all(page["after_chars"] > 700 for page in result["metadata"]["pages"])
    assert_audit(result, sources, 6000)


def test_hinge_reason_and_decisive_constraint_terms_drive_late_excerpts():
    sources = [source("generic", "preface " * 3000 + "specialcapability exactlimitation uniqueconstraint " + " tail" * 3000,
                      discovery_options=["A", "B"])]
    planned = {"best_action": "UnknownProduct", "decisive_constraints": ["uniqueconstraint"],
               "mistakes": [{"action": "OtherUnknown", "scenario_reason": "specialcapability exactlimitation"}]}
    result = build_documentation_context(sources, max_chars=1700, plan=planned)
    assert "specialcapability exactlimitation uniqueconstraint" in result["context"]
    assert_audit(result, sources, 1700)


@pytest.mark.parametrize("count,cap", [(1, 1000), (2, 5000), (5, 1700)])
def test_optional_pages_have_no_mandatory_floor(count, cap):
    sources = [source(f"optional{i}", "optional text " * 2000) for i in range(count)]
    result = build_documentation_context(sources, max_chars=cap)
    assert_audit(result, sources, cap)


def test_small_unrelated_sections_do_not_displace_decisive_action_window():
    preface = "\n\n".join(f"neutral material {i}" for i in range(70)) + "\n\n"
    hinge = "lead filler " * 300 + "BigQuery authorized views have decisive uniqueconstraint behavior. " + " tail filler" * 300
    sources = [source("bigquery", preface + hinge)]
    planned = {"best_action": "BigQuery authorized views", "decisive_constraints": ["uniqueconstraint"]}
    result = build_documentation_context(sources, max_chars=1300, plan=planned)
    assert "BigQuery authorized views have decisive uniqueconstraint behavior." in result["context"]
    assert result["metadata"]["pages"][0]["retained_offsets"][0][0] > len(preface)
    assert_audit(result, sources, 1300)


@pytest.mark.parametrize("pages", [None, 1, "invalid", {}])
def test_quote_checker_rejects_malformed_page_container(pages):
    sources = [source("bigquery", "exact quote")]
    assert not quote_in_context({"url": sources[0]["url"], "quote": "exact quote"}, sources, {"pages": pages})


@pytest.mark.parametrize("offsets", [None, 1, "invalid", {}, [None], [[False, 10]], [[0, 10000]]])
def test_quote_checker_rejects_malformed_offsets(offsets):
    sources = [source("bigquery", "exact quote")]
    metadata = build_documentation_context(sources)["metadata"]
    metadata["pages"][0]["retained_offsets"] = offsets
    assert not quote_in_context({"url": sources[0]["url"], "quote": "exact quote"}, sources, metadata)


def test_quote_checker_rejects_source_hash_tampering():
    sources = [source("bigquery", "exact quote")]
    metadata = build_documentation_context(sources)["metadata"]
    sources[0]["text"] += " tampered"
    assert not quote_in_context({"url": sources[0]["url"], "quote": "exact quote"}, sources, metadata)


# Localization is a view-selection policy, not a rewrite of fetched evidence.
def localized_source(url, text, **metadata):
    return {**source("bigquery", text), "url": url, "requested_url": url, **metadata}


@pytest.mark.parametrize("variant", [
    "https://docs.cloud.google.com/bigquery/docs/guide?hl=ja",
    "https://docs.cloud.google.com/bigquery/docs/guide?hl=pt-br",
    "https://docs.cloud.google.com/bigquery/docs/guide?hl=es-419",
    "https://docs.cloud.google.com/bigquery/docs/guide?hl=en-US",
    "https://docs.cloud.google.com/bigquery/docs/guide?%68l=fr",
    "https://docs.cloud.google.com/ja/bigquery/docs/guide",
    "https://docs.cloud.google.com/intl/pt-br/bigquery/docs/guide",
    "https://docs.cloud.google.com/bigquery/docs/ja/guide",
])
def test_localized_duplicates_drop_before_budget_even_with_spare_capacity(variant):
    english = source("bigquery", "English decisive evidence.")
    translated = localized_source(variant, "Localized copy must never fill spare context.")
    sources = [translated, english]  # English preference is not source-order preference.
    original = deepcopy(sources)
    result = build_documentation_context(sources, max_chars=100_000)
    assert result["context"] == documentation_context([english])
    assert "Localized copy" not in result["context"]
    assert sources == original
    page = result["metadata"]["pages"][0]
    assert page["omitted"] and page["status"] == "omitted"
    assert page["omission_reason"] == "localized_duplicate"
    assert page["duplicate_of"] == {key: english[key] for key in ("url", "text_sha256", "retrieved_at")}
    assert page["retained_offsets"] == []
    assert page["trimmed_spans"] == [[0, len(translated["text"])]]
    assert result["metadata"]["localized_duplicates_dropped"] == 1
    assert result["metadata"]["post_deduplication_pages"] == 1
    assert_audit(result, sources, 100_000)


def test_locales_cannot_resurrect_as_option_representatives_or_budget_filler():
    english = source("bigquery", "BigQuery authorized views English evidence. " * 250)
    translated = localized_source(english["url"] + "?hl=ja", "Localized quote. " * 2000,
                                   discovery_options=["A", "B", "C", "D"])
    result = build_documentation_context([translated, english], max_chars=1500, plan=plan())
    assert len(result["context"]) <= 1500
    page = result["metadata"]["pages"][0]
    assert page["omitted"] and not page["mandatory_options"]
    assert "Localized quote" not in result["context"]
    assert_audit(result, [translated, english], 1500)


@pytest.mark.parametrize("language", ["ja", "fr-CA", "zh-Hant", "pt-BR"])
def test_explicit_nonenglish_metadata_beats_english_url_hint(language):
    english = source("bigquery", "English source.")
    other = localized_source(english["url"] + "?hl=en", "Not English.", language=language)
    result = build_documentation_context([other, english])
    assert result["context"] == documentation_context([english])
    assert language.casefold() in result["metadata"]["pages"][0]["locale_hints"]


def test_metadata_only_language_and_fragment_do_not_invent_separate_http_page():
    english = source("bigquery", "English default source.", language="en-US-u-ca-gregory")
    translated = localized_source(english["url"] + "#localized", "Localized fragment record.", language="ja")
    result = build_documentation_context([english, translated])
    assert result["context"] == documentation_context([english])
    assert result["metadata"]["pages"][1]["omission_reason"] == "localized_duplicate"


def test_localized_english_is_kept_when_it_is_the_only_english_version():
    en = localized_source("https://docs.cloud.google.com/bigquery/docs/guide?hl=en-US", "English regional source.")
    ja = localized_source("https://docs.cloud.google.com/bigquery/docs/guide?hl=ja", "Japanese source.")
    result = build_documentation_context([ja, en])
    assert result["context"] == documentation_context([en])
    assert result["metadata"]["pages"][1]["status"] == "full"


@pytest.mark.parametrize("url,metadata", [
    ("https://docs.cloud.google.com/bigquery/docs/guide?hl=ja", {}),
    ("https://docs.cloud.google.com/intl/fr/bigquery/docs/guide", {"language": "fr"}),
    ("https://docs.cloud.google.com/bigquery/docs/guide", {"language": "ja"}),
])
def test_only_locale_without_fetched_english_is_not_discarded(url, metadata):
    sources = [localized_source(url, "Only fetched source.", **metadata)]
    result = build_documentation_context(sources)
    assert result["context"] == documentation_context(sources)
    assert result["metadata"]["pages"][0]["status"] == "full"
    assert "localized_duplicates_dropped" not in result["metadata"]


@pytest.mark.parametrize("variant", [
    "https://docs.cloud.google.com/bigquery/docs/other?hl=ja",
    "https://docs.cloud.google.com/bigquery/docs/guide/?hl=ja",
    "https://docs.cloud.google.com/BigQuery/docs/guide?hl=ja",
    "https://docs.cloud.google.com/bigquery/docs/guide?product=other&hl=ja",
    "https://cloud.google.com/bigquery/docs/guide?hl=ja",
    "https://docs.cloud.google.com/project-id/bigquery/docs/guide",
])
def test_different_final_pages_are_not_guessed_to_be_translations(variant):
    en = source("bigquery", "English source.")
    other = localized_source(variant, "Distinct fetched page.")
    # The fetcher's requested URL must remain a discovery-host URL.
    other["requested_url"] = other["url"].replace("https://cloud.google.com/", "https://docs.cloud.google.com/")
    result = build_documentation_context([en, other])
    assert result["context"] == documentation_context([en, other])
    assert all(not page["omitted"] for page in result["metadata"]["pages"])


def test_nonlocale_query_bytes_order_and_values_stay_part_of_identity():
    en = localized_source("https://docs.cloud.google.com/bigquery/docs/guide?a=%2F&b=2", "English exact query.")
    ja = localized_source("https://docs.cloud.google.com/bigquery/docs/guide?hl=ja&a=%2F&b=2", "Drop translated query.")
    different = localized_source("https://docs.cloud.google.com/bigquery/docs/guide?hl=ja&b=2&a=%2F", "Keep distinct query order.")
    result = build_documentation_context([en, ja, different])
    assert result["metadata"]["pages"][1]["omitted"]
    assert not result["metadata"]["pages"][2]["omitted"]


@pytest.mark.parametrize("receipt_alias", ["url", "requested_url"])
def test_localized_quote_receipt_fails_closed_instead_of_rerouting_to_english(receipt_alias):
    en = source("bigquery", "Same exact quote.")
    ja = localized_source(en["url"] + "?hl=ja", "Same exact quote.")
    ja["requested_url"] += "&request=1"
    with pytest.raises(DocumentationBudgetError, match="localized duplicate"):
        build_documentation_context([en, ja], receipts=[{"url": ja[receipt_alias], "quote": "Same exact quote."}])
    result = build_documentation_context([en, ja])
    assert quote_in_context({"url": en["url"], "quote": "Same exact quote."}, [en, ja], result["metadata"])
    assert not quote_in_context({"url": ja["url"], "quote": "Same exact quote."}, [en, ja], result["metadata"])


def test_url_less_plan_quotes_only_protect_eligible_english_text():
    en = source("bigquery", "Shared exact quote.")
    ja = localized_source(en["url"] + "?hl=ja", "Shared exact quote. Localized only quote.")
    result = build_documentation_context([en, ja], plan={"decisive_quote": "Shared exact quote."})
    assert result["metadata"]["pages"][0]["required_quote_offsets"]
    assert not result["metadata"]["pages"][1]["required_quote_offsets"]
    with pytest.raises(DocumentationBudgetError, match="Required quote"):
        build_documentation_context([en, ja], plan={"decisive_quote": "Localized only quote."})


def test_invalid_localized_hash_and_conflicting_aliases_still_block():
    en = source("bigquery", "English source.")
    ja = localized_source(en["url"] + "?hl=ja", "Localized source.")
    bad = {**ja, "text_sha256": "0" * 64}
    with pytest.raises(DocumentationError, match="inconsistent"):
        build_documentation_context([en, bad])
    conflicting = localized_source(ja["url"], "Conflicting localized fetch.")
    with pytest.raises(DocumentationBudgetError, match="Conflicting fetched URL aliases"):
        build_documentation_context([en, ja, conflicting])


def test_known_nonenglish_language_cannot_be_an_english_representative():
    not_english = source("bigquery", "Not an English fetch.", language="ja")
    fr = localized_source(not_english["url"] + "?hl=fr", "French source.")
    result = build_documentation_context([not_english, fr])
    assert result["context"] == documentation_context([not_english, fr])
    assert "localized_duplicates_dropped" not in result["metadata"]


def test_localized_discovery_labels_preserve_english_navigation_not_evidence():
    english = source("bigquery", "English source fact.", discovery_options=["A"])
    japanese = localized_source(english["url"] + "?hl=ja", "Localized different text.", discovery_options=["B"])
    sources = [japanese, english]
    original = deepcopy(sources)
    result = build_documentation_context(sources)
    assert result["context"] == documentation_context([english])
    assert sources == original
    kept = result["metadata"]["pages"][1]
    assert kept["mandatory_options"] == ["A", "B"]
    assert kept["inherited_discovery_options"] == ["B"]
    assert kept["required_quote_offsets"] == []
    assert "localized_aliases" in kept["priority_basis"]
    assert result["metadata"]["pages"][0]["duplicate_of_index"] == 1
    assert not quote_in_context({"url": japanese["url"], "quote": "Localized different text."}, sources, result["metadata"])
