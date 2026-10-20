"""Offline ACE contracts; synthetic inputs never establish live question quality."""
from copy import deepcopy
import json
from pathlib import Path
from unittest.mock import Mock

from click.testing import CliRunner
import pytest

from scripts import generate_pmle_questions as generate, generate_all_domains, run_domain_batch as batch
from shared.cert_context import load_cert_context, plan_questions
from shared.domain_context import get_domain_context
from shared.objective_style import allows_ml_practice, policy_instructions, style_policy, validate_style_policy
from shared.near_duplicates import load_export, comparison_row, check_near_duplicate, check_plan_near_duplicate
from shared.call_logging import call_context, model_call


def question(cert="cloud-engineer", ident="q"):
    return {"id": ident, "cert_id": cert, "exam": cert, "status": "DRAFT",
            "stem": "Your team runs private workloads with no external IP and needs outbound package downloads.",
            "key": "A", "options": [{"label": "A", "text": "Configure Cloud NAT for the subnet."}]}


def test_ace_plan_only_through_all_domains_has_no_transports(monkeypatch, tmp_path):
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    for name in ("database_client", "plan_decision", "search_objective_docs", "verify_decision", "generate_question"):
        monkeypatch.setattr(generate, name, Mock(side_effect=AssertionError("No transport permitted")))
    artifact = tmp_path / "cloud-engineer-plan.json"
    wrapper = __import__("click").Command("all-domains", context_settings={"ignore_unknown_options": True, "allow_extra_args": True},
        callback=__import__("click").pass_context(lambda ctx: generate_all_domains.main(ctx.args, standalone_mode=False)))
    result = CliRunner().invoke(wrapper, ["--cert", "cloud-engineer", "--n-questions", "10",
        "--model", "codex", "--judge-model", "external", "--argon-gate", "--seed", "3", "--plan-only", "--artifact", str(artifact)])
    assert result.exit_code == 0, result.output
    payload = json.loads(artifact.read_text())
    assert payload["cert_id"] == payload["exam"] == "cloud-engineer"
    assert payload["plan_only"] and payload["dry_run"]
    assert payload["candidates"] == [] and payload["generation_runs"] == {}
    assert len(payload["plan"]) == 10
    assert [sum(p["domain_code"].endswith(":" + str(i)) for p in payload["plan"]) for i in range(1, 5)] == [2, 3, 3, 2]
    assert not list(tmp_path.glob("*.calls.jsonl"))
    for scope in payload["plan"]:
        assert "Associate Cloud Engineer" in scope["domain_prompt"]
        assert scope["domain_code"].startswith("cloud-engineer:standard:")
        assert scope["guide_sha256"] == load_cert_context("cloud-engineer")["guide_sha256"]
        assert not allows_ml_practice(scope["style_policy"])


@pytest.mark.parametrize("cert", ["cloud-engineer", "cloud-architect", "data-engineer"])
def test_every_new_cert_objective_keeps_product_style_gates(cert):
    context = load_cert_context(cert)
    for domain in context["domains"].values():
        assert get_domain_context(domain["domain_code"], cert_id=cert)["domain_code"] == domain["domain_code"]
        for objective in domain["objectives"]:
            policy = style_policy(objective["objective_id"])
            assert policy["allowance"] is None and not allows_ml_practice(policy)
            if cert == "data-engineer":
                assert policy["version"] == "5.3" and "Professional Data Engineer" in policy_instructions(policy)
            else:
                assert policy_instructions(policy) == ""
            with pytest.raises(ValueError):
                validate_style_policy({**policy, "allowance": "general_ml_mlops"}, objective["objective_id"])


