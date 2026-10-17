"""Exact real Codex repair/citation outputs; no invented external judgments."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import pytest
from shared.external_judge import build_request,candidate_question,candidate_storage_id,question_sha256
from shared.evidence import check_evidence
from shared.validator import validate_question,option_length_metrics
from shared.cli_models import output_model
from shared.quality_gate import QuestionQualitySignature, RULES_V2_QUALITY_SIGNATURE

DATA=json.loads((Path(__file__).parent/"fixtures/round4_repair_smoke.json").read_text())


@pytest.mark.parametrize("case",DATA["cases"],ids=lambda c:str(c["child"]["index"]))
def test_real_smoke_requires_fresh_independent_judgment(case):
    child=deepcopy(case["child"])
    child["sources"]=[DATA["sources_by_identity"][identity] for identity in child.pop("source_ids")]
    question=candidate_question(child)
    assert question["correct_answer"]==case["parent_correct_answer"]
    assert child["candidate_id"]==case["parent_candidate_id"]+"-r1"
    assert child["repair"]["attempt"]==1
    assert question_sha256(question)==child["repair"]["question_sha256"]
    # The frozen parent verdict has no O5 check; v3 fails closed, without rewriting it.
    with pytest.raises(ValueError):
        candidate_storage_id(child,case["scope"],question)
    assert "options_distinct_approaches" not in child["repair"]["original_verdict"]
    validation=validate_question(question)
    assert validation.is_valid,validation.errors
    assert not option_length_metrics(question)["key_is_longest"]
    checked=check_evidence(child["evidence"],child["sources"])
    assert checked["passed"],checked["errors"]
    request=build_request(child["candidate_id"],case["scope"],question,child["sources"],checked["options"], signature=RULES_V2_QUALITY_SIGNATURE)
    raw=(json.dumps(request,indent=2,ensure_ascii=False,allow_nan=False)+"\n").encode()
    assert hashlib.sha256(raw).hexdigest()==child["external_judge_request"]["sha256"]
    assert len(request["verdict_schema"]["required"])==14
    assert request["verdict_schema"]==output_model(RULES_V2_QUALITY_SIGNATURE).model_json_schema()
    assert child["accepted"] is False
    assert child["awaiting_external_judge"] is True
    assert child["judge_verdict"]["passed"] is False
    assert "external_verdict" not in child
    assert child.get("persistence_status") is None


def test_real_smoke_provenance_stays_inside_authorized_call_budget():
    assert DATA["provenance"]["calls_started"]==4
    assert DATA["provenance"]["candidate_count"]==2
    assert DATA["provenance"]["judge_calls"]==0
    assert DATA["provenance"]["db_writes"]==0
