from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import nightly_budget as budget
from scripts import pipeline_nightly as nightly
from scripts.nightly_plan import plan
from scripts.nightly_digest import digest
from shared import nightly_budget as guard
from shared.call_logging import call_context, log_lm_calls

# Keep a native runner solely for allowlisted temporary local Git fixture commands.
NATIVE_RUN = subprocess.run

NOW = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)


def row(**kwargs):
    return {"ts": NOW.isoformat(), "model": "openrouter/test", "input_tokens": 10,
            "output_tokens": 2, "seconds": 0, "cost_usd": ".1", **kwargs}


def config(tmp_path):
    value = {"calls_root": str(tmp_path / "calls"), "rates": {"openrouter/test": {"input_tokens": "1", "output_tokens": "2"}},
             "exa_upper_bound": {"request_usd": ".01", "result_usd": ".001", "text_result_usd": ".001"},
             "health_artifacts": ["accepted.json"], "gold_artifacts": ["gold.json"]}
    path = tmp_path / "config.json"
    path.write_text(json.dumps(value))
    return path, value


def test_budget_usage_uses_token_report_without_missing_zero():
    report = budget.accounting([row()], NOW)
    assert report["tokens"]["input_tokens"]["known_tokens"] == 10
    assert report["weekly_usd"] == {"openrouter": "0.1", "exa": "0"}
    assert report["known_tokens_per_published"]["input_tokens"] is None


@pytest.mark.parametrize("cost", [None, -1, True, "NaN", "Infinity", "garbage"])
def test_unknown_invalid_cost_fail_closed(cost):
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(cost_usd=cost)], NOW)


def test_known_rate_requires_both_token_counts():
    rates = {"openrouter/test": {"input_tokens": 1, "output_tokens": 2}}
    report = budget.accounting([row(cost_usd=None)], NOW, rates=rates)
    assert Decimal(report["weekly_usd"]["openrouter"]) == Decimal(".000014")
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(cost_usd=None, output_tokens=None)], NOW, rates=rates)


@pytest.mark.parametrize("model", ["openai/gpt-4o", "unknown", ""])
def test_unknown_paid_provider_blocks(model):
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(model=model)], NOW)


def test_weekly_caps_and_boundaries():
    assert budget.accounting([row(cost_usd=10)], NOW)["remaining_usd"]["openrouter"] == "0"
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(cost_usd="10.00001")], NOW)
    assert budget.accounting([row(ts=(budget.week_start(NOW)-timedelta(seconds=1)).isoformat(), cost_usd=None)], NOW)["calls"] == 0
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(ts=(NOW+timedelta(seconds=1)).isoformat())], NOW)


def test_reservations_deduplicated_but_no_refunds(tmp_path):
    (tmp_path / "hold.calls.jsonl").write_text(json.dumps(row(budget_call_id="id", stage="budget_reservation"))+"\n")
    (tmp_path / "actual.calls.jsonl").write_text(json.dumps(row(budget_call_id="id", stage="argon_blind"))+"\n")
    rows = budget.load_calls(tmp_path)
    assert len(rows) == 1
    assert rows[0]["stage"] == "argon_blind"


def test_changed_reservation_refused(tmp_path):
    (tmp_path / "a.calls.jsonl").write_text(json.dumps(row(budget_call_id="id"))+"\n")
    (tmp_path / "b.calls.jsonl").write_text(json.dumps(row(budget_call_id="id", cost_usd="0.01"))+"\n")
    with pytest.raises(budget.BudgetError):
        budget.load_calls(tmp_path)


def test_guard_concurrent_reservations_serialize(tmp_path, monkeypatch):
    path, value = config(tmp_path)
    monkeypatch.setenv("TESTERO_NIGHTLY_CONFIG", str(path))
    def attempt(_):
        try:
            guard.reserve("exa", Decimal("1"), model="exa/search")
            return True
        except budget.BudgetError:
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(attempt, range(10))) == 5
    report = budget.accounting(budget.load_calls(value["calls_root"]), datetime.now(timezone.utc))
    assert report["weekly_usd"]["exa"] == "5"


