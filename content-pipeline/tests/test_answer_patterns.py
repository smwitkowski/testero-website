"""Synthetic offline answer-pattern cases, not unseen-paraphrase validation."""
from copy import deepcopy
import json

import pytest

from shared.answer_patterns import check_answer_pattern
from shared.near_duplicates import comparison_row, load_export, check_plan_near_duplicate

CERT = "data-engineer"
CLUSTER_WRONG = [
    "Keep a persistent Dataproc cluster running between jobs.",
    "Autoscale the cluster workers down to zero after each job.",
    "Stop the cluster after the job and restart it for the next run.",
]
DISTINCT_WRONG = [
    "Sum daily distinct customer counts to obtain the monthly total.",
    "Use APPROX_COUNT_DISTINCT(customer_id) for each reporting month.",
    "Count raw rows for each reporting month with COUNT(*).",
]


def plan(action, wrong=CLUSTER_WRONG, **extra):
    return {"objective_id": CERT + ":standard:5.1:1", "existing_system": "A cinema distributor runs overnight processing.",
            "business_consequence": "Lower idle spending", "decisive_constraints": ["Jobs run once a week"],
            "best_action": action,
            "mistakes": [{"action": text, "scenario_reason": "Synthetic losing tradeoff"} for text in wrong], **extra}


def question(p, ident="bank", cert=CERT):
    return {"id": ident, "cert_id": cert, "status": "ACTIVE", "stem": p["existing_system"],
            "key": "A", "options": [{"label": "A", "text": p["best_action"]}] +
            [{"label": label, "text": wrong["action"]} for label, wrong in zip("BCD", p["mistakes"])]}


def test_ephemeral_cluster_same_pattern_despite_business_wrapper_and_synonyms():
    one = plan("Run a Dataproc workflow template with an ephemeral cluster deleted after each job.")
    two = plan("Use a Managed Service for Apache Spark workflow template with a temporary cluster removed when the workload finishes.",
               ["Retain a long-lived cluster and reuse it for jobs.",
                "Scale the cluster workers to zero when processing finishes.",
                "Suspend the cluster and resume it for the next workload."],
               existing_system="A hospital processes archive images.", business_consequence="Free compute capacity")
    result = check_answer_pattern(two, [question(one)])
    assert not result["passed"] and not result["errors"]
    assert result["matches"][0]["matched_id"] == "bank"
    assert result["matches"][0]["method"] == "canonical"
    assert result["signature"]["mechanism"] == "job_scoped_cluster_lifecycle"
    assert result["signature"]["sha256"] == result["matches"][0]["signature"]["sha256"]


def test_exact_distinct_at_right_grain_canonicalizes_entity_domain_and_sql():
    one = plan("Use COUNT(DISTINCT customer_id) grouped by reporting month.", DISTINCT_WRONG)
    two = plan("Calculate exact patient cardinality at the weekly reporting grain.",
               ["Add per-day unique patient counts to obtain weekly counts.",
                "Use HyperLogLog sketches to estimate weekly cardinality.",
                "Count rows in the event table for every reporting week."],
               existing_system="You track hospital attendance.")
    result = check_answer_pattern(two, [question(one)])
    assert not result["passed"]
    assert result["signature"]["mechanism"] == "exact_distinct_at_target_grain"
    assert result["signature"]["sha256"] == result["matches"][0]["signature"]["sha256"]


def test_one_changed_alternative_does_not_hide_known_family_repeat():
    one = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    two = deepcopy(one)
    two["mistakes"][2]["action"] = "Move the pipeline to Dataflow and emit one output for every source event."
    assert not check_answer_pattern(two, [question(one)])["passed"]


def test_same_product_different_correct_mechanism_or_distractor_skeleton_allowed():
    one = plan("Run a Dataproc workflow template with an ephemeral cluster deleted after each job.")
    other = plan("Configure Dataproc secondary workers to use preemptible instances.",
                 ["Use a persistent high-memory cluster.", "Reserve primary workers.", "Raise the cluster worker disk size."])
    assert check_answer_pattern(other, [question(one)])["passed"]
    # Same mechanism alone is not a complete skeleton match.
    changed = plan(one["best_action"], ["Run the transformation in BigQuery.",
                   "Migrate all batch processing to Dataflow.", "Store results in Bigtable for online reads."])
    assert check_answer_pattern(changed, [question(one)])["passed"]


