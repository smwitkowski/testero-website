"""Offline PDE planning, immutable guide, cap and historical-scope contracts."""
import hashlib
import json
import random
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.cert_context import (DEFAULT_CERT, largest_remainder, load_cert_context,
                                 plan_questions, tune_generation_scope)
from shared.cert_generation_policy import (check_product_share, generation_policy,
                                           product_mentions, product_share_report,
                                           topic_distribution)

PDE = "data-engineer"


def test_weighted_40_topic_preview_is_complete_deterministic_and_json():
    assert largest_remainder([22, 25, 20, 15, 18], 40) == [9, 10, 8, 6, 7]
    for seed in (0, 42, 500):
        plan = plan_questions(PDE, 40, seed=seed)
        assert list(Counter(row["domain_code"] for row in plan).values()) == [9, 10, 8, 6, 7]
        assert plan == plan_questions(PDE, 40, seed=seed)
        report = topic_distribution(plan)
        assert report["status"] == "complete"
        assert len(report["topics"]) == 9
        assert all(topic["planned_count"] == 1 for topic in report["topics"])
        assert report["coverage_basis"] == "planned_topic_hints_only"
        assert json.loads(json.dumps(report)) == report
        policy = generation_policy(PDE)
        for row in plan:
            if row["required_topic_id"]:
                topic = next(t for t in policy["required_topics"] if t["id"] == row["required_topic_id"])
                assert row["objective_id"] in topic["objective_ids"]
                assert row["required_topic_guidance"] in row["domain_prompt"]


def test_topic_bindings_are_exact_existing_guide_objectives_and_product_names():
    context = load_cert_context(PDE)
    objectives = {o["objective_id"] for d in context["domains"].values() for o in d["objectives"]}
    policy = generation_policy(PDE)
    assert all(set(t["objective_ids"]) <= objectives for t in policy["required_topics"])
    guide = (Path(__file__).resolve().parents[1] / "certs/data-engineer.json").read_text()
    for product in policy["product_share"]["products"]:
        assert all(name.casefold() in guide.casefold() for name in product["guide_names"])
    before = hashlib.sha256(guide.encode()).hexdigest()
    plan_questions(PDE, 40, seed=4)
    assert hashlib.sha256((Path(__file__).resolve().parents[1] / "certs/data-engineer.json").read_bytes()).hexdigest() == before
    assert {r["guide_sha256"] for r in plan_questions(PDE, 40, seed=4)} == {context["guide_sha256"]}


@pytest.mark.parametrize("count", [0, 1, 2, 4, 8])
def test_small_plans_are_partial_or_not_applicable_without_scope_invention(count):
    report = topic_distribution(plan_questions(PDE, count, seed=42))
    assert report["status"] in {"partial", "not_applicable"}


def test_filters_and_explicit_order_stay_binding():
    ids = ["data-engineer:standard:4.2:2", "data-engineer:standard:2.2:3:2"]
    plan = plan_questions(PDE, 40, objective_ids=ids + ids, seed=42)
    assert [row["objective_id"] for row in plan] == ids * 20
    report = topic_distribution(plan)
    assert report["status"] == "partial"
    assert len(report["not_applicable_topic_ids"]) == 7
    for kwargs in [{"domain_code": "data-engineer:standard:1"}, {"subsection": "1.1"}]:
        tuned = plan_questions(PDE, 40, seed=42, **kwargs)
        original = plan_questions(PDE, 40, seed=42, generation_tuning=False, **kwargs)
        assert {r["objective_id"] for r in tuned} <= {r["objective_id"] for r in original}
        assert topic_distribution(tuned)["status"] == ("partial" if "domain_code" in kwargs else "not_applicable")


def test_explicit_section_counts_and_zero_sections_stay_binding():
    plan = plan_questions(PDE, 40, section_allocation=[0, 0, 40, 0, 0], seed=42)
    assert {r["domain_code"] for r in plan} == {"data-engineer:standard:3"}
    report = topic_distribution(plan)
    assert report["status"] == "partial"
    assert sum(bool(t["planned_count"]) for t in report["topics"]) == 2
    assert report["missing_topic_ids"]


def test_question_line_and_short_stem_cycles_do_not_affect_pmle():
    pde = plan_questions(PDE, 40, seed=42)
    assert Counter(r["question_line"] for r in pde)["What should you do?"] == 34
    assert sum(r["stem_word_range"]["max"] == 50 for r in pde) == 8
    assert all(r["stem_word_range"]["max"] <= 85 for r in pde)
    pmle = plan_questions(DEFAULT_CERT, 40, seed=42)
    assert pmle == plan_questions(DEFAULT_CERT, 40, seed=42, generation_tuning=False)
    assert Counter(r["question_line"] for r in pmle)["What should you do?"] == 28
    assert not any("generation_policy" in row for row in pmle)
    assert generation_policy(DEFAULT_CERT) is None
    assert topic_distribution(pmle)["status"] == "not_applicable"


