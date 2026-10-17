"""Offline report populations and explicit usage denominators."""
from scripts.token_report import summarize


def test_missing_usage_is_not_zero_and_publication_is_explicit():
    rows = [{"stage": "write", "index": 1, "input_tokens": 100, "output_tokens": 9,
             "cached_input_tokens": 50, "reasoning_tokens": 4, "seconds": 1, "ok": True},
            {"stage": "judge_style", "index": 1, "input_tokens": None,
             "seconds": 2, "ok": False}]
    result = summarize(rows, 2)
    assert result["tokens"]["input_tokens"] == {"known_tokens": 100, "calls_with_usage": 1, "total_calls": 2}
    assert result["known_tokens_per_published"]["input_tokens"] == 50
    assert result["failed_calls"] == 1 and result["seconds"] == 3
    assert len([group for group in result["groups"] if group["kind"] == "candidate"]) == 1
    assert summarize(rows, None)["known_tokens_per_published"]["input_tokens"] is None
    assert summarize(rows, 0)["known_tokens_per_published"]["input_tokens"] is None
