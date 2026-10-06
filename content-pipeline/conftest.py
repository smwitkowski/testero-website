"""Offline-only test environment for the content pipeline."""
import os
import socket

import dotenv
import pytest

# Apply before test module collection, which imports traced DSPy modules.
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"
dotenv.load_dotenv = lambda *args, **kwargs: False


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Network access is forbidden in content-pipeline tests")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket.socket, "connect_ex", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    # Socket patches do not reach CLI child processes; block subscription calls too.
    from shared import cli_models
    monkeypatch.setattr(cli_models.subprocess, "run", forbidden)


@pytest.fixture(autouse=True)
def legacy_generation_stage_fixtures(request, monkeypatch):
    """Keep historical generation tests offline; v4 stages have dedicated tests."""
    if request.path.name not in {
        "test_generation_gate.py", "test_external_pipeline.py",
        "test_external_generation.py", "test_generation_parallel.py",
    }:
        return
    from scripts import generate_pmle_questions as generate

    def plan(scope, **kwargs):
        return {
            "objective_id": scope["objective_id"],
            "engineering_decision": "Choose a managed ML workflow for the selected objective",
            "business_consequence": "Keep the existing application reliable",
            "existing_system": "A running application with an ML workflow",
            "decisive_constraints": ["Minimize operational upkeep"],
            "best_action": "Use the fitting managed workflow",
            "mistakes": [
                {"action": "Build a custom workflow", "scenario_reason": "Adds operational upkeep"},
                {"action": "Migrate the data workflow", "scenario_reason": "Adds migration risk"},
                {"action": "Repeat manual operations", "scenario_reason": "Adds recurring effort"},
            ],
        }

    def proof(scope, decision, sources, **kwargs):
        from shared.evidence import check_evidence
        quote = " ".join(sources[0]["text"].split())[:100]
        receipts = [{"option_label": label, "url": sources[0]["url"], "quote": quote}
                    for label in "ABCD"]
        checked = check_evidence(receipts, sources)
        return {"passed": checked["passed"], "supported": True, "uniquely_best": True,
                "scenario_reasons_supported": True, "no_feature_gotchas": True,
                "reason": "Explicit offline fixture for historical writer-stage tests",
                "reasons": [{**row, "scenario_reason": "Explicit synthetic decision-proof reason"}
                            for row in receipts],
                "mechanical_check": {"passed": checked["passed"], "errors": checked["errors"]}}

    monkeypatch.setattr(generate, "plan_decision", plan)
    monkeypatch.setattr(generate, "verify_decision", proof)
    monkeypatch.setattr(generate, "writer_decision_context", lambda scope, decision, proof: scope["domain_prompt"])