def test_model_reservation_disables_retries_and_preserves_usage(tmp_path, monkeypatch):
    path, value = config(tmp_path)
    monkeypatch.setenv("TESTERO_NIGHTLY_CONFIG", str(path))
    calls = tmp_path / "calls" / "artifact.calls.jsonl"
    class LM:
        kwargs = {"max_tokens": 4}
        num_retries = 3
        def forward(self, **kwargs):
            assert self.num_retries == 0
            self._check_truncation({"usage": {"prompt_tokens": 10, "completion_tokens": 2}})
            return "okay"
        def _check_truncation(self, response):
            pass
    lm = LM()
    with call_context(stage="argon_blind", calls_path=calls), log_lm_calls(lm, "openrouter/test"):
        assert lm.forward(messages=[{"role": "user", "content": "question"}]) == "okay"
    assert lm.num_retries == 3
    rows = budget.load_calls(value["calls_root"])
    assert len(rows) == 1 and rows[0]["input_tokens"] == 10
    assert rows[0]["cost_kind"] == "maximum_reserved"
    assert Decimal(rows[0]["cost_usd"]) > 0


def test_no_paid_generation_fallback(tmp_path, monkeypatch):
    path, _ = config(tmp_path)
    monkeypatch.setenv("TESTERO_NIGHTLY_CONFIG", str(path))
    with pytest.raises(budget.BudgetError, match="fallback"):
        guard.reserve_model("openrouter/test", (), {}, SimpleNamespace(kwargs={}), stage="generate")


def test_exa_unknown_max_cost_blocks_before_transport(tmp_path, monkeypatch):
    path, value = config(tmp_path)
    value["exa_upper_bound"]["request_usd"] = None
    path.write_text(json.dumps(value))
    monkeypatch.setenv("TESTERO_NIGHTLY_CONFIG", str(path))
    with pytest.raises(budget.BudgetError):
        with guard.exa_call(num_results=3):
            pytest.fail("Transport must not start")


def snapshot():
    return {"complete": True, "captured_at": NOW.isoformat(), "questions": []}


def test_plan_pmle_first_and_two_batch_cap():
    result = plan(snapshot(), NOW)
    assert len(result["batches"]) == 2
    assert all(b["cert"] == "machine-learning-engineer" for b in result["batches"])
    assert all(b["cert"] != "agentic-architect" for b in result["coverage"])
    with pytest.raises(ValueError):
        plan(snapshot(), NOW, batches=3)


def test_plan_rejects_stale_and_incomplete_export():
    with pytest.raises(ValueError):
        plan({**snapshot(), "complete": False}, NOW)
    with pytest.raises(ValueError):
        plan(snapshot(), NOW + timedelta(days=2))


def test_print_runs_no_external_step_and_defaults_shadow(tmp_path):
    _, value = config(tmp_path)
    result = nightly.nightly(value, coverage=snapshot(), tools=tmp_path / "tools", state_dir=tmp_path / "state", now=NOW,
                             execute=lambda *a, **k: pytest.fail("Print executed external command"))
    commands = result["commands"]
    assert result["mode"] == "shadow"
    assert commands[0][0] == "canaries-prepare"
    pubs = [c for name,c in commands if name == "publish"]
    assert len(pubs) == 2 and all("--read-db" in c and "--apply" not in c for c in pubs)
    assert not (tmp_path / "state").exists()
    assert "fallback" not in json.dumps(commands)


def test_live_flag_never_authorizes_print_publication(tmp_path):
    _, value = config(tmp_path)
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "PUBLISH_LIVE").touch()
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=tmp_path / "state", now=NOW)
    assert result["mode"] == "shadow"


def test_pause_killswitch(tmp_path):
    (tmp_path / "PIPELINE_PAUSED").touch()
    with pytest.raises(ValueError, match="PAUSED"):
        nightly.paused(tmp_path)