def test_lexical_fallback_order_independent_and_not_product_only():
    one = plan("Configure BigQuery event date partitioning and customer identifier clustering.",
               ["Partition BigQuery events by ingestion date instead of event date.",
                "Shard the BigQuery event tables into one table per day.",
                "Cluster the BigQuery event table by customer identifier without partitions."])
    two = deepcopy(one)
    two["mistakes"].reverse()
    two["existing_system"] = "An unrelated freight company tracks container movements."
    result = check_answer_pattern(two, [question(one)])
    assert not result["passed"] and result["matches"][0]["method"] == "lexical"
    assert result["signature"]["mechanism"] is None
    assert result["signature"]["sha256"] == result["matches"][0]["signature"]["sha256"]
    different = plan("Configure BigQuery row level security with group predicates.",
                     ["Grant dataset viewer IAM access.", "Apply policy tags to private columns.", "Publish an authorized view for partners."])
    assert check_answer_pattern(different, [question(one)])["passed"]


def test_existing_bank_same_batch_question_plan_and_synthetic_ids(tmp_path):
    p = plan("Use COUNT(DISTINCT user_id) at the monthly reporting grain.", DISTINCT_WRONG)
    path = tmp_path / "bank.json"
    path.write_text(json.dumps([question(p)]))
    bank = load_export(path, cert_id=CERT)["questions"]
    assert not check_answer_pattern(p, bank)["passed"]
    prior_plan = {"candidate_id": "inflight-plan:2", "decision_plan": p}
    prior_question = {**question(p, "earlier-written"), "decision_plan": p}
    result = check_answer_pattern(p, [prior_plan, prior_question, p])
    ids = [row["matched_id"] for row in result["matches"]]
    assert "inflight-plan:2" in ids and "earlier-written" in ids
    synthetic = next(ident for ident in ids if ident.startswith("decision-plan:"))
    assert check_answer_pattern(p, [prior_plan, prior_question, p], exclude=ids)["passed"]
    assert check_answer_pattern(p, [p], exclude=[synthetic])["passed"]
    assert check_answer_pattern(p, bank, exclude=["bank"])["passed"]


def test_question_options_override_earlier_decision_plan():
    p = plan("Use COUNT(DISTINCT user_id) at the monthly grain.", DISTINCT_WRONG)
    final = question(plan("Configure Dataproc secondary workers to use preemptible instances."))
    final["decision_plan"] = p
    assert check_answer_pattern(final, [question(p)])["passed"]


@pytest.mark.parametrize("mutation", [
    lambda p: p.pop("mistakes"),
    lambda p: p["mistakes"].pop(),
    lambda p: p["mistakes"][0].update(action=""),
    lambda p: p.update(best_action=""),
])
def test_incomplete_candidate_metadata_blocks(mutation):
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    mutation(p)
    result = check_answer_pattern(p, [])
    assert not result["passed"] and result["errors"] and result["signature"] is None


def test_missing_existing_distractors_or_cert_provenance_blocks_without_guessing():
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    for row in [{"id": "historical-projection", "cert_id": CERT, "stem": "Old scenario", "key": p["best_action"]},
                {**comparison_row(question(p)), "distractors": ["Only one alternative"]},
                {"id": "unprovenanced", "key": p["best_action"], "distractors": DISTINCT_WRONG}]:
        result = check_answer_pattern(p, [row])
        assert not result["passed"] and result["errors"] and not result["matches"]
    malformed = question(p)
    malformed["key"] = None
    assert not check_answer_pattern(malformed, [])["passed"]


def test_crosscert_excluded_and_pmle_unaffected():
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    # Foreign-cert rows are not parsed for distractors and never match.
    assert check_answer_pattern(p, [{"id": "foreign", "cert_id": "cloud-engineer"}])["passed"]
    assert check_answer_pattern(p, [{**question(p), "status": "RETIRED"}])["passed"]
    assert check_answer_pattern({}, [], cert_id="machine-learning-engineer")["passed"]
    assert not check_answer_pattern(p, [], cert_id="machine-learning-engineer")["passed"]
    assert not check_answer_pattern({}, [])["passed"]
    bare = {k: v for k, v in p.items() if k != "objective_id"}
    assert check_answer_pattern(bare, [], cert_id=CERT)["passed"]


def test_old_scenario_jaccard_veto_is_independent_and_unchanged():
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    rows = [comparison_row(question(p))]
    assert not check_plan_near_duplicate(p, rows, cert_id=CERT)["passed"]
    assert not check_answer_pattern(p, rows)["passed"]


