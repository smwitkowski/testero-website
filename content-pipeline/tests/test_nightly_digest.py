"""Offline Resend transport contracts; never send real mail or read credentials."""
import json
from unittest.mock import Mock

from scripts import nightly_digest as mail


def test_explicit_user_agent_no_redirect_and_timeout(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "synthetic-send-only-key")
    response = Mock(status=202)
    opener = Mock()
    opener.open.return_value.__enter__ = Mock(return_value=response)
    opener.open.return_value.__exit__ = Mock(return_value=False)
    build = Mock(return_value=opener)
    monkeypatch.setattr(mail, "build_opener", build)
    mail.send("Synthetic digest", {"sender": "pipeline@example.test", "recipient": "founder@example.test"})
    assert isinstance(build.call_args.args[0], mail.NoRedirect)
    request = opener.open.call_args.args[0]
    assert request.get_header("User-agent") == "testero-pipeline/1.0"
    assert request.full_url == "https://api.resend.com/emails" and request.get_method() == "POST"
    assert request.get_header("Content-type") == "application/json"
    assert json.loads(request.data)["text"] == "Synthetic digest"
    assert opener.open.call_args.kwargs == {"timeout": 30}
    assert build.call_args.args[0].redirect_request(None, None, 302, "redirect", {}, "https://example.test") is None
