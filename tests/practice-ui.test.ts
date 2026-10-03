import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { PracticeSession } from "@/components/practice-session";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardData } from "@/lib/dashboard/types";
import { DashboardPanel } from "@/components/dashboard-panel";
import { PracticeStart } from "@/components/practice-start";
import { PracticeError, PracticeRequestError, practiceRequest } from "@/components/practice-resource";

const state = vi.hoisted(() => ({ progress: null as unknown }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
vi.mock("@/components/practice-resource", async importOriginal => {
  const actual = await importOriginal<typeof import("@/components/practice-resource")>();
  return { ...actual, usePracticeResource: () => ({ data: state.progress, error: null, reload: vi.fn() }) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/analytics/client", () => ({ trackPractice: vi.fn() }));

const domains = Array.from({ length: 6 }, (_, index) => ({ domainCode: `D${index}`, domainName: `Domain ${index}` }));
const empty: DashboardData = { paidAccess: { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null }, diagnostic: null, weakestDomains: [], domains, openPractice: null, quota: { remaining: 5, weekStart: "2026-09-28" } };

beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); state.progress = null; });
afterEach(() => vi.unstubAllGlobals());

describe("practice HTTP boundary", () => {
  it("uses no-store and same-origin credentials even if a caller supplies weaker defaults", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ sessionId: "owned" }), { status: 201 }));
    expect(await practiceRequest("/api/practice", { cache: "default", credentials: "omit" })).toEqual({ sessionId: "owned" });
    expect(fetch).toHaveBeenCalledWith("/api/practice", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
  });
  it.each([401, 403, 404, 409, 410, 429, 500])("keeps status %s but never exposes server error details", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "secret-db-user@example.com" }), { status }));
    try { await practiceRequest("/api/practice/owned"); throw new Error("Expected rejection"); }
    catch (error) {
      expect(error).toBeInstanceOf(PracticeRequestError);
      expect((error as PracticeRequestError).status).toBe(status);
      expect((error as Error).message).not.toContain("secret-db-user");
    }
  });
  it("preserves the strict browser answer body without a user ID", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}"));
    await practiceRequest("/api/practice/owned/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: "item", selectedLabel: "B" }) });
    expect(fetch).toHaveBeenCalledWith("/api/practice/owned/answer", expect.objectContaining({ body: '{"itemId":"item","selectedLabel":"B"}', method: "POST" }));
  });
});

describe("dashboard and practice states", () => {
  it("shows a genuine empty diagnostic with a diagnostic link and all six practice domains", () => {
    const html = renderToStaticMarkup(createElement(DashboardPanel, { data: empty }));
    expect(html).toContain("Take a diagnostic");
    expect(html).toContain("Practice domain");
    domains.forEach(domain => expect(html).toContain(domain.domainName));
    expect(html).not.toContain("0% score");
    expect(html).not.toContain("Coming in Phase 2");
    expect(html).toContain("Free account. 5 practice questions each week.");
    expect(html).not.toContain("Phase 3");
  });
  it("shows score, weakest-domain CTAs and an owned resume link without question review", () => {
    const breakdown = domains.map((domain, index) => ({ ...domain, total: 3, correct: index % 3, percentage: index * 10 }));
    const html = renderToStaticMarkup(createElement(DashboardPanel, { data: {
      ...empty,
      diagnostic: { sessionId: "diagnostic", score: 40, totalQuestions: 20, correctAnswers: 8, readiness: { id: "building", label: "Building", description: "Keep studying." }, domainBreakdown: breakdown } as DashboardData["diagnostic"],
      weakestDomains: breakdown.slice(0, 2), openPractice: { sessionId: "owned/session", domainName: "Domain 1" },
    } }));
    expect(html).toContain("40%");
    expect(html).toContain("Practice Domain 0");
    expect(html).toContain("Practice Domain 1");
    expect(html).toContain('/practice/owned%2Fsession');
    expect(html).not.toContain("Question review");
    expect(html).not.toMatch(/explanation/i);
  });
  it("replaces ungated practice controls with the exhausted allowance and pricing CTA", () => {
    const html = renderToStaticMarkup(createElement(PracticeStart, { domains, weakestDomains: [], remaining: 0 }));
    expect(html).toContain("5 free practice questions");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("Upgrade to PMLE Pass");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("Start practice</button>");
  });
  it("allows paid practice with an exhausted free quota, with unlimited 5-question sessions", () => {
    const html = renderToStaticMarkup(createElement(PracticeStart, { domains, weakestDomains: [], remaining: 0, hasPaidAccess: true }));
    expect(html).toContain("unlimited practice sessions");
    expect(html).toContain("5 questions");
    expect(html).toContain("Start practice</button>");
    expect(html).toContain("<select");
    expect(html).not.toContain("free practice questions remaining");
    expect(html).not.toContain("Upgrade to PMLE Pass");
  });
  it("renders the verified pass expiry or legacy status instead of Phase 3 placeholders", () => {
    const html = renderToStaticMarkup(createElement(DashboardPanel, { data: { ...empty, paidAccess: { hasPaidAccess: true, isLegacySubscriber: false, accessUntil: "2027-01-01T00:00:00Z", pass: { id: "pass", paid_at: "2026-10-03T00:00:00Z", expires_at: "2027-01-01T00:00:00Z", refunded_at: null } } } }));
    expect(html).toContain("Access until");
    expect(html).toContain("January 1, 2027");
    const legacy = renderToStaticMarkup(createElement(DashboardPanel, { data: { ...empty, paidAccess: { hasPaidAccess: true, isLegacySubscriber: true, accessUntil: null, pass: null } } }));
    expect(legacy).toContain("Active legacy subscription");
  });
  it("does not call failed access verification a free account or offer ungated practice", () => {
    const html = renderToStaticMarkup(createElement(DashboardPanel, { data: { ...empty, paidAccess: { ...empty.paidAccess, unavailable: true } } }));
    expect(html).toContain("could not be verified");
    expect(html).not.toContain("Free account.");
    expect(html).not.toContain("Start practice</button>");
  });
  it("offers a safe sign-in return path when practice auth expires", () => {
    const html = renderToStaticMarkup(createElement(PracticeError, { error: new PracticeRequestError(401, "Please sign in again."), nextPath: "/practice/owned/summary", onRetry: vi.fn() }));
    expect(html).toContain('/login?next=%2Fpractice%2Fowned%2Fsummary');
    expect(html).toContain("Back to dashboard");
    expect(html).not.toContain("Back to diagnostic");
  });
});


