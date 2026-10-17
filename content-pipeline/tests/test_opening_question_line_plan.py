"""Offline opening and question-line hints do not change objective planning."""

import json
import random
import sys
from collections import Counter
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shared.cert_context import (
    DEFAULT_CERT,
    DEFAULT_QUESTION_LINE,
    DEFAULT_QUESTION_LINE_TARGET_PERCENT,
    OPENING_STYLES,
    QUESTION_LINES,
    SCENARIO_MOMENTS,
    domain_prompt,
    largest_remainder,
    load_cert_context,
    plan_questions,
)


def explicit_ids():
    context = load_cert_context()
    return [domain["objectives"][0]["objective_id"] for domain in context["domains"].values()]


def assert_rotations(plan):
    for index, item in enumerate(plan):
        assert item["opening_style"] == OPENING_STYLES[index % len(OPENING_STYLES)]
        assert item["question_line"] == QUESTION_LINES[index % len(QUESTION_LINES)]
        moment = SCENARIO_MOMENTS[index % len(SCENARIO_MOMENTS)]
        if moment == "security incident":
            assert item["scenario_moment"] in {"security incident", "scale growth"}
        else:
            assert item["scenario_moment"] == moment


def test_stable_constants_and_spaced_seventy_percent_default_cycle():
    assert isinstance(OPENING_STYLES, tuple)
    assert len(OPENING_STYLES) == 20
    assert Counter(OPENING_STYLES) == {
        "You are": 6, "Your company/organization/team": 5, "You work for": 2,
        "You have/manage/use": 3, "You need to": 2, "You recently": 2,
    }
    assert OPENING_STYLES[:3] == ("You are", "Your company/organization/team", "You work for")
    assert all(left != right for left, right in zip(OPENING_STYLES, OPENING_STYLES[1:]))
    assert DEFAULT_QUESTION_LINE == "What should you do?"
    assert DEFAULT_QUESTION_LINE_TARGET_PERCENT == 70
    assert isinstance(QUESTION_LINES, tuple)
    assert len(QUESTION_LINES) == 10
    assert QUESTION_LINES.count(DEFAULT_QUESTION_LINE) == 7
    assert [(index, phrase) for index, phrase in enumerate(QUESTION_LINES)
            if phrase != DEFAULT_QUESTION_LINE] == [
        (2, "Which approach should you use?"),
        (5, "What should you do first?"),
        (8, "How should you address this issue?"),
    ]
    assert all(phrase.endswith("?") for phrase in QUESTION_LINES)
    assert all("config" not in phrase.casefold() and "setting" not in phrase.casefold()
               for phrase in QUESTION_LINES)


@pytest.mark.parametrize("explicit", [False, True])
def test_forty_five_plan_has_varied_second_person_prefixes_and_thirty_two_default_hints(explicit):
    kwargs = {"objective_ids": explicit_ids()} if explicit else {}
    plan = plan_questions(DEFAULT_CERT, 45, seed=42, **kwargs)
    assert_rotations(plan)
    assert Counter(item["opening_style"] for item in plan) == {
        "You are": 14, "Your company/organization/team": 11, "You work for": 5,
        "You have/manage/use": 7, "You need to": 4, "You recently": 4,
    }
    counts = Counter(item["question_line"] for item in plan)
    assert counts[DEFAULT_QUESTION_LINE] == 32
    assert sum(count for phrase, count in counts.items() if phrase != DEFAULT_QUESTION_LINE) == 13
    assert len({item["domain_code"] for item in plan}) > 1
    assert SCENARIO_MOMENTS == (
        "recent deployment", "monitoring", "migration", "cost/latency reduction",
        "security incident", "scale growth", "greenfield",
    )
    assert plan == plan_questions(DEFAULT_CERT, 45, seed=42, **kwargs)
    assert json.loads(json.dumps(plan)) == plan


@pytest.mark.parametrize("cert_id", [DEFAULT_CERT, "cloud-engineer", "cloud-digital-leader"])
@pytest.mark.parametrize("count", [20, 100])
@pytest.mark.parametrize("explicit", [False, True])
def test_full_cycles_have_exact_prefix_mix_across_domains_and_target_modes(cert_id, count, explicit):
    context = load_cert_context(cert_id)
    ids = [domain["objectives"][0]["objective_id"] for domain in context["domains"].values()]
    kwargs = {"objective_ids": ids} if explicit else {}
    plan = plan_questions(cert_id, count, seed=42, **kwargs)
    assert Counter(item["opening_style"] for item in plan) == {
        "You are": count * 30 // 100, "Your company/organization/team": count * 25 // 100,
        "You work for": count * 10 // 100, "You have/manage/use": count * 15 // 100,
        "You need to": count * 10 // 100, "You recently": count * 10 // 100,
    }
    assert_rotations(plan)


