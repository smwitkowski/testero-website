"""Offline prompt-name contracts; no live product or model validation is claimed."""
import json

import pytest

from shared import doccheck_names


def test_current_names_are_present_up_front_without_a_prior_veto():
    text = doccheck_names.current_name_instructions()
    assert "apply from the first plan" in text
    expected = (
        ("Dataproc", "Managed Service for Apache Spark"),
        ("Dataplex", "Knowledge Catalog"),
        ("Cloud Composer", "Managed Service for Apache Airflow"),
        ("Cloud DLP", "Sensitive Data Protection"),
        ("Cloud Bigtable", "Bigtable"),
    )
    for old, current in expected:
        assert f"- {current} (legacy name: {old})." in text


def test_every_actual_lexicon_mapping_uses_current_name_first():
    data = json.loads(doccheck_names.LEXICON_PATH.read_text(encoding="utf-8"))
    text = doccheck_names.current_name_instructions()
    for item in data["products"]:
        assert f'- {item["new"]} (legacy name: {item["old"]}).' in text
    assert "- Experiments on Agent Platform (legacy name: Vertex AI Experiments)." in text
    assert "- Agent Platform Inference (legacy name: AI Platform Prediction)." in text


def test_guidance_protects_evidence_and_does_not_rewrite_local_sources():
    before = doccheck_names.LEXICON_PATH.read_bytes()
    text = doccheck_names.current_name_instructions()
    assert "Preserve official source text, evidence quotes, URLs and receipts byte-exact" in text
    assert "never rename them" in text
    assert "Do not invent names or infer product capabilities" in text
    assert "does not change frozen historical style policies" in text
    assert doccheck_names.LEXICON_PATH.read_bytes() == before


def test_guidance_reads_local_lexicon_instead_of_hardcoding_its_names(tmp_path, monkeypatch):
    lexicon = tmp_path / "lexicon.json"
    lexicon.write_text(json.dumps({"version": 1, "products": [
        {"old": "Old Fixture", "new": "Current Fixture", "status": "renamed", "source": "fixture"},
    ]}))
    monkeypatch.setattr(doccheck_names, "LEXICON_PATH", lexicon)
    text = doccheck_names.current_name_instructions()
    assert "- Current Fixture (legacy name: Old Fixture)." in text
    assert "Vertex AI Experiments" not in text


@pytest.mark.parametrize("data", [
    [], {}, {"version": 2, "products": []}, {"version": 1, "products": {}},
    {"version": 1, "products": [None]},
    {"version": 1, "products": [{"old": "Old", "new": "Current", "status": "guessed", "source": "fixture"}]},
    {"version": 1, "products": [{"old": "Old", "new": "", "status": "renamed", "source": "fixture"}]},
    {"version": 1, "products": [{"old": "Old", "new": "Current", "status": "renamed"}]},
])
def test_invalid_local_lexicon_fails_closed(tmp_path, monkeypatch, data):
    lexicon = tmp_path / "lexicon.json"
    lexicon.write_text(json.dumps(data))
    monkeypatch.setattr(doccheck_names, "LEXICON_PATH", lexicon)
    with pytest.raises(ValueError, match="Invalid product freshness lexicon"):
        doccheck_names.current_name_instructions()


def test_initial_v6_planner_contains_current_names_without_changing_v5():
    from shared.decision_planner import planning_prompt
    from test_decision_first_v4 import scope
    legacy, _ = planning_prompt(scope())
    current, _ = planning_prompt({**scope(), "doccheck_policy": "v6"})
    assert "Current product names for new doccheck v6" not in legacy.instructions
    for name in ("Managed Service for Apache Spark", "Knowledge Catalog"):
        assert name in current.instructions
    assert "apply from the first plan" in current.instructions
