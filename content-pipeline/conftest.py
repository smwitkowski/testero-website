"""Offline-only test environment for the content pipeline."""
import os
import socket

import dotenv
import pytest

# Apply before test module collection, which imports traced DSPy modules.
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"
dotenv.load_dotenv = lambda *args, **kwargs: False


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Network access is forbidden in content-pipeline tests")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket.socket, "connect_ex", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    # Socket patches do not reach CLI child processes; block subscription calls too.
    from shared import cli_models
    monkeypatch.setattr(cli_models.subprocess, "run", forbidden)
