"""Offline bounded-retry orchestration. All generation and admission are fixtures."""
import json
from pathlib import Path

import pytest

from scripts import pde_retry as retry


@pytest.fixture(autouse=True)
def fixture_native_request_validation(monkeypatch):
    # These are orchestration unit fixtures, not full frozen receipt/request
    # artifacts. The native validator has separate ingestion contract tests.
    from scripts import ingest_external_verdicts as ingestion
    monkeypatch.setattr(ingestion, "validate_saved_judge_requests", lambda path, payload: None)


def scope(section, topic=None):
    return {"domain_code": section, "objective_id": section + ":objective",
            "required_topic_id": topic, "required_topic_guidance": "Keep topic" if topic else None}


class Fixture:
    def __init__(self, tmp_path, outcomes):
        self.artifact = tmp_path / "full.json"
        self.export = tmp_path / "full.existing.json"
        self.export.write_text("[]")
        self.plan = [scope("s1", "streaming"), scope("s2"), scope("s2", "storage")]
        self.outcomes = outcomes
        self.failure_stage = "judge"
        self.expected_comparison_count = 3
        self.events = []
        self.calls = []
        self.commands = [["python", "generate", "--artifact", str(self.artifact), "--n-questions", "3",
                          "--existing-questions", str(self.export)],
                         ["python", "judge", "--requests", "unused", "--verdicts", "unused"]]

    def execute(self, command):
        if command[1] == "generate":
            target = Path(command[command.index("--artifact") + 1])
            assert "--continue-quality-rejections" in command
            if "--frozen-plan" in command:
                frozen = retry.read_json(command[command.index("--frozen-plan") + 1])
                assert frozen["source_sha256"] == retry.digest(self.artifact)
                assert frozen["full_plan_count"] == len(self.plan)
                slots = [row["plan_slot"] for row in frozen["slots"]]
                attempt = frozen["slots"][0]["attempt"]
                export = retry.read_json(command[command.index("--existing-questions") + 1])
                # Earlier authored rejects are still compared, even when not admitted.
                assert len(export) >= self.expected_comparison_count
            else:
                slots, attempt = [1, 2, 3], 1
            self.events.append(("generate", attempt, slots))
            rows = [{"index": index, "candidate_id": f"slot{slot}-a{attempt}", "slot": slot,
                     "attempt": attempt, "stem": f"stem {slot} attempt {attempt}", "key": "A",
                     "options": [{"label": letter, "text": letter + str(slot) + str(attempt)}
                                 for letter in "ABCD"]}
                    for index, slot in enumerate(slots, 1)]
            payload = {"plan": [self.plan[slot - 1] for slot in slots], "candidates": rows}
            if "--frozen-plan" in command:
                payload.update(retry_slots=frozen["slots"], full_plan_count=len(self.plan),
                               retry_source={key: frozen[key] for key in ("source_artifact", "source_sha256")},
                               existing_questions={"sha256": retry.digest(command[command.index("--existing-questions") + 1])})
            retry.write_json(target, payload)
            target.with_suffix(".judge-requests").mkdir(exist_ok=True)
        else:
            requests = Path(command[command.index("--requests") + 1])
            verdicts = Path(command[command.index("--verdicts") + 1])
            verdicts.mkdir()
            self.events.append(("review", requests.stem, None))

    @staticmethod
    def comparison(row):
        return {"id": row["candidate_id"], "stem": row["stem"], "key": "correct",
                "cert_id": "data-engineer", "distractors": ["first", "second", "third"]}

    @staticmethod
    def storage(payload, row):
        return "storage-" + row["candidate_id"]

    def admit(self, path, verdicts, **kwargs):
        self.calls.append((path, kwargs))
        self.events.append(("dry" if kwargs["dry_run"] else "write", path.stem, None))
        payload = retry.read_json(path)
        result = []
        for row in payload["candidates"]:
            row["publication_selected"] = row["attempt"] >= self.outcomes[row["slot"]]
            if not row["publication_selected"]:
                row["failure_stage"] = self.failure_stage
            if row["publication_selected"]:
                result.append({**self.comparison(row), "id": self.storage(payload, row)})
        if "expected_selected_ids" in kwargs:
            assert kwargs["expected_selected_ids"] == [row["id"] for row in result]
            if "balance_population_ids" in kwargs:
                assert kwargs["balance_population_ids"] == sorted(kwargs["balance_population_ids"])
        retry.write_json(path, payload)
        return {"selected_candidates": result}

    def run(self, **kwargs):
        return retry.run_retry_batch(self.artifact, self.export, self.commands, retry_attempts=2,
                                     execute=self.execute, admit=self.admit, load_bank=lambda p: [],
                                     comparison=self.comparison, storage_id=self.storage, **kwargs)


