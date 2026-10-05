"""D-025 explicit objective plans use stable round-robin, not domain weights."""
from collections import Counter
import random

import pytest
from shared.cert_context import DEFAULT_CERT, PMLE_SECTION_CODES, load_cert_context, plan_questions

# The 15 zero-ACTIVE-coverage objectives in the reviewed bank audit (June2026 guide).
ZERO_SUFFIXES = ("1.1:5", "1.2:1", "1.2:2", "1.2:3", "2.1:3", "2.2:3", "3.1:4",
                 "3.2:6", "3.3:1", "4.1:4", "4.1:5", "4.2:4", "5.1:2", "6.1:1", "6.2:3")
ZERO_IDS = tuple(f"{DEFAULT_CERT}:standard:{suffix}" for suffix in ZERO_SUFFIXES)


def test_first_batch_targets_all_15_gaps_twice_in_flag_order():
    state = random.getstate()
    first = plan_questions(DEFAULT_CERT, 30, objective_ids=ZERO_IDS)
    assert len(first) == 30
    assert [item["objective_id"] for item in first] == list(ZERO_IDS) * 2
    assert Counter(item["objective_id"] for item in first) == {ident: 2 for ident in ZERO_IDS}
    assert Counter(item["domain_code"] for item in first) == {
        PMLE_SECTION_CODES["1"]: 8, PMLE_SECTION_CODES["2"]: 4,
        PMLE_SECTION_CODES["3"]: 6, PMLE_SECTION_CODES["4"]: 6,
        PMLE_SECTION_CODES["5"]: 2, PMLE_SECTION_CODES["6"]: 4,
    }
    assert first == plan_questions(DEFAULT_CERT, 30, objective_ids=ZERO_IDS)
    assert first == plan_questions(DEFAULT_CERT, 30, seed=999, objective_ids=ZERO_IDS)
    assert random.getstate() == state
    context = load_cert_context()
    assert all(item["guide_sha256"] == context["guide_sha256"] and item["objective_offset"] == 0 for item in first)
    assert all(item["objective_text"] in item["domain_prompt"] and item["objective_id"] in item["domain_prompt"] for item in first)


def test_target_deduplication_small_budget_and_domain_subsection_filters():
    ids = [ZERO_IDS[1], ZERO_IDS[0], ZERO_IDS[1]]
    plan = plan_questions(DEFAULT_CERT, 5, objective_ids=ids)
    assert [item["objective_id"] for item in plan] == [ids[0], ids[1], ids[0], ids[1], ids[0]]
    assert [item["objective_id"] for item in plan_questions(DEFAULT_CERT, 1, objective_ids=ids)] == [ids[0]]
    single = plan_questions(DEFAULT_CERT, 3, domain_code=PMLE_SECTION_CODES["1"], subsection="1.1", objective_ids=[ZERO_IDS[0]])
    assert [item["objective_id"] for item in single] == [ZERO_IDS[0]] * 3
    assert plan_questions(DEFAULT_CERT, 0, objective_ids=ids) == []
    assert plan_questions(DEFAULT_CERT, 5, seed=42, objective_ids=[]) == plan_questions(DEFAULT_CERT, 5, seed=42)


@pytest.mark.parametrize("cert,domain,subsection,ids", [
    (DEFAULT_CERT, None, None, ["machine-learning-engineer:standard:99.9:1"]),
    ("cloud-engineer", None, None, [ZERO_IDS[0]]),
    (DEFAULT_CERT, PMLE_SECTION_CODES["2"], None, [ZERO_IDS[0]]),
    (DEFAULT_CERT, None, "1.2", [ZERO_IDS[0]]),
    (DEFAULT_CERT, None, None, [ZERO_IDS[0], "unknown"]),
    (DEFAULT_CERT, None, None, [""]),
    (DEFAULT_CERT, None, None, [None]),
    (DEFAULT_CERT, None, None, ZERO_IDS[0]),
])
def test_bad_objective_selection_fails_closed(cert, domain, subsection, ids):
    with pytest.raises(ValueError, match="Objective"):
        plan_questions(cert, 30, domain_code=domain, subsection=subsection, objective_ids=ids)


@pytest.mark.parametrize("count", [-1, 1.5, True, "30"])
def test_targeted_budget_still_validates(count):
    with pytest.raises(ValueError, match="count"):
        plan_questions(DEFAULT_CERT, count, objective_ids=ZERO_IDS)


def test_other_cert_targeting_is_not_pmle_specific():
    context = load_cert_context("cloud-engineer")
    ids = [domain["objectives"][0]["objective_id"] for domain in context["domains"].values()]
    plan = plan_questions("cloud-engineer", 11, objective_ids=ids)
    assert [item["objective_id"] for item in plan] == [ids[i % len(ids)] for i in range(11)]
    assert all(item["domain_code"].startswith("cloud-engineer:standard:") for item in plan)


def test_zero_coverage_targets_match_ignored_audit_when_available():
    import json
    from pathlib import Path
    path = Path(__file__).parents[1] / ".cache/bank/pmle-bank-2026-10-04-audit.json"
    if path.exists():
        audit = json.loads(path.read_text())
        assert tuple(item["objective_id"] for item in audit["zero_coverage_objectives"]) == ZERO_IDS
