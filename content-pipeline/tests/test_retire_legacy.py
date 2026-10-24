"""Offline read-only D-025 coverage and disabled-retirement regression tests.

Guarded-update, partial-write, and concurrent-write tests were removed because
legacy retirement no longer writes. Fail-before-client tests replace that flow;
receipt classification, replacement thresholds and snapshot validation stay tested.
"""
import copy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from click.testing import CliRunner

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "retire_legacy.py"
spec = importlib.util.spec_from_file_location("retire_legacy", SCRIPT)
retire = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retire)

CODE = "ARCHITECTING_LOW_CODE_ML_SOLUTIONS"
OTHER_CODE = "MONITORING_ML_SOLUTIONS"
GENERATOR = "openrouter/google/gemini-3.8-flash"
JUDGE = "openrouter/anthropic/claude-sonnet-5.5"


def context():
    return {"cert_id": "machine-learning-engineer", "guide_sha256": "a" * 64,
            "domains": {CODE: {"objectives": [{"objective_id": "pmle:1:1"}, {"objective_id": "pmle:1:2"}]},
                        OTHER_CODE: {"objectives": [{"objective_id": "pmle:6:1"}]}}}


def envelope(objective="pmle:1:1"):
    return {"content_pipeline_judge": {"version": 1, "passed": True, "score": 0.9,
                                      "reason": "Supported", "model": JUDGE},
            "grounding": {"cert_id": "machine-learning-engineer", "objective_id": objective,
                          "guide_sha256": "a" * 64, "generator_model": GENERATOR, "judge_model": JUDGE,
                          "mechanical_check": {"passed": True, "errors": []},
                          "evidence": [{"option_label": label, "quote": "Official supporting quote " + label,
                                        "url": "https://docs.cloud.google.com/vertex-ai/docs/" + label,
                                        "retrieved_at": "2026-10-01T12:00:00Z", "text_sha256": "b" * 64}
                                       for label in "ABCD"]}}


def question(number, grounded=False, **changes):
    row = {"id": f"q{number:05}", "exam": retire.EXAM, "domain_id": "d1", "status": "ACTIVE",
           "review_status": "GOOD", "generation_run_id": "run1" if grounded else None,
           "review_notes": json.dumps(envelope()) if grounded else None}
    row.update(changes)
    return row


class Query:
    def __init__(self, client, name):
        self.client, self.name = client, name
        self.filters, self.bounds, self.order_key, self.updates, self.fields = [], None, None, None, None

    def select(self, fields):
        self.fields = fields.split(",")
        return self

    def eq(self, key, value):
        self.filters.append(("eq", key, value))
        return self

    def in_(self, key, values):
        self.filters.append(("in", key, values))
        return self

    def order(self, key):
        self.order_key = key
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def update(self, updates):
        raise AssertionError("Read-only coverage must never issue raw updates")

    def execute(self):
        self.client.calls.append(self)
        if self.client.read_failure and not self.updates and self.name == "questions":
            raise RuntimeError("secret endpoint must not be echoed")
        rows = [row for row in self.client.rows[self.name] if all(
            row.get(key) == value if op == "eq" else row.get(key) in value
            for op, key, value in self.filters)]
        if self.order_key:
            rows.sort(key=lambda row: row[self.order_key])
        if self.bounds is not None:
            start, end = self.bounds
            rows = rows[start:min(end + 1, start + self.client.cap)]
        return SimpleNamespace(data=[{key: row[key] for key in self.fields if key in row}
                                     for row in copy.deepcopy(rows)])


class Client:
    def __init__(self, rows=(), cap=1000):
        self.rows = {"exam_domains": [{"id": "d1", "code": CODE}, {"id": "d6", "code": OTHER_CODE}],
                     "questions": copy.deepcopy(list(rows))}
        self.cap, self.calls, self.writes = cap, [], []
        self.read_failure = False

    def table(self, name):
        assert name in self.rows
        return Query(self, name)

    def rpc(self, *args, **kwargs):
        raise AssertionError("Legacy retirement must never issue RPCs")


@pytest.fixture
def cli(monkeypatch):
    client = Client()
    monkeypatch.setattr(retire, "get_client", lambda: client)
    monkeypatch.setattr(retire, "load_cert_context", lambda cert: context())
    runner = CliRunner()
    return client, lambda *args: runner.invoke(retire.main, list(args))


