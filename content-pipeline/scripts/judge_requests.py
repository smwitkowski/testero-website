#!/usr/bin/env python3
"""Judge frozen external requests with one Claude CLI call per candidate."""
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from threading import Event, Lock

import click

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from shared import cli_models
from shared.cli_models import output_model, parse_output
from shared.quality_gate import QuestionQualitySignature
from shared.gates import GATE_SIGNATURES, GATE_VERSION, parse_gate_output

from shared.external_judge import REQUEST_CHARACTER_LIMIT
SAFE_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}")
ALLOWED_MODELS = {"claude", "claude/claude-sonnet-5-5"}


class RequestValidationError(ValueError):
    """A frozen request is unsafe, malformed, oversized or stale."""


@dataclass
class Summary:
    completed: int = 0
    skipped: int = 0
    failed: int = 0
    remaining: int = 0
    usage_stopped: bool = False


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise RequestValidationError("Request contains duplicate JSON keys")
        result[key] = value
    return result


def _no_symlinks(path):
    if any(item.is_symlink() for item in (path, *path.parents)):
        raise click.ClickException("Input and output directories must not contain symlinks")


@contextmanager
def batch_lock(verdicts):
    """Hold a stable lock inode; never unlink it while another runner can wait."""
    flags = os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK
    try:
        fd = os.open(verdicts / ".judge-requests.lock", flags, 0o600)
    except OSError:
        raise click.ClickException("Cannot open verdict batch lock safely") from None
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise click.ClickException("Verdict batch lock must be a regular file")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise click.ClickException("Verdict directory is already locked by another runner") from None
        yield
    finally:
        os.close(fd)


