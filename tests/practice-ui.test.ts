import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardData } from "@/lib/dashboard/types";
import { DashboardPanel } from "@/components/dashboard-panel";
import { PracticeStart } from "@/components/practice-start";
import { PracticeError, PracticeRequestError, practiceRequest } from "@/components/practice-resource";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/analytics/client", () => ({ trackPractice: vi.fn() }));

const domains = Array.from({ length: 6 }, (_, index) => ({ domainCode: `D${index}`, domainName: `Domain ${index}` }));
const empty: DashboardData = { diagnostic: null, weakestDomains: [], domains, openPractice: null, quota: { remaining: 5, weekStart: "2026-09-28" } };

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
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
    expect(html).toContain("billing is available in Phase 3");
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
  it("offers a safe sign-in return path when practice auth expires", () => {
    const html = renderToStaticMarkup(createElement(PracticeError, { error: new PracticeRequestError(401, "Please sign in again."), nextPath: "/practice/owned/summary", onRetry: vi.fn() }));
    expect(html).toContain('/login?next=%2Fpractice%2Fowned%2Fsummary');
    expect(html).toContain("Back to dashboard");
    expect(html).not.toContain("Back to diagnostic");
  });
});
