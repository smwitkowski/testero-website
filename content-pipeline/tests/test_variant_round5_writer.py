"""Offline policy-5 writer/rank mechanics; historical signatures stay frozen."""
from copy import deepcopy
import hashlib
import json

import pytest

from shared import variants as writer
from shared.cli_models import signature_prompt
from shared.external_judge import candidate_question
from shared.option_order import OPTION_FIELDS, store_options
from test_variants import parents, VARIANT


@pytest.fixture
def parent(parents):
    _, _, payload, bank = parents
    return writer.parent_snapshot(payload, payload["candidates"][0], bank)


def question_with_lengths(lengths):
    return {field: " ".join(f"fresh{index}_{word}" for word in range(length))
            for index, (field, length) in enumerate(zip(OPTION_FIELDS, lengths))}


@pytest.mark.parametrize("count, expected", [
    (0, []), (1, [4]), (2, [2, 4]), (3, [2, 3, 4]),
    (4, [2, 3, 4, 1]), (8, [2, 3, 4, 1, 2, 3, 4, 1]),
])
def test_rank_schedule_exact_small_batches(count, expected):
    assert writer.planned_key_length_ranks(count) == expected


def test_rank_schedule_caps_shortest_and_includes_longest():
    for count in range(1, 101):
        ranks = writer.planned_key_length_ranks(count)
        assert len(ranks) == count
        assert ranks.count(1) <= count // 4
        assert 4 in ranks


@pytest.mark.parametrize("count", [-1, True, 2.0, "4", None])
def test_schedule_rejects_invalid_count(count):
    with pytest.raises(ValueError):
        writer.planned_key_length_ranks(count)


@pytest.mark.parametrize("lengths, assigned, actual, passed", [
    ([10, 10, 11, 12], 1, 1, True),
    ([10, 11, 12, 13], 1, 1, False),  # Legacy unique-shortest ban stays.
    ([11, 10, 11, 12], 2, 2, True),
    ([12, 10, 11, 12], 3, 3, True),
    ([13, 10, 11, 12], 4, 4, True),
    ([12, 10, 11, 12], 4, 3, False),  # Tied longest is rank 3, not rank 4.
    ([10, 10, 10, 10], 2, 1, False),
    ([11, 10, 12, 13], 3, 2, False),
])
def test_actual_competition_rank(lengths, assigned, actual, passed, parent):
    check = writer.option_rewrite_check(question_with_lengths(lengths), parent,
                                        key_length_rank=assigned)
    assert check["key_length_rank"] == actual
    assert check["assigned_key_length_rank"] == assigned
    assert check["key_length_rank_passed"] is passed
    assert check["passed"] is passed
    assert bool(writer.option_rewrite_errors(check)) is not passed


@pytest.mark.parametrize("rank", [0, 5, True, 2.0, "2"])
def test_rewrite_rejects_invalid_rank(rank, parent):
    with pytest.raises(ValueError):
        writer.option_rewrite_check(question_with_lengths([12, 10, 11, 13]), parent,
                                     key_length_rank=rank)


def test_no_rank_retains_exact_legacy_dictionary_and_targets(parent):
    question = question_with_lengths([10, 10, 11, 12])
    check = writer.option_rewrite_check(question, parent)
    assert check == {"passed": True, "option_jaccard": dict.fromkeys("ABCD", 0.0),
                     "threshold": .65, "canonical_word_counts": dict(zip("ABCD", [10, 10, 11, 12])),
                     "key_uniquely_shortest": False}
    feedback = json.loads(writer.length_repair_inputs(question, check)["length_feedback"])
    assert set(feedback) == {"canonical_word_counts", "target"}
    assert feedback["target"] == ("A at least tied with the shortest distractor; aim for rank 2 of 4. "
                                   "Use only details already in this question, not filler.")
    shortest = writer.option_rewrite_check(question_with_lengths([9, 10, 11, 12]), parent)
    assert writer.option_rewrite_errors(shortest) == [
        "Key cannot be uniquely shortest; balance option word counts"]


def test_rank_feedback_has_assigned_target_and_no_padding(parent):
    question = question_with_lengths([10, 10, 11, 12])
    check = writer.option_rewrite_check(question, parent, key_length_rank=4)
    inputs = writer.length_repair_inputs(question, check)
    feedback = json.loads(inputs["length_feedback"])
    assert feedback["assigned_key_length_rank"] == 4
    assert feedback["actual_key_length_rank"] == 1
    assert "strictly shorter" in feedback["target"]
    assert "uniquely longest" in feedback["target"]
    assert "not filler or padding" in feedback["target"]
    assert json.loads(inputs["current_question"]) == question
    assert "must be 4 of 4, not 1" in writer.option_rewrite_errors(check)[0]


