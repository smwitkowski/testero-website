"""Offline contract tests for the telemetry-only baseline overlay."""
import importlib.util
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/baseline_telemetry.py"
spec = importlib.util.spec_from_file_location("baseline_overlay", SCRIPT)
overlay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(overlay)
MANIFEST = json.loads(SCRIPT.with_name("baseline_telemetry_manifest.json").read_text())


def test_manifest_is_compact_and_compilable():
    assert len(MANIFEST["files"]) == 7
    for row in MANIFEST["files"]:
        assert set(row) == {"path", "sha256", "hunks"}
        assert len(row["sha256"]) == 64
        assert row["hunks"]
        assert all(h["start"] <= h["end"] for h in row["hunks"])
    compile(MANIFEST["helper"], "call_logging.py", "exec")


def test_transform_exact_hunks_and_drift(tmp_path, monkeypatch):
    import hashlib
    original = "a = 1\nb = 2\nc = 3\n"
    fixture = {"files": [{"path": "shared/example.py",
        "sha256": hashlib.sha256(original.encode()).hexdigest(),
        "hunks": [{"start": 0, "end": 1, "new": "a = 10\n"},
                  {"start": 2, "end": 3, "new": "c = 30\nd = 4\n"}]}],
        "helper": MANIFEST["helper"]}
    fake_script = tmp_path / "script.py"
    fake_script.with_name("baseline_telemetry_manifest.json").write_text(json.dumps(fixture))
    monkeypatch.setattr(overlay, "__file__", str(fake_script))
    source = tmp_path / "checkout/content-pipeline/shared/example.py"
    source.parent.mkdir(parents=True)
    source.write_text(original)
    updates = overlay.transform(tmp_path / "checkout", tmp_path / "calls.jsonl")
    assert updates[source] == "a = 10\nb = 2\nc = 30\nd = 4\n"
    assert source.read_text() == original
    source.write_text("a = 9\n")
    with pytest.raises(ValueError, match="Baseline source drift"):
        overlay.transform(tmp_path / "checkout", tmp_path / "calls.jsonl")


def test_worker_contexts_native_usage_and_restoration(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    ns = {}
    exec(MANIFEST["helper"], ns)
    sink = tmp_path / "calls.jsonl"
    ns["BASELINE_CALLS_PATH"] = str(sink)
    # The decorator obtains main's unchanged deterministic identity function.
    namespace = {"candidate_id": lambda index, scope, question: f"candidate-{index}",
                 "worker_decorator": ns["baseline_worker"], "call_context": ns["call_context"],
                 "model_call": ns["model_call"]}
    exec("@worker_decorator('generate')\ndef worker(item):\n"
         "    with call_context(stage='write', attempt=2):\n"
         "        with model_call('fake') as usage: usage['input_tokens'] = 3\n", namespace)
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(namespace["worker"], [(1, {}), (2, {})]))
    rows = [json.loads(line) for line in sink.read_text().splitlines()]
    assert {(r["candidate_id"], r["index"], r["attempt"], r["stage"]) for r in rows} == {
        ("candidate-1", 1, 2, "write"), ("candidate-2", 2, 2, "write")}

    @ns["baseline_worker"]("judge_requests", {"abc.json": 4})
    def runner(path):
        with ns["call_context"](attempt=1):
            with ns["model_call"]("fake"):
                pass
    runner(Path("abc.json"))
    row = json.loads(sink.read_text().splitlines()[-1])
    assert (row["candidate_id"], row["index"], row["attempt"]) == ("abc", 4, 1)

    class LM:
        def _check_truncation(self, response):
            pass
        def forward(self):
            self._check_truncation({"usage": {"prompt_tokens": 7, "completion_tokens": 2}})
            return "unchanged"
    lm = LM()
    with ns["call_context"](stage="judge.evidence", calls_path=sink):
        with ns["log_lm_calls"](lm, "fake"):
            assert lm.forward() == "unchanged"
    row = json.loads(sink.read_text().splitlines()[-1])
    assert (row["input_tokens"], row["output_tokens"]) == (7, 2)
    assert "forward" not in lm.__dict__
    assert "_check_truncation" not in lm.__dict__


def test_codex_documented_reasoning_usage():
    ns = {}
    exec(MANIFEST["helper"], ns)
    fields = ns["cli_usage"](json.dumps({"type": "turn.completed", "usage": {
        "input_tokens": 10, "cached_input_tokens": 3, "output_tokens": 4,
        "reasoning_output_tokens": 2}}), provider="codex")
    assert fields["reasoning_tokens"] == 2
    assert fields["input_tokens"] == 10
    assert fields["cached_input_tokens"] == 3
    assert ns["usage_fields"]({}, provider="codex")["reasoning_tokens"] is None