def test_frozen_scope_can_be_rebuilt_from_untuned_base_and_index():
    policy = generation_policy(PDE)
    plan = plan_questions(PDE, 40, seed=42)
    for index, row in enumerate(plan):
        base = plan_questions(PDE, index + 1, objective_ids=[row["objective_id"]], generation_tuning=False)[-1]
        # Offset is initial weighted RNG provenance, not a presentation hint.
        base["objective_offset"] = row["objective_offset"]
        rebuilt = tune_generation_scope(base, index, topic_id=row["required_topic_id"],
                                        coverage_scope=row["topic_coverage_scope"], policy=policy)
        assert rebuilt == row
    with pytest.raises(ValueError, match="outside"):
        tune_generation_scope(base, 0, topic_id="dataflow-streaming")
    with pytest.raises(ValueError, match="reviewed"):
        tune_generation_scope(base, 0, policy={**policy, "version": "unreviewed"})
    with pytest.raises(ValueError, match="already tuned"):
        tune_generation_scope(plan[0], 0)


def test_policy_is_fresh_and_hash_matches_separate_file():
    first = generation_policy(PDE)
    assert first["sha256"] == hashlib.sha256((Path(__file__).resolve().parents[1] / "certs/data-engineer-generation.json").read_bytes()).hexdigest()
    first["required_topics"].clear()
    assert len(generation_policy(PDE)["required_topics"]) == 9


def test_product_mentions_only_named_guide_products_bounded_and_case_insensitive():
    assert product_mentions("Use BigQuery and BIGQUERY with BigQueryML") == ["BigQuery"]
    assert product_mentions("Use BigQueryish or dataprocessing") == []
    assert set(product_mentions("Use Dataflow with BigQuery and Cloud Storage")) == {"Dataflow", "BigQuery", "Cloud Storage"}
    assert product_mentions("Use Cloud Data Loss Prevention and Cloud DLP") == ["Cloud DLP"]
    assert product_mentions("Use Cloud Composer", DEFAULT_CERT) == []


def test_planned_cap_40_is_16_and_ignores_distractor_mentions():
    prior = [{"best_action": "Use BigQuery.", "distractors": ["Use Dataflow"]} for _ in range(15)]
    before = json.dumps(prior)
    assert check_product_share("Use BigQuery.", prior, 40)["passed"] is True
    report = check_product_share("Use BigQuery.", prior + [{"best_action": "Use BigQuery."}], 40)
    assert report["passed"] is False
    assert report["max_per_product"] == 16
    assert report["exceeded_products"] == ["BigQuery"]
    assert "Dataflow" not in report["counts"]
    assert json.dumps(prior) == before
    assert check_product_share({"cert_id": DEFAULT_CERT}, [], 40)["passed"] is None


@pytest.mark.parametrize("count,cap", [(1, 1), (2, 1), (3, 1), (4, 1), (5, 2), (9, 3), (40, 16)])
def test_small_batch_rounding_is_explicit(count, cap):
    report = check_product_share("Use BigQuery", [], count)
    assert report["max_per_product"] == cap
    assert report["rounding"] == "floor_min_one"


def test_actual_population_cap_cannot_be_diluted_by_planned_budget():
    rows = [{"decision_plan": {"best_action": "Use BigQuery"}} for _ in range(8)]
    rows += ["Use Dataflow", "Choose a storage access pattern"]
    report = product_share_report(rows, cert_id=PDE)
    assert report["passed"] is False
    assert report["max_per_product"] == 4
    assert report["denominator"] == 10
    assert report["max_share"] == .8
    assert report["unnamed_count"] == 1
    assert product_share_report([], cert_id=PDE)["passed"] is None
    assert product_share_report(rows, cert_id=DEFAULT_CERT)["passed"] is None


@pytest.mark.parametrize("value", [None, {}, {"best_action": ""}, 5])
def test_malformed_actions_fail_closed(value):
    with pytest.raises(ValueError, match="best_action"):
        check_product_share(value, [], 40)
    with pytest.raises(ValueError, match="best_action"):
        product_share_report([value], cert_id=PDE)


def test_population_overflow_and_cross_cert_inputs_cannot_pass():
    assert check_product_share("Use Dataflow", ["Use BigQuery"], 1)["population_exceeded"] is True
    with pytest.raises(ValueError, match="single certification"):
        check_product_share("Use Dataflow", [{"cert_id": DEFAULT_CERT, "best_action": "Use BigQuery"}], 40)
    state = random.getstate()
    plan_questions(PDE, 40, seed=42)
    assert random.getstate() == state