def test_historical_signature_instructions_fingerprints():
    assert hashlib.sha256(writer.VariantSignature.instructions.encode()).hexdigest() == (
        "58bec186240d9e30bc7b25a81a0450cdac27344f2476fd30b28fe8b4774925b2")
    assert hashlib.sha256(writer.OptionLengthRepairSignature.instructions.encode()).hexdigest() == (
        "90202fc05e95cfc0abb7ceaeee2610b8fc23a586826d936d3c2e6ec68194bac1")


@pytest.mark.parametrize("policy", [3, 4])
def test_historical_scopes_prompts_and_overrides(parent, policy):
    scope = writer.variant_scope(parent["scope"], parent, 1, policy_version=policy)
    if policy == 4:
        assert scope == writer.variant_scope(parent["scope"], parent, 1)
    inputs = writer.writer_inputs(parent, scope, [], 1, "MEDIUM")
    assert "variant_policy_version" not in json.loads(inputs["diversity"])
    assert writer.render_prompt(inputs) == signature_prompt(writer.VariantSignature, inputs)
    for override in ({"key_length_rank": 4}, {"scenario_moment": "migration"}):
        with pytest.raises(ValueError, match="require variant policy 5"):
            writer.variant_scope(parent["scope"], parent, 1, policy_version=policy, **override)
    scopes = [writer.variant_scope(parent["scope"], parent, n, policy_version=policy)
              for n in range(1, 5)]
    assert ("cost/latency reduction" in {s["scenario_moment"] for s in scopes}) == (policy == 3)


def test_policy5_scope_allows_repeated_target_moments_and_changes_rank(parent):
    scopes = [writer.variant_scope(parent["scope"], parent, ordinal, policy_version=5,
                                  key_length_rank=rank, scenario_moment="migration")
              for ordinal, rank in [(1, 2), (2, 4)]]
    assert {s["scenario_moment"] for s in scopes} == {"migration"}
    assert len({s["opening_style"] for s in scopes}) == 2
    assert len({s["industry"] for s in scopes}) == 2
    for scope in scopes:
        assert scope["variant_policy_version"] == 5
        assert f"Key length rank hint: {scope['key_length_rank']} of 4" in scope["domain_prompt"]
        assert "Scenario moment: migration." in scope["domain_prompt"]
    cost = writer.variant_scope(parent["scope"], parent, 1, policy_version=5,
                                scenario_moment="cost/latency reduction", key_length_rank=4)
    assert cost["scenario_moment"] == "cost/latency reduction"
    for moment in (parent["scope"]["scenario_moment"], "unsupported"):
        with pytest.raises(ValueError):
            writer.variant_scope(parent["scope"], parent, 1, policy_version=5,
                                 scenario_moment=moment)


def test_policy5_writer_prompt_uses_new_constraints_only(parent):
    scope = writer.variant_scope(parent["scope"], parent, 1, policy_version=5, key_length_rank=4,
                                 scenario_moment="cost/latency reduction")
    inputs = writer.writer_inputs(parent, scope, [], 1, "MEDIUM")
    hints = json.loads(inputs["diversity"])
    assert hints["key_length_rank"] == 4 and hints["variant_policy_version"] == 5
    assert json.loads(inputs["parent_question"])["canonical_option_receipts"] == parent["evidence"]
    assert writer.render_prompt(inputs) == signature_prompt(writer.VariantV5Signature, inputs)
    instructions = " ".join(writer.VariantV5Signature.instructions.split())
    for phrase in ("Cost/latency", "Scale", "discovery", "Wash count/fabric type",
                   "transit duration/temperature", "vessel calls", "key-only echo",
                   "Do not migrate TO", "Rank 4 must be uniquely", "filler"):
        assert phrase in instructions
    assert "aim for A to be second shortest" not in instructions
    assert "no unrelated cost/latency wrapper" not in instructions
    assert "never create a uniquely longest key" not in instructions
    assert "Rank 4 should tie one other option" not in instructions
    for rendered in (scope["domain_prompt"], inputs["domain_context"], writer.render_prompt(inputs)):
        normalized = " ".join(rendered.split())
        assert "Rank 4 should tie" not in normalized
        assert "never make the key uniquely longest" not in normalized
        assert "The key must never be uniquely longest" not in normalized
        assert "never create a uniquely longest key" not in normalized
        assert "rank 4 must be uniquely longest" in normalized
        assert "Rank 1 must tie for shortest" in normalized
        assert "two-word key lead limit" in normalized


