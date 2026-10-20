"""Offline contracts for the opt-in PDE 5.3 filler check.

Critic outputs are canned. These tests prove routing and rejection contracts,
not live model judgment quality. All question text below is original/synthetic.
"""
from copy import deepcopy
import hashlib
import json

import pytest

from shared import cli_models
from shared.gates import (
    aggregate_gate_verdict, build_gate_inputs, evaluate_gate, gate_signatures,
    parse_gate_output,
)
from shared.objective_style import (
    policy_instructions, style_policy, uses_filler_style, uses_pde_style,
    validate_style_policy,
)
from shared.quality_gate import judge_three_gates
from test_generation_gate import QUESTION
from test_pde_style import PDE, LEGACY, PMLE, pde_bundle, question, request

HISTORICAL_PDE = {**PDE, "version": "5.2"}
CHECK = "distractors_no_generic_filler"


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def test_filler_check_is_new_pde_only():
    assert style_policy(PDE["objective_id"])["version"] == "5.3"
    assert uses_filler_style(PDE)
    for old in (HISTORICAL_PDE, LEGACY, PMLE, None):
        assert not uses_filler_style(old)
        signature = gate_signatures(style_policy=old)["style"]
        assert CHECK not in signature.output_fields
        assert "Rules v5.3" not in policy_instructions(old)
    assert uses_pde_style(HISTORICAL_PDE)
    assert validate_style_policy(HISTORICAL_PDE, PDE["objective_id"]) == HISTORICAL_PDE
    for invalid in ({**PDE, "allowance": "general_ml_mlops"},
                    {**PMLE, "version": "5.3"}, {**PDE, "extra": True}):
        with pytest.raises(ValueError):
            uses_filler_style(invalid)


@pytest.mark.parametrize("stem,action,critic_passes", [
    (
        "Your team queries non-clustered BigQuery tables. On-demand charges rose "
        "because each query scans the entire table. You want to reduce bytes scanned. "
        "What should you do?",
        "Add LIMIT 100 to each BigQuery query to restrict the number of final rows returned.",
        False,
    ),
    (
        "Your team runs a BigQuery report with a join that produces many intermediate "
        "rows and consumes substantial compute. You want to reduce that work. What should you do?",
        "Add LIMIT 100 to the final BigQuery query result after joining both source tables.",
        False,
    ),
    (
        "Your team delivers BigQuery reports to an analyst. Each report returns millions "
        "of rows although the analyst only examines ten examples. You want fewer returned rows. "
        "What should you do?",
        "Add LIMIT 10 to the BigQuery query before returning its results to the analyst.",
        True,
    ),
    (
        "Your team queries a BigQuery score table. Analysts only need the ten highest "
        "scores, but their report currently returns all scores. You want a top-ten report. "
        "What should you do?",
        "Order the BigQuery query by score descending and add LIMIT 10 to its result.",
        True,
    ),
    (
        "Your team queries a clustered BigQuery table through a documented access pattern "
        "that permits early termination. You want to examine a small result subset with less "
        "scan work. What should you do?",
        "Apply LIMIT to the BigQuery query using the documented clustered-table access pattern for early termination.",
        True,
    ),
])
def test_contextual_limit_critic_verdicts_are_enforced_not_a_keyword_ban(stem, action, critic_passes):
    # This is a supplied critic verdict, not a heuristic pretending to judge SQL.
    q = question()
    q.update(stem=stem, distractor_1=action)
    raw = pde_bundle(q)
    raw["style"].update(score=1.0, verdict="PASS", **{CHECK: critic_passes})
    result = aggregate_gate_verdict(q, raw, style_policy=PDE)
    assert result.passed is critic_passes
    if not critic_passes:
        assert CHECK in result.reason  # Score 1.0 and verdict PASS cannot waive false.
    assert "LIMIT" in q["distractor_1"]  # Legitimate uses are not blacklisted.


@pytest.mark.parametrize("bad", ["missing", "true", 1, None, [], {}])
def test_required_filler_boolean_fails_closed_on_missing_or_wrong_type(bad):
    raw = pde_bundle()
    if bad == "missing":
        raw["style"].pop(CHECK)
    else:
        raw["style"][CHECK] = bad
    with pytest.raises(cli_models.CLISchemaError):
        parse_gate_output("style", raw["style"], style_policy=PDE)
    with pytest.raises(cli_models.CLISchemaError):
        aggregate_gate_verdict(question(), raw, style_policy=PDE)


def test_inline_critic_cannot_skip_filler_check_and_all_other_checks_remain_required():
    raw = pde_bundle()
    predictors = {name: (lambda data: lambda **_: data)(data) for name, data in raw.items()}
    args = dict(documentation_context="docs", model="claude", generator_model="codex",
                option_evidence=[{"quote": "proof"}], predictors=predictors, style_policy=PDE)
    assert judge_three_gates(question(), "scope", **args).passed
    raw["style"][CHECK] = False
    assert not judge_three_gates(question(), "scope", **args).passed
    raw["style"].pop(CHECK)
    assert not judge_three_gates(question(), "scope", **args).passed
    raw["style"][CHECK] = True
    for old_check in ("inference_required", "distractors_plausible", "options_no_goal_restatement"):
        raw["style"][old_check] = False
        assert not judge_three_gates(question(), "scope", **args).passed
        raw["style"][old_check] = True


