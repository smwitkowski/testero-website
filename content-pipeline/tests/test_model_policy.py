"""Pure model-family checks and judge-enforcement tests."""
import json
from unittest.mock import Mock
import pytest
from shared.model_policy import model_family, require_independent_models, DEFAULT_GENERATOR_MODEL, DEFAULT_JUDGE_MODEL
from shared.quality_gate import JudgeVerdict, is_judge_passed, judge_question

@pytest.mark.parametrize("model,family", [(DEFAULT_GENERATOR_MODEL,"google"),(DEFAULT_JUDGE_MODEL,"anthropic"),("openai/gpt-4o","openai"),("openrouter/x-ai/grok-4","x-ai")])
def test_known_vendor(model,family):
    assert model_family(model)==family

@pytest.mark.parametrize("model", [None,"","gemini","custom/model","openrouter/auto","google/made-up","openrouter/google/gemini/model"])
def test_unknown_vendor_or_alias_fails(model):
    with pytest.raises(ValueError): model_family(model)

def test_google_sizes_versions_and_gemma_not_independent():
    for judge in ["google/gemini-2.5-pro","google/gemma-3-27b"]:
        with pytest.raises(ValueError): require_independent_models(DEFAULT_GENERATOR_MODEL,judge)
    assert require_independent_models(DEFAULT_GENERATOR_MODEL,DEFAULT_JUDGE_MODEL)==("google","anthropic")

def test_judge_enforces_pair_before_predictor():
    predictor=Mock()
    verdict=judge_question({},"scope",documentation_context="docs",model=DEFAULT_GENERATOR_MODEL,generator_model=DEFAULT_GENERATOR_MODEL,predictor=predictor)
    assert not verdict.passed
    predictor.assert_not_called()

def test_extended_review_envelope_keeps_strict_judge_and_unknown_keys_rejected():
    data=json.loads(JudgeVerdict(True,.9,"Pass",DEFAULT_JUDGE_MODEL).to_review_notes())
    data["grounding"]={"cert_id":"synthetic"}
    assert is_judge_passed(json.dumps(data))
    data["unknown"]=True
    assert not is_judge_passed(json.dumps(data))