@pytest.mark.parametrize("policy", [4, 5])
def test_write_and_repair_select_corresponding_signature(parent, monkeypatch, policy):
    scope = writer.variant_scope(parent["scope"], parent, 1, policy_version=policy)
    inputs = writer.writer_inputs(parent, scope, [], 1, "MEDIUM")
    seen = []
    def predict(signature, inputs, model, effort):
        seen.append(signature)
        return deepcopy(VARIANT)
    monkeypatch.setattr(writer, "_predict", predict)
    writer.write_variant(inputs, model="codex", effort="low")
    assert seen == [writer.VariantV5Signature if policy == 5 else writer.VariantSignature]
    question = question_with_lengths([10, 10, 11, 12])
    check = writer.option_rewrite_check(question, parent, key_length_rank=4 if policy == 5 else None)
    monkeypatch.setattr(writer, "_predict", lambda signature, *_: seen.append(signature) or question)
    assert writer.repair_option_lengths(writer.length_repair_inputs(question, check), model="codex") == question
    assert seen[-1] is (writer.OptionLengthRepairV5Signature if policy == 5
                       else writer.OptionLengthRepairSignature)


def frozen_payload(parent, *, policy=5, count=1):
    ranks = writer.planned_key_length_ranks(count)
    allocation = writer.industry_allocation([parent], {parent["question_id"]: count})
    plan, entries = [], []
    for index, rank in enumerate(ranks, 1):
        scope = writer.variant_scope(parent["scope"], parent, index, policy_version=policy,
                                     **({"key_length_rank": rank} if policy == 5 else {}))
        scope["industry"] = allocation[(parent["question_id"], index)]
        question = deepcopy(VARIANT)
        lengths = {1: [10, 10, 11, 12], 2: [12, 11, 13, 14],
                   3: [13, 11, 12, 14], 4: [14, 11, 12, 13]}
        question.update(question_with_lengths(lengths[rank]))
        entry = {**deepcopy(parent["entry"]), **scope, "index": index,
                 "candidate_id": f"variant-{index}", "parent_question_id": parent["question_id"],
                 "stem": question["stem"],
                 "variant": writer.lineage(parent, index, {"industry": scope["industry"],
                                                           "setting": f"distinct setting {index}"})}
        store_options(entry, question, parent["evidence"])
        plan.append(scope)
        entries.append(entry)
    return {"variant_mode": 1, "argon_gate": True, "execution_policy": "short_circuit_v1",
            "family_stem_threshold": writer.FAMILY_STEM_THRESHOLD,
            "variant_parents": {parent["question_id"]: parent}, "plan": plan,
            "candidates": entries}


def test_validate_policy5_rechecks_actual_lengths_on_every_replay(parent):
    payload = frozen_payload(parent)
    entry = payload["candidates"][0]
    writer.validate_variant(payload, entry)
    # Re-store valid rewritten options with rank 2, preserving all frozen receipts.
    question = candidate_question(entry)
    question.update(question_with_lengths([12, 11, 13, 14]))
    store_options(entry, question, parent["evidence"])
    with pytest.raises(ValueError, match="competition rank must be 4"):
        writer.validate_variant(payload, entry)


@pytest.mark.parametrize("index", [1, 2])
def test_validate_rank_assignment_comes_from_global_index_not_tampered_scope(parent, index):
    payload = frozen_payload(parent, count=2)
    entry = payload["candidates"][index - 1]
    writer.validate_variant(payload, entry)
    payload["plan"][index - 1]["key_length_rank"] = 3
    with pytest.raises(ValueError, match="frozen batch assignment"):
        writer.validate_variant(payload, entry)


@pytest.mark.parametrize("policy", [3, 4])
def test_historical_replay_does_not_enforce_batch_rank(parent, policy):
    payload = frozen_payload(parent, policy=policy)
    entry = payload["candidates"][0]
    question = candidate_question(entry)
    question.update(question_with_lengths([10, 10, 11, 12]))
    store_options(entry, question, parent["evidence"])
    writer.validate_variant(payload, entry)


def test_validate_all_four_rank_slots_including_shortest_tie(parent):
    payload = frozen_payload(parent, count=4)
    for entry in payload["candidates"]:
        writer.validate_variant(payload, entry)


def test_rank1_failure_feedback_does_not_claim_matching_ranks_differ(parent):
    check = writer.option_rewrite_check(question_with_lengths([9, 10, 11, 12]), parent,
                                        key_length_rank=1)
    assert check["key_length_rank_passed"] is False
    assert writer.option_rewrite_errors(check) == [
        "Key cannot be uniquely shortest; balance option word counts"]


def test_direct_policy5_replay_cannot_strip_required_repair_priors(parent):
    from shared.variant_plan import REPAIR_MODE
    payload = frozen_payload(parent)
    payload["repair_mode"] = REPAIR_MODE
    with pytest.raises(ValueError, match="approved 13-live prior snapshot"):
        writer.validate_variant(payload, payload["candidates"][0])
