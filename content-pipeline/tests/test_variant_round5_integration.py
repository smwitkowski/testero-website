"""Round-5 deterministic repair and batch guards. Synthetic, offline only."""
from copy import deepcopy
from collections import Counter
import json
from unittest.mock import Mock

import pytest
from scripts import generate_variants, variants_ab
from shared.cert_context import plan_questions, DEFAULT_CERT
from shared.external_judge import candidate_question
from shared.option_order import store_options
from shared.variant_plan import (REPAIR_MODE, REPAIR_SLOTS, assignments, replay_scope, key_length_batch_report)
from shared.variants import parent_snapshot, planned_key_length_ranks
from test_variants import parents
from test_generation_gate import QUESTION


def repaired_parents(parents):
    _,_,payload,bank=parents
    parent=parent_snapshot(payload,payload["candidates"][0],bank)
    result=[]
    for ident in dict.fromkeys(s["parent_question_id"] for s in REPAIR_SLOTS):
        copied=deepcopy(parent);copied["question_id"]=ident;result.append(copied)
    return result


def synthetic_live_history(monkeypatch):
    # Binding semantics are tested in test_variant_live_history; this isolates replay dispatch.
    from shared.variant_live_history import LIVE_HISTORY_POLICY
    monkeypatch.setattr("shared.variant_live_history.validate_live_priors", lambda snapshot: snapshot)
    return {"policy": LIVE_HISTORY_POLICY, "questions": [
        {"id": str(i), "parent_question_id": "unrelated-parent", "industry": "unused"} for i in range(13)]}


def test_targeted_repair_plan_is_exact_four_slots_times_two_with_global_ranks(parents, monkeypatch):
    p=repaired_parents(parents)
    plan,links=generate_variants.build_plan(p,2,policy_version=5,repair_mode=REPAIR_MODE)
    assert len(plan)==len(links)==8
    assert Counter((s["variant_origin"]["parent_question_id"],s["scenario_moment"]) for s in plan)==Counter({
        (slot["parent_question_id"],slot["scenario_moment"]):2 for slot in REPAIR_SLOTS})
    assert [s["key_length_rank"] for s in plan]==[2,3,4,1,2,3,4,1]
    payload={"variant_parents":{p["question_id"]:p for p in p},"plan":plan,"repair_mode":REPAIR_MODE,
             "prior_variants": synthetic_live_history(monkeypatch)}
    for index,scope in enumerate(plan,1):
        base=plan_questions(DEFAULT_CERT,index,objective_ids=[scope["objective_id"]])[-1]
        expected=replay_scope(payload,index,base)
        assert expected["variant_origin"]==scope["variant_origin"]
        assert expected["domain_prompt"]==scope["domain_prompt"]
        assert expected["scenario_moment"]==scope["scenario_moment"]
        assert expected["key_length_rank"]==scope["key_length_rank"]
    assert max(Counter(s["industry"] for s in plan).values())<=2
    assert len({(s["variant_origin"]["parent_question_id"],s["variant_origin"]["ordinal"]) for s in plan})==8


@pytest.mark.parametrize("defect",["parent","mode","count","origin","moment","rank"])
def test_repair_scope_replay_rejects_changed_frozen_plan(parents,defect,monkeypatch):
    p=repaired_parents(parents)
    plan,_=generate_variants.build_plan(p,2,policy_version=5,repair_mode=REPAIR_MODE)
    payload={"variant_parents":{p["question_id"]:p for p in p},"plan":plan,"repair_mode":REPAIR_MODE,
             "prior_variants": synthetic_live_history(monkeypatch)}
    if defect=="parent":payload["variant_parents"].pop(next(iter(payload["variant_parents"])))
    if defect=="mode":payload["repair_mode"]="unknown"
    if defect=="count":payload["plan"].pop()
    if defect=="origin":payload["plan"][0]["variant_origin"]["ordinal"]=5
    if defect=="moment":payload["plan"][0]["scenario_moment"]="greenfield"
    if defect=="rank":payload["plan"][0]["key_length_rank"]=1
    base=plan_questions(DEFAULT_CERT,1,objective_ids=[plan[0]["objective_id"]])[0]
    if defect in ("moment","rank"):
        # Helper reconstructs independently. The ingest scope comparator rejects the inequality.
        expected=replay_scope(payload,1,base)
        assert expected["scenario_moment"]!=plan[0]["scenario_moment"] or expected["key_length_rank"]!=plan[0]["key_length_rank"]
    else:
        with pytest.raises(ValueError):replay_scope(payload,1,base)


def entry_with_lengths(ident,lengths):
    question=deepcopy(QUESTION)
    for field,length in zip(("correct_answer","distractor_1","distractor_2","distractor_3"),lengths):
        question[field]=" ".join([field]*length)
    entry={"candidate_id":ident,"stem":question["stem"]}
    store_options(entry,question,[])
    return entry


