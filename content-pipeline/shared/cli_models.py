"""Subscription CLI transports for DSPy signatures; strict JSON, no marker parser."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any

import dspy
from pydantic import ConfigDict, Field, ValidationError, create_model

from shared.evidence import OptionEvidence
from shared.model_policy import DEFAULT_CLAUDE_MODEL

CLI_TIMEOUT_SECONDS = 300
DEFAULT_CODEX_MODEL = "gpt-6.1-sol"
# CLI 0.160.0: read-only alone still permits file reads. Disable tool backends
# and ambient context; the model receives only the DSPy prompt on stdin.
CODEX_DISABLED_FEATURES = (
    "shell_tool", "unified_exec", "shell_snapshot", "code_mode", "code_mode_host",
    "multi_agent", "multi_agent_v2", "apps", "plugins", "hooks", "memories",
    "browser_use", "browser_use_external", "computer_use", "view_image", "image_generation",
)
CLI_TEMP_ROOT = Path(__file__).resolve().parents[1] / ".cache/cli-models"


class CLIModelError(RuntimeError):
    """Safe interface error; never includes CLI logs or credentials."""


class CLIExitError(CLIModelError):
    """CLI failed or could not start."""


class CLIAuthError(CLIExitError):
    """CLI subscription authentication is missing, invalid or expired."""


class CodexModelRejectedError(CLIExitError):
    """The requested Codex model is unsupported; never retry another model silently."""


class CLIUsageLimitError(CLIModelError):
    """Subscription usage or rate limit; caller must stop the batch."""


class CLITimeoutError(CLIModelError):
    """CLI exceeded the bounded execution time."""


class CLISchemaError(CLIModelError):
    """Missing, malformed or mistyped structured output."""


class StrictOptionEvidence(OptionEvidence):
    model_config = ConfigDict(strict=True, extra="forbid")


def output_model(signature):
    """Derive the strict output schema from the existing DSPy signature."""
    fields = {}
    for name, field in signature.output_fields.items():
        annotation = list[StrictOptionEvidence] if name == "evidence" else field.annotation
        description = field.description or (field.json_schema_extra or {}).get("desc", "")
        fields[name] = (annotation, Field(description=description))
    return create_model(signature.__name__ + "CLIOutput", __config__=ConfigDict(strict=True, extra="forbid"), **fields)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _load_json(text):
    return json.loads(text, object_pairs_hook=_unique_object,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def parse_output(text, signature):
    """Validate the exact schema; no coercion, marker recovery or missing checks."""
    try:
        data = _load_json(text)
        return output_model(signature).model_validate(data).model_dump()
    except (ValueError, TypeError, ValidationError, RecursionError):
        raise CLISchemaError("CLI structured output does not match the schema") from None


def signature_prompt(signature, inputs):
    """Use DSPy's JSON adapter instructions and field descriptions for both CLIs."""
    messages = dspy.JSONAdapter().format(signature, [], inputs)
    return ("Do not use tools, browse, read files, or execute commands. Use only the supplied data. "
            "Return only the structured output requested by the schema.\n\n" +
            "\n\n".join(f"{message['role'].upper()}:\n{message['content']}" for message in messages))


_LIMIT = re.compile(r"usage_limit_reached|rate_limit_exceeded|rate_limit_error|you(?:'|’)?ve hit your (?:usage )?limit|"
                    r"you have (?:hit|exceeded) your (?:usage |rate )?limit|"
                    r"(?:usage|rate) limit (?:reached|exceeded)|too many requests", re.I)


def _limit(text):
    return bool(_LIMIT.search(text or ""))


_AUTH = re.compile(r"failed to authenticate|authentication_error|invalid_api_key|"
                   r"not logged in|oauth[^\n]{0,100}(?:expired|invalid)|"
                   r"invalid (?:bearer|authentication) token|unauthorized|\b401\b", re.I)


def _auth(text):
    return bool(_AUTH.search(text or ""))



