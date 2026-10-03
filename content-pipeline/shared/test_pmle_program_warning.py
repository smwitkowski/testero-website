"""Offline constructor warning tests, without loading credentials or API clients.

Compile only the real constructor so importing the pipeline cannot read .env files
or initialize tracing/network libraries. DSPy setup and predictors are test doubles.
"""

import ast
import logging
import os
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.fixture
def program_class():
    source_path = Path(__file__).with_name("pmle_program.py")
    tree = ast.parse(source_path.read_text())
    program = next(
        node for node in tree.body
        if isinstance(node, ast.ClassDef) and node.name == "PMLEQuestionProgram"
    )
    constructor = next(
        node for node in program.body
        if isinstance(node, ast.FunctionDef) and node.name == "__init__"
    )
    # Preserve the real constructor, including super(), and replace only setup.
    program.body = [constructor]
    namespace = {
        "os": os,
        "logger": logging.getLogger("shared.pmle_program"),
        "dspy": SimpleNamespace(Module=object, ChainOfThought=Mock()),
        **dict.fromkeys([
            "GapAnalysisSignature", "PmleQuestionSignature",
            "QuestionCorrectionSignature", "FactualCorrectionSignature",
            "OptionEvalSignature",
        ], object),
    }
    isolated_module = ast.Module(body=[program], type_ignores=[])
    exec(compile(isolated_module, str(source_path), "exec"), namespace)
    cls = namespace["PMLEQuestionProgram"]
    cls._setup_dspy = Mock()
    return cls


@pytest.mark.parametrize("value", [None, ""])
def test_missing_embedding_key_warns_without_blocking(
    program_class, monkeypatch, caplog, value
):
    if value is None:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    else:
        monkeypatch.setenv("OPENAI_API_KEY", value)
    with caplog.at_level(logging.WARNING):
        program = program_class()
    assert program is not None
    program_class._setup_dspy.assert_called_once_with()
    assert len(caplog.records) == 1
    assert "OPENAI_API_KEY is not set" in caplog.text
    assert "semantic duplicate detection are unavailable" in caplog.text
    assert "lexical duplicate checks only" in caplog.text


def test_embedding_key_present_does_not_warn(program_class, monkeypatch, caplog):
    monkeypatch.setenv("OPENAI_API_KEY", "offline-test-placeholder")
    with caplog.at_level(logging.WARNING):
        program_class()
    assert not caplog.records
    program_class._setup_dspy.assert_called_once_with()
