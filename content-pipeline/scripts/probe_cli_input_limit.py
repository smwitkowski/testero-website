"""Opt-in offline Codex preflight probe; only a loopback fixture receives requests.

No model is called. HOME/CODEX_HOME and the environment are isolated, and the
fixture returns a canned schema-valid response. Run from content-pipeline with
`uv run python scripts/probe_cli_input_limit.py [--artifact /absolute/file.json]`.
"""
from __future__ import annotations

import argparse
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import tempfile
from threading import Thread
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shared import cli_models as cli
from shared.decision_planner import DecisionProofSignature, verification_prompt


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", type=Path, help="Read-only saved generation artifact")
    args = parser.parse_args()
    if args.artifact:
        artifact = json.loads(args.artifact.read_text(encoding="utf-8"))
        candidate = artifact["candidates"][0]
        signature, inputs = verification_prompt(
            artifact["plan"][0], candidate["decision_attempts"][0]["plan"],
            candidate["sources"], stable_prefix=True)
        prompt = cli.signature_prompt(signature, inputs)
    else:
        signature = DecisionProofSignature
        prompt = "Offline fixture task data: " + "x" * cli.CODEX_MAX_PROMPT_CHARS
    expected = {"supported": False, "uniquely_best": False,
                "scenario_reasons_supported": False, "no_feature_gotchas": False,
                "reason": "Offline fixture only; not a model judgment", "reasons": []}
    schema = cli.output_model(signature).model_json_schema()
    calls = []

    class Fixture(BaseHTTPRequestHandler):
        def log_message(self, *unused):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            texts = [(item.get("role"), part.get("text", ""))
                     for item in body.get("input", []) if isinstance(item, dict)
                     for part in item.get("content", []) if isinstance(part, dict)]
            matches = [{"role": role, "chars": len(text), "sha256": digest(text)}
                       for role, text in texts if text == prompt]
            calls.append({"path": self.path, "model": body.get("model"),
                          "reasoning": body.get("reasoning"), "full_prompt_matches": matches,
                          "schema_matches": body.get("text", {}).get("format", {}).get("schema")
                          == cli._codex_response_schema(schema)})
            item = {"id": "msg_offline", "type": "message", "role": "assistant",
                    "status": "completed", "content": [{"type": "output_text",
                    "text": json.dumps(expected), "annotations": []}]}
            events = [
                {"type": "response.output_item.done", "output_index": 0, "item": item},
                {"type": "response.completed", "response": {"id": "resp_offline",
                 "status": "completed", "output": [item]}},
            ]
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for event in events:
                self.wfile.write(("data: " + json.dumps(event) + "\n\n").encode())
            self.wfile.flush()

    cli.CLI_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    results = []
    with tempfile.TemporaryDirectory(prefix="offline-probe-", dir=cli.CLI_TEMP_ROOT) as directory:
        home = Path(directory)
        (home / ".codex").mkdir()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Fixture)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        port = server.server_address[1]
        real_run = cli.subprocess.run
        mode = ""
        captured = {}

        def run_offline(command, **kwargs):
            # Baseline deliberately disables ONLY our new file path, not Codex's guard.
            if mode == "oversized_stdin":
                command = list(command)
                index = next((i for i, value in enumerate(command)
                              if value.startswith("model_instructions_file=")), None)
                if index is not None:
                    del command[index - 1:index + 1]
                kwargs["input"] = prompt
            command += [
                "-c", 'model_provider="offline"',
                "-c", 'model_providers.offline.name="Offline fixture"',
                "-c", f'model_providers.offline.base_url="http://127.0.0.1:{port}/v1"',
                "-c", 'model_providers.offline.wire_api="responses"',
                "-c", "model_providers.offline.requires_openai_auth=false",
                "-c", "model_providers.offline.request_max_retries=0",
                "-c", "model_providers.offline.stream_max_retries=0",
                "-c", "analytics.enabled=false", "-c", "feedback.enabled=false",
                "-c", "check_for_update_on_startup=false",
                "-c", "features.daemon_auto_start=false",
            ]
            kwargs["env"] = {"PATH": os.environ["PATH"], "HOME": str(home),
                             "CODEX_HOME": str(home / ".codex"), "PYTHON_DOTENV_DISABLED": "1"}
            result = real_run(command, **kwargs)
            captured.update(returncode=result.returncode,
                            stderr_tail=cli._redacted_stderr_tail(result.stderr, prompt))
            return result

        try:
            with patch.object(cli.subprocess, "run", run_offline):
                for mode in ("small_stdin", "oversized_stdin", "oversized_auto"):
                    calls.clear()
                    captured.clear()
                    task = "Offline small control" if mode == "small_stdin" else prompt
                    row = {"mode": mode, "prompt_chars": len(task),
                           "prompt_utf8_bytes": len(task.encode()), "prompt_sha256": digest(task)}
                    try:
                        output = cli._run_cli("codex", task, schema, signature,
                                              timeout=30, reasoning_effort="medium")
                        row["fixture_output_valid"] = output == expected
                    except cli.CLIModelError as error:
                        row.update(error_class=type(error).__name__, error_message=str(error))
                    row.update(captured, provider_requests=list(calls))
                    results.append(row)
        finally:
            server.shutdown()
            server.server_close()
            worker.join()
    print(json.dumps({"offline_fixture_only": True, "results": results}, indent=2))
    small, rejected, fixed = results
    assert small.get("fixture_output_valid") is True and len(small["provider_requests"]) == 1
    assert rejected.get("error_class") == "CLIExitError" and not rejected["provider_requests"]
    assert "maximum length" in rejected["stderr_tail"]
    assert fixed.get("fixture_output_valid") is True and len(fixed["provider_requests"]) == 1
    request = fixed["provider_requests"][0]
    assert len(request["full_prompt_matches"]) == 1
    match = request["full_prompt_matches"][0]
    assert match["role"] in ("developer", "system")
    assert match["chars"] == len(prompt) and match["sha256"] == digest(prompt)
    assert request["schema_matches"] is True
    assert request["model"] == cli.DEFAULT_CODEX_MODEL
    assert request["reasoning"]["effort"] == "medium"
    assert fixed["returncode"] == 0


if __name__ == "__main__":
    main()
