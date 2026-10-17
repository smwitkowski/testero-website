"""Apply frozen origin/main telemetry only; no model calls or baseline behavior changes.

Requires a separate clean checkout. Dry-run by default. --calls is embedded as
an absolute sink in that checkout's helper; no environment setup is needed.
"""
import argparse
import json
from pathlib import Path
import subprocess


def transform(root, calls):
    manifest = json.loads(Path(__file__).with_name("baseline_telemetry_manifest.json").read_text())
    updates = {}
    for row in manifest["files"]:
        path = root / "content-pipeline" / row["path"]
        import hashlib
        original = path.read_text()
        if hashlib.sha256(original.encode()).hexdigest() != row["sha256"]:
            raise ValueError("Baseline source drift: " + row["path"])
        lines = original.splitlines(True)
        for hunk in reversed(row["hunks"]):
            lines[hunk["start"]:hunk["end"]] = [hunk["new"]]
        updated = "".join(lines)
        compile(updated, str(path), "exec")
        updates[path] = updated
    helper = root / "content-pipeline/shared/call_logging.py"
    if helper.exists():
        raise ValueError("Baseline already contains call_logging.py")
    text = manifest["helper"] + "\nBASELINE_CALLS_PATH = " + repr(str(calls.resolve())) + "\n"
    compile(text, str(helper), "exec")
    updates[helper] = text
    return updates


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", required=True, type=Path)
    parser.add_argument("--calls", required=True, type=Path)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.baseline.resolve()
    if root == Path(__file__).resolve().parents[2]:
        parser.error("Use a separate baseline checkout")
    dirty = subprocess.run(["git", "-C", str(root), "status", "--porcelain"],
                           capture_output=True, text=True, check=True)
    if dirty.stdout:
        parser.error("Baseline must be clean")
    updates = transform(root, args.calls)
    print(json.dumps({"label": "origin/main + telemetry", "applied": args.apply,
                      "files": [str(path.relative_to(root)) for path in updates],
                      "identity": "pre-write uses deterministic empty-question candidate_id; index correlates final identity"}))
    if args.apply:
        for path, text in updates.items():
            path.write_text(text)


if __name__ == "__main__":
    main()