def test_default_dry_run_counts_every_objective_including_zero(cli):
    client, invoke = cli
    client.rows["questions"] = [question(1), question(2, True),
                               question(3, True, domain_id="d6", review_notes=json.dumps(envelope("pmle:6:1"))),
                               question(4, True, exam="OTHER"), question(5, status="DRAFT")]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert CODE + ": grounded ACTIVE=1; legacy ACTIVE=1; invalid ACTIVE=0" in result.output
    assert OTHER_CODE + ": grounded ACTIVE=1; legacy ACTIVE=0; invalid ACTIVE=0" in result.output
    assert "pmle:1:1: grounded ACTIVE=1" in result.output
    assert "pmle:1:2: grounded ACTIVE=0" in result.output
    assert "Dry run; no writes." in result.output
    assert client.writes == []


def test_registry_current_context_is_used_without_network():
    ctx = retire.load_cert_context()
    for code, domain in ctx["domains"].items():
        data = envelope(domain["objectives"][0]["objective_id"])
        data["grounding"]["guide_sha256"] = ctx["guide_sha256"]
        assert retire.classification(question(1, True, review_notes=json.dumps(data)), ctx, code) == "grounded"


@pytest.mark.parametrize("args", [("--apply",), ("--apply", "--domain", "UNKNOWN"),
                                   ("--apply", "--domain", CODE)])
def test_apply_disabled_before_registry_client_or_credentials(cli, monkeypatch, args):
    client, invoke = cli
    monkeypatch.setattr(retire, "get_client", lambda: pytest.fail("Client should not be created"))
    monkeypatch.setattr(retire, "load_cert_context", lambda *a: pytest.fail("Registry should not be loaded"))
    class UnreadableEnvironment:
        def get(self, *args):
            pytest.fail("Credentials should not be read")
    monkeypatch.setattr(retire, "os", SimpleNamespace(environ=UnreadableEnvironment()))
    result = invoke(*args)
    assert result.exit_code != 0
    assert "Legacy retirement is disabled" in result.output
    assert "retire_question RPC" in result.output
    assert "domain floor" in result.output
    assert "question_events" in result.output
    assert client.calls == []
    assert client.writes == []


def test_shortfall_remains_a_pure_replacement_safety_check(cli):
    client, invoke = cli
    rows = [question(1), question(2), question(3, True)]
    with pytest.raises(retire.click.ClickException, match="shortfall=1"):
        retire.require_threshold(rows, context(), CODE)
    assert client.calls == []
    assert client.writes == []


def test_exact_threshold_returns_only_legacy_rows_without_writes():
    rows = [question(1), question(2, True)]
    assert retire.require_threshold(rows, context(), CODE) == [rows[0]]
    assert rows[0]["status"] == "ACTIVE"


def test_direct_retirement_helper_is_disabled_before_any_argument_access():
    class Unreadable:
        def __getattribute__(self, name):
            raise AssertionError("Legacy helper must not inspect arguments")
        def __iter__(self):
            raise AssertionError("Legacy helper must not inspect snapshots")
    with pytest.raises(retire.click.ClickException, match="Legacy retirement is disabled"):
        retire.retire(Unreadable(), Unreadable(), Unreadable(), CODE, "d1")


def test_all_pages_use_stable_id_order_and_actual_server_cap(cli):
    client, invoke = cli
    client.cap = 7
    client.rows["questions"] = [question(i, True) for i in range(1003)]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "grounded ACTIVE=1003; legacy ACTIVE=0" in result.output
    reads = [q for q in client.calls if q.name == "questions"]
    assert len(reads) > 100
    assert all(q.order_key == "id" for q in reads)
    assert [q.bounds[0] for q in reads[:4]] == [0, 7, 14, 21]
    assert client.writes == []


@pytest.mark.parametrize("notes", [None, "", "  ", "Founder reviewed; seems fine", "not JSON", "{}",
                                    '{"content_pipeline_judge": {"passed": true}}'])
def test_no_grounding_envelope_is_legacy_in_read_only_coverage(cli, notes):
    client, invoke = cli
    row = question(1, review_notes=notes)
    assert retire.classification(row, context(), CODE) == "legacy"
    client.rows["questions"] = [row, question(2, True)]
    before = copy.deepcopy(client.rows)
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "grounded ACTIVE=1; legacy ACTIVE=1; invalid ACTIVE=0" in result.output
    assert client.rows == before
    assert client.writes == []


@pytest.mark.parametrize("notes", ['{bad JSON', '{"grounding":', '[]', 'null', '"text"',
                                    '{"grounding": null}', '{"grounding": {}}',
                                    '{"grounding": {}, "grounding": {}}',
                                    '{"legacy": 1, "legacy": 2}'])
def test_malformed_or_duplicate_json_is_invalid_and_never_retired(cli, notes):
    client, invoke = cli
    client.rows["questions"] = [question(1, review_notes=notes), question(2), question(3, True)]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


