#!/bin/bash

# PostHog A/B Test Setup Script
# This script configures the multivariate feature flag and creates the experiment
# Requires: POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID environment variables

set -e

POSTHOG_HOST="${POSTHOG_HOST:-https://us.posthog.com}"
PROJECT_ID="${POSTHOG_PROJECT_ID:-98408}"
FLAG_KEY="diagnostic_results_verdict_copy"
FLAG_ID="351302"

if [ -z "$POSTHOG_PERSONAL_API_KEY" ]; then
  echo "❌ Error: POSTHOG_PERSONAL_API_KEY environment variable not set"
  echo ""
  echo "To get your API key:"
  echo "1. Go to https://us.posthog.com/project/settings"
  echo "2. Navigate to 'Personal API keys' section"
  echo "3. Click '+ Create a personal API Key'"
  echo "4. Set scopes: feature_flag:write, experiment:write"
  echo "5. Copy the key and run: export POSTHOG_PERSONAL_API_KEY='your-key-here'"
  exit 1
fi

echo "🔧 Configuring multivariate feature flag..."

# Update feature flag to be multivariate with variants
curl -X PATCH \
  "${POSTHOG_HOST}/api/projects/${PROJECT_ID}/feature_flags/${FLAG_ID}/" \
  -H "Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "multivariate": {
        "variants": [
          {
            "key": "control",
            "name": "Control - Standard Verdict",
            "rollout_percentage": 50
          },
          {
            "key": "risk_qualifier",
            "name": "Treatment - Ready with Risk",
            "rollout_percentage": 50
          }
        ]
      }
    },
    "active": true
  }' | jq '.'

echo ""
echo "✅ Feature flag configured as multivariate"
echo ""
echo "📊 Creating PostHog experiment..."

# Create experiment
EXPERIMENT_RESPONSE=$(curl -s -X POST \
  "${POSTHOG_HOST}/api/projects/${PROJECT_ID}/experiments/" \
  -H "Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Diagnostic Results Verdict Copy A/B Test",
    "description": "A/B test for diagnostic results page verdict copy. Control shows standard \"Ready\" label. Treatment shows \"Ready — with risk\" plus weakest domain qualifier to encourage productive doubt and next action.",
    "feature_flag_key": "'"${FLAG_KEY}"'",
    "parameters": {
      "feature_flag_variants": [
        {
          "key": "control",
          "rollout_percentage": 50
        },
        {
          "key": "risk_qualifier",
          "rollout_percentage": 50
        }
      ]
    },
    "filters": {
      "events": [
        {
          "id": "diagnostic_summary_signup_cta_clicked",
          "name": "diagnostic_summary_signup_cta_clicked",
          "type": "events",
          "order": 0
        }
      ]
    }
  }')

echo "$EXPERIMENT_RESPONSE" | jq '.'

EXPERIMENT_ID=$(echo "$EXPERIMENT_RESPONSE" | jq -r '.id // empty')

if [ -n "$EXPERIMENT_ID" ] && [ "$EXPERIMENT_ID" != "null" ]; then
  echo ""
  echo "✅ Experiment created successfully!"
  echo "🔗 View experiment: ${POSTHOG_HOST}/experiments/${EXPERIMENT_ID}"
  echo ""
  echo "⚠️  Note: You may need to configure the experiment metrics in the PostHog UI:"
  echo "   1. Go to the experiment page"
  echo "   2. Set primary metric: diagnostic_summary_signup_cta_clicked"
  echo "   3. Launch the experiment"
else
  echo ""
  echo "⚠️  Experiment creation may have failed. Please check the response above."
  echo "    You can create it manually in the PostHog UI:"
  echo "    ${POSTHOG_HOST}/experiments"
fi

echo ""
echo "📋 Summary:"
echo "   Feature Flag: ${POSTHOG_HOST}/project/${PROJECT_ID}/feature_flags/${FLAG_ID}"
echo "   Flag Key: ${FLAG_KEY}"
echo "   Variants: control (50%), risk_qualifier (50%)"
echo "   Status: Active ✅"