def test_preflight_quota_stop_no_generation():
    calls = []
    def execute(command):
        calls.append(command)
        return int("--provider" in command and "claude" in command)
    with pytest.raises(ValueError, match="quota"):
        nightly.preflight(execute=execute, environ={k:"fixture" for k in nightly.REQUIRED_KEYS})
    assert len(calls) == 3


def test_page_deduped_per_day_and_weekly_digest(tmp_path):
    state, sent = {}, []
    path = tmp_path / "state.json"
    deliver = lambda text, config: sent.append(text)
    for _ in range(2):
        nightly.notify({}, {}, state, path, NOW, immediate=True, deliver=deliver)
    assert len(sent) == 1
    for _ in range(2):
        nightly.notify({}, {}, state, path, NOW, deliver=deliver)
    assert len(sent) == 2


def test_unknown_email_claim_prevents_repeat(tmp_path):
    state = {}
    def fail(*_):
        raise OSError("transport unknown")
    with pytest.raises(OSError):
        nightly.notify({}, {}, state, tmp_path/"state.json", NOW, immediate=True, deliver=fail)
    nightly.notify({}, {}, state, tmp_path/"state.json", NOW, immediate=True, deliver=lambda *_: pytest.fail("double send"))
    assert state["mail_status"] == "delivery_unknown"


def test_digest_does_not_invent_missing_metrics():
    text = digest({})
    assert "not yet independently measured" in text and "dormant" in text


def test_explicit_subscription_provider_not_paid():
    report = budget.accounting([row(model="gpt-6.1-sol", provider="codex", cost_usd=None)], NOW)
    assert report["weekly_usd"]["openrouter"] == "0"
    with pytest.raises(budget.BudgetError):
        budget.accounting([row(model="gpt-6.1-sol", cost_usd=None)], NOW)


def test_quota_failure_persists_checkpoint_without_generation(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    tools, state = tmp_path / "tools", tmp_path / "state"
    def quota(**_):
        raise ValueError("quota exhausted")
    monkeypatch.setattr(nightly, "preflight", quota)
    monkeypatch.setattr(nightly, "send", lambda *_: None)
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW, live=True,
                             execute=lambda *_a, **_k: pytest.fail("No generation after failed preflight"))
    assert result["status"] == "checkpointed_stop"
    saved = json.loads((state/"20261024/checkpoint.json").read_text())
    assert saved["reason"] == "quota exhausted"
    with pytest.raises(ValueError, match="checkpoint"):
        nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW, live=True)


def test_health_escape_blocks_first_publication(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    tools, state = tmp_path / "tools", tmp_path / "state"
    tools.mkdir()
    (tools/"PUBLISH_LIVE").touch()
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: snapshot())
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    seen = []
    def execute(command, **kwargs):
        seen.append(command)
        if "evaluate" in command:
            (tools/"PIPELINE_PAUSED").write_text("canary escape")
            return 1
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW, live=True,
                             execute=execute, client=object())
    assert result["status"] == "checkpointed_stop"
    assert not any("scripts.run_domain_batch" in c or "scripts.publish_batch" in c for c in seen)


def test_full_shadow_flow_uses_fresh_queue_and_current_caps(tmp_path, monkeypatch):
    from scripts import nightly_metrics
    monkeypatch.setattr(nightly_metrics, "batch_metrics", lambda *args: {"published":0})
    _, value = config(tmp_path)
    tools, state = tmp_path / "tools", tmp_path / "state"
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: snapshot())
    counts = iter([7,8,8,9])
    monkeypatch.setattr(nightly, "publications_today", lambda *_: next(counts))
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    seen = []
    def execute(command, output=None):
        seen.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete": True, "pages": []}))
        if "scripts.publish_batch" in command:
            Path(command[command.index("--report")+1]).write_text(json.dumps({"published":0,"would_publish":1}))
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW, live=True,
                             execute=execute, client=object())
    assert result["status"] == "complete"
    pubs = [c for c in seen if "scripts.publish_batch" in c]
    assert [c[c.index("--limit")+1] for c in pubs] == ["2","1"]
    assert all("--read-db" in c and "--apply" not in c for c in pubs)
    assert result["recouncil"]["queued"] == 0
    assert seen[0][3] == "prepare"


