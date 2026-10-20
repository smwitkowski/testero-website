#!/bin/bash
# usage: run-domain-batch.sh <section e.g. 1. or all> <unique-tag> [cert-id] [--plan-only]
# PDE full plan: run-domain-batch.sh all <unique-tag> data-engineer --count 40
# Add --plan-only to write the same weighted plan offline without any service calls.
# Credentials are injected by the coordinator. Never reads .env files or secrets itself.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE="${TESTERO_PIPELINE_DIR:-$(dirname -- "$SCRIPT_DIR")}"
cd "$PIPELINE"
export PYTHON_DOTENV_DISABLED=1
exec uv run python -m scripts.run_domain_batch "$@"
