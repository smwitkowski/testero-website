#!/usr/bin/env bash
# Rotate the live Testero endpoint and Secret Manager version; coordinator only.
# Requires stripe, gcloud, jq. --check is read-only. Never run with shell tracing.
# After rotation, coordinator MUST roll Cloud Run instances to load :latest,
# then verify a signed live delivery. --check cannot verify the app secret.
set +x
set -euo pipefail
[[ $# == 0 || ( $# == 1 && $1 == --check ) ]] || { echo 'Usage: stripe-webhook-rotate.sh [--check]' >&2; exit 2; }
cd "$(dirname "$0")/.."
STRIPE_API_KEY="$(gcloud secrets versions access latest --secret testero-stripe-key --project testero-ai)"
export STRIPE_API_KEY
url=https://testero.ai/api/billing/webhook
events=$(sed -n 's/^  "\([^"]*\)",$/\1/p' lib/stripe/events.ts | sort)
[[ -n "$STRIPE_API_KEY" && -n "$events" ]]
endpoints=$(stripe webhook_endpoints list --live --limit=100)
jq -e '.has_more == false' <<<"$endpoints" >/dev/null # Fail closed rather than miss a page.
if [[ ${1:-} == --check ]]; then
  jq -e --arg url "$url" '[.data[] | select(.url == $url and .status == "enabled")] | length == 1' <<<"$endpoints" >/dev/null
  diff -u <(printf '%s\n' "$events") <(jq -r --arg url "$url" '.data[] | select(.url == $url and .status == "enabled") | .enabled_events[]' <<<"$endpoints" | sort)
  exit
fi
args=(); while IFS= read -r event; do args+=(-d "enabled_events[]=$event"); done <<<"$events"
created=$(stripe webhook_endpoints create --live --url="$url" "${args[@]}")
jq -ej '.secret | select(type == "string" and startswith("whsec_") and length > 6)' <<<"$created" | gcloud secrets versions add STRIPE_WEBHOOK_SECRET --project testero-ai --data-file=- >/dev/null
id=$(jq -er '.id | select(type == "string" and startswith("we_"))' <<<"$created")
while IFS= read -r old; do
  stripe webhook_endpoints update "$old" --live --disabled=true >/dev/null
done < <(jq -r --arg url "$url" --arg id "$id" '.data[] | select(.url == $url and .id != $id) | .id' <<<"$endpoints")