def test_unprepared_quarantine_skips_judge_but_reports_reasons(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    value["batches"] = 0
    tools, state = tmp_path/"tools", tmp_path/"state"
    monkeypatch.setattr(nightly,"preflight",lambda **_: None)
    queue = {**snapshot(),"questions":[{"id":"held","status":"DRAFT","review_status":"QUARANTINED"}]}
    snapshots = iter([snapshot(),queue])
    monkeypatch.setattr(nightly,"export_snapshot",lambda *_:next(snapshots))
    monkeypatch.setattr(nightly,"notify",lambda *_a,**_k:None)
    commands = []
    def execute(command, output=None):
        commands.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete":True,"pages":[]}))
        if "scripts.recouncil" in command:
            Path(command[command.index("--report")+1]).write_text(json.dumps({"questions":[{"question_id":"held","outcome":"quarantined","reasons":["Missing receipts"]}],"pages":[]}))
        return 0
    result = nightly.nightly(value,coverage=snapshot(),tools=tools,state_dir=state,now=NOW,live=True,execute=execute,client=object())
    assert result["status"] == "complete"
    assert result["recouncil_judge"]["status"] == "skipped"
    assert result["recouncil"]["questions"][0]["outcome"] == "quarantined"
    assert not any("scripts.judge_requests" in c for c in commands)


def test_weekly_metrics_keep_denominator_and_low_yield(tmp_path):
    from scripts.nightly_metrics import observed_week
    prior = {"at":(NOW-timedelta(days=1)).isoformat(),"batches":[{"metrics":{"candidates":20,"persisted_drafts":1,"published":1}}]}
    path = tmp_path/"20261023/checkpoint.json"
    nightly.save(path,prior)
    current = {"at":NOW.isoformat(),"batches":[{"metrics":{"candidates":20,"persisted_drafts":2,"published":0}}],"budget":{"weekly_usd":{"openrouter":"2","exa":"1"}}}
    result = observed_week(tmp_path,current,NOW)
    assert result["funnel"]["candidates"] == 40
    assert result["cost_usd_per_observed_published"] == "3"
    assert result["low_yield_two_batches"] is True
    assert result["observed_nights"] == 2


def test_daily_batch_claim_shared_across_state_directories(tmp_path):
    assert guard.daily_claim(tmp_path,NOW) == 1
    assert guard.daily_claim(tmp_path,NOW) == 1
    with pytest.raises(budget.BudgetError,match="Two nightly"):
        guard.daily_claim(tmp_path,NOW)
    assert guard.daily_claim(tmp_path,NOW+timedelta(days=1)) == 1


def test_daily_publication_slots_never_refund_unknown_outcomes(tmp_path):
    assert guard.daily_claim(tmp_path,NOW,publications=5,db_used=0) == 5
    assert guard.daily_claim(tmp_path,NOW,publications=5,db_used=3) == 5
    assert guard.daily_claim(tmp_path,NOW,publications=5,db_used=3) == 0


def test_flag_removed_before_recouncil_apply_stops_writes(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    value["batches"] = 0
    tools,state = tmp_path/"tools",tmp_path/"state"
    tools.mkdir()
    flag = tools/"PUBLISH_LIVE"
    flag.touch()
    monkeypatch.setattr(nightly,"preflight",lambda **_:None)
    queue = {**snapshot(),"questions":[{"id":"held","status":"DRAFT","review_status":"QUARANTINED"}]}
    snapshots = iter([snapshot(),queue])
    monkeypatch.setattr(nightly,"export_snapshot",lambda *_:next(snapshots))
    monkeypatch.setattr(nightly,"notify",lambda *_a,**_k:None)
    commands = []
    def execute(command, output=None):
        commands.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete":True,"pages":[]}))
        if "scripts.recouncil" in command and "--apply" not in command:
            requests = Path(command[command.index("--output-dir")+1])/"judge-requests"
            requests.mkdir(parents=True)
            (requests/"id.json").write_text("{}")
        if "scripts.judge_requests" in command:
            flag.unlink()
        return 0
    result = nightly.nightly(value,coverage=snapshot(),tools=tools,state_dir=state,now=NOW,live=True,execute=execute,client=object())
    assert result["status"] == "checkpointed_stop"
    assert "removed before a write stage" in result["reason"]
    assert not any("--apply" in c for c in commands)


@pytest.mark.parametrize("outcome,expected,judge", [("partial", "partial", True), ("hard_stop", "checkpointed_stop", False),
                                                   (None, "checkpointed_stop", False)])
def test_batch_failure_keeps_recouncil_and_digest_but_not_publication(tmp_path, monkeypatch, outcome, expected, judge):
    _, value = config(tmp_path)
    tools, state = tmp_path / "tools", tmp_path / "state"
    tools.mkdir()
    (tools / "PUBLISH_LIVE").touch()
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    queued = {**snapshot(), "questions": [{"id": "held", "review_status": "QUARANTINED"}]}
    snapshots = iter([snapshot(), queued])
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: next(snapshots))
    monkeypatch.setattr(nightly, "publications_today", lambda *_: 0)
    notices, seen = [], []
    monkeypatch.setattr(nightly, "notify", lambda report, *_a, **_k: notices.append(report["status"]))
    def execute(command, output=None):
        seen.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete": True, "pages": []}))
        if "scripts.run_domain_batch" in command:
            if outcome:
                Path(command[command.index("--nightly-result") + 1]).write_text(json.dumps({"schema": "nightly-stage-v1", "status": outcome}))
            return 1
        if "scripts.recouncil" in command:
            root = Path(command[command.index("--output-dir") + 1])
            requests = root / "judge-requests"
            requests.mkdir(parents=True, exist_ok=True)
            (requests / "held.json").write_text("{}")
            Path(command[command.index("--report") + 1]).write_text(json.dumps({"questions": [{"outcome": "quarantined"}], "pages": []}))
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW,
                             live=True, execute=execute, client=object())
    assert result["status"] == expected
    assert result["publishing_disabled"] is True
    assert len([c for c in seen if "scripts.run_domain_batch" in c]) == 1  # No generation replay or second cohort.
    assert not any("scripts.publish_batch" in c for c in seen)
    assert any("scripts.judge_requests" in c for c in seen) is judge
    evaluations = [c for c in seen if "scripts.recouncil" in c and "--verdict-dir" in c]
    assert len(evaluations) == 1
    assert ("--apply" in evaluations[0]) is judge
    assert notices == [expected]
    assert (state / "20261024/digest.txt").is_file()
    assert result["recouncil"]["questions"][0]["outcome"] == "quarantined"