def test_invalid_container_cert_and_option_metadata_rejects_without_type_errors():
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    assert not check_answer_pattern(p, [], cert_id=[])["passed"]
    assert not check_answer_pattern(p, None)["passed"]
    assert not check_answer_pattern(p, {})["passed"]
    malformed = question(p)
    malformed["options"][1]["label"] = []
    assert not check_answer_pattern(malformed, [])["passed"]


def test_synthetic_plan_ids_do_not_collapse_different_business_wrappers():
    p = plan("Count exact distinct identifiers per month.", DISTINCT_WRONG)
    other = {**deepcopy(p), "existing_system": "A hospital reports weekly attendance."}
    result = check_answer_pattern(p, [p, other])
    assert len(result["matches"]) == 2
    ids = [row["matched_id"] for row in result["matches"]]
    assert len(set(ids)) == 2
    assert not check_answer_pattern(p, [p, other], exclude=[ids[0]])["passed"]


@pytest.mark.parametrize("action", [
    "Keep a persistent Dataproc cluster rather than deleting it after each job.",
    "Reuse the cluster instead of creating an ephemeral cluster for each job.",
    "Do not delete the Dataproc cluster after each job completes.",
    "Disable automatic deletion of the Dataproc cluster after job completion.",
    "Prevent deletion of the Dataproc cluster after job completion.",
    "Don't create a temporary cluster for every job.",
    "Don’t delete the Dataproc cluster after job completion.",
])
def test_negated_or_contrasted_cluster_mechanisms_never_get_positive_category(action):
    positive = plan("Run a Dataproc workflow template with an ephemeral cluster deleted after each job.")
    opposite = plan(action)
    result = check_answer_pattern(opposite, [question(positive)])
    assert result["passed"] and not result["errors"]
    assert result["signature"]["mechanism"] is None
    assert result["signature"]["has_contrast"] is True
    # Unknown contrasted actions still have inspectable lexical fallback.
    assert not check_answer_pattern(opposite, [question(opposite)])["passed"]


@pytest.mark.parametrize("prefix", ["Do not ", "Never ", "Avoid "])
def test_negated_distinct_action_cannot_rematch_positive_via_lexical_fallback(prefix):
    positive = plan("Use COUNT(DISTINCT user_id) at the monthly reporting grain.", DISTINCT_WRONG)
    opposite = plan(prefix + positive["best_action"], DISTINCT_WRONG)
    result = check_answer_pattern(opposite, [question(positive)])
    assert result["passed"] and result["signature"]["mechanism"] is None
    assert result["signature"]["has_contrast"] is True


def test_consumer_identifier_is_not_a_sum_operation_but_sql_sum_is():
    positive = plan("Use COUNT(DISTINCT consumer_id) grouped by reporting month.", DISTINCT_WRONG)
    equivalent = plan("Calculate exact patient cardinality at the weekly reporting grain.", DISTINCT_WRONG)
    result = check_answer_pattern(positive, [question(equivalent)])
    assert not result["passed"]
    assert result["signature"]["mechanism"] == "exact_distinct_at_target_grain"
    summed = plan("Use SUM(daily_count) to count distinct consumer identifiers at the monthly grain.", DISTINCT_WRONG)
    assert check_answer_pattern(summed, [])["signature"]["mechanism"] is None
    alternatives = plan(positive["best_action"], [
        "Count distinct consumer_id at the per-session grain.",
        "Use SUM(daily_count) to obtain the monthly consumer count.",
        "Use approximate consumer cardinality sketches.",
    ])
    signature = check_answer_pattern(alternatives, [])["signature"]
    assert sum(alt["archetype"] == "sum_partial_counts" for alt in signature["distractors"]) == 1
    assert next(alt for alt in signature["distractors"] if "consumer_id" in alt["tokens"])["archetype"] is None


def test_negated_distractors_are_not_invented_positive_archetypes():
    p = plan("Use COUNT(DISTINCT consumer_id) grouped by month.", [
        "Do not sum daily distinct consumer counts.",
        "Avoid approximate consumer cardinality sketches.",
        "Never count raw rows for the reporting period.",
    ])
    signature = check_answer_pattern(p, [])["signature"]
    assert all(alt["archetype"] is None and alt["has_contrast"] for alt in signature["distractors"])
    positive_wrong = plan(p["best_action"], DISTINCT_WRONG)
    assert check_answer_pattern(p, [question(positive_wrong)])["passed"]