def test_new_signature_and_prompt_require_contextual_non_solutions_check_without_key_leak():
    signature = gate_signatures(style_policy=PDE)["style"]
    schema = cli_models.output_model(signature).model_json_schema()
    assert schema["properties"][CHECK]["type"] == "boolean"
    assert CHECK in schema["required"] and schema["additionalProperties"] is False
    inputs = build_gate_inputs(question(), "PRIVATE_SCOPE", "PRIVATE_DOCS",
                               [{"quote": "PRIVATE_QUOTE"}], style_policy=PDE)
    assert set(inputs["style"]) == {"stem", "options", "style_reference"}
    assert "PRIVATE_" not in json.dumps(inputs["style"])
    prompt = cli_models.signature_prompt(signature, inputs["style"])
    for required in (CHECK, "LIMIT", "non-clustered", "returned-row", "top-N",
                     "early termination", "restarts", "credible mechanism"):
        assert required in prompt
    assert "Do not blacklist LIMIT" in prompt
    assert "Rules v5.3" in inputs["style"]["style_reference"]
    custom = build_gate_inputs(question(), "scope", "docs", [], style_policy=PDE,
                               style_reference="CUSTOM_REFERENCE")
    assert "CUSTOM_REFERENCE" in custom["style"]["style_reference"]
    assert "Rules v5.3" in custom["style"]["style_reference"]


def test_frozen_historical_pde52_prompt_schema_and_complete_request_unchanged():
    inputs = build_gate_inputs(QUESTION, "SCOPE", "DOCS", [{"quote": "PROOF"}],
                               style_policy=HISTORICAL_PDE)
    frozen = {name: {"schema": cli_models.output_model(signature).model_json_schema(),
                     "prompt": cli_models.signature_prompt(signature, inputs[name])}
              for name, signature in gate_signatures(cert_id="data-engineer", style_policy=HISTORICAL_PDE).items()}
    # Captured from origin/main before this change using these exact fixtures.
    assert digest(frozen) == "43327575e6be10c562cb1561e82b4ba22d44759bb7d47a88d64a42923133bae9"
    assert digest(request(policy=HISTORICAL_PDE)) == "b7ca7a4f99ef85bb0dde4d62ed3b1dea8b2217e5cd3d50661c7669caf9efbe14"
    old_output = deepcopy(pde_bundle()["style"])
    old_output.pop(CHECK)
    assert evaluate_gate("style", old_output, question(), style_policy=HISTORICAL_PDE)[0]
    with pytest.raises(cli_models.CLISchemaError):
        parse_gate_output("style", old_output, style_policy=PDE)
    with pytest.raises(cli_models.CLISchemaError):
        parse_gate_output("style", pde_bundle()["style"], style_policy=HISTORICAL_PDE)


@pytest.mark.parametrize("policy", [PDE, HISTORICAL_PDE, LEGACY, PMLE, None])
def test_frozen_cli_dispatch_supports_each_exact_schema_without_live_calls(monkeypatch, policy):
    signature = gate_signatures(style_policy=policy)["style"]
    schema = cli_models.output_model(signature).model_json_schema()
    seen = []
    monkeypatch.setattr(cli_models, "_run_cli", lambda model, prompt, actual, selected, **kw:
                        seen.append((actual, selected)) or {"synthetic": True})
    assert cli_models.run_claude_request("claude", "frozen prompt", schema) == {"synthetic": True}
    assert len(seen) == 1 and seen[0][0] == schema


@pytest.mark.parametrize("version", ["5.2", "5.3"])
def test_recovery_inventory_admits_complete_frozen_pde_versions_unchanged(tmp_path, version):
    from scripts import recover_pde_candidates as recovery
    policy = {**PDE, "version": version}
    payload = {"cert_id": "data-engineer", "style_policy_version": version,
               "rules_version": 5, "judge_model": "external", "candidates": [],
               "plan": [{"objective_id": policy["objective_id"], "style_policy": policy}]}
    path = tmp_path / "source.json"
    path.write_text(json.dumps(payload))
    original = path.read_bytes()
    manifest, loaded, files = recovery._inventory([path])
    assert loaded == [payload] and files[0][0] == path
    assert manifest["sources"][0]["sha256"] == hashlib.sha256(original).hexdigest()
    assert path.read_bytes() == original


@pytest.mark.parametrize("defect", ["missing_policy", "partial_policy", "unknown_version",
                                     "mixed_versions", "wrong_objective", "wrong_cert", "extra_field"])
def test_recovery_inventory_validates_complete_frozen_policies(tmp_path, defect):
    from scripts import recover_pde_candidates as recovery
    policy = deepcopy(PDE)
    scope = {"objective_id": PDE["objective_id"], "style_policy": policy}
    payload = {"cert_id": "data-engineer", "style_policy_version": "5.3",
               "rules_version": 5, "judge_model": "external", "candidates": [], "plan": [scope]}
    if defect == "missing_policy": scope.pop("style_policy")
    elif defect == "partial_policy": scope["style_policy"] = {"version": "5.3"}
    elif defect == "unknown_version": payload["style_policy_version"] = policy["version"] = "5.4"
    elif defect == "mixed_versions": policy["version"] = "5.2"
    elif defect == "wrong_objective": scope["objective_id"] = "data-engineer:standard:2.1:2"
    elif defect == "wrong_cert": policy["objective_id"] = PMLE["objective_id"]
    else: policy["extra"] = True
    path = tmp_path / "source.json"
    path.write_text(json.dumps(payload))
    original = path.read_bytes()
    with pytest.raises(ValueError):
        recovery._inventory([path])
    assert path.read_bytes() == original