def test_pause_before_preflight_makes_no_model_probes_and_keeps_digest(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "PIPELINE_PAUSED").touch()
    monkeypatch.setattr(nightly, "preflight", lambda **_: pytest.fail("No probes after pause"))
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    state = tmp_path / "state"
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW,
                             live=True, execute=lambda *_a, **_k: pytest.fail("No calls after pause"))
    assert result["status"] == "checkpointed_stop"
    assert (state / "20261024/digest.txt").is_file()


def test_recouncil_judge_unknown_failure_only_local_evaluate_follows(tmp_path, monkeypatch):
    _, value = config(tmp_path)
    value["batches"] = 0
    tools, state = tmp_path / "tools", tmp_path / "state"
    tools.mkdir()
    (tools / "PUBLISH_LIVE").touch()
    monkeypatch.setattr(nightly, "preflight", lambda **_: None)
    queue = {**snapshot(), "questions": [{"id": "held", "review_status": "QUARANTINED"}]}
    monkeypatch.setattr(nightly, "export_snapshot", lambda *_: queue)
    monkeypatch.setattr(nightly, "notify", lambda *_a, **_k: None)
    seen = []
    def execute(command, output=None):
        seen.append(command)
        if output:
            Path(output).write_text(json.dumps({"complete": True, "pages": []}))
        if "scripts.judge_requests" in command:
            return 1
        if "scripts.recouncil" in command:
            requests = Path(command[command.index("--output-dir") + 1]) / "judge-requests"
            requests.mkdir(parents=True, exist_ok=True)
            (requests / "held.json").write_text("{}")
            Path(command[command.index("--report") + 1]).write_text(json.dumps({"questions": [], "pages": []}))
        return 0
    result = nightly.nightly(value, coverage=snapshot(), tools=tools, state_dir=state, now=NOW,
                             live=True, execute=execute, client=object())
    assert result["status"] == "checkpointed_stop"
    assert seen[-1][2] == "scripts.recouncil"
    assert "--dry-run" in seen[-1] and "--apply" not in seen[-1]
    assert (state / "20261024/digest.txt").exists()


