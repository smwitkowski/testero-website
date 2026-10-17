#!/bin/bash
# usage: run-domain-batch.sh <section e.g. 1.> <unique-tag> [cert-id] [--plan-only]
# Credentials are injected by the coordinator. Never reads .env files or secrets itself.
set -euo pipefail
PIPELINE="${TESTERO_PIPELINE_DIR:-/Users/switkowski/Projects/Testero/frontend.prime-testero-multicert/content-pipeline}"
cd "$PIPELINE"
export PYTHON_DOTENV_DISABLED=1
exec uv run python -m scripts.run_domain_batch "$@"