describe("practice explanation display boundary", () => {
  const question = { id: "item", ordinal: 1, stem: "Current question", options: [{ label: "A", text: "First" }, { label: "B", text: "Second" }] };
  const feedback = { itemId: "item", selectedLabel: "B", correctLabel: "A", isCorrect: false, explanation: "Saved-answer explanation", optionExplanations: [{ label: "A", text: "First snapshot", explanation: "Saved option explanation" }] };
  it("does not render correctness or explanation fields before an answer, even if received on the current question", () => {
    state.progress = { sessionId: "owned", status: "in_progress", answeredCount: 0, totalQuestions: 5, currentQuestion: { ...question, explanation: "Premature explanation", correctLabel: "A", options: [{ ...question.options[0], explanation: "Premature option explanation" }, question.options[1]] } };
    const html = renderToStaticMarkup(createElement(PracticeSession, { sessionId: "owned" }));
    expect(html).toContain("Current question"); expect(html).toContain("Submit answer");
    expect(html).not.toMatch(/Premature|Correct answer|Option explanations|Saved-answer/);
  });
  it("renders explanations only from saved answer feedback, with snapshot label and text", () => {
    state.progress = { sessionId: "owned", status: "in_progress", answeredCount: 0, totalQuestions: 5, currentQuestion: question };
    vi.mocked(useState).mockImplementationOnce(() => ["B", vi.fn()] as never)
      .mockImplementationOnce(() => [false, vi.fn()] as never)
      .mockImplementationOnce(() => [{ answeredCount: 1, totalQuestions: 5, completed: false, feedback }, vi.fn()] as never);
    const html = renderToStaticMarkup(createElement(PracticeSession, { sessionId: "owned" }));
    expect(html).toContain("Saved-answer explanation"); expect(html).toContain("Saved option explanation");
    expect(html).toContain("First snapshot"); expect(html).toContain("Correct answer: A");
    expect(html).not.toContain("Submit answer");
  });
  it("does not invent explanations for free saved-answer feedback", () => {
    state.progress = { sessionId: "owned", status: "in_progress", answeredCount: 0, totalQuestions: 5, currentQuestion: question };
    const { explanation: _explanation, optionExplanations: _optionExplanations, ...freeFeedback } = feedback;
    void _explanation; void _optionExplanations;
    vi.mocked(useState).mockImplementationOnce(() => ["B", vi.fn()] as never)
      .mockImplementationOnce(() => [false, vi.fn()] as never)
      .mockImplementationOnce(() => [{ answeredCount: 1, totalQuestions: 5, completed: false, feedback: freeFeedback }, vi.fn()] as never);
    const html = renderToStaticMarkup(createElement(PracticeSession, { sessionId: "owned" }));
    expect(html).toContain("Correct answer: A"); expect(html).not.toMatch(/Explanation|Saved-answer|Saved option/);
  });
});
