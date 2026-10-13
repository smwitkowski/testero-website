"use client";

import posthog from "posthog-js";

let initialized = false;

export function initializeAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || initialized) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: false,
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function trackPageview(path: string) {
  if (initialized) posthog.capture("$pageview", { $current_url: `${window.location.origin}${path}` });
}

export function trackDiagnostic(event: "diagnostic_started" | "diagnostic_completed", sessionId: string) {
  if (initialized) posthog.capture(event, { session_id: sessionId, $insert_id: `${event}:${sessionId}` });
}

export function trackSignupCompleted() {
  if (initialized) posthog.capture("signup_completed");
}
export function trackPractice(sessionId: string) {
  if (initialized) posthog.capture("practice_started", { session_id: sessionId });
}
export function trackCheckoutStarted() {
  if (initialized) posthog.capture("checkout_started", { plan_name: "PMLE Pass" });
}

export function identifyAnalytics(userId: string) {
  initializeAnalytics();
  if (initialized && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) posthog.identify(userId);
}

export function resetAnalytics() {
  if (initialized) posthog.reset();
}

export function analyticsHeaders(): Record<string, string> {
  initializeAnalytics();
  if (!initialized) return {};
  return { "X-PostHog-Distinct-Id": posthog.get_distinct_id() };
}

export function trackDiagnosticAnswer(sessionId: string, ordinal: number, domainCode: string) {
  if (initialized) posthog.capture("diagnostic_question_answered", {
    session_id: sessionId, ordinal, domain_code: domainCode,
  });
}