def test_pinned_replacements_and_section_topups_review_all_initial_first(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    report = fixture.run()
    generated = [event for event in fixture.events if event[0] == "generate"]
    assert generated == [("generate", 1, [1, 2, 3]), ("generate", 2, [1, 2]), ("generate", 3, [2])]
    assert fixture.events[1][0] == "review"
    assert fixture.events[2][0] == "dry"
    first_write = next(i for i, event in enumerate(fixture.events) if event[0] == "write")
    assert all(event[0] not in ("generate", "review", "dry") for event in fixture.events[first_write:])
    assert report["status"] == "persisted"
    assert report["coverage_basis"] == "persisted_DRAFT"
    assert all(row["status"] == "covered" for row in report["topics"])
    assert report["sections"] == [{"section": "s1", "planned": 1, "accepted": 1, "shortfall": 0},
                                   {"section": "s2", "planned": 2, "accepted": 2, "shortfall": 0}]
    assert report["balance_population_ids"] == ["slot1-a2", "slot2-a3", "slot3-a1"]
    assert all(kwargs["full_plan_count"] == 3 for _, kwargs in fixture.calls)
    writes = [kwargs for _, kwargs in fixture.calls if not kwargs["dry_run"]]
    assert [len(kwargs["publication_bank"]) for kwargs in writes] == [0, 1, 2]


@pytest.mark.parametrize("stage", ["decision_veto", "evidence", "style", "blind", "argon", "duplicate", "answer_pattern", "product_share"])
def test_all_gate_rejects_remain_bounded_and_exhaustion_is_reported(tmp_path, stage):
    fixture = Fixture(tmp_path, {1: 99, 2: 1, 3: 1})
    fixture.failure_stage = stage
    report = fixture.run(write=False)
    assert report["status"] == "admitted"
    assert report["topics"][0]["status"] == "attempts_exhausted"
    assert report["topics"][0]["attempts"] == 3
    assert report["sections"][0]["shortfall"] == 1
    assert not any(event[0] == "write" for event in fixture.events)


def test_integrity_or_system_admission_error_aborts_all_retries_and_writes(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    def broken(*args, **kwargs):
        raise ValueError("Malformed verdict")
    fixture.admit = broken
    with pytest.raises(ValueError, match="Malformed"):
        fixture.run()
    assert [event[0] for event in fixture.events] == ["generate", "review"]


def test_generator_system_failure_never_runs_review_or_admission(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    def broken(command):
        raise RuntimeError("Transport stopped")
    fixture.execute = broken
    with pytest.raises(RuntimeError, match="Transport"):
        fixture.run()
    assert fixture.calls == []


def test_global_dry_revalidation_failure_prevents_every_write(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.admit
    def check(*args, **kwargs):
        if "expected_selected_ids" in kwargs:
            raise ValueError("Selection changed")
        return original(*args, **kwargs)
    fixture.admit = check
    with pytest.raises(ValueError, match="Selection"):
        fixture.run()
    assert not any(event[0] == "write" for event in fixture.events)


def test_changed_pinned_scope_is_not_accepted(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.execute
    def mutate(command):
        original(command)
        if "--frozen-plan" in command:
            path = command[command.index("--artifact") + 1]
            data = retry.read_json(path)
            data["plan"][0]["required_topic_id"] = "unrelated"
            retry.write_json(path, data)
    fixture.execute = mutate
    with pytest.raises(ValueError, match="pinned"):
        fixture.run()
    assert not any(event[0] == "write" for event in fixture.events)


def test_no_retries_needed_finishes_after_one_wave(tmp_path):
    fixture = Fixture(tmp_path, {1: 1, 2: 1, 3: 1})
    report = fixture.run()
    assert len(report["waves"]) == 1
    assert all(row["attempts"] == 1 for row in report["topics"])


def test_zero_retry_budget_performs_only_initial_wave(tmp_path):
    fixture = Fixture(tmp_path, {1: 99, 2: 1, 3: 1})
    report = retry.run_retry_batch(fixture.artifact, fixture.export, fixture.commands, retry_attempts=0,
                                  execute=fixture.execute, admit=fixture.admit, load_bank=lambda p: [],
                                  comparison=fixture.comparison, storage_id=fixture.storage, write=False)
    assert len(report["waves"]) == 1
    assert report["topics"][0]["attempts"] == 1
    assert report["topics"][0]["status"] == "attempts_exhausted"


def test_frozen_export_change_stops_before_first_write(tmp_path):
    fixture = Fixture(tmp_path, {1: 1, 2: 1, 3: 1})
    original = retry.write_json
    def mutate(path, value):
        original(path, value)
        if value.get("status") == "admitted":
            fixture.export.write_text('["changed after freeze"]')
    from unittest.mock import patch
    with patch.object(retry, "write_json", mutate):
        with pytest.raises(ValueError, match="Frozen"):
            fixture.run()
    assert not any(event[0] == "write" for event in fixture.events)


def test_old_retry_sidecar_cannot_be_overwritten(tmp_path):
    fixture = Fixture(tmp_path, {1: 1, 2: 1, 3: 1})
    stale = tmp_path / "full-retry1.plan.json"
    stale.write_text("private frozen journal")
    with pytest.raises(ValueError, match="new tag"):
        fixture.run()
    assert stale.read_text() == "private frozen journal"
    assert fixture.events == []


def test_retry_export_keeps_whole_bank_answers_and_rejected_authored_choices(tmp_path):
    from shared.near_duplicates import load_export
    rows = [{"id": "pilot", "stem": "Original pilot scenario", "key": "Original pilot action",
             "cert_id": "data-engineer", "distractors": ["One action", "Two action", "Three action"]},
            {"id": "rejected", "stem": "Reviewed rejected scenario", "key": "Reviewed rejected action",
             "cert_id": "data-engineer", "distractors": ["First option", "Second option", "Third option"]}]
    path = tmp_path / "comparison.json"
    retry.export_bank(path, rows)
    restored = load_export(path, cert_id="data-engineer")["questions"]
    assert [(row["id"], row["key"], row["distractors"]) for row in restored] == [
        (row["id"], row["key"], row["distractors"]) for row in rows]


def test_retry_scope_can_change_decision_but_never_frozen_hints(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.execute
    def decide(command):
        original(command)
        if command[1] == "generate":
            path = command[command.index("--artifact") + 1]
            data = retry.read_json(path)
            for row in data["plan"]:
                row["decision_plan"] = {"best_action": "replacement" if "--frozen-plan" in command else "original"}
                row["decision_proof"] = {"passed": True}
            retry.write_json(path, data)
    fixture.execute = decide
    report = fixture.run()
    assert len(report["waves"]) == 2


def test_partial_write_stops_later_waves_and_reports_reconciliation(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.admit
    writes = []
    def partial(path, verdicts, **kwargs):
        if not kwargs["dry_run"]:
            writes.append(path)
            raise ValueError("Unknown persistence journal")
        return original(path, verdicts, **kwargs)
    fixture.admit = partial
    with pytest.raises(ValueError, match="Unknown persistence"):
        fixture.run()
    report = retry.read_json(fixture.artifact.with_suffix(".retry-report.json"))
    assert len(writes) == 1
    assert report["status"] == "write_interrupted"
    assert report["requires_reconciliation"] is True
    assert report["coverage_basis"] == "dry_run_admitted_not_persisted"
    assert report["completed_waves"] == []


@pytest.mark.parametrize("field", ["stem", "correct_option"])
def test_schema_reject_with_empty_authored_text_still_gets_replacement(tmp_path, field):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.execute
    def malformed(command):
        original(command)
        if command[1] == "generate" and "--frozen-plan" not in command:
            path = command[command.index("--artifact") + 1]
            payload = retry.read_json(path)
            row = payload["candidates"][0]
            row.update(schema_check={"passed": False}, failure_stage="schema")
            if field == "stem":
                row["stem"] = ""
            else:
                row["options"][0]["text"] = ""
            retry.write_json(path, payload)
    fixture.execute = malformed
    # Two valid original authored rows remain; the malformed reject is omitted.
    fixture.expected_comparison_count = 2
    report = fixture.run(write=False)
    assert len(report["waves"]) == 2
    assert report["waves"][1]["slots"] == [1]
    assert report["waves"][0]["comparison_omissions"][0]["candidate_id"] == "slot1-a1"
    assert report["sections"][0]["accepted"] == 1


def test_malformed_reviewed_content_remains_integrity_failure(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    original = fixture.execute
    def malformed(command):
        original(command)
        if command[1] == "generate":
            path = command[command.index("--artifact") + 1]
            payload = retry.read_json(path)
            payload["candidates"][0]["stem"] = ""
            retry.write_json(path, payload)
    fixture.execute = malformed
    with pytest.raises(ValueError, match="without a schema"):
        fixture.run()
    assert not any(event[0] == "write" for event in fixture.events)


def interrupted_after_retry_generation(fixture):
    """Save one reviewed wave and a complete but unjudged retry cohort."""
    original = fixture.execute
    def stop(command):
        original(command)
        if command[1] == "generate" and "--frozen-plan" in command:
            raise RuntimeError("Stopped after saved generation")
    fixture.execute = stop
    with pytest.raises(RuntimeError, match="Stopped after"):
        fixture.run(write=False)
    fixture.execute = original
    fixture.events.clear()
    fixture.calls.clear()
    return fixture.artifact.with_name("full-retry1.json")


def test_resume_judges_saved_retry_without_regeneration_and_uses_remaining_attempt(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    before = {str(path): path.read_bytes() for path in tmp_path.rglob("*")
              if path.is_file() and (".plan." in path.name or ".existing." in path.name)}
    report = fixture.run(resume=True)
    assert [event for event in fixture.events if event[0] == "generate"] == [("generate", 3, [2])]
    assert [event[1] for event in fixture.events if event[0] == "review"] == [target.stem, "full-retry2"]
    assert [wave["slots"] for wave in report["waves"]] == [[1, 2, 3], [1, 2], [2]]
    assert report["status"] == "persisted"
    assert report["topics"][0]["attempts"] == 2
    assert report["balance_population_ids"] == ["slot1-a2", "slot2-a3", "slot3-a1"]
    assert all(Path(name).read_bytes() == value for name, value in before.items())
    first_write = next(index for index, event in enumerate(fixture.events) if event[0] == "write")
    assert all(event[0] == "write" for event in fixture.events[first_write:])


def test_resume_legacy_report_without_hash_manifest(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    interrupted_after_retry_generation(fixture)
    path = fixture.artifact.with_suffix(".retry-report.json")
    report = retry.read_json(path)
    report.pop("frozen_files")
    retry.write_json(path, report)
    report = fixture.run(resume=True, write=False)
    assert report["status"] == "admitted"
    assert not any(event[0] == "generate" for event in fixture.events)
    assert not any(event[0] == "write" for event in fixture.events)


def test_resume_admitted_cohort_revalidates_without_judge_or_generation(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    fixture.run(write=False)
    fixture.events.clear()
    fixture.calls.clear()
    report = fixture.run(resume=True, write=False)
    assert report["status"] == "admitted"
    assert all(event[0] == "dry" for event in fixture.events)
    assert all("expected_selected_ids" in kwargs for _, kwargs in fixture.calls)
    assert all("balance_population_ids" in kwargs for _, kwargs in fixture.calls)


@pytest.mark.parametrize("change", ["cap", "status", "missing_wave", "orphan", "scope", "source", "snapshot", "report_slots", "report_ids", "journals", "indices", "missing_requests"])
def test_resume_rejects_changed_or_incomplete_saved_inputs_before_any_call(tmp_path, change):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    path = fixture.artifact.with_suffix(".retry-report.json")
    report = retry.read_json(path)
    payload = retry.read_json(target)
    if change == "cap":
        report["retry_attempts"] = 1
    elif change == "status":
        report["status"] = "write_interrupted"
    elif change == "missing_wave":
        fixture.artifact.unlink()
    elif change == "orphan":
        target.with_name("full-retry3.json").write_text("{}")
    elif change == "scope":
        payload["plan"][0]["required_topic_id"] = "different-topic"
    elif change == "source":
        payload["retry_source"]["source_sha256"] = "0" * 64
    elif change == "snapshot":
        target.with_suffix(".existing.json").write_text("[]")
    elif change == "report_slots":
        report["waves"][0]["slots"] = [1, 2]
    elif change == "report_ids":
        report["waves"][0]["candidate_ids"] = ["other-candidate"]
    elif change == "journals":
        payload["candidates"][0]["persistence_status"] = "unknown"
    elif change == "indices":
        payload["candidates"][0]["index"] = 2
    elif change == "missing_requests":
        target.with_suffix(".judge-requests").rmdir()
    retry.write_json(path, report)
    retry.write_json(target, payload)
    with pytest.raises(ValueError):
        fixture.run(resume=True)
    assert fixture.events == []
    assert fixture.calls == []


def test_resume_rejects_saved_selection_change_before_judging_next_wave(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    interrupted_after_retry_generation(fixture)
    fixture.outcomes[1] = 1
    with pytest.raises(AssertionError):  # Admission's expected-ID invariant.
        fixture.run(resume=True)
    assert not any(event[0] in {"generate", "review", "write"} for event in fixture.events)


def test_resume_global_replay_error_prevents_every_write(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 1, 3: 1})
    interrupted_after_retry_generation(fixture)
    original = fixture.admit
    def fail(path, verdicts, **kwargs):
        if "balance_population_ids" in kwargs:
            raise ValueError("Changed global report")
        return original(path, verdicts, **kwargs)
    fixture.admit = fail
    with pytest.raises(ValueError, match="Changed global"):
        fixture.run(resume=True)
    assert not any(event[0] == "write" for event in fixture.events)


def test_report_explains_each_nonselected_judge_pass_and_preserves_diagnostics(tmp_path):
    fixture = Fixture(tmp_path, {1: 99, 2: 1, 3: 1})
    original = fixture.admit
    def admission(path, verdicts, **kwargs):
        result = original(path, verdicts, **kwargs)
        payload = retry.read_json(path)
        for row in payload["candidates"]:
            row["judge_verdict"] = {"passed": True, "score": 0.9}
            if not row["publication_selected"]:
                row.update(failure_stage="product_share", reason="Rolling product cap exceeded",
                           product_share_check={"passed": False, "denominator": 40, "max_per_product": 16})
        payload["product_share_report"] = {"unknown_bank_count": 3, "selected_count": len(result["selected_candidates"])}
        payload["option_prefix_report"] = {"passed": True}
        retry.write_json(path, payload)
        result["quality_rejections"] = {"by_stage": {"product_share": 1}}
        return result
    fixture.admit = admission
    report = fixture.run(write=False)
    diagnostics = report["waves"][0]["selection_diagnostics"]
    assert diagnostics["external_judge_passed"] == 3
    assert diagnostics["selected_count"] == 2
    assert diagnostics["non_selected_judge_passes"][0]["candidate_id"] == "slot1-a1"
    assert diagnostics["non_selected_judge_passes"][0]["failure_stage"] == "product_share"
    assert diagnostics["non_selected_judge_passes"][0]["product_share_check"]["max_per_product"] == 16
    assert diagnostics["product_share_report"]["unknown_bank_count"] == 3
    assert diagnostics["batch_reports"]["option_prefix_report"] == {"passed": True}
    assert diagnostics["quality_rejections"]["by_stage"] == {"product_share": 1}


def test_ordinary_prejudge_rejects_in_both_retry_waves_do_not_block_other_slots(tmp_path):
    fixture = Fixture(tmp_path, {1: 99, 2: 3, 3: 1})
    original = fixture.execute
    def ordinary_rejection(command):
        original(command)
        if command[1] == "generate":
            target = Path(command[command.index("--artifact") + 1])
            payload = retry.read_json(target)
            for row in payload["candidates"]:
                if row["slot"] == 1:
                    row.update(failure_stage="schema", error_class="CandidateRejected",
                               schema_check={"passed": False}, reason="Ordinary schema veto")
            retry.write_json(target, payload)
    fixture.execute = ordinary_rejection
    fixture.failure_stage = "schema"
    report = fixture.run()
    assert [event[1] for event in fixture.events if event[0] == "review"] == ["full", "full-retry1", "full-retry2"]
    assert len([event for event in fixture.events if event[0] == "write"]) == 3
    assert report["sections"][0]["shortfall"] == 1
    assert report["topics"][0]["attempts"] == 3
    assert report["status"] == "persisted"


def test_new_generation_transport_stop_during_resume_still_prevents_all_writes(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    interrupted_after_retry_generation(fixture)
    original = fixture.execute
    def transport(command):
        if command[1] == "generate":
            raise RuntimeError("New transport failure")
        original(command)
    fixture.execute = transport
    with pytest.raises(RuntimeError, match="New transport"):
        fixture.run(resume=True, acknowledge_saved_system_failures=True)
    assert not any(event[0] == "write" for event in fixture.events)


def test_resume_saved_system_failure_acknowledgement_is_explicit_and_wave_local(tmp_path, monkeypatch):
    from scripts import ingest_external_verdicts as ingestion
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    payload = retry.read_json(target)
    payload["candidates"][0].update(error_class="ReadTimeout", failure_stage="documentation",
                                     error_message="Provider body must never enter retry report")
    retry.write_json(target, payload)
    # The native helper has independent frozen-artifact shape tests. This fixture
    # supplies only its narrow result, not production request/proof documents.
    def discovered(payload):
        return frozenset(row["candidate_id"] for row in payload["candidates"] if row.get("error_class") == "ReadTimeout")
    monkeypatch.setattr(ingestion, "saved_system_failure_ids", discovered)
    with pytest.raises(ValueError, match="explicit acknowledgement"):
        fixture.run(resume=True)
    assert fixture.events == []
    report = fixture.run(resume=True, acknowledge_saved_system_failures=True, write=False)
    ack = report["acknowledged_saved_system_failures"]
    assert ack == [{"artifact": str(target), "candidate_id": "slot1-a2",
                    "error_class": "ReadTimeout", "failure_stage": "documentation"}]
    assert "Provider body" not in json.dumps(report)
    for path, kwargs in fixture.calls:
        assert kwargs.get("acknowledged_system_failure_ids", []) == (["slot1-a2"] if path == target else [])


def test_acknowledgement_without_resume_is_invalid(tmp_path):
    fixture = Fixture(tmp_path, {1: 1, 2: 1, 3: 1})
    with pytest.raises(ValueError, match="only be acknowledged with resume"):
        fixture.run(acknowledge_saved_system_failures=True)
    assert fixture.events == []


def test_all_saved_request_cohorts_are_validated_before_any_execution(tmp_path, monkeypatch):
    from scripts import ingest_external_verdicts as ingestion
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    seen = []
    def invalid(path, payload):
        seen.append(path)
        if path == target:
            raise ValueError("Frozen request hash mismatch")
    monkeypatch.setattr(ingestion, "validate_saved_judge_requests", invalid)
    with pytest.raises(ValueError, match="request hash"):
        fixture.run(resume=True)
    assert seen == [fixture.artifact, target]
    assert fixture.events == []
    assert fixture.calls == []


def test_saved_comparison_export_cannot_omit_rejected_authored_content(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    snapshot = target.with_suffix(".existing.json")
    snapshot.write_text("[]")
    payload = retry.read_json(target)
    payload["existing_questions"]["sha256"] = retry.digest(snapshot)
    retry.write_json(target, payload)
    with pytest.raises(ValueError, match="earlier authored"):
        fixture.run(resume=True)
    assert not any(event[0] in {"review", "generate", "write"} for event in fixture.events)


def test_resume_cannot_clear_a_saved_persisted_flag(tmp_path):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    payload = retry.read_json(target)
    payload["candidates"][0]["persisted"] = True
    retry.write_json(target, payload)
    with pytest.raises(ValueError, match="Persistence journals"):
        fixture.run(resume=True)
    assert fixture.events == []


@pytest.mark.parametrize("saved_file", ["pending_artifact", "retry_report"])
@pytest.mark.parametrize("malformation", ["duplicate_key", "NaN", "Infinity", "-Infinity", "1e999"])
def test_resume_rejects_ambiguous_saved_json_before_any_call(tmp_path, saved_file, malformation):
    fixture = Fixture(tmp_path, {1: 2, 2: 3, 3: 1})
    target = interrupted_after_retry_generation(fixture)
    path = target if saved_file == "pending_artifact" else fixture.artifact.with_suffix(".retry-report.json")
    value = path.read_text()
    if malformation == "duplicate_key":
        key = "candidates" if saved_file == "pending_artifact" else "version"
        path.write_text("{" + json.dumps(key) + ": null," + value[1:])
        expected = "Duplicate JSON"
    else:
        path.write_text('{"ignored_nonfinite": ' + malformation + ',' + value[1:])
        expected = "Nonfinite JSON"
    with pytest.raises(ValueError, match=expected):
        fixture.run(resume=True)
    assert fixture.events == []
    assert fixture.calls == []