@pytest.fixture
def launcher():
    import runpy
    wrapper = Path("/Users/switkowski/Projects/Testero/hq/tools/pipeline-nightly.sh")
    if not wrapper.is_file():
        pytest.skip("External coordinator wrapper is not installed in this clone")
    # This loads definitions only. It does NOT invoke main or the live path.
    return SimpleNamespace(**runpy.run_path(str(wrapper), run_name="wrapper_test"))


@pytest.fixture
def local_git(tmp_path, monkeypatch):
    def local_only(command, **kwargs):
        assert command[0] == "git" and "-C" in command
        assert Path(command[command.index("-C") + 1]).resolve().is_relative_to(tmp_path.resolve())
        assert not any(str(arg).startswith(("http:", "https:", "ssh:", "git@")) for arg in command)
        return NATIVE_RUN(command, **kwargs)
    # All origins below are local temporary repos. Models and sockets stay blocked.
    monkeypatch.setattr(subprocess, "run", local_only)
    def git(path, *args):
        return subprocess.check_output(["git", "-C", str(path), *args], text=True, stderr=subprocess.DEVNULL).strip()
    source, origin, repo = tmp_path / "source", tmp_path / "origin.git", tmp_path / "repo"
    source.mkdir()
    git(source, "init", "-b", "main")
    git(source, "config", "user.name", "Offline Test")
    git(source, "config", "user.email", "offline@example.invalid")
    (source / "content-pipeline").mkdir()
    (source / "content-pipeline/README.md").write_text("fixture")
    git(source, "add", ".")
    git(source, "commit", "-m", "fixture")
    git(tmp_path, "clone", "--bare", str(source), str(origin))
    git(tmp_path, "clone", str(origin), str(repo))
    return SimpleNamespace(git=git, source=source, origin=origin, repo=repo, head=git(repo, "rev-parse", "HEAD"))


def test_launcher_fresh_detached_pin_and_durable_cache(launcher, local_git, tmp_path):
    root = tmp_path / "runtime"
    with launcher.checkout(local_git.repo, root, local_git.head) as first:
        assert local_git.git(first, "rev-parse", "HEAD") == local_git.head
        assert local_git.git(first, "branch", "--show-current") == ""
        assert (first / "content-pipeline/.cache").resolve() == root / "cache"
        (first / "content-pipeline/.cache/proof.json").write_text("durable")
        with pytest.raises(BlockingIOError):
            with launcher.checkout(local_git.repo, root, local_git.head):
                pytest.fail("Concurrent launcher admitted")
    with launcher.checkout(local_git.repo, root, local_git.head) as second:
        assert first != second
        assert (second / "content-pipeline/.cache/proof.json").read_text() == "durable"
    assert local_git.git(local_git.repo, "branch", "--show-current") == "main"
    assert local_git.git(local_git.repo, "status", "--porcelain") == ""


