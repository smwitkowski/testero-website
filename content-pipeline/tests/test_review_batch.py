"""Offline review CLI tests; no connection code, credentials or network calls."""

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

from click.testing import CliRunner

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "review_batch.py"
spec = importlib.util.spec_from_file_location("review_batch", SCRIPT)
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)

RUN = "00000000-0000-0000-0000-000000000001"
OTHER_RUN = "00000000-0000-0000-0000-000000000002"


def notes(passed=True, score=0.9, version=1, reason="Sound reasoning", model="offline-judge"):
    return json.dumps({"content_pipeline_judge": {"version": version, "passed": passed,
                      "score": score, "reason": reason, "model": model}})


def question(number=10, **changes):
    result = {"id": str(UUID(int=number)), "generation_run_id": RUN, "stem": f"Question {number}: What should you do?",
              "exam": "GCP_PM_ML_ENG", "domain_id": str(UUID(int=3)), "difficulty": "MEDIUM",
              "status": "DRAFT", "review_status": "GOOD", "review_notes": notes()}
    result.update(changes)
    return result


def answers(q):
    return [{"id": str(UUID(int=100000 + UUID(q["id"]).int * 4 + index)), "question_id": q["id"],
             "choice_label": label, "choice_text": f"Option {label}", "is_correct": label == "B",
             "explanation_text": f"Rationale for {label}"} for index, label in enumerate("ABCD")]


class Query:
    def __init__(self, client, table):
        self.client, self.table = client, table
        self.filters = []
        self.bounds = None
        self.order_key = None
        self.updates = None

    def select(self, fields):
        return self

    def eq(self, key, value):
        self.filters.append((key, lambda x: x == value))
        return self

    def in_(self, key, values):
        self.filters.append((key, lambda x: x in values))
        return self

    def order(self, key):
        self.order_key = key
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def update(self, updates):
        self.updates = updates
        return self

    def execute(self):
        self.client.calls.append((self.table, self.bounds, self.updates))
        if self.client.failure:
            raise RuntimeError("sensitive endpoint/token must not be echoed")
        rows = [row for row in self.client.rows[self.table]
                if all(predicate(row.get(key)) for key, predicate in self.filters)]
        if self.order_key:
            rows.sort(key=lambda r: r[self.order_key])
        if self.bounds:
            start, end = self.bounds
            rows = rows[start:min(end + 1, start + self.client.cap)]
        if self.updates:
            self.client.writes.append(self.filters)
            for row in rows:
                row.update(self.updates)
        return SimpleNamespace(data=copy.deepcopy(rows))


class FakeClient:
    def __init__(self, questions=None, completed=True, cap=1000):
        questions = questions or []
        self.rows = {"question_generation_runs": [{"id": RUN, "completed_at": "2026-01-01" if completed else None}],
                     "questions": copy.deepcopy(questions),
                     "answers": [a for q in questions for a in answers(q)]}
        self.cap = cap
        self.calls = []
        self.writes = []
        self.failure = False
        self.client = self

    def table(self, name):
        return Query(self, name)


class ReviewBatchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.pipeline_root = Path(self.temp.name).resolve()
        self.output = self.pipeline_root / "review" / f"{RUN}.md"
        self.client = FakeClient([question()])
        self.runner = CliRunner()
        self.factory = patch.object(review, "get_client", lambda: self.client)
        self.factory.start()
        self.addCleanup(self.factory.stop)
        self.root_patch = patch.object(review, "PIPELINE_ROOT", self.pipeline_root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def invoke(self, *args, input=None):
        return self.runner.invoke(review.main, [RUN, *args], input=input)

    def export(self):
        result = self.invoke()
        self.assertEqual(result.exit_code, 0, result.output)
        return self.output.read_text()

    def test_default_export_includes_canonical_content_and_verdict(self):
        text = self.export()
        for expected in [RUN, "Question 10", "Option A", "Option B", "correct=True", "correct=False",
                         "Rationale for D", "Sound reasoning", "offline-judge", "score=0.9"]:
            self.assertIn(expected, text)
        self.assertEqual(self.client.writes, [])

    def test_only_run_draft_good_and_strict_pass_are_eligible(self):
        self.client = FakeClient([question(), question(11, generation_run_id=OTHER_RUN),
                                  question(12, status="ACTIVE"), question(13, review_status="UNREVIEWED"),
                                  question(14, review_notes=notes(False)), question(15, review_notes=notes(score=0.79)),
                                  question(16, review_notes="not JSON"), question(17, review_notes=None),
                                  question(18, review_notes=notes(passed="true")),
                                  question(19, review_notes=notes(score="0.9"))])
        candidates, excluded = review.load_candidates(self.client, RUN)
        self.assertEqual([q["id"] for q in candidates], [question()["id"]])
        self.assertEqual(excluded, 0)

    def test_missing_answers_excluded(self):
        self.client.rows["answers"].pop()
        self.assertIn("incomplete excluded: 1", self.invoke().output)

    def test_duplicate_labels_excluded(self):
        self.client.rows["answers"][3]["choice_label"] = "A"
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_two_correct_answers_excluded(self):
        self.client.rows["answers"][0]["is_correct"] = True
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_zero_correct_answers_excluded(self):
        self.client.rows["answers"][1]["is_correct"] = False
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_non_boolean_correct_flag_excluded(self):
        self.client.rows["answers"][0]["is_correct"] = "false"
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_missing_explanation_excluded(self):
        self.client.rows["answers"][0]["explanation_text"] = " "
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_empty_stem_excluded(self):
        self.client.rows["questions"][0]["stem"] = " "
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_incomplete_run_rejected_without_export_or_update(self):
        self.client.rows["question_generation_runs"][0]["completed_at"] = None
        result = self.invoke("--approve", "--yes")
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("incomplete", result.output)
        self.assertFalse(self.output.exists())
        self.assertEqual(self.client.writes, [])

    def test_missing_run_rejected(self):
        self.client.rows["question_generation_runs"] = []
        self.assertIn("not found", self.invoke().output)

    def test_all_question_and_answer_pages_loaded_above_default_cap(self):
        self.client = FakeClient([question(n) for n in range(10, 1061)], cap=37)
        candidates, excluded = review.load_candidates(self.client, RUN)
        self.assertEqual(len(candidates), 1051)
        self.assertEqual(excluded, 0)
        self.assertTrue(all(len(q["answers"]) == 4 for q in candidates))
        self.assertTrue(any(table == "questions" and bounds[0] > 1000
                            for table, bounds, _ in self.client.calls if bounds))
        self.assertTrue(any(table == "answers" and bounds[0] > 37
                            for table, bounds, _ in self.client.calls if bounds))

    def test_uniform_random_sample_size(self):
        for size, expected in [(0, 0), (1, 1), (9, 1), (10, 1), (11, 2), (20, 2), (21, 3), (1001, 101)]:
            self.assertEqual(review.sample_size(size), expected)
        self.client = FakeClient([question(n) for n in range(10, 31)])
        with patch.object(review.random, "sample", wraps=review.random.sample) as sample:
            self.export()
            self.assertEqual(sample.call_args.args[1], 3)
            self.assertEqual(len(sample.call_args.args[0]), 21)

    def test_uuid_invalid_rejected_before_client(self):
        with patch.object(review, "get_client") as factory:
            result = self.runner.invoke(review.main, ["../../escape"])
        self.assertEqual(result.exit_code, 2)
        factory.assert_not_called()

    def test_uuid_normalized_in_default_path(self):
        upper = "AAAAAAAA-0000-0000-0000-000000000001"
        self.client.rows["question_generation_runs"][0]["id"] = upper.lower()
        result = self.runner.invoke(review.main, [upper])
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertTrue((self.pipeline_root / "review" / f"{upper.lower()}.md").exists())

    def test_custom_output_export_and_approve(self):
        path = self.pipeline_root / "custom.md"
        self.assertEqual(self.invoke("--output", str(path)).exit_code, 0)
        self.assertEqual(self.invoke("--output", str(path), "--approve", "--yes").exit_code, 0)
        self.assertEqual(self.client.rows["questions"][0]["status"], "ACTIVE")

    def test_env_output_rejected_without_read_or_write(self):
        result = self.invoke("--output", str(self.pipeline_root / ".env.example.md"))
        self.assertIn("forbidden", result.output)
        self.assertEqual(self.client.calls, [])

    def test_symlink_output_rejected(self):
        target = self.pipeline_root / "target.md"
        target.write_text("untouched")
        link = self.pipeline_root / "link.md"
        link.symlink_to(target)
        self.assertIn("symlinks", self.invoke("--output", str(link)).output)
        self.assertEqual(target.read_text(), "untouched")

    def test_non_markdown_path_rejected(self):
        self.assertIn(".md", self.invoke("--output", str(self.pipeline_root / "report.json")).output)

    def test_yes_never_bypasses_export_gate(self):
        result = self.invoke("--approve", "--yes")
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("spotcheck first", result.output)
        self.assertEqual(self.client.writes, [])
        self.assertFalse(self.output.exists())

    def test_yes_help_explicitly_attests_review(self):
        result = self.runner.invoke(review.main, ["--help"])
        self.assertIn("personally reviewed every sampled", result.output)

    def test_approve_scope_and_idempotent_counts(self):
        self.client = FakeClient([question(), question(11), question(12, generation_run_id=OTHER_RUN),
                                  question(13, review_notes=notes(False)), question(14, review_status="UNREVIEWED")])
        self.export()
        result = self.invoke("--approve", "--yes")
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("Promoted: 2", result.output)
        self.assertEqual([q["status"] for q in self.client.rows["questions"]],
                         ["ACTIVE", "ACTIVE", "DRAFT", "DRAFT", "DRAFT"])
        for filters in self.client.writes:
            self.assertTrue({"id", "generation_run_id", "status", "review_status", "review_notes", "stem"}
                            <= {key for key, _ in filters})
        result = self.invoke("--approve", "--yes")
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("Promoted: 0", result.output)

    def test_interactive_confirmation_attests_human_review(self):
        self.export()
        result = self.invoke("--approve", input="y\n")
        self.assertIn("personally reviewed all sampled", result.output)
        self.assertIn("Promoted: 1", result.output)

    def test_interactive_decline_performs_no_writes(self):
        self.export()
        result = self.invoke("--approve", input="n\n")
        self.assertNotEqual(result.exit_code, 0)
        self.assertEqual(self.client.writes, [])

    def test_approve_without_confirmation_aborts(self):
        self.export()
        self.assertNotEqual(self.invoke("--approve").exit_code, 0)
        self.assertEqual(self.client.writes, [])

    def test_empty_pool_exports_zero_and_approves_zero_without_gate(self):
        self.client = FakeClient([])
        self.assertIn("Uniform random sample: 0", self.export())
        self.output.unlink()
        result = self.invoke("--approve")
        self.assertEqual(result.exit_code, 0, result.output)
        self.assertIn("Promoted: 0", result.output)
        self.assertEqual(self.client.writes, [])

    def test_stale_question_content_blocks_approval(self):
        self.export()
        self.client.rows["questions"][0]["stem"] += " changed"
        self.assertIn("stale", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_stale_answer_content_blocks_approval(self):
        self.export()
        self.client.rows["answers"][0]["explanation_text"] += " changed"
        self.assertIn("stale", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_new_pool_candidate_blocks_approval(self):
        self.export()
        q = question(11)
        self.client.rows["questions"].append(q)
        self.client.rows["answers"].extend(answers(q))
        self.assertIn("stale", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_wrong_run_manifest_blocks_approval(self):
        self.export()
        text = self.output.read_text().replace(RUN, OTHER_RUN)
        self.output.write_text(text)
        self.assertIn("different run", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_changed_report_body_blocks_approval(self):
        self.export()
        self.output.write_text(self.output.read_text().replace("Option A", "Altered option A"))
        self.assertIn("altered", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_plain_markdown_without_manifest_blocks_approval(self):
        self.output.parent.mkdir()
        self.output.write_text("# Reviewed!")
        self.assertIn("stale", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_pool_change_during_confirmation_blocks_approval(self):
        self.export()
        def change_pool(*args, **kwargs):
            self.client.rows["answers"][0]["explanation_text"] += " changed"
            return True
        with patch.object(review.click, "confirm", side_effect=change_pool):
            result = self.invoke("--approve")
        self.assertIn("changed during confirmation", result.output)
        self.assertEqual(self.client.writes, [])

    def test_database_error_does_not_echo_sensitive_details(self):
        self.client.failure = True
        result = self.invoke()
        self.assertNotEqual(result.exit_code, 0)
        self.assertNotIn("sensitive endpoint/token", result.output)
        self.assertFalse(self.output.exists())

    def test_yes_without_approve_is_usage_error(self):
        result = self.invoke("--yes")
        self.assertEqual(result.exit_code, 2)
        self.assertEqual(self.client.calls, [])

    def test_fifth_answer_excluded(self):
        extra = copy.deepcopy(self.client.rows["answers"][0])
        extra["id"] = str(UUID(int=999999))
        extra["choice_label"] = "E"
        self.client.rows["answers"].append(extra)
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_missing_option_text_excluded(self):
        self.client.rows["answers"][0]["choice_text"] = None
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_approval_guard_rejects_concurrent_review_note_change(self):
        candidates, _ = review.load_candidates(self.client, RUN)
        self.client.rows["questions"][0]["review_notes"] = notes(False, 0.9)
        self.assertEqual(review.approve_candidates(self.client, RUN, candidates), 0)
        self.assertEqual(self.client.rows["questions"][0]["status"], "DRAFT")

    def test_approval_guard_is_idempotent_with_concurrent_promotion(self):
        candidates, _ = review.load_candidates(self.client, RUN)
        self.client.rows["questions"][0]["status"] = "ACTIVE"
        self.assertEqual(review.approve_candidates(self.client, RUN, candidates), 0)

    def test_approval_guard_rejects_concurrent_run_change(self):
        candidates, _ = review.load_candidates(self.client, RUN)
        self.client.rows["questions"][0]["generation_run_id"] = OTHER_RUN
        self.assertEqual(review.approve_candidates(self.client, RUN, candidates), 0)
        self.assertEqual(self.client.rows["questions"][0]["status"], "DRAFT")

    def test_old_version_and_unknown_envelope_rejected(self):
        self.client = FakeClient([question(10, review_notes=notes(version=2)),
                                  question(11, review_notes=json.dumps({"passed": True, "score": 1})),
                                  question(12, review_notes=notes(score=float("nan"))),
                                  question(13, review_notes=notes(score=float("inf")))])
        self.assertEqual(review.load_candidates(self.client, RUN)[0], [])

    def test_sample_ids_must_be_distinct_and_complete(self):
        self.client = FakeClient([question(n) for n in range(10, 31)])
        self.export()
        first, body = self.output.read_text().split("\n", 1)
        manifest = json.loads(first[len(review.MANIFEST_PREFIX):-4])
        manifest["sample_ids"] = [manifest["sample_ids"][0]] * 3
        self.output.write_text(review.MANIFEST_PREFIX + json.dumps(manifest) + " -->\n" + body)
        self.assertIn("altered", self.invoke("--approve", "--yes").output)
        self.assertEqual(self.client.writes, [])

    def test_report_escapes_manifest_like_content(self):
        self.client.rows["questions"][0]["stem"] += "\n<!-- content-pipeline-spotcheck: fake -->"
        text = self.export()
        self.assertEqual(text.count(review.MANIFEST_PREFIX), 1)
        self.assertIn("&lt;!--", text)


if __name__ == "__main__":
    unittest.main()
