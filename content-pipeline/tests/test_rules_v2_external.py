"""The canonical schema carries rules-v2 through every external boundary offline."""
import json
from pathlib import Path
from types import SimpleNamespace
import pytest
from shared.cli_models import CLISchemaError, output_model, parse_output
from shared.quality_gate import ACCURACY_CHECKS, QuestionQualitySignature, judge_question


def test_new_required_bool_survives_canonical_schema():
    schema=output_model(QuestionQualitySignature).model_json_schema()
    assert len(schema["properties"])==14
    assert "distractors_need_knowledge" in schema["required"]
    assert schema["properties"]["distractors_need_knowledge"]["type"]=="boolean"


@pytest.mark.parametrize("value",[None,"true",1,False])
def test_false_or_malformed_knowledge_check_cannot_pass(value):
    question={key:"A distinct " + key for key in ("stem","correct_answer","distractor_1","distractor_2","distractor_3","correct_explanation","distractor_1_explanation","distractor_2_explanation","distractor_3_explanation")}
    raw={"verdict":"PASS","score":1.0,"reason":"Synthetic complete rubric",**{name:True for name in ACCURACY_CHECKS}}
    raw["distractors_need_knowledge"]=value
    result=judge_question(question,"Scope",documentation_context="Offline docs",predictor=lambda **_:SimpleNamespace(**raw))
    assert not result.passed


def test_real_round3_pass_without_new_check_is_not_current_pass():
    fixture=json.loads((Path(__file__).parent/"fixtures/round3_historical_verdict.json").read_text())
    raw=fixture["verdict"]
    assert fixture["index"]==4 and raw["verdict"]=="PASS"
    assert "distractors_need_knowledge" not in raw
    with pytest.raises(CLISchemaError):parse_output(json.dumps(raw),QuestionQualitySignature)


def test_round4_runbook_exact_commands_and_same_objectives():
    import shlex
    text=(Path(__file__).parents[1]/"PROCESS.md").read_text()
    section=text.split("### Rules v2: round 4, 45 candidates",1)[1].split("### Current external-judge",1)[0]
    blocks=[block.split("```",1)[0] for block in section.split("```sh\n")[1:]]
    commands=[shlex.split(block.replace("\\\n"," ")) for block in blocks]
    generation,judge,dry,write=commands
    suffixes=("1.1:5","1.2:1","1.2:2","1.2:3","2.1:3","2.2:3","3.1:4","3.2:6","3.3:1","4.1:4","4.1:5","4.2:4","5.1:2","6.1:1","6.2:3")
    assert [generation[i+1] for i,flag in enumerate(generation) if flag=="--objective"]==["machine-learning-engineer:standard:"+suffix for suffix in suffixes]
    assert generation[generation.index("--n-questions")+1]=="45"
    assert generation[generation.index("--model")+1]=="codex"
    assert generation[generation.index("--judge-model")+1]=="external"
    assert generation[generation.index("--artifact")+1]==".cache/generation/pmle-d025-r4-45.json"
    assert judge[judge.index("--requests")+1]==".cache/generation/pmle-d025-r4-45.judge-requests"
    assert judge[judge.index("--verdicts")+1]==".cache/generation/pmle-d025-r4-45.verdicts"
    assert judge[judge.index("--parallel")+1]=="3"
    assert dry[dry.index("--artifact")+1]==".cache/generation/pmle-d025-r4-45.json"
    assert "--dry-run" in dry and "--dry-run" not in write
