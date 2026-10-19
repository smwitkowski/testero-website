"""Safe defaults preserve complete typed prompt content, not just word counts."""
import json
from copy import deepcopy
import dspy
import pytest
from shared.cli_models import signature_prompt
from shared.decision_planner import planning_prompt, verification_prompt
from test_decision_first_v4 import scope, decision, pipeline
from test_external_generation import source


@pytest.mark.parametrize("mode", ["strict", "consistent"])
@pytest.mark.parametrize("kind", ["plan", "verify"])
def test_prefix_reorders_exact_fields_without_any_content_change(mode, kind):
    selected = {**scope(), "distractor_evidence": {"version": 1, "mode": mode}}
    def prompt(enabled):
        if kind == "plan":
            return planning_prompt(selected, existing_scenarios=[{"action": "retain Unicode Ω"}],
                                   replacement_feedback="previous veto retained exactly", stable_prefix=enabled)
        return verification_prompt(selected, decision(), [source()], stable_prefix=enabled)
    before, values_before = prompt(False)
    after, values_after = prompt(True)
    assert values_before == values_after
    assert before.instructions == after.instructions
    assert set(before.fields) == set(after.fields)
    for name in before.fields:
        assert before.fields[name].asdict() == after.fields[name].asdict()
    assert list(before.output_fields) == list(after.output_fields)
    # Both transports use these same signatures. Reversing only input order
    # recreates byte-identical JSON/Chat adapter messages and CLI prompt text.
    from shared.decision_planner import ordered_signature
    restored = ordered_signature(after, list(before.input_fields))
    for adapter in (dspy.JSONAdapter(), dspy.ChatAdapter()):
        assert adapter.format(restored, [], values_after) == adapter.format(before, [], values_before)
    assert signature_prompt(restored, values_after) == signature_prompt(before, values_before)
    assert list(before.input_fields) != list(after.input_fields)


def test_generator_defaults_only_cache_and_ordering_on(pipeline):
    events, path, invoke = pipeline
    assert invoke().exit_code == 0
    payload = json.loads((path / "batch.json").read_text())
    flags = payload["retrieval_experiment"]
    assert flags["disk_cache"] is True
    assert flags["stable_prefix"] is True
    assert flags["per_option_retrieval"] is False
    assert all("retrieval" not in attempt and "escalation" not in attempt
               for candidate in payload["candidates"] for attempt in candidate["decision_attempts"])
