import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "@/app/login/page";
import DashboardPage from "@/app/dashboard/page";
import PracticePage from "@/app/practice/[id]/page";
import PracticeSummaryPage from "@/app/practice/[id]/summary/page";
import { DashboardLoadError } from "@/components/dashboard-panel";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), claim: vi.fn(), load: vi.fn(), client: {}, cookies: vi.fn(), readPractice: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/auth/claim", () => ({ claimAnonymousDiagnostics: mocks.claim }));
vi.mock("@/lib/dashboard/service", () => ({ loadDashboard: mocks.load }));
vi.mock("@/lib/practice/service", () => ({ readPractice: mocks.readPractice }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => mocks.client }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/analytics/client", () => ({ trackPractice: vi.fn() }));

beforeEach(() => {
  mocks.requireUser.mockReset().mockResolvedValue({ id: "verified-owner" });
  mocks.claim.mockReset().mockResolvedValue(0);
  mocks.readPractice.mockReset().mockResolvedValue(null);
  mocks.load.mockReset().mockResolvedValue({ paidAccess: { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null }, diagnostic: null, weakestDomains: [], domains: [], openPractice: null, progress: { totalQuestions: 0, correctAnswers: 0, score: 0, domainBreakdown: [] }, practiceHistory: [] });
  mocks.cookies.mockReset().mockResolvedValue({ get: (name: string) => name === "testero_anon" ? { value: "actual-cookie-token" } : undefined });
});

describe("protected study pages", () => {
  it("verifies auth before retrying an anonymous claim with the real cookie and loading owned data", async () => {
    await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(mocks.requireUser).toHaveBeenCalledWith("/dashboard");
    expect(mocks.claim).toHaveBeenCalledWith(mocks.client, "verified-owner", "actual-cookie-token");
    expect(mocks.load).toHaveBeenCalledWith(mocks.client, "verified-owner");
    expect(mocks.requireUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.claim.mock.invocationCallOrder[0]);
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.load.mock.invocationCallOrder[0]);
  });
  it("never claims or loads dashboard data when auth redirects", async () => {
    mocks.requireUser.mockRejectedValue(new Error("redirect"));
    await expect(DashboardPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("shows honest retry, not an empty dashboard, when the claim fails", async () => {
    mocks.claim.mockRejectedValue(new Error("private DB failure"));
    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(page.type).toBe(DashboardLoadError);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("shows honest retry when the owned dashboard load fails", async () => {
    mocks.load.mockRejectedValue(new Error("private DB failure"));
    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    expect(page.type).toBe(DashboardLoadError);
  });
  it("preserves the password-updated flag through the dashboard auth boundary", async () => {
    const page = await DashboardPage({ searchParams: Promise.resolve({ message: "password-updated" }) });
    expect(mocks.requireUser).toHaveBeenCalledWith("/dashboard?message=password-updated");
    expect(renderToStaticMarkup(page)).toContain("Password updated.");
  });
  it("shows the password-updated notice even when dashboard loading fails", async () => {
    mocks.load.mockRejectedValue(new Error("private DB failure"));
    const page = await DashboardPage({ searchParams: Promise.resolve({ message: "password-updated" }) });
    expect(renderToStaticMarkup(page)).toContain("Password updated.");
  });
  it.each([
    { message: "password-updated" }, { next: "/dashboard?message=password-updated" },
  ])("explains a post-reset sign-in prompt %#", async params => {
    const page = await LoginPage({ searchParams: Promise.resolve(params) });
    expect(renderToStaticMarkup(page)).toContain("Password updated. Please sign in again with your new password.");
  });
  it("ignores forged focus query text and loads only the verified stored practice", async () => {
    const stored = { sessionId: "saved-session", selection: { reason: "diagnostic_focus", domainCode: "stored-domain", message: "Trusted saved focus" } };
    mocks.readPractice.mockResolvedValue(stored);
    const props = { params: Promise.resolve({ id: "saved-session" }), searchParams: Promise.resolve({ focus: "FORGED-FROM-URL" }) };
    const page = await PracticePage(props);
    expect(mocks.readPractice).toHaveBeenCalledWith(mocks.client, "saved-session", "verified-owner");
    expect(page.props.initialData).toBe(stored);
    expect(JSON.stringify(page)).not.toContain("FORGED-FROM-URL");
  });
  it("protects practice and summary with the encoded actual session return path", async () => {
    await PracticePage({ params: Promise.resolve({ id: "actual/id" }) });
    expect(mocks.requireUser).toHaveBeenLastCalledWith("/practice/actual%2Fid");
    await PracticeSummaryPage({ params: Promise.resolve({ id: "actual/id" }) });
    expect(mocks.requireUser).toHaveBeenLastCalledWith("/practice/actual%2Fid/summary");
  });
});
