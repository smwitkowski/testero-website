"""Offline writer-pack schema, scope, frozen judges and fake-transport parity."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json

import dspy
import pytest
from click.testing import CliRunner

from shared import cli_models, decision_planner as decisions, llm_generator as generator
from shared.openrouter_writer import WriterChatAdapter, WriterJSONAdapter
from shared.prompt_pack import (PromptPackError, create_pack, load_pack, save_pack,
    validate_pack, pack_hash, signature_hash, use_prompt_pack, writer_signature, writer_demos)
from test_decision_first_v4 import pipeline
from test_openrouter_writer_parity import (MODEL, SCOPE, native, request, question,
    with_receipts, question_inputs, plan, proof, sources, markers)


def pack(base=generator.QuestionWithEvidenceSignature, **kwargs):
    return create_pack(stage="plan" if base is decisions.DecisionPlanSignature else "draft",
        signature=base, instructions="Optimized: ask what an ML engineer should do.",
        policy={"doccheck_policy": "v5"}, source_run="offline-test", scores={"dev": .75}, **kwargs)


def demo(base):
    if base is decisions.DecisionPlanSignature:
        return {"objective_scope": "Synthetic scope", "difficulty": "MEDIUM",
                "replacement_feedback": "", "existing_scenarios": "[]", "plan": plan()}
    if base is generator.CitationSignature:
        return {"finished_question": "Synthetic finished question", "fetched_sources": "Synthetic docs",
                "check_errors": "", "evidence": with_receipts()["evidence"]}
    output = with_receipts() if base is generator.QuestionWithEvidenceSignature else question()
    return {**question_inputs(), **output}


def test_roundtrip_hash_typed_demo_and_no_mutation(tmp_path):
    base = generator.QuestionWithEvidenceSignature
    original = base.instructions
    values = demo(base)
    value = pack(demos=[dspy.Example(**values).with_inputs(*base.input_fields)])
    path = tmp_path / "pack.json"
    assert save_pack(value, path) == value == load_pack(path)
    assert pack_hash(value) == pack_hash(load_pack(path))
    assert value["writers"][0]["base_signature_hash"] == signature_hash(base)
    with use_prompt_pack(value):
        assert writer_signature(base).instructions.startswith("Optimized:")
        assert writer_demos(base)[0].toDict() == values
        mutated = writer_demos(base)
        mutated[0].evidence[0]["quote"] = "Do not leak mutation"
        assert writer_demos(base)[0].evidence == values["evidence"]
    assert writer_signature(base) is base and writer_demos(base) == []
    assert base.instructions == original


@pytest.mark.parametrize("base", [decisions.DecisionPlanSignature, generator.PmleQuestionSignature,
    generator.QuestionWithEvidenceSignature, generator.CitationSignature])
def test_empty_or_no_pack_is_byte_identical(base):
    values = {name: "Synthetic input" for name in base.input_fields}
    before = cli_models.signature_prompt(base, values)
    assert before == ("Do not use tools, browse, read files, or execute commands. Use only the supplied data. "
        "Return only the structured output requested by the schema.\n\n" +
        "\n\n".join(f"{message['role'].upper()}:\n{message['content']}"
        for message in dspy.JSONAdapter().format(base, [], values)))
    empty = create_pack(stage="plan" if base is decisions.DecisionPlanSignature else "draft",
                        policy={}, source_run="identity", scores={})
    for value in [None, empty, create_pack(stage=empty["stage"], signature=base,
                         policy={}, source_run="identity-entry", scores={})]:
        with use_prompt_pack(value):
            assert writer_signature(base) is base
            assert writer_demos(base) == []
            assert cli_models.signature_prompt(writer_signature(base), values,
                        demos=writer_demos(base)) == before


@pytest.mark.parametrize("base", [decisions.DecisionProofSignature, decisions.ConsistentDecisionProofSignature,
    decisions.ConstraintDecisionProofSignature])
def test_proof_and_veto_targets_refused(base):
    with pytest.raises(PromptPackError, match="writer|judge"):
        create_pack(stage="plan", signature=base, policy={}, source_run="bad", scores={})
    bad = pack(decisions.DecisionPlanSignature)
    bad["writers"][0]["signature"] = base.__name__
    with pytest.raises(PromptPackError, match="writer|judge"):
        validate_pack(bad)
    with use_prompt_pack(pack()):
        with pytest.raises(PromptPackError):
            writer_signature(base)


def test_other_judges_and_forged_writer_identity_refused():
    from shared.gates import GATE_SIGNATURES
    for base in GATE_SIGNATURES.values():
        with pytest.raises(PromptPackError):
            create_pack(stage="draft", signature=base, policy={}, source_run="bad", scores={})
    forged = generator.PmleQuestionSignature.with_instructions("Changed untrusted base")
    forged.__name__ = "PmleQuestionSignature"
    with pytest.raises(PromptPackError, match="trusted"):
        signature_hash(forged)


@pytest.mark.parametrize("mutation", ["version", "extra", "stale", "duplicate", "stage", "blank", "typed", "nan"])
def test_bad_pack_refused(mutation):
    value = pack(demos=[demo(generator.QuestionWithEvidenceSignature)])
    entry = value["writers"][0]
    if mutation == "version": value["version"] = True
    elif mutation == "extra": value["judges"] = []
    elif mutation == "stale": entry["base_signature_hash"] = "0" * 64
    elif mutation == "duplicate": value["writers"].append(deepcopy(entry))
    elif mutation == "stage": value["stage"] = "plan"
    elif mutation == "blank": entry["instructions"] = " "
    elif mutation == "typed": entry["demos"][0]["evidence"][0]["quote"] = False
    else: value["policy"]["not_finite"] = float("nan")
    with pytest.raises(PromptPackError):
        validate_pack(value)


@pytest.mark.parametrize("text", ['{"version":1,"version":1}', '{"version":NaN}', 'not json'])
def test_load_refuses_duplicate_keys_and_nonfinite_json(tmp_path, text):
    path = tmp_path / "bad.json"
    path.write_text(text)
    with pytest.raises(PromptPackError): load_pack(path)


def test_context_scope_restores_and_does_not_cross_threads():
    base = generator.QuestionWithEvidenceSignature
    value = pack()
    with use_prompt_pack(value):
        with ThreadPoolExecutor(max_workers=1) as executor:
            assert executor.submit(writer_signature, base).result() is base
        with use_prompt_pack(None):
            assert writer_signature(base) is base
        assert writer_signature(base).instructions.startswith("Optimized:")
        with pytest.raises(RuntimeError):
            with use_prompt_pack(None):
                raise RuntimeError("reset even on error")
        assert writer_signature(base).instructions.startswith("Optimized:")
    assert writer_signature(base) is base


@pytest.mark.parametrize("protocol", ["json", "chat"])
@pytest.mark.parametrize("kind", ["plan", "draft", "question", "citation"])
def test_fake_transport_instructions_and_typed_demos_match_cli(monkeypatch, kind, protocol):
    base = {"plan": decisions.DecisionPlanSignature, "draft": generator.QuestionWithEvidenceSignature,
            "question": generator.PmleQuestionSignature, "citation": generator.CitationSignature}[kind]
    output = {"plan": plan()} if kind == "plan" else {"evidence": with_receipts()["evidence"]} if kind == "citation" else with_receipts() if kind == "draft" else question()
    monkeypatch.setenv("OPENROUTER_API_KEY", "offline-placeholder")
    monkeypatch.setenv("TESTERO_OPENROUTER_MODEL_PARAMETERS", json.dumps({MODEL: ["structured_outputs"]}) if protocol == "json" else "{}")
    # Citation repair intentionally retains its existing chat adapter even when
    # the model advertises native JSON. Pack application must not change it.
    json_protocol = protocol == "json" and kind != "citation"
    completion = json.dumps(output) if json_protocol else markers(output)
    transport, _, _ = native(monkeypatch, completion)
    cli_prompts = []
    def fake_cli(model, prompt, schema, signature, **kwargs):
        cli_prompts.append(prompt)
        return deepcopy(output)
    monkeypatch.setattr(cli_models, "_run_cli", fake_cli)
    value = pack(base, demos=[demo(base)])
    with use_prompt_pack(value), dspy.context(disable_history=True):
        if kind == "plan":
            decisions.plan_decision(SCOPE, model="codex", stable_prefix=True)
            decisions.plan_decision(SCOPE, model=MODEL, stable_prefix=True)
            signature, inputs = decisions.planning_prompt(SCOPE, stable_prefix=True)
        elif kind in ("draft", "question"):
            # Question-only chat historically adds CoT; avoid changing that path.
            if kind == "question" and protocol == "chat":
                transport.return_value.choices[0].message.content = markers({"reasoning": "Synthetic", **output})
            generator.generate_question("Scope", "Docs", "codex", include_evidence=kind == "draft")
            generator.generate_question("Scope", "Docs", MODEL, include_evidence=kind == "draft")
            signature = writer_signature(base)
            inputs = {**question_inputs(), "domain_context": "Scope", "documentation_context": "Docs"}
        else:
            generator.cite_question(question(), sources(), "codex")
            generator.cite_question(question(), sources(), MODEL)
            signature = writer_signature(base)
            inputs = {"finished_question": json.dumps({"stem": question()["stem"], "options": [
                {"option_label": label, "option": question()[answer], "rationale": question()[explanation]}
                for label, answer, explanation in [("A", "correct_answer", "correct_explanation"),
                    ("B", "distractor_1", "distractor_1_explanation"), ("C", "distractor_2", "distractor_2_explanation"),
                    ("D", "distractor_3", "distractor_3_explanation")]]}, ensure_ascii=False),
                "fetched_sources": generator.build_documentation_context(sources(), max_chars=generator.DEFAULT_DOC_CONTEXT_CHARS, receipts=[])["context"], "check_errors": ""}
        demos = writer_demos(base)
        assert cli_prompts == [cli_models.signature_prompt(signature, inputs, demos=demos)]
        native_messages = request(transport)["messages"]
        adapter = WriterJSONAdapter() if json_protocol else WriterChatAdapter()
        native_signature = (dspy.ChainOfThought(signature).predict.signature
            if kind == "question" and protocol == "chat" else signature)
        assert native_messages == adapter.format(native_signature, demos, inputs)
        assert len(native_messages) == 4  # system + demo user/assistant + current user
        assert value["writers"][0]["instructions"] in native_messages[0]["content"]
        # The same complete demonstrations are present in both transports.
        for name in base.output_fields:
            assert name in cli_prompts[0] and name in str(native_messages)
    assert transport.call_count == 1


def test_dynamic_practitioner_order_and_v6_policy_are_retained():
    value = pack(decisions.DecisionPlanSignature, demos=[demo(decisions.DecisionPlanSignature)])
    scope = {**SCOPE, "cert_id": "data-engineer", "doccheck_policy": "v6"}
    before = decisions.DecisionPlanSignature.instructions
    with use_prompt_pack(value):
        selected, _ = decisions.planning_prompt(scope, stable_prefix=True)
        assert "the practitioner" in selected.instructions
        assert "an ML engineer" not in selected.instructions
        assert "documented POSITIVE fact" in selected.instructions
        assert list(selected.input_fields) == ["objective_scope", "difficulty", "existing_scenarios", "replacement_feedback"]
        assert writer_demos(decisions.DecisionPlanSignature)[0].plan == plan()
    assert decisions.DecisionPlanSignature.instructions == before


@pytest.mark.parametrize("model", ["codex", MODEL])
def test_active_pack_does_not_change_proof_transport(monkeypatch, model):
    baseline = []
    def fake_cli(model, signature, inputs, **kwargs):
        baseline.append((signature.instructions, kwargs.get("demos")))
        return proof()
    def fake_writer(signature, inputs, model, **kwargs):
        baseline.append((signature.instructions, kwargs.get("demos")))
        return proof()
    monkeypatch.setattr(cli_models, "run_signature", fake_cli)
    monkeypatch.setattr(generator, "_predict_writer", fake_writer)
    decisions.verify_decision(SCOPE, plan(), sources(), model=model)
    with use_prompt_pack(pack(decisions.DecisionPlanSignature)):
        decisions.verify_decision(SCOPE, plan(), sources(), model=model)
    assert baseline[0] == baseline[1] and baseline[0][1] is None


def test_generator_flag_loads_pack_offline_and_refuses_policy_mismatch(monkeypatch, tmp_path):
    from scripts import generate_pmle_questions as generate
    monkeypatch.setattr(generate, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(generate, "database_client", lambda: pytest.fail("No DB calls"))
    value = pack()
    path = tmp_path / "pack.json"
    save_pack(value, path)
    arguments = ["--model", "codex", "--judge-model", "external", "--plan-only", "--n-questions", "1", "--prompt-pack", str(path), "--artifact", str(tmp_path / "plan.json")]
    result = CliRunner().invoke(generate.main, arguments)
    assert result.exit_code == 0, result.output
    payload = json.loads((tmp_path / "plan.json").read_text())
    assert payload["prompt_pack"]["sha256"] == pack_hash(value)
    result = CliRunner().invoke(generate.main, [*arguments, "--doccheck-policy", "v6"])
    assert result.exit_code != 0 and "policy differs" in result.output


@pytest.mark.parametrize("stage", ["plan", "draft"])
def test_generator_worker_pack_scope_excludes_proof_and_restores_next_run(pipeline, monkeypatch, stage):
    from scripts import generate_pmle_questions as generate
    events, path, invoke = pipeline
    base = decisions.DecisionPlanSignature if stage == "plan" else generator.QuestionWithEvidenceSignature
    value = pack(base)
    pack_path = path / "pack.json"
    save_pack(value, pack_path)
    observed = []
    def observe(name, function):
        def wrapped(*args, **kwargs):
            observed.append((name, writer_signature(decisions.DecisionPlanSignature).instructions,
                writer_signature(generator.QuestionWithEvidenceSignature).instructions))
            return function(*args, **kwargs)
        return wrapped
    for name, field in [("plan", "plan_decision"), ("draft", "generate_question"), ("proof", "verify_decision")]:
        monkeypatch.setattr(generate, field, observe(name, getattr(generate, field)))
    result = invoke("--prompt-pack", str(pack_path))
    assert result.exit_code == 0, result.output
    plan_row, proof_row, draft_row = observed
    assert [row[0] for row in observed] == ["plan", "proof", "draft"]
    original_plan = decisions.DecisionPlanSignature.instructions
    original_draft = generator.QuestionWithEvidenceSignature.instructions
    optimized = value["writers"][0]["instructions"]
    assert plan_row[1] == (optimized if stage == "plan" else original_plan)
    assert draft_row[2] == (optimized if stage == "draft" else original_draft)
    assert proof_row[1:] == (original_plan, original_draft)
    observed.clear()
    result = invoke("--artifact", str(path / "baseline.json"))
    assert result.exit_code == 0, result.output
    assert all(row[1:] == (original_plan, original_draft) for row in observed)
    assert "prompt_pack" not in json.loads((path / "baseline.json").read_text())
