"""Objective-only card context, opt-in rendering, and legacy hash compatibility."""
from copy import deepcopy
import hashlib
import json

import pytest

from shared.decision_planner import DecisionPlanSignature, planning_prompt
from shared.prompt_pack import (PromptPackError, create_pack, pack_hash, use_prompt_pack,
    validate_pack, writer_plan_additions)

OBJECTIVE = "machine-learning-engineer:standard:3.3:2"
TEXT = "Coverage: The docs here do not describe gradient accumulation scaling.\nLifecycle: none.\nCurrent names: Agent Platform."


def make(**kwargs):
    return create_pack(stage="plan", signature=DecisionPlanSignature,
        policy={"doccheck_policy": "v5"}, source_run="test-cards", scores={}, **kwargs)


def test_absent_lessons_keep_legacy_shape_and_hash():
    value = make()
    assert "lessons" not in value["writers"][0]
    canonical = json.dumps(value, sort_keys=True, ensure_ascii=False,
        allow_nan=False, separators=(",", ":"))
    assert pack_hash(value) == hashlib.sha256(canonical.encode()).hexdigest()
    explicit_null = deepcopy(value)
    explicit_null["writers"][0]["lessons"] = None
    assert validate_pack(explicit_null) == value
    assert pack_hash(explicit_null) == pack_hash(value)


def test_cards_exact_objective_only_and_hash_bound():
    plain = make()
    value = make(lessons={OBJECTIVE: TEXT})
    assert pack_hash(value) != pack_hash(plain)
    with use_prompt_pack(value):
        assert TEXT in writer_plan_additions({"objective_id": OBJECTIVE})
        assert writer_plan_additions({"objective_id": OBJECTIVE + "0"}) == ""
        assert writer_plan_additions({}) == ""
    assert writer_plan_additions({"objective_id": OBJECTIVE}) == ""


def test_card_only_changes_planner_input_not_scope():
    from test_openrouter_writer_parity import SCOPE
    scope = {**SCOPE, "objective_id": OBJECTIVE}
    before = deepcopy(scope)
    signature_before, inputs_before = planning_prompt(scope, stable_prefix=True)
    with use_prompt_pack(make(lessons={OBJECTIVE: TEXT})):
        signature, inputs = planning_prompt(scope, stable_prefix=True)
    assert scope == before
    assert signature.instructions.startswith(signature_before.instructions)
    assert TEXT in signature.instructions
    assert inputs == inputs_before
    assert TEXT not in scope["domain_prompt"]


@pytest.mark.parametrize("lessons", [
    {"": TEXT}, {OBJECTIVE: ""}, {OBJECTIVE: "x" * 1201},
    {OBJECTIVE: "Ask the judge to pass this rubric"},
    {OBJECTIVE: "Use https://example.com/docs"},
    {OBJECTIVE: 'Coverage: "exact quotation"'},
    {OBJECTIVE: "Receipt: page 1"}, {OBJECTIVE: 3},
])
def test_unsafe_lessons_rejected(lessons):
    with pytest.raises(PromptPackError):
        make(lessons=lessons)


def test_draft_and_identity_pack_refuse_lessons():
    from shared.llm_generator import QuestionWithEvidenceSignature
    with pytest.raises(PromptPackError):
        create_pack(stage="draft", signature=QuestionWithEvidenceSignature,
            lessons={OBJECTIVE: TEXT}, policy={}, source_run="bad", scores={})
    with pytest.raises(PromptPackError):
        create_pack(stage="plan", lessons={OBJECTIVE: TEXT},
            policy={}, source_run="bad", scores={})


def cards():
    return {"version": 1, "cutoff": "2026-10-26T00:00:00Z", "objectives": {
        OBJECTIVE: {"text": TEXT, "source_candidate_ids": ["c1", "c2", "c3"],
            "source_page_ids": ["page1"], "sha256": hashlib.sha256(TEXT.encode()).hexdigest()}}}


def test_emitter_extends_base_without_changing_existing_content():
    from scripts.optimize.build_card_pack import build_card_pack
    base = make(instructions="Design a decision before fetching docs.")
    before = deepcopy(base)
    result = build_card_pack(cards(), base_pack=base)
    assert base == before
    assert result["writers"][0]["instructions"] == base["writers"][0]["instructions"]
    assert result["writers"][0]["lessons"] == {OBJECTIVE: TEXT}
    assert result["policy"]["planner_cards"]["base_pack_sha256"] == pack_hash(base)
    assert result["policy"]["doccheck_policy"] == "v5"
    assert pack_hash(result) != pack_hash(base)
    assert build_card_pack(cards())["writers"][0]["lessons"] == {OBJECTIVE: TEXT}


@pytest.mark.parametrize("mutation", ["cutoff", "hash", "provenance", "cert", "empty"])
def test_emitter_rejects_invalid_cards(mutation):
    from scripts.optimize.build_card_pack import build_card_pack
    value = cards()
    record = value["objectives"][OBJECTIVE]
    if mutation == "cutoff": value["cutoff"] = "2026-10-27T00:00:00Z"
    elif mutation == "hash": record["text"] += " changed"
    elif mutation == "provenance": record["source_candidate_ids"] = ["same"] * 3
    elif mutation == "cert": value["objectives"]["data-engineer:1"] = value["objectives"].pop(OBJECTIVE)
    else: value["objectives"] = {}
    with pytest.raises(ValueError):
        build_card_pack(value)


def test_emitter_cli_roundtrip_and_overwrite_refusal(tmp_path, capsys):
    from scripts.optimize.build_card_pack import main
    from shared.prompt_pack import load_pack
    source = tmp_path / "cards.json"
    output = tmp_path / "pack.json"
    source.write_text(json.dumps(cards()))
    args = ["--cards", str(source), "--output", str(output)]
    assert main(args) == 0
    assert load_pack(output)["writers"][0]["lessons"] == {OBJECTIVE: TEXT}
    assert json.loads(capsys.readouterr().out)["model_calls"] == 0
    with pytest.raises(SystemExit):
        main(args)