@pytest.mark.parametrize("field,value", [
    ("cert_id", "GCP_PM_ML_ENG"), ("cert_id", "other-cert"),
    ("objective_id", "unknown"), ("objective_id", "pmle:6:1"),
    ("guide_sha256", "c" * 64), ("guide_sha256", "invalid"),
    ("generator_model", JUDGE), ("generator_model", "unknown/vendor"),
    ("judge_model", GENERATOR), ("judge_model", "openrouter/anthropic/claude-sonnet-4.5"),
    ("mechanical_check", {"passed": False, "errors": []}),
    ("mechanical_check", {"passed": True, "errors": ["unsupported"]}),
    ("mechanical_check", {"passed": True, "errors": [], "extra": 1}),
    ("evidence", []), ("evidence", [None]),
])
def test_independent_judge_and_current_registry_receipt_required(cli, field, value):
    client, invoke = cli
    data = envelope()
    data["grounding"][field] = value
    client.rows["questions"] = [question(1), question(2, True, review_notes=json.dumps(data))]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "grounded ACTIVE=0; legacy ACTIVE=1; invalid ACTIVE=1" in result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


@pytest.mark.parametrize("field,value", [("passed", False), ("passed", "true"), ("version", 2),
                                         ("score", 0.79), ("score", float("nan")),
                                         ("model", GENERATOR), ("reason", "")])
def test_grounding_cannot_replace_strict_judge_pass(cli, field, value):
    client, invoke = cli
    data = envelope()
    data["content_pipeline_judge"][field] = value
    client.rows["questions"] = [question(1), question(2, True, review_notes=json.dumps(data))]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


@pytest.mark.parametrize("field,value", [("quote", ""), ("quote", "x" * 301),
                                         ("url", "https://example.com/docs"),
                                         ("url", "https://cloud.google.com/blog/article"),
                                         ("retrieved_at", "2026-01-01"), ("text_sha256", "invalid"),
                                         ("option_label", "E"), ("extra", "field")])
def test_every_option_needs_strict_evidence_receipt(cli, field, value):
    client, invoke = cli
    data = envelope()
    data["grounding"]["evidence"][0][field] = value
    client.rows["questions"] = [question(1), question(2, True, review_notes=json.dumps(data))]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


@pytest.mark.parametrize("field,value", [("generation_run_id", None), ("generation_run_id", ""),
                                         ("generation_run_id", 123), ("review_status", "UNREVIEWED")])
def test_new_active_requires_phase2_run_and_review_status(cli, field, value):
    client, invoke = cli
    client.rows["questions"] = [question(1), question(2, True, **{field: value})]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


def test_duplicate_nested_json_keys_fail_closed(cli):
    client, invoke = cli
    raw = json.dumps(envelope()).replace('"cert_id": "machine-learning-engineer"',
                                        '"cert_id": "wrong", "cert_id": "machine-learning-engineer"')
    client.rows["questions"] = [question(1), question(2, True, review_notes=raw)]
    result = invoke()
    assert result.exit_code == 0, result.output
    assert "grounded ACTIVE=0" in result.output
    assert "invalid ACTIVE=1" in result.output
    invalid = [row for row in client.rows["questions"]
               if retire.classification(row, context(), CODE) == "invalid"]
    assert len(invalid) == 1
    with pytest.raises(retire.click.ClickException, match="Invalid receipts"):
        retire.require_threshold(client.rows["questions"], context(), CODE)
    assert all(row["status"] == "ACTIVE" for row in client.rows["questions"])
    assert client.writes == []


def test_invalid_other_domain_receipt_is_reported_separately(cli):
    client, invoke = cli
    client.rows["questions"] = [question(1), question(2, True),
                               question(3, domain_id="d6", review_notes='{"grounding": null}')]
    result = invoke("--domain", CODE)
    assert result.exit_code == 0, result.output
    assert CODE + ": grounded ACTIVE=1; legacy ACTIVE=1; invalid ACTIVE=0" in result.output
    assert OTHER_CODE + ": grounded ACTIVE=0; legacy ACTIVE=0; invalid ACTIVE=1" in result.output
    assert client.rows["questions"][2]["status"] == "ACTIVE"
    assert client.writes == []


def test_missing_seed_has_no_mapped_coverage_and_ambiguous_seed_fails(cli):
    client, invoke = cli
    client.rows["exam_domains"] = [{"id": "d6", "code": OTHER_CODE}]
    result = invoke("--domain", CODE)
    assert result.exit_code == 0, result.output
    assert CODE + ": grounded ACTIVE=0; legacy ACTIVE=0; invalid ACTIVE=0" in result.output
    client.rows["exam_domains"] += [{"id": "d6", "code": CODE}]
    result = invoke()
    assert result.exit_code != 0 and "ambiguous" in result.output
    assert client.writes == []