def test_cert_scoped_exports_and_comparisons(tmp_path):
    ace, pca = question(), question("cloud-architect", "other")
    path = tmp_path / "bank.json"
    path.write_text(json.dumps([ace]))
    bank = load_export(path, cert_id="cloud-engineer")
    assert bank["questions"][0]["cert_id"] == "cloud-engineer"
    assert not check_near_duplicate(ace, bank["questions"])["passed"]
    assert check_near_duplicate(pca, bank["questions"])["passed"]
    for rows in ([pca], [ace, pca], [{k: v for k, v in ace.items() if k not in ("cert_id", "exam")}], [{**ace, "exam": "cloud-architect"}]):
        path.write_text(json.dumps(rows))
        with pytest.raises(ValueError): load_export(path, cert_id="cloud-engineer")
    path.write_text("[]")
    assert load_export(path, cert_id="cloud-engineer")["questions"] == []
    legacy = {k: v for k, v in ace.items() if k not in ("cert_id", "exam")}
    path.write_text(json.dumps([legacy]))
    assert load_export(path, cert_id="machine-learning-engineer")["questions"][0]["cert_id"] == "machine-learning-engineer"
    decision = {"existing_system": ace["stem"], "business_consequence": "package downloads", "decisive_constraints": [], "best_action": ace["options"][0]["text"]}
    assert not check_plan_near_duplicate(decision, bank["questions"], cert_id="cloud-engineer")["passed"]
    assert check_plan_near_duplicate(decision, bank["questions"], cert_id="cloud-architect")["passed"]


def test_export_paginates_even_when_server_caps_limit_and_allows_empty(tmp_path):
    path = tmp_path / "bank.json"
    rows = [{"id": str(i), "exam": "cloud-engineer", "status": "DRAFT", "stem": "Need private outbound package access",
             "answers": [{"choice_text": "Configure Cloud NAT", "is_correct": True}]} for i in range(5)]
    calls = []
    def fetch(params):
        calls.append(params)
        return rows[params["offset"]:params["offset"] + 2]
    assert batch.export_questions("https://synthetic.supabase.co", "synthetic-key", "cloud-engineer", path, fetch=fetch) == 5
    assert [c["offset"] for c in calls] == [0, 2, 4, 5]
    assert all(c["exam"] == "eq.cloud-engineer" and c["order"] == "id.asc" for c in calls)
    assert len(json.loads(path.read_text())) == 5
    assert batch.export_questions("https://synthetic.supabase.co", "synthetic-key", "cloud-engineer", path, fetch=lambda _: []) == 0
    assert json.loads(path.read_text()) == []


@pytest.mark.parametrize("bad", [{"message": "not an export"}, [{"id": "foreign", "exam": "GCP_PM_ML_ENG", "status": "ACTIVE"}]])
def test_export_failure_keeps_previous_file(tmp_path, bad):
    path = tmp_path / "bank.json"
    path.write_text("[]")
    with pytest.raises(ValueError): batch.export_questions("https://synthetic.supabase.co", "synthetic-key", "cloud-engineer", path, fetch=lambda _: bad)
    assert path.read_text() == "[]"


def test_batch_plan_uses_cert_objectives_and_separate_paths(monkeypatch, tmp_path):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    artifact, export, commands = batch.batch_commands("1.", "ace-pilot", "cloud-engineer", 4, 2, plan_only=True)
    assert artifact.name == "cloud-engineer-v5-ace-pilot.json"
    assert export.name == "cloud-engineer-v5-ace-pilot.existing.json"
    assert len(commands) == 1 and "--plan-only" in commands[0]
    assert "--existing-questions" not in commands[0]
    assert "--cert" in commands[0] and "cloud-engineer" in commands[0]
    assert all(value.startswith("cloud-engineer:standard:1.") for i, value in enumerate(commands[0]) if commands[0][i - 1] == "--objective")
    with pytest.raises(ValueError): batch.batch_commands("5.", "bad", "cloud-engineer", 4, 2)
    with pytest.raises(ValueError): batch.batch_commands("1.", "../escape", "cloud-engineer", 4, 2)


def test_runner_stops_after_failed_generation(monkeypatch, tmp_path):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    monkeypatch.setenv("SUPABASE_URL", "https://synthetic.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-key")
    monkeypatch.setattr(batch, "export_questions", lambda *a: 0)
    run = Mock(side_effect=batch.subprocess.CalledProcessError(1, ["synthetic"]))
    monkeypatch.setattr(batch.subprocess, "run", run)
    result = CliRunner().invoke(batch.main, ["1.", "pilot", "cloud-engineer"])
    assert result.exit_code == 1
    assert run.call_count == 1
    assert "synthetic-key" not in result.output