def test_historical_topic_report_is_not_applicable_and_mixed_policy_blocks():
    historical = plan_questions(PDE, 40, seed=42, generation_tuning=False)
    assert topic_distribution(historical)["status"] == "not_applicable"
    current = plan_questions(PDE, 40, seed=42)
    with pytest.raises(ValueError, match="single reviewed"):
        topic_distribution(current + historical)


@pytest.mark.parametrize("count", [0, -1, True, 1.2])
def test_product_cap_requires_positive_integral_budget(count):
    with pytest.raises(ValueError, match="positive integer"):
        check_product_share("Use Dataflow", [], count)



def test_implicit_sql_keys_count_the_single_stem_product_and_cannot_bypass_cap():
    sql = {"best_action": "Compute COUNT DISTINCT on the customer identifier at the daily grain.",
           "product_context": "Your team runs daily customer reports in BigQuery."}
    report = check_product_share(sql, [sql] * 16, 40)
    assert report["passed"] is False
    assert report["counts"] == {"BigQuery": 17}
    assert report["max_per_product"] == 16
    assert report["basis"] == {"single_product_context": 17}
    assert report["proposed_basis"] == "single_product_context"
    assert report["unnamed_count"] == 0
    assert report["exceeded_products"] == ["BigQuery"]
    assert any(error["code"] == "product_cap_exceeded" for error in report["errors"])
    # Actual eligible denominator remains authoritative, including the last row.
    actual = product_share_report([sql] * 17, cert_id=PDE)
    assert actual["passed"] is False
    assert actual["counts"] == {"BigQuery": 17}
    assert actual["denominator"] == 17
    assert actual["basis"] == {"single_product_context": 17}


def test_single_context_product_aliases_are_one_canonical_attribution():
    report = check_product_share({"best_action": "Create features for the training table.",
                                  "product_context": "Your BigQuery tables feed BigQueryML."}, [], 40)
    assert report["passed"] is True
    assert report["counts"] == {"BigQuery": 1}
    assert report["proposed_basis"] == "single_product_context"
    assert report["errors"] == []


@pytest.mark.parametrize("row,basis", [
    ({"best_action": "Aggregate the identifiers.", "product_context": "BigQuery receives events from Dataflow."}, "ambiguous_product_context"),
    ({"best_action": "Aggregate the identifiers."}, "unnamed"),
    ("Aggregate the identifiers.", "unnamed"),
    ({"best_action": "Aggregate the identifiers.", "product_context": "Your team processes customer events."}, "unnamed"),
    ({"best_action": "Aggregate the identifiers.", "product_context": 5}, "invalid_product_context"),
])
def test_unknown_and_ambiguous_product_attribution_fail_closed(row, basis):
    before = json.dumps(row)
    for report in (check_product_share(row, [], 40), product_share_report([row], cert_id=PDE)):
        assert report["passed"] is False
        assert report["counts"] == {}
        assert report["unnamed_count"] == 1
        assert report["basis"] == {basis: 1}
        assert report["errors"][0]["row_index"] == 0
        assert report["errors"][0]["code"] == basis
    assert json.dumps(row) == before


def test_explicit_action_products_override_context_and_plans_fall_back_to_existing_system():
    explicit = {"best_action": "Run the transform in Dataflow.",
                "product_context": "BigQuery and Cloud Storage receive output.",
                "existing_system": "Dataproc"}
    report = check_product_share(explicit, [], 40)
    assert report["passed"] is True
    assert report["counts"] == {"Dataflow": 1}
    assert report["basis"] == {"explicit_best_action": 1}
    for plan in ({"best_action": "Aggregate the identifiers.", "existing_system": "BigQuery"},
                 {"decision_plan": {"best_action": "Aggregate the identifiers.", "existing_system": "BigQuery"}}):
        report = check_product_share(plan, [], 40)
        assert report["passed"] is True
        assert report["counts"] == {"BigQuery": 1}
        assert report["basis"] == {"single_product_context": 1}
    # Written context, when supplied, must not silently fall back to a plan.
    report = check_product_share({"best_action": "Aggregate the identifiers.",
                                  "product_context": "BigQuery or Dataflow", "existing_system": "BigQuery"}, [], 40)
    assert report["passed"] is False and report["unnamed_count"] == 1


def test_unattributed_prior_rows_cannot_dilute_or_certify_a_cap():
    report = check_product_share("Use BigQuery", ["Aggregate the identifiers."], 40)
    assert report["passed"] is False
    assert report["counts"] == {"BigQuery": 1}
    assert report["unnamed_count"] == 1
    assert report["errors"][0]["row_index"] == 0
    assert product_share_report([], cert_id=PDE)["passed"] is None
    assert product_share_report(["Unattributed action"], cert_id=DEFAULT_CERT)["passed"] is None