def test_unknown_domain_active_rows_reported_and_never_written(cli):
    client, invoke = cli
    client.rows["questions"] = [question(1), question(2, True), question(3, domain_id="unknown")]
    result = invoke("--domain", CODE)
    assert result.exit_code == 0, result.output
    assert "Unmapped PMLE ACTIVE rows=1" in result.output
    assert client.rows["questions"][2]["status"] == "ACTIVE"


def test_duplicate_rows_from_unstable_pagination_fail_before_writes(cli):
    client, invoke = cli
    client.rows["questions"] = [question(1), question(1)]
    result = invoke("--domain", CODE)
    assert result.exit_code != 0 and "unstable ACTIVE snapshot" in result.output
    assert client.writes == []


def test_client_uses_only_environment_and_direct_factory(monkeypatch):
    import dotenv
    import supabase
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: pytest.fail("dotenv forbidden"))
    monkeypatch.setenv("SUPABASE_URL", "https://offline.invalid")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "offline-placeholder-not-a-key")
    fake = object()
    calls = []
    monkeypatch.setattr(supabase, "create_client", lambda url, key: calls.append((url, key)) or fake)
    assert retire.get_client() is fake
    assert calls == [("https://offline.invalid", "offline-placeholder-not-a-key")]
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY")
    with pytest.raises(retire.click.ClickException, match="process environment"):
        retire.get_client()


@pytest.mark.parametrize("domain_id", [True, 1, {}, [], "", "  "])
def test_domain_mapping_requires_nonempty_string_id(cli, domain_id):
    client, invoke = cli
    client.rows["exam_domains"] = [{"id": domain_id, "code": CODE}]
    result = invoke("--domain", CODE)
    assert result.exit_code != 0
    assert "Invalid or ambiguous canonical domain mapping" in result.output
    assert client.writes == []


def test_actual_phase2_persisted_receipt_counts_as_replacement(cli, monkeypatch):
    from unittest.mock import Mock
    from scripts import generate_pmle_questions as generate
    from shared.cert_context import load_cert_context
    from shared.quality_gate import JudgeVerdict

    ctx = load_cert_context()
    scope = {"cert_id": ctx["cert_id"], "guide_sha256": ctx["guide_sha256"],
             "objective_id": ctx["domains"][CODE]["objectives"][0]["objective_id"]}
    receipt = {**envelope()["grounding"], **scope}
    persistence = Mock()
    persistence.insert_question.return_value = {"id": "q00002"}
    persistence.insert_answers_batch.return_value = [{"id": str(i)} for i in range(4)]
    persistence.insert_explanation.return_value = {"id": "explanation"}
    persistence.update_question_review.return_value = True
    native = {field: "Offline question content for " + field for field in generate.QUESTION_FIELDS}
    verdict = JudgeVerdict(True, 0.9, "Supported", JUDGE)
    assert generate.persist_candidate(persistence, scope, native, verdict, receipt,
                                      retire.EXAM, "d1", "run1", "MEDIUM")
    inserted = copy.deepcopy(persistence.insert_question.call_args.args[0])
    assert inserted["status"] == "DRAFT" and inserted["review_status"] == "UNREVIEWED"
    # Simulate already-reviewed ACTIVE data solely for receipt classification;
    # the exact notes emitted by persist_candidate remain untouched.
    final_review = persistence.update_question_review.call_args.args
    assert final_review == ("q00002", "run1", "GOOD", inserted["review_notes"])
    promoted = {**inserted, "id": "q00002", "status": "ACTIVE", "review_status": final_review[2]}
    assert retire.classification(promoted, ctx, CODE) == "grounded"
    client, invoke = cli
    client.rows["questions"] = [question(1), promoted]
    monkeypatch.setattr(retire, "load_cert_context", lambda cert: ctx)
    result = invoke("--domain", CODE)
    assert result.exit_code == 0, result.output
    assert "grounded ACTIVE=1; legacy ACTIVE=1; invalid ACTIVE=0" in result.output
    assert "Dry run; no writes." in result.output
    assert client.writes == []
    assert client.rows["questions"][1] == promoted


def test_coverage_read_failure_redacts_sensitive_details(cli):
    client, invoke = cli
    client.read_failure = True
    result = invoke()
    assert result.exit_code != 0
    assert "Coverage database or registry operation failed" in result.output
    assert "secret endpoint" not in result.output
    assert "Dry run; no writes." not in result.output
    assert client.writes == []


def test_unknown_read_only_domain_fails_before_client(cli, monkeypatch):
    client, invoke = cli
    monkeypatch.setattr(retire, "get_client", lambda: pytest.fail("Client should not be created"))
    result = invoke("--domain", "UNKNOWN")
    assert result.exit_code != 0
    assert "Unknown canonical PMLE domain" in result.output
    assert client.calls == []
