# PostHog A/B Test Setup: Diagnostic Results Verdict Copy

## Status
✅ Feature flag created and activated: `diagnostic_results_verdict_copy`  
✅ Code implementation complete  
✅ Setup script created: `scripts/setup-posthog-ab-test.sh`  
⏳ Run setup script to configure multivariate variants and create experiment  

## Quick Setup (Automated)

Run the setup script to configure everything automatically:

```bash
# Set your PostHog API key (get it from https://us.posthog.com/project/settings)
export POSTHOG_PERSONAL_API_KEY='your-api-key-here'

# Optional: Set project ID (defaults to 98408)
export POSTHOG_PROJECT_ID='98408'

# Run the setup script
./scripts/setup-posthog-ab-test.sh
```

The script will:
1. Configure the feature flag as multivariate with `control` and `risk_qualifier` variants (50/50)
2. Create the PostHog experiment linked to the feature flag
3. Set up the conversion metric

## Manual Setup (PostHog UI)

If you prefer to configure manually or the script doesn't work:

### Step 1: Configure Feature Flag as Multivariate

1. Navigate to: https://us.posthog.com/project/98408/feature_flags/351302
2. Click "Edit" on the feature flag
3. Change flag type from "Boolean" to **"Multiple variants with rollout percentages"**
4. Add two variants:
   - **Variant 1**: Key: `control`, Name: "Control - Standard Verdict", Rollout: 50%
   - **Variant 2**: Key: `risk_qualifier`, Name: "Treatment - Ready with Risk", Rollout: 50%
5. Save the feature flag

### Step 2: Create PostHog Experiment

1. Navigate to: https://us.posthog.com/experiments
2. Click "New experiment"
3. Configure experiment:
   - **Name**: "Diagnostic Results Verdict Copy A/B Test"
   - **Feature Flag Key**: `diagnostic_results_verdict_copy`
   - **Type**: Product experiment
   - **Participant Type**: Users
   - **Distribution**: 50/50 (should auto-populate from feature flag)

4. **Primary Metric**:
   - **Metric Name**: "Signup CTA Click Rate"
   - **Metric Type**: Mean
   - **Event Name**: `diagnostic_summary_signup_cta_clicked`
   - **Description**: "Percentage of users who click the signup CTA on diagnostic summary page"

5. **Secondary Metrics** (optional but recommended):
   - **Practice Start**: `study_plan_start_practice_clicked` (Mean)
   - **Practice Session Created**: `practice_session_created_from_diagnostic` (Mean)

6. **Variants** (should auto-populate from feature flag):
   - Control: 50%
   - risk_qualifier: 50%

7. Click "Save" and then "Launch" to start the experiment

## What's Being Tested

### Control Variant
- Shows standard readiness label: "Readiness: {tier.label}" (e.g., "Readiness: Ready")
- Includes standard "Pass typically ≥70%" line

### Treatment Variant (`risk_qualifier`)
- For **Ready tier** (score ≥70): Shows "Readiness: Ready — with risk"
  - Adds: "but exposed in {DomainA} and {DomainB}"
  - Adds: "Your biggest score lift is in {DomainA}."
- For **Borderline/Not Yet tiers**: Shows standard label but still includes action line
  - Adds: "Your biggest score lift is in {DomainA}."

## Analytics Tracking

All events on the diagnostic summary page now include `verdict_copy_variant` property:
- `diagnostic_summary_viewed`
- `diagnostic_summary_signup_cta_clicked` ⭐ **Primary conversion metric**
- `study_plan_start_practice_clicked` (secondary)
- `practice_session_created_from_diagnostic` (secondary)

## Monitoring

After launching:
1. Monitor experiment results in PostHog Experiments dashboard
2. Check statistical significance (PostHog uses Bayesian analysis)
3. Review win probability and confidence intervals
4. Segment results by readiness tier (Ready vs Borderline vs Not Yet)

## Rollout Plan

- ✅ Code deployed
- ✅ Feature flag created and active
- ⏳ Configure multivariate variants (UI step)
- ⏳ Create experiment (UI step)
- ⏳ Launch experiment at 50/50 split
- ⏳ Monitor for 1-2 weeks
- ⏳ Analyze results and decide on winner

## Expected Impact

**Hypothesis**: Treatment variant ("Ready — with risk") will increase signup intent by:
- Creating "productive doubt" instead of complacency at 80%+ scores
- Providing clear next action (focus on weakest domains)
- Reducing psychological stopping point ("I'm done" → "I know what to shore up")

**Success Metric**: Increase in `diagnostic_summary_signup_cta_clicked` event rate for treatment vs control.
