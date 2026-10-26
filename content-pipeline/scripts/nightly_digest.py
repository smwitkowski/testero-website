"""Safe text digest/page formatter. Default print never reads credentials or sends mail."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def digest(report):
    return "\n".join([
        "Testero pipeline v6", "Status: " + str(report.get("status", "unknown")),
        "Mode: " + str(report.get("mode", "unknown")),
        "Generation-only experiment (publishing rules unchanged): " + json.dumps(report.get("generation_experiment", {}), sort_keys=True),
        "A/B candidate arms (including partial artifacts): " + json.dumps(report.get("ab_batches", []), sort_keys=True),
        "Funnel and coverage: " + json.dumps(report.get("batches", []), sort_keys=True),
        "Weekly paid USD (conservative reservations included): " + json.dumps(report.get("budget", {}).get("weekly_usd")),
        "Observed weekly funnel/cost: " + json.dumps(report.get("weekly_observed", "unavailable"), sort_keys=True),
        "Council agreement/canary catch rate: " + json.dumps(report.get("health", "unavailable"), sort_keys=True),
        "Re-council/defects: " + json.dumps(report.get("recouncil", "unavailable"), sort_keys=True),
        "Coverage vs blueprint: " + json.dumps(report.get("coverage", "unavailable"), sort_keys=True),
        "Freshness age/site-vs-DB count: not yet independently measured (week 2).",
        "Answer statistics: dormant until minimum sample sizes exist.",
        "No user reports means unknown, not safe.",
        "Pages: " + json.dumps(report.get("pages", [])),
        "Stop reason: " + str(report.get("reason", "none")),
    ])


def send(text, config):
    key = os.environ.get("RESEND_API_KEY")
    if not key:
        raise ValueError("Runtime RESEND_API_KEY is required")
    sender, recipient = config.get("sender"), config.get("recipient")
    if any(not isinstance(value, str) or "@" not in value or any(c in value for c in "\r\n") for value in (sender, recipient)):
        raise ValueError("Configured sender/recipient are required")
    request = Request("https://api.resend.com/emails", method="POST",
                      headers={"Authorization": "Bearer " + key, "Content-Type": "application/json",
                               "User-Agent": "testero-pipeline/1.0"},
                      data=json.dumps({"from": sender, "to": [recipient],
                                       "subject": "Testero pipeline v6", "text": text}).encode())
    with build_opener(NoRedirect()).open(request, timeout=30) as response:
        if response.status not in (200, 201, 202):
            raise ValueError("Email delivery was not accepted")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--config", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--print", action="store_true")
    mode.add_argument("--send", action="store_true")
    args = parser.parse_args()
    text = digest(json.loads(args.report.read_text()))
    if args.send:
        if not args.config:
            parser.error("--send requires --config")
        try:
            send(text, json.loads(args.config.read_text()))
        except Exception:
            parser.exit(1, "Email not confirmed; inspect runtime configuration.\n")
    else:
        print(text)


if __name__ == "__main__":
    main()
