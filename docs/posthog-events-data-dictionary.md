# PostHog Events Data Dictionary

This document provides a comprehensive reference for all PostHog analytics events tracked in the Testero application. Use this guide to create dashboards, analyze user behavior, and understand the event schema.

**Last Updated:** 2024-12-19  
**PostHog Version:** posthog-js/react (client-side) and posthog-node (server-side)  
**Verified:** 2024-12-19 via PostHog MCP - 79 events found in production

---

## Table of Contents

1. [Event Categories](#event-categories)
2. [Standard Event Properties](#standard-event-properties)
3. [User Properties](#user-properties)
4. [Event Reference](#event-reference)
5. [Dashboard Recommendations](#dashboard-recommendations)

---

## Event Categories

Events are organized into the following categories:

- **Authentication & Session** - User signup, login, session management
- **Dashboard** - Dashboard views and interactions
- **Diagnostic** - Diagnostic test flow and completion
- **Study Path** - Study plan generation and viewing
- **Practice Questions** - Practice question interactions
- **Subscription & Billing** - Payment, subscription, and billing events
- **Pricing** - Pricing page interactions
- **Errors** - Error tracking and recovery
- **Email Verification** - Email confirmation flow
- **Conversion Events** - Trial and conversion tracking
- **Feature Discovery** - Feature usage tracking
- **Beta Onboarding** - Beta user onboarding flow
- **Email Campaign** - Marketing campaign attribution
- **Pageviews** - Standard page navigation tracking

---

## Standard Event Properties

Many events include these common properties:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `userId` | string \| null | User ID (null for anonymous users) | `"123e4567-e89b-12d3-a456-426614174000"` |
| `isAnonymous` | boolean | Whether the user is anonymous | `true` |
| `sessionId` | string | Diagnostic session ID | `"abc123"` |
| `examType` | string | Type of exam (e.g., "AWS SAA-C03") | `"AWS SAA-C03"` |
| `route` | string | Current route/pathname | `"/diagnostic/abc123"` |
| `timestamp` | number | Unix timestamp in milliseconds | `1703001234567` |
| `source` | string | Source context for the event | `"diagnostic_summary"` |

---

## User Properties

User properties are set via `posthog.identify()` and persist across sessions:

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `email` | string | User email address | `"user@example.com"` |
| `user_id` | string | User UUID | `"123e4567-e89b-12d3-a456-426614174000"` |
| `subscription_tier` | string | Subscription tier (free, pro, etc.) | `"pro"` |
| `subscription_status` | string | Subscription status | `"active"`, `"trialing"`, `"cancelled"` |
| `is_paying_customer` | boolean | Whether user has active paid subscription | `true` |
| `is_trial` | boolean | Whether user is on trial | `true` |
| `customer_since` | string | ISO timestamp of first subscription | `"2024-01-15T10:30:00Z"` |
| `churned_at` | string \| null | ISO timestamp of cancellation | `"2024-02-20T14:00:00Z"` |
| `exam_type` | string | User's exam type preference | `"AWS SAA-C03"` |
| `readiness_score` | number | Latest diagnostic readiness score | `75` |
| `total_practice_questions` | number | Total practice questions answered | `150` |
| `accuracy_percentage` | number | Overall accuracy percentage | `82.5` |
| `plan_tier` | string | Current plan tier | `"pro"` |
| `is_early_access` | boolean | Whether user has early access | `false` |
| `email_verified` | boolean | Whether email is verified | `true` |

---

## Event Reference

### Authentication & Session Events

#### `user_session_started`
**Description:** Fired when a user session begins (on login or page load for authenticated users).

**Properties:**
- `userId` (string): User ID
- `email` (string): User email
- `is_early_access` (boolean): Whether user has early access

**Location:** `components/providers/AuthProvider.tsx`

---

#### `user_session_ended`
**Description:** Fired when a user session ends (on logout or page unload).

**Properties:**
- `userId` (string): User ID
- `session_duration` (number): Session duration in seconds

**Location:** `components/providers/AuthProvider.tsx`

---

#### `user_identified`
**Description:** Fired when a user is identified (via `posthog.identify()`).

**Properties:**
- User properties (see [User Properties](#user-properties) section)

**Location:** `components/providers/AuthProvider.tsx`, `lib/analytics/analytics.ts`

---

#### `signup_attempt`
**Description:** Fired when a user attempts to sign up.

**Properties:**
- `email` (string): Email address used for signup
- `hasAnonymousSession` (boolean): Whether user had an anonymous session before signup

**Location:** `lib/auth/signup-handler.ts`, `app/api/auth/signup/route.ts`

---

#### `signup_success`
**Description:** Fired when signup is successful.

**Properties:**
- `email` (string): Email address
- `guestUpgraded` (boolean): Whether anonymous sessions were upgraded
- `sessionsTransferred` (number): Number of sessions transferred from anonymous to user

**Location:** `lib/auth/signup-handler.ts`

---

#### `signup_error`
**Description:** Fired when signup fails.

**Properties:**
- `email` (string): Email address used
- `error` (string): Error message

**Location:** `lib/auth/signup-handler.ts`

---

#### `signup_rate_limited`
**Description:** Fired when signup is rate limited.

**Properties:**
- `ip` (string): IP address
- `email` (string): Email address used

**Location:** `app/api/auth/signup/route.ts`

---

#### `guest_upgraded`
**Description:** Fired when anonymous sessions are upgraded to authenticated user.

**Properties:**
- `userId` (string): User ID
- `sessionsTransferred` (number): Number of sessions transferred
- `completedSessions` (number): Number of completed sessions
- `activeSessions` (number): Number of active sessions
- `totalQuestionsAnswered` (number): Total questions answered across sessions
- `examTypes` (string[]): Array of exam types from transferred sessions
- `oldestSession` (string): ISO timestamp of oldest session

**Location:** `lib/auth/signup-handler.ts`

---

#### `guest_upgrade_error`
**Description:** Fired when guest session upgrade fails.

**Properties:**
- `email` (string): User email
- `error` (string): Error message
- `anonymousSessionId` (string): Partial anonymous session ID (privacy-safe)

**Location:** `lib/auth/signup-handler.ts`

---

#### `login_attempt`
**Description:** Fired when a user attempts to log in.

**Properties:**
- `email` (string): Email address used

**Location:** `app/login/page.tsx`

---

#### `login_error`
**Description:** Fired when login fails.

**Properties:**
- `email` (string): Email address used
- `error` (string): Error message

**Location:** `app/login/page.tsx`

---

#### `login_unconfirmed_user`
**Description:** Fired when an unconfirmed user attempts to log in.

**Properties:**
- `email` (string): Email address

**Location:** `app/login/page.tsx`

---

#### `login_resend_confirmation_attempt`
**Description:** Fired when user attempts to resend confirmation email.

**Properties:**
- `email` (string): Email address

**Location:** `app/login/page.tsx`

---

#### `login_resend_confirmation_success`
**Description:** Fired when resend confirmation email succeeds.

**Properties:**
- `email` (string): Email address

**Location:** `app/login/page.tsx`

---

#### `login_resend_confirmation_error`
**Description:** Fired when resend confirmation email fails.

**Properties:**
- `email` (string): Email address
- `error` (string): Error message

**Location:** `app/login/page.tsx`

---

#### `login_form_interaction_start`
**Description:** Fired when user starts interacting with login form.

**Properties:** None

**Location:** `app/login/page.tsx`

---

#### `password_reset_requested`
**Description:** Fired when user requests password reset.

**Properties:**
- `email` (string): Email address

**Location:** `app/forgot-password/page.tsx`

---

#### `password_reset_error`
**Description:** Fired when password reset request fails.

**Properties:**
- `email` (string): Email address
- `error` (string): Error message

**Location:** `app/forgot-password/page.tsx`

---

#### `password_reset_resend_requested`
**Description:** Fired when user requests to resend password reset email.

**Properties:** None

**Location:** `app/forgot-password/page.tsx`

---

#### `forgot_password_form_interaction_start`
**Description:** Fired when user starts interacting with forgot password form.

**Properties:** None

**Location:** `app/forgot-password/page.tsx`

---

#### `password_reset_page_viewed`
**Description:** Fired when password reset page is viewed.

**Properties:** None

**Location:** `app/reset-password/page.tsx`

---

#### `password_reset_page_error`
**Description:** Fired when password reset page encounters an error.

**Properties:**
- `error` (string): Error message
- `token` (string): Reset token (if available)

**Location:** `app/reset-password/page.tsx`

---

#### `password_reset_attempt`
**Description:** Fired when user attempts to reset password.

**Properties:** None

**Location:** `app/reset-password/page.tsx`

---

#### `password_reset_success`
**Description:** Fired when password reset succeeds.

**Properties:** None

**Location:** `app/reset-password/page.tsx`

---

#### `password_reset_submit_error`
**Description:** Fired when password reset submission fails.

**Properties:**
- `error` (string): Error message

**Location:** `app/reset-password/page.tsx`

---

#### `reset_password_page_mounted`
**Description:** Fired when reset password page mounts.

**Properties:** None

**Location:** `app/reset-password/page.tsx`

---

### Dashboard Events

#### `dashboard_viewed`
**Description:** Fired when dashboard page is viewed.

**Properties:**
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `dashboard_loaded`
**Description:** Fired when dashboard finishes loading.

**Properties:**
- `loadTime` (number): Load time in milliseconds

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `dashboard_error`
**Description:** Fired when dashboard encounters an error.

**Properties:**
- `error` (string): Error message
- `component` (string): Component where error occurred

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Diagnostic Events

#### `diagnostic_started`
**Description:** Fired when a diagnostic test session starts.

**Properties:**
- `sessionId` (string): Diagnostic session ID
- `examType` (string): Type of exam
- `questionCount` (number): Total number of questions
- `userId` (string \| null): User ID (null for anonymous)
- `isAnonymous` (boolean): Whether user is anonymous

**Location:** `app/diagnostic/[sessionId]/page.tsx`, `lib/analytics/campaign-analytics-integration.ts`

---

#### `diagnostic_resume_shown`
**Description:** Fired when resume diagnostic option is shown.

**Properties:**
- `sessionId` (string): Session ID
- `examType` (string): Exam type

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `diagnostic_resumed`
**Description:** Fired when user resumes a diagnostic session.

**Properties:**
- `sessionId` (string): Session ID
- `questionNumber` (number): Current question number

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `diagnostic_question_answered`
**Description:** Fired when user answers a diagnostic question.

**Properties:**
- `sessionId` (string): Session ID
- `questionNumber` (number): Question number (1-indexed)
- `totalQuestions` (number): Total questions in session
- `questionId` (number): Question ID
- `selectedAnswer` (string): Selected answer label (A, B, C, D)
- `examType` (string): Exam type
- `userId` (string \| null): User ID
- `isAnonymous` (boolean): Whether user is anonymous

**Location:** `app/diagnostic/[sessionId]/page.tsx`

---

#### `diagnostic_completed`
**Description:** Fired when diagnostic test is completed.

**Properties:**
- `sessionId` (string): Session ID
- `examType` (string): Exam type
- `totalQuestions` (number): Total questions answered
- `userId` (string \| null): User ID
- `isAnonymous` (boolean): Whether user is anonymous

**Location:** `app/diagnostic/[sessionId]/page.tsx`, `lib/analytics/campaign-analytics-integration.ts`

---

#### `diagnostic_abandoned`
**Description:** Fired when diagnostic test is abandoned (not completed).

**Properties:**
- `sessionId` (string): Session ID
- `questionNumber` (number): Last question number reached
- `totalQuestions` (number): Total questions in session

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `diagnostic_summary_viewed`
**Description:** Fired when diagnostic summary/results page is viewed.

**Properties:**
- `sessionId` (string): Session ID
- `examType` (string): Exam type
- `examKey` (string): Exam key identifier (e.g., "pmle")
- `score` (number): Final score percentage
- `totalQuestions` (number): Total questions
- `correctAnswers` (number): Number of correct answers
- `domainCount` (number): Number of domains assessed
- `readinessTier` (string): Readiness tier ID (e.g., "low", "building", "ready", "strong")

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `diagnostic_domain_clicked`
**Description:** Fired when user clicks into a domain from Domain Performance section.

**Properties:**
- `sessionId` (string): Session ID
- `examKey` (string): Exam key identifier (e.g., "pmle")
- `domainCode` (string): Domain code identifier
- `domainTier` (string): Domain tier ID based on performance percentage

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `study_plan_start_practice_clicked`
**Description:** Fired when user clicks a practice CTA from Study Plan section or top "weakest topics" CTA.

**Properties:**
- `sessionId` (string): Session ID
- `examKey` (string): Exam key identifier (e.g., "pmle")
- `domainCodes` (string[]): Array of domain codes for the practice session
- `questionCount` (number): Number of questions in the practice session
- `source` (string): Source of the click - "weakest" for top CTA or "domain_row" for Study Plan domain-specific CTAs

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `practice_session_created_from_diagnostic`
**Description:** Fired when a practice session is successfully created from the diagnostic summary page.

**Properties:**
- `diagnosticSessionId` (string): Diagnostic session ID
- `practiceSessionId` (string): Practice session ID
- `examKey` (string): Exam key identifier (e.g., "pmle")
- `domainCodes` (string[]): Array of domain codes for the practice session
- `questionCount` (number): Number of questions in the practice session

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `practice_session_creation_failed_from_diagnostic`
**Description:** Fired when practice session creation fails from the diagnostic summary page.

**Properties:**
- `diagnosticSessionId` (string): Diagnostic session ID
- `domainCodes` (string[]): Array of domain codes that were attempted
- `statusCode` (number, optional): HTTP status code if API call failed
- `errorType` (string, optional): Error type (e.g., "network_error")
- `error` (string): Error message

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `question_explanation_viewed`
**Description:** Fired when user opens/expands an explanation in Question Review section.

**Properties:**
- `sessionId` (string): Diagnostic session ID
- `examKey` (string): Exam key identifier (e.g., "pmle")
- `questionId` (string): Question ID
- `domain` (string): Question domain
- `isCorrect` (boolean): Whether the user's answer was correct

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx` (QuestionReview component)

---

### Study Path Events

#### `study_path_viewed`
**Description:** Fired when study path page is viewed.

**Properties:**
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `study_path_generated`
**Description:** Fired when study path is generated.

**Properties:**
- `userId` (string): User ID
- `examType` (string): Exam type
- `domainCount` (number): Number of domains in study path

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `study_path_error`
**Description:** Fired when study path generation fails.

**Properties:**
- `error` (string): Error message
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Practice Question Events

#### `practice_page_viewed`
**Description:** Fired when practice page is viewed.

**Properties:**
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `practice_question_loaded`
**Description:** Fired when a practice question loads.

**Properties:**
- `questionId` (string): Question ID
- `examType` (string): Exam type
- `domain` (string): Question domain

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `practice_question_answered`
**Description:** Fired when user answers a practice question.

**Properties:**
- `questionId` (string): Question ID
- `isCorrect` (boolean): Whether answer was correct
- `timeSpent` (number): Time spent in seconds

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `practice_question_error`
**Description:** Fired when practice question encounters an error.

**Properties:**
- `error` (string): Error message
- `questionId` (string): Question ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `practice_started`
**Description:** Fired when user starts a practice session. (Historical event - superseded by `practice_session_created_from_diagnostic` for readiness loop tracking)

**Properties:**
- `source` (string): Source context (e.g., "diagnostic_summary")
- `topics` (string \| string[]): Topics or "weakest" for weakest topics

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

**Note:** For Week 3 readiness and practice loop analytics, use `practice_session_created_from_diagnostic` instead, which provides more detailed tracking including session IDs and domain codes.

---

### Subscription & Billing Events

#### `subscription_created`
**Description:** Fired when a subscription is created (via Stripe webhook).

**Properties:**
- `plan_name` (string): Plan name
- `plan_tier` (string): Plan tier (free, pro, etc.)
- `price_id` (string): Stripe price ID
- `amount` (number): Amount in cents
- `currency` (string): Currency code (e.g., "usd")
- `billing_interval` (string): "monthly" or "yearly"
- `stripe_customer_id` (string): Stripe customer ID
- `stripe_subscription_id` (string): Stripe subscription ID
- `subscription_status` (string): Subscription status

**Location:** `app/api/billing/webhook/route.ts`

---

#### `subscription_created_webhook`
**Description:** Fired when subscription is created via webhook (before payment).

**Properties:**
- `stripe_subscription_id` (string): Stripe subscription ID
- `subscription_status` (string): Subscription status
- `plan_name` (string): Plan name
- `plan_tier` (string): Plan tier

**Location:** `app/api/billing/webhook/route.ts`

---

#### `subscription_updated`
**Description:** Fired when subscription is updated (e.g., cancellation scheduled).

**Properties:**
- `subscription_status` (string): New subscription status
- `cancel_at_period_end` (boolean): Whether cancellation is scheduled
- `stripe_subscription_id` (string): Stripe subscription ID
- `update_type` (string): "scheduled_cancellation" or "reactivation"

**Location:** `app/api/billing/webhook/route.ts`

---

#### `subscription_cancelled`
**Description:** Fired when subscription is cancelled.

**Properties:**
- `stripe_subscription_id` (string): Stripe subscription ID
- `cancellation_reason` (string): Reason for cancellation

**Location:** `app/api/billing/webhook/route.ts`

---

#### `payment_failed`
**Description:** Fired when payment fails.

**Properties:**
- `amount` (number): Amount in cents
- `currency` (string): Currency code
- `stripe_payment_intent_id` (string): Payment intent ID
- `failure_reason` (string): Reason for failure (e.g., "card_declined")

**Location:** `app/api/billing/webhook/route.ts`

---

#### `payment_intent_succeeded`
**Description:** Fired when payment intent succeeds.

**Properties:**
- `amount` (number): Amount in cents
- `currency` (string): Currency code
- `stripe_payment_intent_id` (string): Payment intent ID
- `receipt_url` (string \| null): Receipt URL if available

**Location:** `app/api/billing/webhook/route.ts`

---

#### `payment_one_time_succeeded`
**Description:** Fired when one-time payment succeeds.

**Properties:**
- `amount` (number): Amount in cents
- `currency` (string): Currency code
- `stripe_payment_intent_id` (string): Payment intent ID
- `stripe_checkout_session_id` (string): Checkout session ID

**Location:** `app/api/billing/webhook/route.ts`

---

#### `payment_recurring_succeeded`
**Description:** Fired when recurring subscription payment succeeds.

**Properties:**
- `amount` (number): Amount in cents
- `currency` (string): Currency code
- `stripe_payment_intent_id` (string): Payment intent ID
- `stripe_invoice_id` (string): Invoice ID
- `stripe_subscription_id` (string): Subscription ID

**Location:** `app/api/billing/webhook/route.ts`

---

#### `checkout_initiated`
**Description:** Fired when checkout process is initiated.

**Properties:**
- `plan_tier` (string): Plan tier selected
- `billing_interval` (string): "monthly" or "yearly"

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `checkout_session_created`
**Description:** Fired when Stripe checkout session is created.

**Properties:**
- `session_id` (string): Checkout session ID
- `plan_tier` (string): Plan tier

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `checkout_error`
**Description:** Fired when checkout fails.

**Properties:**
- `error` (string): Error message
- `plan_tier` (string): Plan tier attempted

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `billing_portal_accessed`
**Description:** Fired when user accesses billing portal.

**Properties:**
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `gate_viewed` / `upsell_view`
**Description:** Fired when premium gate/paywall is shown.

**Properties:**
- `route` (string): Current route
- `distinct_id` (string): PostHog distinct ID
- `feature` (string): Feature name that triggered gate
- `abBucket` (string): A/B test bucket (if applicable)
- `dwellMs` (number): Time spent viewing in milliseconds
- `score` (number): User's diagnostic score
- `trigger` (string): What triggered the upsell (e.g., "exit_intent", "deep_scroll")
- `variant` (string): Upsell variant shown
- `weakDomains` (array): Array of weak domain names

**Location:** `components/billing/UpgradePrompt.tsx`  
**Note:** PostHog shows `upsell_view` as the actual event name

---

#### `gate_cta_clicked`
**Description:** Fired when user clicks CTA on premium gate.

**Properties:**
- `route` (string): Current route
- `plan_context` (string): Plan context
- `feature` (string): Feature name

**Location:** `components/billing/UpgradePrompt.tsx`

---

#### `gate_dismissed` / `upsell_dismiss`
**Description:** Fired when user dismisses premium gate.

**Properties:**
- `route` (string): Current route
- `feature` (string): Feature name

**Location:** `components/billing/UpgradePrompt.tsx`  
**Note:** PostHog shows `upsell_dismiss` as the actual event name

---

#### `entitlement_check_failed`
**Description:** Fired when entitlement check fails (user lacks required subscription).

**Properties:**
- `feature` (string): Feature name
- `required_tier` (string): Required subscription tier

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Pricing Events

#### `pricing_page_viewed`
**Description:** Fired when pricing page is viewed.

**Properties:**
- Campaign attribution properties (if available)

**Location:** `lib/analytics/campaign-analytics-integration.ts`

---

#### `pricing_plan_selected`
**Description:** Fired when user selects a pricing plan.

**Properties:**
- `plan_tier` (string): Plan tier selected
- `billing_interval` (string): "monthly" or "yearly"

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Error Events

#### `unhandled_error`
**Description:** Fired when an unhandled error occurs.

**Properties:**
- `error_message` (string): Error message
- `error_stack` (string): Error stack trace
- `error_name` (string): Error name/type
- `component` (string): Component where error occurred
- `route` (string): Route where error occurred

**Location:** `components/providers/ErrorBoundary.tsx`, `lib/utils/error-handling.ts`

---

#### `error_recovery_attempted`
**Description:** Fired when error recovery is attempted.

**Properties:**
- `error_message` (string): Original error message
- `recovery_action` (string): Recovery action taken

**Location:** `components/providers/ErrorBoundary.tsx`

---

### Email Verification Events

#### `email_verification_page_viewed`
**Description:** Fired when email verification page is viewed.

**Properties:**
- `userId` (string): User ID

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `email_confirmed`
**Description:** Fired when email is confirmed.

**Properties:**
- `userId` (string): User ID
- `email` (string): Email address

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `email_verification_error`
**Description:** Fired when email verification fails.

**Properties:**
- `error` (string): Error message
- `token` (string): Verification token (if available)

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Conversion Events

#### `trial_started`
**Description:** Fired when user starts a free trial.

**Properties:**
- `email` (string): User email
- `trial_days` (number): Trial duration in days (typically 14)
- `price_id` (string): Stripe price ID
- `tier_name` (string): Tier name (e.g., "pro")
- `from_anonymous` (boolean): Whether user upgraded from anonymous
- `anonymous_session_id` (string \| null): Anonymous session ID if applicable

**Location:** `app/api/billing/trial/route.ts`

---

#### `trial_to_paid_conversion`
**Description:** Fired when trial converts to paid subscription.

**Properties:**
- `conversion_type` (string): Type of conversion
- `conversion_value` (number): Conversion value
- `trial_days_used` (number): Days of trial used
- `plan_tier` (string): Plan tier converted to

**Location:** `lib/analytics/analytics.ts` (via `trackConversion` helper)

---

#### `trial_modal_shown`
**Description:** Fired when trial conversion modal is shown.

**Properties:**
- `source` (string): Source context (e.g., "diagnostic_summary")
- `delay_seconds` (number): Delay before showing modal
- `diagnostic_score` (number \| undefined): Diagnostic score if available

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `trial_cta_clicked`
**Description:** Fired when user clicks trial CTA.

**Properties:**
- `source` (string): Source context
- `diagnostic_score` (number \| undefined): Diagnostic score if available

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

### Feature Discovery Events

#### `feature_discovered`
**Description:** Fired when user discovers a feature.

**Properties:**
- `feature_name` (string): Name of feature
- `discovery_method` (string): How feature was discovered

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `feature_used`
**Description:** Fired when user uses a feature.

**Properties:**
- `feature_name` (string): Name of feature
- `engagement_type` (string): Type of engagement
- `engagement_value` (number): Engagement value

**Location:** `lib/analytics/analytics.ts` (via `trackEngagement` helper)

---

### Beta Onboarding Events

#### `beta_started`
**Description:** Fired when beta onboarding flow starts.

**Properties:**
- Campaign attribution properties (if available)

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `start_diagnostic_clicked`
**Description:** Fired when user clicks "Start Diagnostic" in beta flow.

**Properties:**
- Campaign attribution properties (if available)

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `diagnostic_session_created`
**Description:** Fired when diagnostic session is created in beta flow.

**Properties:**
- `sessionId` (string): Session ID
- `examType` (string): Exam type

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `skip_diagnostic_clicked`
**Description:** Fired when user skips diagnostic in beta flow.

**Properties:**
- Campaign attribution properties (if available)

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `beta_banner_viewed`
**Description:** Fired when beta banner is viewed.

**Properties:**
- `banner_location` (string): Banner location

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

#### `beta_banner_dismissed`
**Description:** Fired when beta banner is dismissed.

**Properties:**
- `banner_location` (string): Banner location

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Email Campaign Events

#### `email_campaign_landing`
**Description:** Fired when user lands on site from email campaign.

**Properties:**
- `utm_source` (string \| undefined): UTM source
- `utm_medium` (string \| undefined): UTM medium
- `utm_campaign` (string \| undefined): UTM campaign
- `utm_content` (string \| undefined): UTM content
- `utm_term` (string \| undefined): UTM term
- `landing_page` (string): Landing page pathname
- `timestamp` (number): Unix timestamp

**Location:** `lib/analytics/campaign-analytics-integration.ts`

---

#### `campaign_attribution_set`
**Description:** Fired when campaign attribution is set from URL parameters.

**Properties:**
- `utm_source` (string \| undefined): UTM source
- `utm_medium` (string \| undefined): UTM medium
- `utm_campaign` (string \| undefined): UTM campaign
- `utm_content` (string \| undefined): UTM content
- `utm_term` (string \| undefined): UTM term
- `source_url` (string): Full source URL

**Location:** `lib/analytics/campaign-analytics-integration.ts`

---

#### `email_campaign_tracking_pixel_loaded`
**Description:** Fired when email campaign tracking pixel loads.

**Properties:**
- Campaign attribution properties

**Location:** Defined in `lib/analytics/analytics.ts` (constant)

---

### Waitlist Events

#### `waitlist_page_viewed`
**Description:** Fired when waitlist page is viewed.

**Properties:** None

**Location:** `app/waitlist/page.tsx`

---

#### `waitlist_joined`
**Description:** Fired when user joins waitlist.

**Properties:**
- `email` (string): Email address
- `source` (string): Source context

**Location:** `components/marketing/forms/waitlist-form.tsx`

---

#### `waitlist_form_submission_error`
**Description:** Fired when waitlist form submission fails.

**Properties:**
- `error` (string): Error message
- `email` (string): Email address used

**Location:** `components/marketing/forms/waitlist-form.tsx`

---

#### `waitlist_form_interaction_start`
**Description:** Fired when user starts interacting with waitlist form.

**Properties:** None

**Location:** `components/marketing/forms/waitlist-form.tsx`

---

### Marketing Events

#### `cta_click`
**Description:** Fired when user clicks a CTA button.

**Properties:**
- `cta_location` (string): Location of CTA (e.g., "hero", "footer")

**Location:** `components/marketing/forms/waitlist-form.tsx`

---

### Summary & Export Events

#### `summary_exported`
**Description:** Fired when user exports diagnostic summary.

**Properties:**
- `format` (string): Export format (e.g., "pdf")

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

#### `summary_shared`
**Description:** Fired when user shares diagnostic summary.

**Properties:** None

**Location:** `app/diagnostic/[sessionId]/summary/page.tsx`

---

### Pageview Events

#### `$pageview`
**Description:** Standard PostHog pageview event (fired automatically on route changes).

**Properties:**
- `$current_url` (string): Full URL including query parameters

**Location:** `components/providers/PostHogProvider.tsx`

**Note:** This is PostHog's built-in pageview event. It fires automatically on every route change in the Next.js app.

---

## Dashboard Recommendations

### Conversion Funnel Dashboard

**Events to Track:**
1. `waitlist_page_viewed` → `waitlist_joined`
2. `signup_attempt` → `signup_success` → `email_confirmed`
3. `trial_started` → `trial_to_paid_conversion`
4. `checkout_initiated` → `checkout_session_created` → `subscription_created`

**Metrics:**
- Waitlist conversion rate
- Signup completion rate
- Email verification rate
- Trial-to-paid conversion rate
- Checkout completion rate

---

### Diagnostic Engagement Dashboard

**Events to Track:**
1. `diagnostic_started` → `diagnostic_question_answered` → `diagnostic_completed`
2. `diagnostic_summary_viewed` → `practice_started`

**Metrics:**
- Diagnostic start rate
- Diagnostic completion rate
- Average questions answered per session
- Time to complete diagnostic
- Summary view rate
- Practice start rate from summary

---

### User Engagement Dashboard

**Events to Track:**
- `user_session_started`
- `dashboard_viewed`
- `practice_page_viewed`
- `practice_question_answered`
- `study_path_viewed`

**Metrics:**
- Daily/Monthly Active Users (DAU/MAU)
- Session duration
- Pages per session
- Practice questions per session
- Feature adoption rate

---

### Revenue Dashboard

**Events to Track:**
- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `payment_failed`
- `payment_recurring_succeeded`
- `trial_started`
- `trial_to_paid_conversion`

**Metrics:**
- Monthly Recurring Revenue (MRR)
- Trial conversion rate
- Churn rate
- Payment failure rate
- Average Revenue Per User (ARPU)

---

### Error Monitoring Dashboard

**Events to Track:**
- `unhandled_error`
- `error_recovery_attempted`
- `signup_error`
- `login_error`
- `dashboard_error`
- `practice_question_error`

**Metrics:**
- Error rate by type
- Error rate by route/component
- Recovery success rate
- Most common errors

---

### Campaign Attribution Dashboard

**Events to Track:**
- `email_campaign_landing`
- `campaign_attribution_set`
- `diagnostic_started` (with campaign properties)
- `diagnostic_completed` (with campaign properties)
- `pricing_page_viewed` (with campaign properties)

**Metrics:**
- Campaign landing rate
- Campaign-to-diagnostic conversion
- Campaign-to-paid conversion
- ROI by campaign

---

## PostHog Verification Status

**Verified Events (79 total in PostHog):**

The following events have been confirmed in PostHog production data (as of 2024-12-19):

### ✅ Confirmed with Properties Verified:
- `diagnostic_started` - Properties: `examType`, `isAnonymous`, `questionCount`, `sessionId`, `userId`
- `diagnostic_completed` - Last seen: 2025-11-22
- `diagnostic_question_answered` - Properties: `examType`, `isAnonymous`, `isCorrect`, `questionId`, `questionNumber`, `selectedAnswer`, `sessionId`, `totalQuestions`, `userId`
- `diagnostic_summary_viewed` - Properties: `correctAnswers`, `domainCount`, `examType`, `score`, `sessionId`, `totalQuestions`
- `signup_success` - Properties: `email`, `guestUpgraded`, `sessionsTransferred`
- `signup_attempt` - Last seen: 2025-11-10
- `signup_error` - Last seen: 2025-11-10
- `trial_started` - Properties: `email`, `from_anonymous`, `price_id`, `trial_days`
- `trial_modal_shown` - Last seen: 2025-11-22
- `trial_cta_clicked` - Last seen: 2025-11-22
- `practice_started` - Properties: `source`, `topics`
- `upsell_view` - Properties: `abBucket`, `dwellMs`, `score`, `trigger`, `variant`, `weakDomains`
- `upsell_dismiss` - Last seen: 2025-11-21
- `user_session_started` - Last seen: 2025-11-22
- `user_session_ended` - Last seen: 2025-11-21

### ⚠️ Events Defined in Code but Not Yet Fired:
Some events are defined in the codebase constants but haven't been fired in production yet:
- `subscription_created` - No properties found (likely server-side webhook only)
- `subscription_updated` - Webhook event, may not appear in client-side tracking
- `subscription_cancelled` - Webhook event
- `payment_failed` - Webhook event
- `payment_intent_succeeded` - Webhook event
- `payment_recurring_succeeded` - Webhook event
- `checkout_session_created` - May not be tracked yet
- `billing_portal_accessed` - May not be tracked yet

### 📝 Event Name Discrepancies:
- Code uses `gate_viewed`, `gate_cta_clicked`, `gate_dismissed` but PostHog shows `upsell_view` and `upsell_dismiss`
  - **Action:** Verify which naming convention is actually used in production

### 🔍 Standard PostHog Properties:
All events automatically include PostHog standard properties like:
- `$current_url`, `$pathname`, `$referrer`
- `$browser`, `$os`, `$device_type`
- `$geoip_*` (location data)
- `utm_*` (campaign attribution)
- `$session_id`, `$pageview_id`
- `$user_id` (when user is identified)

---

## Notes

- **Event Naming Convention:** Events use snake_case (e.g., `diagnostic_started`)
- **Property Naming Convention:** Properties use snake_case (e.g., `user_id`, `exam_type`)
- **Anonymous Users:** Many events support anonymous users with `isAnonymous: true` and `userId: null`
- **Campaign Attribution:** Campaign properties (utm_*) are automatically added to events via `addCampaignAttributionToEvent()` helper
- **Server vs Client Events:** Some events fire server-side (e.g., webhook events), others client-side (e.g., UI interactions)
- **Rate Limiting:** Some events (like `signup_rate_limited`) indicate rate limiting is in place
- **Verification:** Events marked with ✅ have been verified in PostHog production data. Events marked with ⚠️ are defined in code but may not have been fired yet or are server-side only.

---

## Questions or Updates?

If you need to add new events or update existing ones, please:
1. Update the event constants in `lib/analytics/analytics.ts`
2. Document the event and properties in this file
3. Update the version date at the top of this document

