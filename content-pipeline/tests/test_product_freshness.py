"""Structured freshness classification preserves publication vetoes."""
import json
from shared.product_freshness import QUESTION_TEXT_FIELDS, freshness_findings, freshness_errors


def test_structured_status_preserves_legacy_publication_errors(tmp_path):
    question = {field: "Current learner prose" for field in QUESTION_TEXT_FIELDS}
    question["stem"] = "Old Renamed or Old Retired? https://cloud.google.com/Old-Renamed"
    entries = [{"old": name, "new": "Current", "status": status, "source": "fixture"}
               for name, status in [("Old Renamed", "renamed"), ("Old Retired", "retired")]]
    path = tmp_path / "lexicon.json"
    path.write_text(json.dumps({"version": 1, "products": entries}))
    assert freshness_findings(question, lexicon_path=path) == [{"field": "stem", **entry} for entry in entries]
    assert freshness_errors(question, lexicon_path=path) == [
        "freshness:stem: Old Renamed (renamed); use Current",
        "freshness:stem: Old Retired (retired); use Current"]
