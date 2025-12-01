# PostHog Dashboard Implementation Queries

This document contains the exact queries needed to build the three strategy dashboards in PostHog. Use these queries to create insights and add them to the respective dashboards.

**Dashboards Created:**
- Dashboard #2: Readiness & Study Activation (ID: 789819)
- Dashboard #1: Acquisition & Conversion Funnel (ID: 789820)  
- Dashboard #3: Subscription & Revenue Health (ID: 789821)

---

## Dashboard #2: Readiness & Study Activation

### Insight 1: Diagnostic Funnel (by Exam Type)
**Type:** Funnel  
**Name:** Diagnostic Funnel - Started → First Question → Completed → Summary  
**Description:** Primary product funnel showing progression through diagnostic, broken down by examType

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "diagnostic_started"},
    {
      "kind": "EventsNode",
      "event": "diagnostic_question_answered",
      "properties": [
        {
          "key": "questionNumber",
          "value": [1],
          "operator": "exact",
          "type": "event"
        }
      ]
    },
    {"kind": "EventsNode", "event": "diagnostic_completed"},
    {"kind": "EventsNode", "event": "diagnostic_summary_viewed"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "examType",
    "breakdown_limit": 25
  },
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 14,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

### Insight 2: Completion & Abandonment Rates
**Type:** Trends (Line Graph)  
**Name:** Diagnostic Completion & Abandonment Trends  
**Description:** Daily trends for diagnostic_started, diagnostic_completed, and diagnostic_abandoned events

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "diagnostic_started", "math": "total", "name": "diagnostic_started"},
    {"kind": "EventsNode", "event": "diagnostic_completed", "math": "total", "name": "diagnostic_completed"},
    {"kind": "EventsNode", "event": "diagnostic_abandoned", "math": "total", "name": "diagnostic_abandoned"}
  ],
  "interval": "day",
  "dateRange": {"date_from": "-30d"},
  "filterTestAccounts": true,
  "trendsFilter": {
    "display": "ActionsLineGraph",
    "showLegend": true
  }
}
```

### Insight 3: Diagnostic → Practice Activation Funnel
**Type:** Funnel  
**Name:** Activation Funnel - Completed → Summary → Practice Started  
**Description:** Measures activation after diagnostic completion (within 24 hours recommended)

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "diagnostic_completed"},
    {"kind": "EventsNode", "event": "diagnostic_summary_viewed"},
    {"kind": "EventsNode", "event": "practice_started"}
  ],
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 1,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"},
  "filterTestAccounts": true
}
```

### Insight 4: Question-Level Behavior by Exam Type
**Type:** Trends (Bar Chart)  
**Name:** Diagnostic Questions Answered by Exam Type  
**Description:** Total count of diagnostic_question_answered events broken down by examType

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {
      "kind": "EventsNode",
      "event": "diagnostic_question_answered",
      "math": "total",
      "custom_name": "diagnostic_question_answered"
    }
  ],
  "breakdownFilter": {
    "breakdown_limit": 20,
    "breakdowns": [{"property": "examType", "type": "event"}]
  },
  "dateRange": {"date_from": "-30d"},
  "trendsFilter": {
    "display": "ActionsBarValue",
    "showLegend": true,
    "showValuesOnSeries": true
  }
}
```

### Insight 5: Study Path Engagement
**Type:** Trends (Line Graph)  
**Name:** Study Path Engagement Trends  
**Description:** Daily trends for study_path_viewed, study_path_generated, and study_path_error

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "study_path_viewed", "math": "total", "name": "study_path_viewed"},
    {"kind": "EventsNode", "event": "study_path_generated", "math": "total", "name": "study_path_generated"},
    {"kind": "EventsNode", "event": "study_path_error", "math": "total", "name": "study_path_error"}
  ],
  "interval": "day",
  "dateRange": {"date_from": "-30d"},
  "trendsFilter": {
    "display": "ActionsLineGraph",
    "showLegend": true
  }
}
```

