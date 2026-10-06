"""Offline checks for the exact founder-run v4 pilot commands."""
from pathlib import Path
import shlex
from collections import Counter

from shared.cert_context import plan_questions


def commands():
    text = (Path(__file__).parents[1] / "calibration/PILOT-v4.md").read_text()
    block = text.split("```sh\n", 1)[1].split("```", 1)[0]
    return [shlex.split(line.replace("\\\n", " ")) for line in block.split("\n\n") if line.strip()]


def test_pilot_is_exact_thirty_item_section_plan_and_three_gate_external_flow():
    steps = commands()
    assert steps[0][0] == "cd"
    scripts = [next(arg for arg in step if arg.endswith(".py")) for step in steps[1:]]
    assert [Path(script).name for script in scripts] == [
        "generate_all_domains.py", "judge_requests.py", "repair_candidates.py",
        "judge_requests.py", "ingest_external_verdicts.py",
    ]
    generation = steps[1]
    assert generation[generation.index("--model") + 1] == "codex"
    assert generation[generation.index("--judge-model") + 1] == "external"
    assert generation[generation.index("--n-questions") + 1] == "30"
    quotas = [int(n) for n in generation[generation.index("--section-allocation") + 1].split(",")]
    assert quotas == [4, 5, 6, 6, 5, 4]
    plan = plan_questions("machine-learning-engineer", 30, section_allocation=quotas, seed=0)
    assert list(Counter(item["domain_code"] for item in plan).values()) == quotas
    assert Counter(item["key_length_rank"] for item in plan) == {1: 8, 2: 8, 3: 7, 4: 7}
    for step in steps[1:5]:
        assert step[step.index("--parallel") + 1] == "3"
    for step in (steps[2], steps[4]):
        assert step[step.index("--judge-model") + 1] == "claude"
    assert "--dry-run" in steps[5]
    assert all(step[0] == "PYTHON_DOTENV_DISABLED=1" for step in steps[1:])


def test_process_and_standalone_pilot_commands_match_exactly():
    process = (Path(__file__).parents[1] / "PROCESS.md").read_text()
    current = process.split("## Historical rules-v3 operator flow", 1)[0]
    block = current.split("```sh\n", 1)[1].split("```", 1)[0]
    parsed = [shlex.split(line.replace("\\\n", " ")) for line in block.split("\n\n") if line.strip()]
    assert parsed == commands()