@pytest.mark.parametrize("cert_id", [DEFAULT_CERT, "cloud-engineer"])
def test_weighted_targets_offsets_quotas_and_scope_are_unchanged(cert_id):
    context = load_cert_context(cert_id)
    counts = largest_remainder([domain["exam_weight"] for domain in context["domains"].values()], 45)
    rng = random.Random(42)
    expected = []
    for (code, domain), count in zip(context["domains"].items(), counts):
        objectives = domain["objectives"]
        offset = rng.randrange(len(objectives))
        expected.extend((code, offset, objectives[(offset + index) % len(objectives)])
                        for index in range(count))
    plan = plan_questions(cert_id, 45, seed=42)
    assert Counter(item["domain_code"] for item in plan) == dict(zip(context["domains"], counts))
    assert_rotations(plan)
    for item, (code, offset, objective) in zip(plan, expected):
        assert item["domain_code"] == code
        assert item["objective_offset"] == offset
        assert item["objective_id"] == objective["objective_id"]
        assert item["objective_text"] == objective["objective_text"]
        assert item["objective_context"] == objective["objective_context"]
        assert item["services"] == objective["services"]
        assert item["subsection"] == objective["subsection"]
        assert item["guide_sha256"] == context["guide_sha256"]
        assert item["domain_prompt"].startswith(domain_prompt(context, context["domains"][code], item["subsection"]))


def test_explicit_objective_order_deduplication_and_scope_are_unchanged():
    context = load_cert_context()
    domain = next(iter(context["domains"].values()))
    sub_number, sub = next(iter(domain["subsections"].items()))
    ids = [objective["objective_id"] for objective in sub["objectives"][:2]]
    assert len(ids) == 2
    selected = [ids[1], ids[0], ids[1]]
    plan = plan_questions(DEFAULT_CERT, 45, domain["domain_code"], sub_number,
                          seed=42, objective_ids=selected)
    assert [item["objective_id"] for item in plan] == [selected[index % 2] for index in range(45)]
    assert {item["objective_offset"] for item in plan} == {0}
    assert {item["domain_code"] for item in plan} == {domain["domain_code"]}
    assert {item["subsection"] for item in plan} == {sub_number}
    assert Counter(item["objective_id"] for item in plan) == {ids[1]: 23, ids[0]: 22}
    assert_rotations(plan)
    assert plan == plan_questions(DEFAULT_CERT, 45, domain["domain_code"], sub_number,
                                  seed=999, objective_ids=selected)


@pytest.mark.parametrize("explicit", [False, True])
@pytest.mark.parametrize("count", [0, 1, 2, 3, 5, 10, 11])
def test_prefixes_are_safe_without_forcing_small_batch_quotas(explicit, count):
    kwargs = {"objective_ids": explicit_ids()} if explicit else {}
    plan = plan_questions(DEFAULT_CERT, count, seed=42, **kwargs)
    assert len(plan) == count
    assert_rotations(plan)
    if count:
        assert plan[0]["opening_style"] == "You are"
        assert plan[0]["question_line"] == DEFAULT_QUESTION_LINE
        assert plan[0]["scenario_moment"] == "recent deployment"
    else:
        assert plan == []


@pytest.mark.parametrize("cert_id", [DEFAULT_CERT, "cloud-engineer"])
def test_prompt_hints_preserve_purpose_operational_context_and_selected_decision(cert_id):
    plan = plan_questions(cert_id, 45, seed=42)
    for item in plan:
        prompt = item["domain_prompt"]
        assert f"Opening style: {item['opening_style']}." in prompt
        assert f"Question line hint: {item['question_line']}" in prompt
        assert "Every opening must name a business application or a concrete ML task" in prompt
        assert "Never use an abstract task such as deploy a model without its purpose" in prompt
        assert "Do not expand the selected exam scope" in prompt
        assert "For non-ML objectives, name the concrete task and its business application purpose" in prompt
        assert "do not introduce ML beyond the selected scope" in prompt
        assert "Use this exact phrase when it fits the selected decision" in prompt
        assert "natural question-line variant ending in ?" in prompt
        assert "Do not force 'first'" in prompt
        assert "no sequencing decision or introduce a false premise" in prompt
        assert "wording hints, not permission to expand the selected exam scope" in prompt
        assert "Use this second-person prefix family naturally" in prompt
        assert "choose one (for example, Your company or You manage)" in prompt
        assert "first 1–2 sentences" in prompt
        assert "Never start with an imperative or a gerund-led opening" in prompt
        assert "must not invent a role, chronology or scope" in prompt
        assert "must not displace the objective or turn it into a different decision" in prompt
        if item["scenario_moment"] != "greenfield":
            assert "already-running workload at this moment, not a new build" in prompt
        else:
            assert "new workload being built, within the selected objective" in prompt
