#!/usr/bin/env python3
"""Inspect/backfill variant attempt failures offline, without generation or judging."""
import argparse
from copy import deepcopy
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.ingest_external_verdicts import _read_json, artifact_lock, _flush
from shared.variant_diagnostics import backfill_failures


def backfill(artifact, *, write=False):
    artifact = Path(artifact)
    with artifact_lock(artifact):
        payload = _read_json(artifact)
        original = deepcopy(payload)
        result = backfill_failures(payload)
        if write and payload != original:
            backup = artifact.with_name(artifact.stem + ".before-failure-backfill.json")
            with backup.open("xb") as stream:
                stream.write(artifact.read_bytes())
            _flush(artifact, payload)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifact", required=True, type=Path)
    parser.add_argument("--write", action="store_true", help="Add metadata in place after an exclusive byte-for-byte backup.")
    args = parser.parse_args()
    print(json.dumps(backfill(args.artifact, write=args.write), indent=2))


if __name__ == "__main__":
    main()