def test_batch_cap_counts_tied_shortest_and_actual_longest_after_label_shuffles():
    payload={"plan":[{"variant_policy_version":5}]}
    entries=[entry_with_lengths("rank1",[24,24,25,26]),entry_with_lengths("rank2",[25,24,26,27]),
             entry_with_lengths("rank3",[26,24,25,27]),entry_with_lengths("rank4",[27,26,26,26])]
    good=key_length_batch_report(payload,entries)
    assert good["passed"] and good["shortest_or_tied_count"]==1 and good["unique_longest_count"]==1
    assert good["shortest_or_tied_fraction"]==.25
    assert not key_length_batch_report(payload,[entries[0],entries[3]])["passed"]
    assert not key_length_batch_report(payload,entries[:3])["passed"]
    assert not key_length_batch_report(payload,[])["passed"]
    assert key_length_batch_report({"plan":[{}]},entries)["enforced"] is False
    with pytest.raises(ValueError):key_length_batch_report({"plan":[{}, {"variant_policy_version":5}]},entries)


def test_policy5_generation_gets_one_rank_repair_and_revalidates(parents,tmp_path,monkeypatch):
    from test_variants import variant_for
    artifact,bank,payload,_=parents
    calls=[]
    def repair(inputs):
        calls.append(inputs)
        current=json.loads(inputs["current_question"])
        # The existing synthetic writer is deliberately off the rank-4 target.
        # Retain the content to prove failed repair is bounded, not retried forever.
        return {name:current[name] for name in ("correct_answer","distractor_1","distractor_2","distractor_3")}
    result=generate_variants.generate([artifact],[payload["candidates"][0]["candidate_id"]],bank,tmp_path/"r5.json",
        variants_per_parent=1,enable_variants=True,predictor=variant_for,length_repair_predictor=repair,variant_policy_version=5)
    assert len(calls)==1
    assert result["plan"][0]["key_length_rank"]==4
    assert result["candidates"][0]["option_rewrite_check"]["key_length_rank_passed"] is False
    assert result["candidates"][0]["failure_stage"]=="schema"
    assert result["variant_attempts"][0]["calls_started"]==2


def test_repair_cli_requires_both_explicit_live_optin_and_live_manifest(tmp_path,monkeypatch):
    import sys
    generate=Mock(side_effect=AssertionError("No generation without complete CLI guards"))
    monkeypatch.setattr(variants_ab,"generate",generate)
    monkeypatch.setattr(sys,"argv",["variants_ab.py","repair","--artifact",str(tmp_path/"repair.json")])
    with pytest.raises(SystemExit):variants_ab.main()
    monkeypatch.setattr(sys,"argv",["variants_ab.py","repair","--artifact",str(tmp_path/"repair.json"),
        "--parent-dir",str(tmp_path),"--live-prior-manifest",str(tmp_path/"receipt.json")])
    with pytest.raises(SystemExit):variants_ab.main()
    generate.assert_not_called()


@pytest.mark.parametrize("prior",[None,{}, {"artifacts":[],"questions":[],"snapshot_sha256":"unused"},
                                  {"policy":"unapproved","questions":[{}]*13}])
def test_repair_replay_cannot_discard_live_family_history(parents,prior):
    from shared.variant_plan import validate_repair_history
    with pytest.raises(ValueError,match="13-live"):
        validate_repair_history({"repair_mode":REPAIR_MODE,"prior_variants":prior})


def test_round5_report_rejects_duplicate_ids_before_batch_counting(tmp_path):
    artifact=tmp_path/"duplicates.json"
    artifact.write_text(json.dumps({"plan":[{"variant_policy_version":5}],"candidates":[
        {"index":1,"candidate_id":"same"},{"index":1,"candidate_id":"same"}]}))
    with pytest.raises(ValueError):variants_ab.report(artifact,tmp_path/"verdicts")


def test_repair_review_pairs_can_show_all_eight_alternatives(parents,tmp_path,monkeypatch):
    p=repaired_parents(parents)
    rows=assignments(p,2,repair_mode=REPAIR_MODE)
    entries=[]
    for index,(parent,_,_) in enumerate(rows,1):
        entry=deepcopy(parent["entry"])
        entry.update(candidate_id=str(index),parent_question_id=parent["question_id"],variant={"version":1})
        entries.append(entry)
    artifact=tmp_path/"repair.json"; output=tmp_path/"pairs.md"
    artifact.write_text(json.dumps({"repair_mode":REPAIR_MODE,"candidates":entries,
        "variant_parents":{p["question_id"]:p for p in p},"existing_questions":{"questions":[]}}))
    monkeypatch.setattr(variants_ab,"variant_duplicates",lambda *a,**kw:{"max_family_stem_similarity":.1})
    assert variants_ab.review_pairs(artifact,output,8)==8
    assert output.read_text().count("## Pair ")==8
