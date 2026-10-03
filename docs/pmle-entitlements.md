# PMLE Access & Entitlements

PMLE Pass costs US$39 once. It grants 90 days of access, with no renewal.
A refund within the 7-day policy revokes pass access. Active legacy subscriptions retain access.

## Authoritative access

`lib/billing/paid-access.ts` reads durable paid-access records. Server routes use
`getPmleAccessLevelForRequest()` from `lib/access/pmleEntitlements.server.ts`.
Client views use `/api/billing/status` and `getPmleAccessLevelForUser()`.
The client is not an authorization boundary.

`SUBSCRIBER` and `isSubscriber` remain compatibility aliases for paid access.
They do not describe a new recurring subscription or trial.
Checkout cookies and environment flags never grant question access.
Auth and entitlement errors fail closed.

## Feature matrix

| Feature | Anonymous | Free account | Valid pass or active legacy subscription |
| --- | --- | --- | --- |
| Diagnostic runs and retakes | Yes | Yes | Yes |
| Score, readiness, domain breakdown | Yes | Yes | Yes |
| Diagnostic question review | No | Yes | Yes |
| Explanations | No | No | Yes |
| Unlimited targeted practice | No | No | Yes |
| Quota-backed practice creation | No | Yes, subject to server quota | Yes |

There is no one-free-diagnostic restriction or paid-retake claim.
Session ownership and anonymous session identifiers still control access to results.

## Boundaries

- `/practice/question` and its nested question pages require `PRACTICE_SESSION`.
- Standalone question APIs use `requireSubscriber`, which checks authenticated,
  durable `PRACTICE_SESSION` and `EXPLANATIONS` access before reading questions.
- Diagnostic routes and layouts are not paid-only. Diagnostic answer submission
  returns correctness only, never a correct-answer label or explanation.
- Anonymous diagnostic summary responses omit `summary.questions` entirely.
  The UI shows score, readiness, and an unblurred domain breakdown. Question
  review requires an account. Signup uses `/signup` and retains the existing
  session attribution marker, not an unsupported return-to parameter.
- Free users can review their own completed quota-backed practice sessions.
  Owner authorization remains mandatory. Explanations require paid access and
  are not queried for free users.
- A refused dashboard practice-creation request leads to the pass pricing path.
  It never falls back to unlimited standalone practice.

## Adding features

Add the feature to `PmleFeature`, update `FEATURE_MATRIX`, and test anonymous,
free, and paid access. Check authorization on the server before loading protected
content. UI locks must not hide content that the API has already leaked.

## Verification

Focused regressions cover standalone API and layout gates, ignored checkout
cookies, fail-closed entitlement errors, answer-payload redaction, anonymous
aggregate-only summaries, visible domain breakdown, signup CTA, free-owned
summary authorization, and refused dashboard session creation. Services are mocked.