_MODEL_REJECTION = re.compile(
    r"not supported when using Codex with a ChatGPT account|"
    r"model[^\n]{0,200}(?:not supported|unsupported|not available|not found)|"
    r"(?:unsupported|unknown|invalid) model|model_not_found", re.I,
)


def _codex_model_rejection(model, text):
    if not _MODEL_REJECTION.search(text or ""):
        return None
    rejected = DEFAULT_CODEX_MODEL if model == "codex" else model.removeprefix("codex/")
    # Read model names only. Never copy account identity or auth/config metadata.
    path = Path.home() / ".codex/models_cache.json"
    choices = []
    try:
        cache = json.loads(path.read_text())
        records = cache.get("models", []) if isinstance(cache, dict) else []
        choices = list(dict.fromkeys(
            record["slug"] for record in records if isinstance(record, dict)
            and record.get("visibility") == "list" and isinstance(record.get("slug"), str)
            and re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", record["slug"])
            and record["slug"] != rejected
        ))
    except (OSError, UnicodeError, ValueError, TypeError):
        pass
    # A stale cache is a suggestion, never an automatic fallback or proof of access.
    safe_name = rejected if re.fullmatch(r"[a-zA-Z0-9_.-]{1,80}", rejected) else "requested model"
    reason = f"Codex rejected model {safe_name}; no fallback was attempted."
    reason += (" Cached model choices (availability may vary): " + ", ".join(choices)
               if choices else " Allowed model list is unavailable; refresh Codex models_cache.json.")
    return CodexModelRejectedError(reason)


def parse_claude_output(text, signature):
    """Read Claude Code's structured_output, never its free-text result as a verdict."""
    try:
        envelope = _load_json(text)
        if not isinstance(envelope, dict):
            raise ValueError("Invalid envelope")
    except (ValueError, TypeError, RecursionError):
        raise CLISchemaError("Claude CLI returned an invalid JSON envelope") from None
    if envelope.get("is_error") is True or (isinstance(envelope.get("subtype"), str) and envelope["subtype"] != "success"):
        error_text = json.dumps({key: envelope.get(key) for key in ("result", "errors", "subtype")})
        if _limit(error_text):
            raise CLIUsageLimitError("Claude subscription usage or rate limit reached; batch stopped")
        if _auth(error_text):
            raise CLIAuthError("Claude subscription authentication failed; restore CLI login")
        raise CLIExitError("Claude CLI reported a failed request")
    if envelope.get("is_error") is not False or envelope.get("subtype") != "success":
        raise CLISchemaError("Claude CLI returned mistyped or missing success flags")
    if envelope.get("type") != "result":
        raise CLISchemaError("Claude CLI did not return a result envelope")
    if "structured_output" not in envelope:
        if _limit(str(envelope.get("result", ""))):
            raise CLIUsageLimitError("Claude subscription usage or rate limit reached; batch stopped")
        if _auth(str(envelope.get("result", ""))):
            raise CLIAuthError("Claude subscription authentication failed; restore CLI login")
        raise CLISchemaError("Claude CLI omitted structured_output")
    return parse_output(json.dumps(envelope["structured_output"], allow_nan=False), signature)


def _cli_env():
    env = dict(os.environ)
    # Use the CLI login/subscription, not inherited pay-per-token API keys.
    for name in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY", "CODEX_API_KEY",
                 "OPENROUTER_API_KEY", "EXA_API_KEY", "SUPABASE_SERVICE_ROLE_KEY",
                 "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY",
                 "ANTHROPIC_BASE_URL", "OPENAI_BASE_URL"):
        env.pop(name, None)
    env["PYTHON_DOTENV_DISABLED"] = "1"
    return env


def run_signature(model: str, signature, inputs: dict[str, Any], *, timeout=CLI_TIMEOUT_SECONDS):
    """Run one DSPy signature through the shared bounded subscription transport."""
    return _run_cli(model, signature_prompt(signature, inputs),
                    output_model(signature).model_json_schema(), signature, timeout=timeout)


