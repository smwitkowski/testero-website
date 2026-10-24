"""Subscription quota probe using the existing isolated, tool-disabled CLI transport.

Default --print describes the probe without reading credentials or login state.
"""
import argparse


def probe(provider):
    import dspy
    from shared.cli_models import run_signature
    class Probe(dspy.Signature):
        """Reply with the single word ok. Do not perform any other action."""
        task: str = dspy.InputField()
        answer: str = dspy.OutputField()
    result = run_signature(provider, Probe, {"task": "Reply ok."}, reasoning_effort="low")
    if result.get("answer", "").strip().lower().rstrip(".") != "ok":
        raise ValueError("Quota probe returned an unexpected answer")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=("claude", "codex"), required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--print", action="store_true")
    mode.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if not args.live:
        print("Offline preview: isolated " + args.provider + " subscription quota probe; no call made")
        return 0
    try:
        probe(args.provider)
        return 0
    except Exception:
        parser.exit(2, "Subscription quota/auth probe failed. No fallback attempted.\n")


if __name__ == "__main__":
    raise SystemExit(main())
