"""Offline zero-cost arm: exact frozen rules, train-only plans, native CLI."""
import hashlib
import json
import re

import pytest

from scripts.optimize.zero_cost import build_zero_cost_pack, main
from shared import cli_models, llm_generator
from shared.decision_planner import planning_prompt
from shared.plan_components import frozen_decision_rules
from shared.prompt_pack import use_prompt_pack, load_pack, validate_pack
from shared.question_style import STYLE_RULES
from test_optimize_exemplars_v2 import splits


def exact_rule(name):
    # Slice directly from frozen source text; include all O5 batch-target lines.
    start = STYLE_RULES.index(name + " ")
    tail = STYLE_RULES[start:]
    end = re.search(r"\n(?:[SO]\d+ [A-Z]|Rules v)", tail)
    return tail[:end.start() if end else len(tail)].rstrip("\n")


def test_verbatim_rules_and_compact_exemplars_only_no_calls(monkeypatch):
    def blocked(*args, **kwargs):
        pytest.fail("Zero-cost pack generation must not call a model")
    monkeypatch.setattr(cli_models, "run_signature", blocked)
    monkeypatch.setattr(llm_generator, "_generation_lm", blocked)
    pack = build_zero_cost_pack(splits(), cert_id="machine-learning-engineer", domains=["D1"])
    entry = pack["writers"][0]
    assert entry["frozen_rubric"] == frozen_decision_rules()
    for name in ("O3", "O5", "O6"):
        assert exact_rule(name) in entry["frozen_rubric"]
    assert "Batch targets: median shared leading words" in entry["frozen_rubric"]
    assert entry["demos"] == []
    assert len(entry["exemplars"]) == 3
    scope = {"domain_code": "D1", "cert_id": "machine-learning-engineer", "objective_id": "dev",
             "domain_prompt": "Scope", "doccheck_policy": "v6"}
    with use_prompt_pack(pack):
        sig, _ = planning_prompt(scope)
    assert entry["frozen_rubric"] in sig.instructions
    assert "Accepted same-domain plans" in sig.instructions
    assert "LARGE DOCUMENT" not in sig.instructions
    assert "LARGE SOURCE" not in sig.instructions
    mutated = json.loads(json.dumps(pack))
    mutated["writers"][0]["frozen_rubric"] += " Changed"
    with pytest.raises(ValueError, match="verbatim"):
        validate_pack(mutated)


def test_native_offline_cli_manifest_and_no_overwrite(tmp_path, capsys):
    data = splits()
    files = {}
    for split, rows in data.items():
        path = tmp_path / f"draft.{split}.json"
        raw = json.dumps(rows).encode()
        path.write_bytes(raw)
        files[path.name] = hashlib.sha256(raw).hexdigest()
    (tmp_path / "manifest.json").write_text(json.dumps({"files": files,
        "splits": {k: sorted({r["objective_id"] for r in v}) for k, v in data.items()}}))
    output = tmp_path / "pack.json"
    args = ["--dataset-dir", str(tmp_path), "--output", str(output), "--cert-id", "machine-learning-engineer", "--domain", "D1"]
    assert main(args) == 0
    assert json.loads(capsys.readouterr().out)["model_calls"] == 0
    pack = load_pack(output)
    assert pack["policy"]["dataset_manifest_sha256"] == hashlib.sha256((tmp_path / "manifest.json").read_bytes()).hexdigest()
    with pytest.raises(SystemExit):
        main(args)
    assert load_pack(output) == pack


def test_missing_accepted_exemplars_fail_closed():
    with pytest.raises(ValueError, match="No accepted"):
        build_zero_cost_pack(splits(), cert_id="unknown")
    with pytest.raises(ValueError, match="No accepted"):
        build_zero_cost_pack(splits(), cert_id="machine-learning-engineer", domains=["missing"])