def run_claude_request(model: str, prompt: str, schema: dict, *, timeout=CLI_TIMEOUT_SECONDS):
    """Judge an exported request verbatim with the existing Claude transport.

    Raises:
        ValueError: The model is not a Claude CLI selector.
        CLIAuthError: Subscription authentication failed.
        CLIExitError: The command cannot start or reports failure.
        CLIUsageLimitError: A subscription usage or rate limit stops the batch.
        CLITimeoutError: The command exceeds the timeout.
        CLISchemaError: The request or structured output differs from the full rubric schema.
    """
    from shared.quality_gate import QuestionQualitySignature
    if not isinstance(model, str) or not (model == "claude" or model.startswith("claude/")):
        raise ValueError("Exported requests require a Claude CLI model")
    if not isinstance(prompt, str) or not prompt.strip():
        raise CLISchemaError("Exported judge prompt is missing")
    if schema != output_model(QuestionQualitySignature).model_json_schema():
        raise CLISchemaError("Exported judge schema differs from the full current rubric")
    return _run_cli(model, prompt, schema, QuestionQualitySignature, timeout=timeout)


def _run_cli(model, prompt, schema, signature, *, timeout):
    """Use one transport for both DSPy signatures and frozen external requests."""
    codex = model == "codex" or model.startswith("codex/")
    claude = model == "claude" or model.startswith("claude/")
    if not codex and not claude:
        raise ValueError("Not a subscription CLI model")
    CLI_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="request-", dir=CLI_TEMP_ROOT) as directory:
        base = Path(directory)
        cwd = base / "empty"
        cwd.mkdir()
        output = base / "output.json"
        if codex:
            schema_path = base / "schema.json"
            schema_path.write_text(json.dumps(schema))
            command = ["codex", "exec", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only",
                       "--output-schema", str(schema_path), "-o", str(output)]
            command += ["--ignore-user-config", "--ignore-rules", "-m",
                        DEFAULT_CODEX_MODEL if model == "codex" else model.removeprefix("codex/"),
                        "-c", 'model_reasoning_effort="high"', "-c", "project_doc_max_bytes=0",
                        "-c", 'web_search="disabled"']
            for feature in CODEX_DISABLED_FEATURES:
                command += ["--disable", feature]
        else:
            command = [str(Path.home() / ".local/bin/claude"), "-p", "--model",
                       DEFAULT_CLAUDE_MODEL if model == "claude" else model.removeprefix("claude/"),
                       "--output-format", "json", "--json-schema", json.dumps(schema),
                       "--tools", "", "--no-session-persistence", "--safe-mode",
                       "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}']
        try:
            result = subprocess.run(command, input=prompt, text=True, capture_output=True,
                                    cwd=cwd, env=_cli_env(), timeout=timeout, check=False)
        except subprocess.TimeoutExpired:
            raise CLITimeoutError("CLI model request timed out") from None
        except OSError:
            raise CLIExitError("CLI model command could not start") from None
        if result.returncode != 0:
            if codex:
                rejection = _codex_model_rejection(model, result.stdout + "\n" + result.stderr)
                if rejection:
                    raise rejection
            if _limit(result.stdout + "\n" + result.stderr):
                raise CLIUsageLimitError("CLI subscription usage or rate limit reached; batch stopped")
            if _auth(result.stdout + "\n" + result.stderr):
                raise CLIAuthError("CLI subscription authentication failed; restore CLI login")
            raise CLIExitError(f"CLI model command exited unsuccessfully (exit {result.returncode})")
        if claude:
            return parse_claude_output(result.stdout, signature)
        if not output.is_file():
            rejection = _codex_model_rejection(model, result.stdout + "\n" + result.stderr)
            if rejection:
                raise rejection
            if _limit(result.stdout + "\n" + result.stderr):
                raise CLIUsageLimitError("Codex subscription usage or rate limit reached; batch stopped")
            raise CLISchemaError("Codex CLI did not write its structured output")
        try:
            text = output.read_text()
        except (OSError, UnicodeError):
            raise CLISchemaError("Codex structured output could not be read") from None
        return parse_output(text, signature)
