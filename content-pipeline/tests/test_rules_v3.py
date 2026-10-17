"""Offline rules-v3 calibration; real questions are never reworded to pass."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from shared.cli_models import CLISchemaError, output_model, parse_output
from shared.external_judge import eligible_repair_verdict
from shared.quality_gate import ACCURACY_CHECKS, QuestionQualitySignature, judge_question
from shared.validator import validate_question, shared_leading_words, has_human_subject_opening
from shared.batch_report import option_prefix_report, format_option_prefix_report
from test_external_ingest import case, invoke, saved
from test_generation_gate import QUESTION

CASES = json.loads((Path(__file__).parent / "fixtures/round4_v3_style_replay.json").read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=lambda item: item["objective_id"])
def test_real_round4_mechanical_replay(case):
    question = case["question"]
    result = validate_question(question)
    if case["founder_ok"]:
        assert result.is_valid, result.errors
    else:
        assert not result.is_valid
        assert any("Stem opening" in error for error in result.errors)
        assert any("leading words" in error for error in result.errors)
        options = [question[name] for name in ("correct_answer", "distractor_1", "distractor_2", "distractor_3")]
        assert shared_leading_words(options) == {"1.2:2": 17, "2.2:3": 9}[case["objective_id"]]


@pytest.mark.parametrize("prefix", ["You are training", "Your company runs", "You work for", "You have trained", "You need to train", "You recently deployed", "A travel company runs", "An engineer trains", "The data scientist trains"])
def test_official_style_synthetic_stems_pass(prefix):
    stem = (prefix + " a fraud classifier for an online payments application. "
            "The team has a labeled dataset of past transactions and evaluates candidate models every week. "
            "You want to reduce maintenance while keeping the existing evaluation workflow. What should you do?")
    assert validate_question({**QUESTION, "stem": stem}).is_valid


@pytest.mark.parametrize("stem", ["Prototype a reply-writing assistant.", "Extracting text supports claims processing.", "Training a model is useful.", "Deploy the classifier.", "A model predicts fraud.", "The deployment runs.", "A model supports the company.", "The model helps a hospital identify fraud."])
def test_narrow_subject_gate_rejects_other_openings(stem):
    assert not has_human_subject_opening(stem)


@pytest.mark.parametrize("shared, rejected", [(7, False), (8, True)])
def test_three_option_prefix_boundary(shared, rejected):
    prefix = " ".join(f"word{i}" for i in range(shared))
    opts = [prefix + " alpha", prefix + " beta", prefix + " gamma", "different " + " ".join(f"detail{i}" for i in range(shared))]
    q = {**QUESTION, **dict(zip(("correct_answer", "distractor_1", "distractor_2", "distractor_3"), opts))}
    assert shared_leading_words([f"{label}. {text}" for label, text in zip("ABCD", opts)]) == shared
    assert any("leading words" in error for error in validate_question(q).errors) is rejected
    assert shared_leading_words([opts[0], opts[1], "other approach", "another method"]) == 0


def raw_verdict(**changes):
    return {"verdict": "PASS", "score": 1.0, "reason": "Synthetic schema check, not a real quality verdict", **{key: True for key in ACCURACY_CHECKS}, **changes}


@pytest.mark.parametrize("value", [False, None, "true", 1, "missing"])
def test_o5_fails_closed_in_judge_and_ingestion(case, value):
    raw = raw_verdict(options_distinct_approaches=value)
    if value == "missing": raw.pop("options_distinct_approaches")
    verdict = judge_question(QUESTION, "Scope", documentation_context="Offline docs", predictor=lambda **_: SimpleNamespace(**raw))
    assert not verdict.passed
    if value is not False:
        with pytest.raises(CLISchemaError): parse_output(json.dumps(raw), QuestionQualitySignature)
    else:
        parse_output(json.dumps(raw), QuestionQualitySignature)
    (case[1] / (case[2]["candidates"][0]["candidate_id"] + ".json")).write_text(json.dumps(raw))
    assert invoke(case, "--dry-run").exit_code == 1
    assert not saved(case)["candidates"][0]["accepted"]
    case[4].assert_not_called()


def test_o5_is_strict_exported_required_bool_and_repairable(case):
    request = json.loads(case[6].read_text())
    schema = output_model(QuestionQualitySignature).model_json_schema()
    assert request["verdict_schema"] == schema
    assert len(schema["required"]) == 15
    assert len(ACCURACY_CHECKS) == 12
    assert schema["properties"]["options_distinct_approaches"]["type"] == "boolean"
    assert "theme displaces the objective" in request["judge_prompt"]
    eligible_repair_verdict(raw_verdict(verdict="FAIL", options_distinct_approaches=False))
    with pytest.raises(ValueError): eligible_repair_verdict(raw_verdict(verdict="FAIL", options_distinct_approaches=False, evidence_supported=False))


def test_prefix_report_targets_and_empty_samples():
    entries = []
    for words in [0, 1, 2, 6]:
        prefix = " ".join(f"word{i}" for i in range(words))
        texts = [prefix + f" unique{i}" for i in range(3)] + ["Different method"]
        entries.append({"options": [{"label": label, "text": text} for label, text in zip("ABCD", texts)], "accepted": True})
    report = option_prefix_report(entries)
    assert report["median_shared_leading_words"] == 1.5
    assert report["shared_at_least_6_rate"] == .25
    assert report["median_target_met"] is True and report["rate_target_met"] is False
    assert report["accepted"]["count"] == 4
    assert "WARNING target exceeded" in format_option_prefix_report(report)
    assert option_prefix_report([])["median_shared_leading_words"] is None
    assert option_prefix_report(entries[:3])["rate_target_met"] is True


def test_ingestion_stores_and_prints_prefix_report(case):
    result = invoke(case, "--dry-run")
    assert result.exit_code == 0, result.output
    assert "Option prefixes:" in result.output
    assert saved(case)["option_prefix_report"]["count"] == 1


def test_round5_runbook_sequence_and_same_fifteen_objectives():
    import shlex
    text = (Path(__file__).parents[1] / "PROCESS.md").read_text()
    section = text.split("### Current rules-v3 round 5: 45 candidates (D-025)", 1)[1].split("### Historical round-3 inline", 1)[0]
    blocks = [block.split("```", 1)[0] for block in section.split("```sh\n")[1:]]
    commands = [shlex.split(block.replace("\\\n", " ")) for block in blocks]
    assert len(commands) == 7
    generation, judge, repair_dry, repair, judge_again, dry, write = commands
    suffixes = ("1.1:5", "1.2:1", "1.2:2", "1.2:3", "2.1:3", "2.2:3", "3.1:4", "3.2:6", "3.3:1", "4.1:4", "4.1:5", "4.2:4", "5.1:2", "6.1:1", "6.2:3")
    assert [generation[i+1] for i, flag in enumerate(generation) if flag == "--objective"] == ["machine-learning-engineer:standard:" + s for s in suffixes]
    for flag, value in [("--n-questions", "45"), ("--model", "codex"), ("--judge-model", "external")]:
        assert generation[generation.index(flag)+1] == value
    assert Path(generation[generation.index("--artifact")+1]).name == "pmle-d025-r5-45.json"
    assert judge == judge_again
    assert judge[judge.index("--judge-model")+1] == "claude"
    assert Path(judge[judge.index("--requests")+1]).name == "pmle-d025-r5-45.judge-requests"
    assert Path(judge[judge.index("--verdicts")+1]).name == "pmle-d025-r5-45.verdicts"
    assert "--dry-run" in repair_dry and "--dry-run" not in repair
    assert "--dry-run" in dry and "--dry-run" not in write
