# PMLE Access & Entitlements

This document describes the PMLE access control system that centralizes entitlement logic for anonymous users, free accounts, and subscribers.

## Overview

The PMLE entitlements system (`lib/access/pmleEntitlements.ts`) provides a consistent way to gate features across diagnostic summary, practice, and dashboard. It replaces ad-hoc subscription checks with a centralized access level model.

## Access Levels

There are three access levels:

- **ANONYMOUS**: No account (not logged in)
- **FREE**: Logged in, no active subscription
- **SUBSCRIBER**: Has active or trialing subscription (status in ("active","trialing"))

## Features

The following features can be gated by access level:

- `DIAGNOSTIC_RUN`: Ability to start/run a diagnostic test
- `DIAGNOSTIC_SUMMARY_BASIC`: View basic diagnostic summary (score, domain breakdown)
- `DIAGNOSTIC_SUMMARY_FULL`: View full diagnostic summary including question-level details
- `EXPLANATIONS`: Access to question explanations in diagnostic results
- `PRACTICE_SESSION`: Create unlimited, domain-targeted practice sessions
- `PRACTICE_SESSION_FREE_QUOTA`: Create limited practice sessions (free tier quota)

## Access Matrix

### ANONYMOUS

- ✅ `DIAGNOSTIC_RUN`: 1 diagnostic run allowed
- ✅ `DIAGNOSTIC_SUMMARY_BASIC`: Can view basic summary (score + readiness tier)
- ❌ `DIAGNOSTIC_SUMMARY_FULL`: Cannot view full summary with question details
- ❌ `EXPLANATIONS`: No explanations access
- ❌ `PRACTICE_SESSION`: No unlimited practice
- ❌ `PRACTICE_SESSION_FREE_QUOTA`: No free practice quota

**Note**: Anonymous users see a teaser view on the diagnostic summary page:
- ✅ **Visible**: Overall score, readiness tier, exam type, session date
- 🔒 **Locked/Blurred**: Domain Performance breakdown, Study Plan, and Question Review sections
- 📝 **Signup Panel**: Displayed with CTAs to sign up or continue without account

### FREE (logged in, no subscription)

- ✅ `DIAGNOSTIC_RUN`: Can run diagnostics
- ✅ `DIAGNOSTIC_SUMMARY_BASIC`: Can view basic summary
- ✅ `DIAGNOSTIC_SUMMARY_FULL`: Can view full summary with question details
- ❌ `EXPLANATIONS`: No explanations (paid feature)
- ❌ `PRACTICE_SESSION`: No unlimited practice
- ✅ `PRACTICE_SESSION_FREE_QUOTA`: Limited practice quota (e.g., ~5 questions per week)

### SUBSCRIBER (active or trialing subscription)

- ✅ All features: Full access to everything

## Usage

### Server-Side (API Routes)

```typescript
import {
  getPmleAccessLevelForRequest,
  canUseFeature,
} from "@/lib/access/pmleEntitlements";

export async function GET(req: Request) {
  // Get access level from request
  const { accessLevel, user } = await getPmleAccessLevelForRequest(req);

  // Check feature access
  if (!canUseFeature(accessLevel, "DIAGNOSTIC_SUMMARY_BASIC")) {
    return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
  }

  // Gate explanations based on access level
  const canAccessExplanations = canUseFeature(accessLevel, "EXPLANATIONS");
  if (canAccessExplanations) {
    // Fetch and include explanations
  } else {
    // Skip explanation fetching
  }
}
```

### Client-Side (React Components)

```typescript
import { useAuth } from "@/components/providers/AuthProvider";
import {
  getPmleAccessLevelForUser,
  canUseFeature,
} from "@/lib/access/pmleEntitlements";
import type { BillingStatusResponse } from "@/app/api/billing/status/route";

function MyComponent() {
  const { user } = useAuth();
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);

  // Fetch billing status
  useEffect(() => {
    fetch("/api/billing/status")
      .then((res) => res.json())
      .then((data) => setBillingStatus(data));
  }, []);

  // Compute access level
  const accessLevel = getPmleAccessLevelForUser(user, billingStatus);

  // Gate UI based on access level
  const canAccessExplanations = canUseFeature(accessLevel, "EXPLANATIONS");

  return (
    <div>
      {canAccessExplanations ? (
        <ExplanationView />
      ) : (
        <UpsellMessage />
      )}
    </div>
  );
}
```

