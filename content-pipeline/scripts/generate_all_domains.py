#!/usr/bin/env python3
"""Generate one weighted total budget through the certification-aware CLI.

Uses the same --cert, --n-questions TOTAL, --dry-run, --artifact PATH, --model,
--judge-model and --difficulty options as generate_pmle_questions.py.
There are no equal-count domain loops or subprocesses.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main(*args, **kwargs):
    # Lazy import keeps importing this wrapper offline and free of client setup.
    from scripts.generate_pmle_questions import main as generate_main

    return generate_main(*args, **kwargs)


if __name__ == "__main__":
    main()
