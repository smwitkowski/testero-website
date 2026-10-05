"""Actual Claude CLI authentication failure replay; no invented judge fields."""
import json
from pathlib import Path
import pytest
from shared.cli_models import CLIExitError, parse_claude_output
from shared.quality_gate import QuestionQualitySignature

FIXTURES = Path(__file__).parent / "fixtures/cli_models"


def test_real_claude_expired_oauth_fails_without_structured_verdict():
    text = (FIXTURES / "judge-output.json").read_text()
    data = json.loads(text)
    assert data["is_error"] is True
    assert data["result"] == "Failed to authenticate: OAuth session expired and could not be refreshed"
    assert "structured_output" not in data
    with pytest.raises(CLIExitError):
        parse_claude_output(text, QuestionQualitySignature)