def test_launcher_fetches_then_rejects_unreviewed_main(launcher, local_git, tmp_path):
    (local_git.source / "content-pipeline/README.md").write_text("new main")
    local_git.git(local_git.source, "commit", "-am", "new main")
    local_git.git(local_git.source, "push", str(local_git.origin), "main")
    root = tmp_path / "runtime"
    with pytest.raises(ValueError, match="reviewed pin"):
        with launcher.checkout(local_git.repo, root, local_git.head):
            pytest.fail("Unreviewed main ran")
    assert not list((root / "worktrees").iterdir())
    assert local_git.git(local_git.repo, "rev-parse", "HEAD") == local_git.head


def test_launcher_refuses_human_root_and_dirty_prior_worktree(launcher, local_git, tmp_path):
    root = tmp_path / "human"
    root.mkdir()
    (root / "notes.txt").write_text("keep")
    with pytest.raises((ValueError, FileNotFoundError)):
        with launcher.checkout(local_git.repo, root, local_git.head):
            pytest.fail("Adopted a human directory")
    assert sorted(p.name for p in root.iterdir()) == ["notes.txt"]
    root = tmp_path / "owned"
    with launcher.checkout(local_git.repo, root, local_git.head) as previous:
        pass
    (previous / "human-notes.txt").write_text("keep exactly")
    with pytest.raises(ValueError, match="dirty or drifted"):
        with launcher.checkout(local_git.repo, root, local_git.head):
            pytest.fail("Discarded human edits")
    assert (previous / "human-notes.txt").read_text() == "keep exactly"


def test_launcher_print_never_loads_repo_or_mutates_worktrees(launcher, tmp_path, monkeypatch, capsys):
    globals_ = launcher.main.__globals__
    root = tmp_path / "runtime"
    monkeypatch.setitem(globals_, "RUNTIME", root)
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps({"calls_root": str(root / "calls")}))
    monkeypatch.setitem(globals_, "checkout", lambda *_: pytest.fail("Print touched worktrees"))
    monkeypatch.setitem(globals_, "secret", lambda *_: pytest.fail("Print fetched keys"))
    assert launcher.main(["--config", str(config_path), "--reviewed-main", "a" * 40, "--print"]) == 0
    output = json.loads(capsys.readouterr().out)
    assert output["mode"] == "offline-launch-plan"
    assert not root.exists()



def test_durable_cache_symlink_is_resolved_before_strict_stage_inputs(tmp_path, monkeypatch):
    checkout = tmp_path / "checkout"
    checkout.mkdir()
    durable = tmp_path / "durable"
    durable.mkdir()
    (checkout / ".cache").symlink_to(durable, target_is_directory=True)
    monkeypatch.setattr(nightly, "PIPELINE", checkout)
    from scripts import run_domain_batch
    monkeypatch.setattr(run_domain_batch, "PIPELINE", checkout)
    artifact, _, batch_commands = run_domain_batch.batch_commands("1.", "night", "machine-learning-engineer", 2, 1)
    assert artifact.parent == durable / "generation"
    assert not any(part.is_symlink() for part in artifact.parents)
    batch_plan = {"cert": "machine-learning-engineer", "section": "1.", "count": 2}
    commands = nightly.commands_for_batch(batch_plan, "night", state_dir=tmp_path / "state", tools=tmp_path)
    publish = commands[-1][1]
    assert Path(publish[publish.index("--artifact") + 1]) == artifact
    assert Path(batch_commands[1][batch_commands[1].index("--requests") + 1]).parent == durable / "generation"



def test_pause_between_preflight_commands_stops_before_model_probe(tmp_path):
    seen = []
    def execute(command):
        seen.append(command)
        (tmp_path / "PIPELINE_PAUSED").touch()
        return 0
    with pytest.raises(ValueError, match="PAUSED"):
        nightly.preflight(execute=execute, environ={key: "fixture" for key in nightly.REQUIRED_KEYS},
                          check=lambda: nightly.paused(tmp_path))
    assert len(seen) == 1 and seen[0] == ["claude", "auth", "status"]