## Integration Points

### Diagnostic Summary API

- **File**: `app/api/diagnostic/summary/[sessionId]/route.ts`
- **Changes**: Replaced `requireSubscriber` with PMLE entitlement checks
- **Behavior**: Gates explanations based on `EXPLANATIONS` feature access

### Diagnostic Summary Page

- **File**: `app/diagnostic/[sessionId]/summary/page.tsx`
- **Changes**: 
  - Fetches billing status, computes access level
  - Implements UI gating for anonymous users (teaser view with locked sections)
  - Gates explanation UI for non-subscribers
- **Behavior**: 
  - **Anonymous users**: See verdict block (score + readiness tier) with Domain Performance, Study Plan, and Question Review sections blurred/locked. Signup panel displayed in right rail.
  - **FREE users**: See full summary including question details, but explanations are gated (upsell messages shown)
  - **SUBSCRIBER users**: Full access to all features including explanations
- **Analytics**: Tracks `diagnostic_summary_gated_viewed` for anonymous views and `diagnostic_summary_signup_cta_clicked` for signup CTA clicks

### Practice Session API

- **File**: `app/api/practice/session/route.ts`
- **Changes**: Replaced `requireSubscriber` with PMLE entitlement checks
- **Behavior**: Allows free tier users with `PRACTICE_SESSION_FREE_QUOTA`, subscribers with `PRACTICE_SESSION`

### Dashboard

- **File**: `app/dashboard/page.tsx`
- **Changes**: Fetches billing status, computes access level, shows tier-appropriate CTAs
- **Behavior**: Displays different messaging based on access level

## Adding New Features

To add a new feature to the entitlements system:

1. Add the feature to the `PmleFeature` type in `lib/access/pmleEntitlements.ts`
2. Update the `FEATURE_MATRIX` with access rules for each access level
3. Update this documentation with the new feature's behavior
4. Use `canUseFeature()` in your code to gate the feature

## Analytics

### Entitlement Check Failures

Entitlement check failures are tracked via PostHog with the `ENTITLEMENT_CHECK_FAILED` event, including:
- `route`: The API route where the check failed
- `reason`: Why access was denied (e.g., "insufficient_access_level")
- `accessLevel`: The user's access level
- `feature`: The feature that was denied
- `userId`: The user ID (if authenticated)

### Anonymous Diagnostic Summary Gating

The following events are tracked for anonymous users viewing diagnostic summaries:
- `diagnostic_summary_gated_viewed`: Fired when an anonymous user views the gated summary page
  - Properties: `sessionId`, `examKey`, `score`, `examType`, `source`
- `diagnostic_summary_signup_cta_clicked`: Fired when an anonymous user clicks the signup CTA
  - Properties: `sessionId`, `examKey`, `accessLevel`, `source`

## Future Enhancements

- **Quota Enforcement**: Implement actual quota checking for `PRACTICE_SESSION_FREE_QUOTA` (currently allows all free users)
- **Multi-Exam Support**: Extend the system to support other exams beyond PMLE

## Implementation Notes

### Anonymous Diagnostic Summary Gating (Week 4)

Anonymous users now see a teaser view of their diagnostic results:
- **API Behavior**: The diagnostic summary API continues to return full data (including domain breakdown and questions) for anonymous sessions, but the UI gates access client-side
- **UI Gating**: Uses a `LockedSection` component that applies visual blur and an overlay with lock icon to Domain Performance, Study Plan, and Question Review sections
- **Signup Flow**: Signup CTA includes redirect parameter (`/signup?redirect=/diagnostic/[sessionId]/summary`) to return users to their summary after signup
- **Analytics**: Tracks gated views and signup CTA clicks to measure conversion funnel effectiveness