def _read_request(path, ident, canonical):
    flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
    try:
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as stream:
            if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
                raise RequestValidationError("Request must be a regular non-symlink file")
            raw = stream.read(4 * REQUEST_CHARACTER_LIMIT + 1)
        text = raw.decode("utf-8")
        if len(text) > REQUEST_CHARACTER_LIMIT:
            raise RequestValidationError(f"Request exceeds the {REQUEST_CHARACTER_LIMIT}-character limit")
        request = json.loads(text, object_pairs_hook=_pairs,
                             parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except RequestValidationError:
        raise
    except (OSError, UnicodeError, ValueError, RecursionError):
        raise RequestValidationError("Request must be readable, non-symlink strict JSON") from None
    legacy_fields = {"candidate_id", "objective_id", "judge_prompt", "verdict_schema", "trimming"}
    gate_fields = {"candidate_id", "objective_id", "gate_version", "decision_provenance_sha256", "gates", "trimming"}
    if not isinstance(request, dict) or set(request) not in (legacy_fields, gate_fields):
        raise RequestValidationError("Request must contain exactly the exported request fields")
    is_gates = set(request) == gate_fields
    if is_gates:
        if (type(request["gate_version"]) is not int or request["gate_version"] != GATE_VERSION
                or not isinstance(request["decision_provenance_sha256"], str)
                or not re.fullmatch(r"[0-9a-f]{64}", request["decision_provenance_sha256"])
                or not isinstance(request["gates"], dict) or set(request["gates"]) != set(GATE_SIGNATURES)):
            raise RequestValidationError("Request must contain all current independent gates")
        for name, signature in GATE_SIGNATURES.items():
            gate = request["gates"][name]
            if (not isinstance(gate, dict) or set(gate) != {"judge_prompt", "verdict_schema"}
                    or not isinstance(gate["judge_prompt"], str) or not gate["judge_prompt"].strip()
                    or gate["verdict_schema"] != output_model(signature).model_json_schema()):
                raise RequestValidationError("Gate request differs from the strict current schema")
    if request["candidate_id"] != ident:
        raise RequestValidationError("Request candidate ID must match its filename")
    if not isinstance(request["objective_id"], str) or not request["objective_id"].strip():
        raise RequestValidationError("Request objective ID must be nonempty text")
    if not is_gates and (not isinstance(request["judge_prompt"], str) or not request["judge_prompt"].strip()):
        raise RequestValidationError("Request judge prompt must be nonempty text")
    if not isinstance(request["trimming"], dict):
        raise RequestValidationError("Request trimming metadata must be an object")
    if not is_gates and json.dumps(request["verdict_schema"], sort_keys=True) != json.dumps(canonical, sort_keys=True):
        raise RequestValidationError("Request verdict schema differs from the current question quality schema")
    return request


def _publish(path, payload, *, exclusive):
    """Flush then publish a complete JSON file; exclusive links never replace results."""
    fd, temporary = tempfile.mkstemp(prefix=".judge-", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, ensure_ascii=False, allow_nan=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        if exclusive:
            try:
                os.link(temporary, path)
            except FileExistsError:
                return False
        else:
            os.replace(temporary, path)
        return True
    finally:
        Path(temporary).unlink(missing_ok=True)


def _safe_failure(error):
    # Never copy arbitrary exception messages, CLI logs, prompts or environment data.
    if isinstance(error, RequestValidationError):
        return "RequestValidationError", "Frozen request validation failed; check ID, size, prompt and current schema"
    for name, message in (
        ("CLIUsageLimitError", "Claude subscription usage or rate limit reached; batch stopped"),
        ("CLIAuthError", "Claude CLI authentication failed; authenticate before rerunning"),
        ("CLITimeoutError", "Claude CLI request timed out"),
        ("CLISchemaError", "Claude CLI structured output does not match the current schema"),
        ("CLIExitError", "Claude CLI request failed or could not start"),
    ):
        error_type = getattr(cli_models, name, None)
        if error_type is not None and isinstance(error, error_type):
            return name, message
    return "RequestRunnerError", "Request could not be completed or saved"


def _record_verdict_directory(requests, verdicts):
    """Track output directories so re-export cannot silently reuse stale verdicts."""
    path = requests / ".verdict-directories.json"
    _no_symlinks(path)
    directories = []
    if path.exists():
        try:
            if not path.is_file():
                raise ValueError()
            payload = cli_models._load_json(path.read_text(encoding="utf-8"))
            if (not isinstance(payload, dict) or set(payload) != {"version", "directories"}
                    or type(payload["version"]) is not int or payload["version"] != 1
                    or not isinstance(payload["directories"], list)
                    or any(not isinstance(item, str) or not Path(item).is_absolute()
                           for item in payload["directories"])):
                raise ValueError()
            directories = payload["directories"]
        except (OSError, UnicodeError, ValueError, TypeError, RecursionError):
            raise click.ClickException("Invalid verdict-directory registry; export and judging are blocked") from None
    target = str(verdicts.resolve())
    if target not in directories:
        try:
            _publish(path, {"version": 1, "directories": sorted(set([*directories, target]))}, exclusive=False)
        except OSError:
            raise click.ClickException("Cannot record verdict-directory registry safely") from None


def run_requests(requests, verdicts, *, judge_model="claude", parallel=3):
    """Run a resumable locked batch, submitting at most parallel requests at once."""
    if not isinstance(judge_model, str) or judge_model not in ALLOWED_MODELS:
        raise click.ClickException("Only claude or claude/claude-sonnet-5-5 is allowed by current ingestion provenance")
    if type(parallel) is not int or not 1 <= parallel <= 4:
        raise click.ClickException("Parallel must be an integer from 1 to 4")
    requests, verdicts = Path(requests).absolute(), Path(verdicts).absolute()
    _no_symlinks(requests)
    _no_symlinks(verdicts)
    if not requests.is_dir():
        raise click.ClickException("Requests directory does not exist")
    if requests.resolve() == verdicts.resolve():
        raise click.ClickException("Requests and verdicts must be separate directories")
    try:
        verdicts.mkdir(parents=True, exist_ok=True)
        paths = sorted(path for path in requests.glob("*.json")
                       if path.name != ".verdict-directories.json")
    except OSError:
        raise click.ClickException("Cannot prepare request and verdict directories") from None
    if any(not SAFE_ID.fullmatch(path.stem) for path in paths):
        raise click.ClickException("Request filenames must contain safe candidate IDs")
    canonical = output_model(QuestionQualitySignature).model_json_schema()
    summary = Summary(remaining=len(paths))
    stopped, submission_lock = Event(), Lock()

    def execute(path):
        ident = path.stem
        destination = verdicts / (ident + ".json")
        if os.path.lexists(destination):
            return ident, "skipped", None
        try:
            request = _read_request(path, ident, canonical)
            if os.path.lexists(destination):
                return ident, "skipped", None
            # Admit each call under the same lock that latches usage stops.
            # Do not hold it during the blocking backend call.
            with submission_lock:
                if stopped.is_set():
                    return ident, "not_attempted", None
            if "gates" in request:
                raw = {}
                for name in GATE_SIGNATURES:
                    with submission_lock:
                        if stopped.is_set():
                            return ident, "not_attempted", None
                    gate = request["gates"][name]
                    raw[name] = cli_models.run_claude_request(judge_model, gate["judge_prompt"], gate["verdict_schema"])
                    parse_gate_output(name, raw[name])
            else:
                raw = cli_models.run_claude_request(judge_model, request["judge_prompt"], request["verdict_schema"])
                if type(raw) is not dict:
                    raise cli_models.CLISchemaError("Invalid structured output")
                try:
                    parse_output(json.dumps(raw, allow_nan=False), QuestionQualitySignature)
                except (ValueError, TypeError, RecursionError):
                    raise cli_models.CLISchemaError("Invalid structured output") from None
                if (type(raw["score"]) not in (int, float) or not 0 <= raw["score"] <= 1
                        or not 0 < len(raw["reason"].strip()) <= 300):
                    raise cli_models.CLISchemaError("Invalid structured output")
            if not _publish(destination, raw, exclusive=True):
                return ident, "skipped", None
            try:
                (verdicts / ".failures" / (ident + ".json")).unlink(missing_ok=True)
            except OSError:
                pass
            return ident, "completed", None
        except Exception as error:
            failure = _safe_failure(error)
            if failure[0] == "CLIUsageLimitError":
                with submission_lock:
                    stopped.set()
            record = {"candidate_id": ident, "error_class": failure[0], "message": failure[1],
                      "judge_model": judge_model, "ts": datetime.now(timezone.utc).isoformat()}
            try:
                _publish(verdicts / ".failures" / (ident + ".json"), record, exclusive=False)
            except (OSError, ValueError, TypeError):
                # Report a safe console failure even if storage itself is unavailable.
                failure = ("RequestRunnerError", "Request failure record could not be saved")
            return ident, "failed", failure

    # Exporters take the same request-directory lock before rewriting prompts.
    with batch_lock(requests), batch_lock(verdicts):
        _record_verdict_directory(requests, verdicts)
        failures = verdicts / ".failures"
        _no_symlinks(failures)
        try:
            failures.mkdir(exist_ok=True)
        except OSError:
            raise click.ClickException("Cannot prepare failure record directory") from None
        iterator = iter(paths)
        with ThreadPoolExecutor(max_workers=parallel) as executor:
            pending = {}

            def fill():
                with submission_lock:
                    while len(pending) < parallel and not stopped.is_set():
                        path = next(iterator, None)
                        if path is None:
                            break
                        pending[executor.submit(execute, path)] = path

            fill()
            while pending:
                done, _ = wait(pending, return_when=FIRST_COMPLETED)
                for future in done:
                    pending.pop(future)
                    ident, state, failure = future.result()
                    if state != "not_attempted":
                        setattr(summary, state, getattr(summary, state) + 1)
                        summary.remaining -= 1
                    if failure:
                        click.echo(f"{ident}: {failure[0]}: {failure[1]}")
                if stopped.is_set():
                    for future in list(pending):
                        if future.cancel():
                            pending.pop(future)
                else:
                    fill()
        summary.usage_stopped = stopped.is_set()
    click.echo(f"completed={summary.completed} skipped={summary.skipped} failed={summary.failed} "
               f"remaining={summary.remaining} usage-stopped={str(summary.usage_stopped).lower()}")
    return summary


@click.command()
@click.option("--requests", required=True, type=click.Path(path_type=Path))
@click.option("--verdicts", required=True, type=click.Path(path_type=Path))
@click.option("--judge-model", default="claude", show_default=True)
@click.option("--parallel", default=3, type=click.IntRange(1, 4), show_default=True)
def main(requests, verdicts, judge_model, parallel):
    """Save raw Claude verdicts for frozen requests; never generate or ingest rows."""
    summary = run_requests(requests, verdicts, judge_model=judge_model, parallel=parallel)
    if summary.failed or summary.usage_stopped or summary.remaining:
        raise click.exceptions.Exit(1)


if __name__ == "__main__":
    main()
