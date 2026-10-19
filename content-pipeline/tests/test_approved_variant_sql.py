"""Offline founder approval -> normal persistence projection -> guarded SQL."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from click.testing import CliRunner
from scripts import export_approved_variants_sql as exporter
from shared.quality_gate import JudgeVerdict
from test_generation_gate import QUESTION


def review_table(prefixes):
    return "**Publish now: 13 variants.**\n| Parent | Monitoring | Migration | Scale |\n" + "\n".join(
        "| 12345678 (decision) | " + " | ".join(f"r4 {p}" for p in prefixes[i:i+3]) + " |"
        for i in range(0, len(prefixes), 3)) + "\n**Dropped as duplicates:**\nr4 deadbeef"


@pytest.fixture
def bundle(tmp_path, monkeypatch):
    prefixes = [f"{i+1:08x}" for i in range(13)]
    review = tmp_path / "review.md"
    review.write_text(review_table(prefixes))
    parent_id = "12345678-0000-4000-8000-000000000001"
    candidates = []
    scope = {"cert_id":"machine-learning-engineer", "objective_id":"objective", "guide_sha256":"guide",
             "domain_code":"DOMAIN", "decision_objective":{}, "decision_plan":{}, "decision_proof":{},
             "key_length_rank":2}
    for index,prefix in enumerate(prefixes, 1):
        ident = prefix + "-0000-4000-8000-000000000001"
        candidates.append({"index":index, "candidate_id":ident, "parent_question_id":parent_id,
            "variant":{"surface":{"industry":"industry " + str(index)}},
            "option_order":{"A":"B","B":"D","C":"A","D":"C"},
            "evidence":[{"option_label":"A","url":"https://docs.cloud.google.com/test","quote":"quote"}],
            "external_judge_request":{"path":"requests/" + ident + ".json","sha256":"requesthash"},
            "sources":[]})
    artifact_paths=[]
    for round_no,name in exporter.ARTIFACT_NAMES.items():
        folder=tmp_path / str(round_no); folder.mkdir()
        path=folder / name
        payload={"cert_id":"machine-learning-engineer","model":"codex","exam":"GCP_PM_ML_ENG", "rules_version":5,
            "external_judge_version":2,"difficulty":"MEDIUM","generation_runs":{},
            "plan":[deepcopy(scope) for _ in candidates],"candidates":deepcopy(candidates) if round_no==4 else []}
        path.write_text(json.dumps(payload)); artifact_paths.append(path)
        if round_no!=4: continue
        (folder/"requests").mkdir(); verdicts=path.with_suffix(".verdicts"); verdicts.mkdir()
        for entry in candidates:
            req = json.dumps({"argon":{}})
            (folder/entry["external_judge_request"]["path"]).write_text(req)
            entry["external_judge_request"]["sha256"] = hashlib.sha256(req.encode()).hexdigest()
            (verdicts/(entry["candidate_id"]+".json")).write_text(json.dumps({"argon":{}}))
        payload["candidates"] = deepcopy(candidates)
        path.write_text(json.dumps(payload))
    checked={"options":[{"option_label":"A","url":"https://docs.cloud.google.com/test","quote":"quote"}]}
    validate=Mock(return_value=(scope,QUESTION,checked))
    judge=JudgeVerdict(True,.95,"Synthetic bound PASS","external")
    decide=Mock(return_value=judge)
    monkeypatch.setattr(exporter,"_validate_candidate",validate)
    monkeypatch.setattr(exporter,"_external_decision",decide)
    return review,artifact_paths,candidates,validate,decide


def test_approval_parser_uses_only_exact_publish_table():
    refs=exporter.approvals(review_table([f"{i+1:08x}" for i in range(13)]))
    assert len(refs)==13
    assert all(r["prefix"]!="deadbeef" and r["parent_prefix"]=="12345678" for r in refs)
    with pytest.raises(ValueError): exporter.approvals(review_table(["00000001"]*13))
    with pytest.raises(ValueError): exporter.approvals("No explicit founder approval")


def test_normal_persistence_projection_preserves_shuffled_option_reasons_and_receipts(bundle):
    review,artifacts,entries,validate,decide=bundle
    before={path:path.read_bytes() for path in artifacts}
    export=exporter.build_export(review,artifacts)
    assert len(export["questions"])==13
    assert len(export["runs"])==1
    assert export["runs"][0]["generated_count"]==export["runs"][0]["target_count"]==13
    row=export["questions"][0]
    q=row["question"]
    assert q["status"]=="ACTIVE" and q["review_status"]=="GOOD" and q["question_type"]=="single_select"
    assert q["domain_id"]=="FROM_PARENT" and q["parent_question_id"]==entries[0]["parent_question_id"]
    assert q["generation_run_id"]==export["runs"][0]["id"]
    labels={a["choice_label"]:a for a in row["answers"]}
    assert labels["C"]["is_correct"] is True
    assert labels["C"]["choice_text"]==QUESTION["correct_answer"]
    assert labels["C"]["explanation_text"]==QUESTION["correct_explanation"]
    assert labels["A"]["explanation_text"]==QUESTION["distractor_1_explanation"]
    assert row["explanation"]["explanation_text"].startswith("A: " + QUESTION["distractor_1_explanation"])
    assert row["explanation"]["doc_links"]==["https://docs.cloud.google.com/test"]
    notes=json.loads(q["review_notes"])
    assert notes["grounding"]["variant"]==entries[0]["variant"]
    assert notes["founder_approved_variant"]["approval"]["sha256"]==hashlib.sha256(review.read_bytes()).hexdigest()
    assert validate.call_count==decide.call_count==13
    assert all(path.read_bytes()==raw for path,raw in before.items())


def test_missing_or_failed_bound_judgment_fails_closed(bundle):
    review,artifacts,entries,validate,decide=bundle
    decide.return_value=JudgeVerdict(False,.4,"FAIL","external")
    with pytest.raises(ValueError,match="bound independent verdicts"): exporter.build_export(review,artifacts)
    validate.side_effect=ValueError("Frozen request mismatch")
    with pytest.raises(ValueError,match="Frozen request mismatch"): exporter.build_export(review,artifacts)


@pytest.mark.parametrize("defect",["missing_prefix","duplicate_prefix","wrong_parent","persisted","wrong_exam"])
def test_resolution_and_unpersisted_source_guards(bundle,defect):
    review,artifacts,entries,_,_=bundle
    path=artifacts[2]; payload=json.loads(path.read_text())
    if defect=="missing_prefix": payload["candidates"][0]["candidate_id"]="ffffffff-0000-4000-8000-000000000001"
    if defect=="duplicate_prefix": payload["candidates"].append(deepcopy(payload["candidates"][0]))
    if defect=="wrong_parent": payload["candidates"][0]["parent_question_id"]="abcdefab-0000-4000-8000-000000000001"
    if defect=="persisted": payload["candidates"][0]["inserted_question_id"]=entries[0]["candidate_id"]
    if defect=="wrong_exam": payload["exam"]="cloud-engineer"
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError): exporter.build_export(review,artifacts)


def test_sql_is_one_guarded_transaction_and_json_content_not_sql_interpolation(bundle):
    review,artifacts,_,_,_=bundle
    export=exporter.build_export(review,artifacts)
    text="apostrophe's \n COMMIT; DROP TABLE questions; -- $approved_variants$"
    export["questions"][0]["question"]["stem"]=text
    sql=exporter.render_sql(export)
    assert sql.startswith("-- Founder-approved") and sql.endswith("COMMIT;\n")
    assert sql.count("BEGIN;\n")==1
    marker=sql.split("v_batch jsonb := $",1)[1].split("$",1)[0]
    data=sql.split("$"+marker+"$",2)[1]
    assert json.loads(data)["questions"][0]["question"]["stem"]==text
    assert sql.index("Variant ID already exists")<sql.index("INSERT INTO public.question_generation_runs")
    assert "public.replace_question_tags" in sql and "'generation',v_tags" in sql
    assert "p.domain_id" in sql and "'single_select'" in sql
    assert "ON CONFLICT DO NOTHING" not in sql


def test_cli_dry_run_prints_13_ids_parents_industries_without_writing(bundle,tmp_path):
    review,artifacts,_,_,_=bundle
    output=tmp_path/"must-not-exist.sql"
    args=["--review",str(review),"--dry-run","--output",str(output)]
    for path in artifacts: args += ["--artifact",str(path)]
    result=CliRunner().invoke(exporter.main,args)
    assert result.exit_code==0,result.output
    data=json.loads(result.output)
    assert data["count"]==13 and data["answers"]==52 and data["explanations"]==13
    assert len(data["questions"])==13 and all({"id","parent","industry"}<=set(q) for q in data["questions"])
    assert not output.exists()


def test_outer_do_delimiter_is_not_payload_controlled(bundle):
    review,artifacts,_,_,_=bundle
    export=exporter.build_export(review,artifacts)
    export["questions"][0]["question"]["stem"]="$approved_variants$; COMMIT; --"
    sql=exporter.render_sql(export)
    outer=sql.split("DO ",1)[1].split("\n",1)[0]
    assert outer.startswith("$body_") and sql.count(outer)==2
    assert "$approved_variants$; COMMIT; --" in sql


@pytest.mark.parametrize("kind",["symlink","hardlink"])
def test_cli_cannot_overwrite_source_aliases(bundle,tmp_path,kind):
    import os
    review,artifacts,_,_,_=bundle
    output=tmp_path/"alias.sql"
    if kind=="symlink": output.symlink_to(review)
    else: os.link(review,output)
    before=review.read_bytes()
    args=["--review",str(review),"--output",str(output)]
    for path in artifacts: args += ["--artifact",str(path)]
    result=CliRunner().invoke(exporter.main,args)
    assert result.exit_code!=0
    assert review.read_bytes()==before


@pytest.mark.parametrize("data",[b'{"key":1,"key":2}',b'{"key":NaN}',b'{"key":Infinity}',b'{"key":-Infinity}'])
def test_exact_hashed_json_parser_rejects_duplicate_and_nonfinite_input(data):
    with pytest.raises(ValueError): exporter.strict_json(data)