def test_ace_stage_token_metadata_and_unknown_counts(tmp_path):
    path = tmp_path / "cloud-engineer.calls.jsonl"
    for stage in ("plan", "verify", "write", "cite"):
        with call_context(stage=stage, candidate_id="ace-synthetic", index=1, attempt=1, calls_path=path):
            with model_call("fixture") as usage:
                usage["input_tokens"] = 13
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    assert [r["stage"] for r in rows] == ["plan", "verify", "write", "cite"]
    assert all(r["input_tokens"] == 13 and r["output_tokens"] is None for r in rows)
    assert all(r["candidate_id"] == "ace-synthetic" and r["ok"] for r in rows)


@pytest.mark.parametrize("cert", ["cloud-engineer", "cloud-architect", "data-engineer"])
def test_real_style_gate_does_not_waive_product_knowledge_for_new_certs(cert):
    from shared.gates import evaluate_gate
    fixture = json.loads((Path(__file__).parent / "fixtures/ml-practice-b18.json").read_text())["candidates"][0]
    raw = deepcopy(fixture["style"])
    objective = next(iter(load_cert_context(cert)["domains"].values()))["objectives"][0]["objective_id"]
    # Synthetic PDE-only checks do not rewrite the historical recorded fixture.
    selected = {**raw, "inference_required": True, "options_no_goal_restatement": True,
                "distractors_no_generic_filler": True} if cert == "data-engineer" else raw
    assert not evaluate_gate("style", selected, {}, style_policy=style_policy(objective))[0]
    assert evaluate_gate("style", raw, {}, style_policy=style_policy("machine-learning-engineer:standard:5.1:1"))[0]


@pytest.mark.parametrize("url", ["https://evil.test", "https://user@synthetic.supabase.co", "https://synthetic.supabase.co/path", "https://synthetic.supabase.co?x=1", "http://synthetic.supabase.co", "https://synthetic.supabase.co:443"])
def test_export_refuses_non_project_origins_before_fetch(tmp_path, url):
    fetch = Mock()
    with pytest.raises(ValueError):
        batch.export_questions(url, "synthetic-key", "cloud-engineer", tmp_path / "bank.json", fetch=fetch)
    fetch.assert_not_called()


@pytest.mark.parametrize("suffix", [".json", ".existing.json", ".judge-requests", ".verdicts", ".accepted-ids", ".json.calls.jsonl"])
def test_runner_refuses_every_prior_sidecar(monkeypatch, tmp_path, suffix):
    monkeypatch.setattr(batch, "PIPELINE", tmp_path)
    base = tmp_path / ".cache/generation/cloud-engineer-v5-pilot"
    base.parent.mkdir(parents=True)
    Path(str(base) + suffix).touch()
    with pytest.raises(ValueError):
        batch.batch_commands("1.", "pilot", "cloud-engineer", 4, 2)


def test_cert_prompt_selection_keeps_frozen_pmle_signatures():
    from shared.gates import GATE_SIGNATURES, gate_signatures
    from shared.question_style import practitioner_signature, practitioner_text, STYLE_INSTRUCTIONS
    from shared.llm_generator import PmleQuestionSignature
    assert gate_signatures(cert_id="machine-learning-engineer")["style"] is GATE_SIGNATURES["style"]
    assert practitioner_signature(PmleQuestionSignature, "machine-learning-engineer") is PmleQuestionSignature
    assert practitioner_text(STYLE_INSTRUCTIONS, "machine-learning-engineer") == STYLE_INSTRUCTIONS
    for cert in ("cloud-engineer", "cloud-architect", "data-engineer"):
        selected = practitioner_signature(PmleQuestionSignature, cert)
        assert "Ask what the practitioner should do" in selected.instructions
        assert selected.instructions != PmleQuestionSignature.instructions
        signatures = gate_signatures(cert_id=cert)
        assert "The practitioner must" in signatures["style"].instructions
        from shared.cli_models import output_model
        assert output_model(signatures["style"]).model_json_schema() == output_model(GATE_SIGNATURES["style"]).model_json_schema()