### Insight 6: Practice Question Intensity
**Type:** Trends (Line Graph)  
**Name:** Average Practice Questions Answered Per Day  
**Description:** Daily average of practice_question_answered events

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {
      "kind": "EventsNode",
      "event": "practice_question_answered",
      "math": "avg",
      "custom_name": "Practice Questions Answered"
    }
  ],
  "interval": "day",
  "dateRange": {"date_from": "-30d"},
  "trendsFilter": {
    "display": "ActionsLineGraph"
  }
}
```

---

## Dashboard #1: Acquisition & Conversion Funnel

### Insight 1: High-Level Conversion Funnel
**Type:** Funnel  
**Name:** Acquisition Funnel - Landing → Signup → Verified → Trial → Paid  
**Description:** Complete conversion funnel from landing page to paid subscription

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {
      "kind": "EventsNode",
      "event": "$pageview",
      "properties": [
        {
          "key": "$current_url",
          "value": ["/", "/beta"],
          "operator": "contains",
          "type": "event"
        }
      ]
    },
    {"kind": "EventsNode", "event": "signup_attempt"},
    {"kind": "EventsNode", "event": "signup_success"},
    {"kind": "EventsNode", "event": "email_confirmed"},
    {"kind": "EventsNode", "event": "trial_started"},
    {"kind": "EventsNode", "event": "subscription_created"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "utm_campaign"
  },
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 30,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

### Insight 2: Signup Health Panel
**Type:** Trends (Line Graph)  
**Name:** Signup Health - Attempts, Successes, Errors, Rate Limits  
**Description:** Daily counts for signup events to track signup funnel health

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "signup_attempt", "math": "total", "name": "Signup Attempts"},
    {"kind": "EventsNode", "event": "signup_success", "math": "total", "name": "Signup Success"},
    {"kind": "EventsNode", "event": "signup_error", "math": "total", "name": "Signup Errors"},
    {"kind": "EventsNode", "event": "signup_rate_limited", "math": "total", "name": "Rate Limited"}
  ],
  "interval": "day",
  "dateRange": {"date_from": "-30d"},
  "trendsFilter": {
    "display": "ActionsLineGraph",
    "showLegend": true
  }
}
```

### Insight 3: Email Verification Completion
**Type:** Funnel  
**Name:** Email Verification Funnel  
**Description:** Signup success → email confirmed, broken down by device and country

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "signup_success"},
    {"kind": "EventsNode", "event": "email_confirmed"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "$device_type"
  },
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 7,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

### Insight 4: Trial Funnel
**Type:** Funnel  
**Name:** Trial Conversion Funnel  
**Description:** Trial modal shown → CTA clicked → Trial started → Paid conversion

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "trial_modal_shown"},
    {"kind": "EventsNode", "event": "trial_cta_clicked"},
    {"kind": "EventsNode", "event": "trial_started"},
    {"kind": "EventsNode", "event": "trial_to_paid_conversion"}
  ],
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 14,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

### Insight 5: Campaign Performance Table
**Type:** Trends (Table)  
**Name:** Campaign Performance Overview  
**Description:** Counts of key events by utm_campaign

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "email_campaign_landing", "math": "total", "name": "Campaign Landing"},
    {"kind": "EventsNode", "event": "signup_success", "math": "total", "name": "Signups"},
    {"kind": "EventsNode", "event": "trial_started", "math": "total", "name": "Trials Started"},
    {"kind": "EventsNode", "event": "subscription_created", "math": "total", "name": "Subscriptions"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "utm_campaign"
  },
  "dateRange": {"date_from": "-30d"},
  "trendsFilter": {
    "display": "ActionsTable"
  }
}
```

---

## Dashboard #3: Subscription & Revenue Health

### Insight 1: MRR & Revenue Trend
**Type:** Trends (Line Graph)  
**Name:** Monthly Recurring Revenue Trend  
**Description:** Sum of payment_recurring_succeeded amounts by month

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {
      "kind": "EventsNode",
      "event": "payment_recurring_succeeded",
      "math": "sum",
      "math_property": "amount",
      "custom_name": "MRR"
    }
  ],
  "interval": "month",
  "dateRange": {"date_from": "-6m"},
  "trendsFilter": {
    "display": "ActionsLineGraph"
  }
}
```

**Note:** This requires `payment_recurring_succeeded` event with `amount` property. If not available, use `subscription_created` count as proxy.

