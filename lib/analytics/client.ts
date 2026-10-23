"use client";

import posthog from "posthog-js";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";

let initialized = false;
let recordingEnabled = false;

function excludedBrowser(): boolean {
  return (typeof document !== "undefined" && /(?:^|;\s*)testero_internal=1(?:;|$)/.test(document.cookie))
    || (typeof navigator !== "undefined" && /HeadlessChrome|Playwright|bot\b|crawler|spider/i.test(navigator.userAgent));
}

function appRecordingRoute(path: string): boolean {
  return /^\/(diagnostic|practice|dashboard|account|checkout)(?:\/|$)/.test(path);
}

export function configureAnalyticsForPath(path: string) {
  initializeAnalytics(path);
  if (!initialized) return;
  const enabled = appRecordingRoute(path);
  if (enabled === recordingEnabled) return;
  posthog.set_config({ disable_session_recording: !enabled });
  if (!enabled) posthog.stopSessionRecording();
  recordingEnabled = enabled;
}

export function initializeAnalytics(path = typeof window === "undefined" ? "/" : window.location.pathname) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  // Match the server-side internal-traffic and bot exclusions before loading the SDK.
  if (!key || initialized || excludedBrowser()) return;
  recordingEnabled = appRecordingRoute(path);
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: !recordingEnabled,
    disable_surveys: true,
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function trackPageview(path: string) {
  const publicPath = path.split(/[?#]/)[0];
  const safePath = publicPath === "/tools" || publicPath.startsWith("/tools/") ? publicPath : path;
  if (initialized) posthog.capture("$pageview", { $current_url: `${window.location.origin}${safePath}` });
}

export function trackDiagnostic(event: "diagnostic_started" | "diagnostic_completed", sessionId: string, length?: number, certId = PMLE_CERT_ID) {
  if (initialized) posthog.capture(event, { session_id: sessionId, cert_id: certId, ...([5, 10, 20].includes(length ?? 0) ? { length } : {}), $insert_id: `${event}:${sessionId}` });
}

export function trackSignupCompleted() {
  if (initialized) posthog.capture("signup_completed");
}
export function trackPractice(sessionId: string, remaining: number | null = null) {
  if (initialized) posthog.capture("practice_started", { session_id: sessionId, free_questions_remaining_at_check: remaining });
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

export function trackDiagnosticAnswer(sessionId: string, ordinal: number, domainCode: string, isCorrect: boolean, certId = PMLE_CERT_ID, total = 20) {
  if (initialized && !excludedBrowser()) posthog.capture("diagnostic_question_answered", {
    session_id: sessionId, question_index: ordinal, total, domain: domainCode, correct: isCorrect, exam: certId, length: total,
    $insert_id: `diagnostic_question_answered:${sessionId}:${ordinal}`,
  });
}

export type CertificationTool = "cert-picker" | "study-plan" | "exam-guide-changes";
export function trackTool(event: "tool_used" | "tool_result_viewed", tool: CertificationTool, certId?: string) {
  initializeAnalytics();
  if (initialized) posthog.capture(event, {
    tool, ...(certifications.some(cert => cert.cert_id === certId) ? { cert_id: certId } : {}),
    $current_url: typeof window === "undefined" ? undefined : `${window.location.origin}${window.location.pathname}`,
  });
}

/** Results metadata only: never stems, answers, email addresses or other PII. */
export function trackResults(event: "results_viewed" | "free_explanation_viewed" | "unlock_cta_clicked", result: import("@/lib/diagnostic/types").DiagnosticResult) {
  initializeAnalytics();
  if (initialized) posthog.capture(event, {
    session_id: result.sessionId,
    cert_id: result.certId ?? PMLE_CERT_ID,
    question_count: result.totalQuestions,
    domain_scores: result.domainBreakdown.map(domain => ({ domain_code: domain.domainCode, correct: domain.correct, total: domain.total, percentage: domain.percentage })),
    ...(event !== "unlock_cta_clicked" ? { $insert_id: `${event}:${result.sessionId}` } : {}),
  });
}
