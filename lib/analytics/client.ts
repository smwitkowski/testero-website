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
    disable_session_recording: true,
    person_profiles: "identified_only",
    persistence: "memory",
  });
  initialized = true;
}

export function trackPageview(path: string) {
  if (initialized) posthog.capture("$pageview", { $current_url: `${window.location.origin}${path}` });
}

export function trackDiagnostic(event: "diagnostic_started" | "diagnostic_completed", sessionId: string) {
  if (initialized) posthog.capture(event, { session_id: sessionId });
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