### Insight 2: New Subscriptions vs Cancellations
**Type:** Trends (Bar + Line)  
**Name:** Subscription Changes - New vs Cancelled  
**Description:** Count of new subscriptions and cancellations with net subscriptions

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "subscription_created", "math": "total", "name": "New Subscriptions"},
    {"kind": "EventsNode", "event": "subscription_cancelled", "math": "total", "name": "Cancellations"}
  ],
  "interval": "month",
  "dateRange": {"date_from": "-6m"},
  "trendsFilter": {
    "display": "ActionsBar",
    "showLegend": true
  }
}
```

### Insight 3: Trial Funnel & Performance
**Type:** Funnel  
**Name:** Trial to Paid Conversion Funnel  
**Description:** Trial started → paid conversion, broken down by exam_type and trial_days_used

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "trial_started"},
    {"kind": "EventsNode", "event": "trial_to_paid_conversion"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "exam_type"
  },
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 14,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

### Insight 4: Churn Overview
**Type:** Trends (Line Graph)  
**Name:** Subscription Cancellations Over Time  
**Description:** Count of subscription_cancelled by month

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "subscription_cancelled", "math": "total", "name": "Cancellations"}
  ],
  "interval": "month",
  "dateRange": {"date_from": "-6m"},
  "trendsFilter": {
    "display": "ActionsLineGraph"
  }
}
```

### Insight 5: Payment Reliability
**Type:** Trends (Bar Chart)  
**Name:** Payment Success vs Failure Rates  
**Description:** Count of payment_failed vs payment_recurring_succeeded

**Query Structure:**
```json
{
  "kind": "TrendsQuery",
  "series": [
    {"kind": "EventsNode", "event": "payment_failed", "math": "total", "name": "Payment Failed"},
    {"kind": "EventsNode", "event": "payment_recurring_succeeded", "math": "total", "name": "Payment Succeeded"}
  ],
  "interval": "month",
  "dateRange": {"date_from": "-6m"},
  "trendsFilter": {
    "display": "ActionsBar",
    "showLegend": true
  }
}
```

### Insight 6: Upsell Effectiveness
**Type:** Funnel  
**Name:** Upsell Conversion Funnel  
**Description:** Upsell view → CTA clicked → Checkout initiated → Subscription created

**Query Structure:**
```json
{
  "kind": "FunnelsQuery",
  "series": [
    {"kind": "EventsNode", "event": "upsell_view"},
    {"kind": "EventsNode", "event": "gate_cta_clicked"},
    {"kind": "EventsNode", "event": "checkout_initiated"},
    {"kind": "EventsNode", "event": "subscription_created"}
  ],
  "breakdownFilter": {
    "breakdown_type": "event",
    "breakdown": "variant"
  },
  "funnelsFilter": {
    "funnelOrderType": "ordered",
    "funnelStepReference": "total",
    "funnelVizType": "steps",
    "funnelWindowInterval": 7,
    "funnelWindowIntervalUnit": "day",
    "layout": "vertical"
  },
  "dateRange": {"date_from": "-30d"}
}
```

---

## Implementation Notes

1. **Event Availability:** Some events may not be available yet (e.g., `subscription_created`, `payment_recurring_succeeded`). Check event definitions before creating insights.

2. **Breakdown Properties:** Some breakdowns may need adjustment based on actual property names in your data (e.g., `examType` vs `exam_type`).

3. **Date Ranges:** Adjust date ranges based on your data volume. Start with 30 days for most insights, 6 months for revenue trends.

4. **Test Accounts:** Enable `filterTestAccounts: true` for production dashboards to exclude test data.

5. **Creating Insights:** 
   - Go to PostHog → Insights → New Insight
   - Select the appropriate visualization type (Funnel, Trends, etc.)
   - Use the query structures above to configure each insight
   - Save and add to the respective dashboard

6. **Dashboard URLs:**
   - Dashboard #2: https://us.posthog.com/project/98408/dashboard/789819
   - Dashboard #1: https://us.posthog.com/project/98408/dashboard/789820
   - Dashboard #3: https://us.posthog.com/project/98408/dashboard/789821



