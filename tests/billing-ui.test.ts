import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PaidAccess } from "@/lib/billing/paid-access";
import { CheckoutButton, beginCheckout, checkoutDestination } from "@/components/checkout-button";
import { BillingAccount, PassStatus, openBillingPortal } from "@/components/billing-account";
import { CheckoutStatus, readCheckoutStatus, MAX_STATUS_CHECKS } from "@/components/checkout-status";
import PricingPage from "@/app/pricing/page";
import AccountPage from "@/app/account/page";
import CheckoutSuccessPage from "@/app/checkout/success/page";

const mocks = vi.hoisted(() => ({ user: vi.fn(), requireUser: vi.fn(), access: vi.fn(), checkoutEvent: vi.fn(), effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); } };
});
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: mocks.user }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/billing/paid-access", () => ({ getPaidAccess: mocks.access }));
vi.mock("@/lib/analytics/client", () => ({ trackCheckoutStarted: mocks.checkoutEvent }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const free: PaidAccess = { hasPaidAccess: false, isLegacySubscriber: false, accessUntil: null, pass: null };
const paid: PaidAccess = { hasPaidAccess: true, isLegacySubscriber: false, accessUntil: "2027-01-01T00:00:00Z", pass: { id: "pass", paid_at: "2026-10-03T00:00:00Z", expires_at: "2027-01-01T00:00:00Z", refunded_at: null } };
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  mocks.effects = [];
  mocks.user.mockReset().mockResolvedValue(null);
  mocks.requireUser.mockReset().mockResolvedValue({ id: "verified", email: "learner@example.com" });
  mocks.access.mockReset().mockResolvedValue(free);
  mocks.checkoutEvent.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("verified billing pages", () => {
  it("offers one $39 one-time 90-day pass, signup return, free diagnostic and no placeholder", async () => {
    const html = renderToStaticMarkup(await PricingPage());
    expect(html).toContain("$39"); expect(html).toContain("one-time"); expect(html).toContain("90 days");
    expect(html).toContain("No auto-renew"); expect(html).toContain("7-day refund");
    expect(html).toContain('href="/signup?next=/pricing"'); expect(html).toContain('href="/diagnostic"');
    expect(html).not.toMatch(/Phase 3|preview|coming soon/i);
  });
  it("renders checkout only for the verified server user", async () => {
    mocks.user.mockResolvedValue({ id: "verified" });
    const html = renderToStaticMarkup(await PricingPage());
    expect(html).toContain("Get PMLE Pass"); expect(html).not.toContain("/signup");
    expect(mocks.user).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires auth before checking account access freshly", async () => {
    mocks.access.mockResolvedValue(paid);
    const html = renderToStaticMarkup(await AccountPage());
    expect(mocks.requireUser).toHaveBeenCalledWith("/account"); expect(mocks.access).toHaveBeenCalledWith("verified");
    expect(mocks.requireUser.mock.invocationCallOrder[0]).toBeLessThan(mocks.access.mock.invocationCallOrder[0]);
    expect(html).toContain("Access until"); expect(html).toContain("January 1, 2027");
    expect(html).not.toMatch(/Phase 3|Manage legacy/);
    mocks.requireUser.mockRejectedValue(new Error("redirect")); mocks.access.mockClear();
    await expect(AccountPage()).rejects.toThrow("redirect"); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("shows portal only for active legacy access and an honest retry for verification failure", () => {
    const legacy = renderToStaticMarkup(createElement(BillingAccount, { access: { ...free, hasPaidAccess: true, isLegacySubscriber: true } }));
    expect(legacy).toContain("Manage legacy subscription"); expect(legacy).toContain("Active legacy subscription");
    const pass = renderToStaticMarkup(createElement(BillingAccount, { access: paid }));
    expect(pass).not.toContain("Manage legacy");
    const failure = renderToStaticMarkup(createElement(BillingAccount, { access: { ...free, unavailable: true } }));
    expect(failure).toContain("could not be loaded"); expect(failure).toContain("Retry");
    expect(failure).not.toContain("Free account"); expect(failure).not.toContain("Get PMLE Pass");
    const refunded = renderToStaticMarkup(createElement(PassStatus, { access: free }));
    expect(refunded).toContain("Free account"); expect(refunded).not.toContain("Access until");
  });
  it.each([undefined, "https://evil.example", ["cs_test_first", "cs_test_second"], "cs_"])('never infers a grant from missing or invalid session reference %s', async raw => {
    const page = await CheckoutSuccessPage({ searchParams: Promise.resolve({ session_id: raw }) });
    const html = renderToStaticMarkup(page);
    expect(mocks.requireUser).toHaveBeenCalledWith("/checkout/success");
    expect(html).toContain("No valid checkout reference"); expect(html).not.toContain("Pass is active");
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.access).not.toHaveBeenCalled();
  });
  it("protects success with its safe checkout reference and starts pending, not paid", async () => {
    const html = renderToStaticMarkup(await CheckoutSuccessPage({ searchParams: Promise.resolve({ session_id: "cs_test_owned" }) }));
    expect(mocks.requireUser).toHaveBeenCalledWith("/checkout/success?session_id=cs_test_owned");
    expect(html).toContain("Access starts only after your payment is verified"); expect(html).not.toContain("Pass is active");
    expect(MAX_STATUS_CHECKS).toBeLessThanOrEqual(6);
  });
});

describe("billing browser boundary", () => {
  it("posts only {} and tracks checkout_started only for the actual Stripe redirect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "https://checkout.stripe.com/c/pay/test" })));
    expect(await beginCheckout()).toBe("https://checkout.stripe.com/c/pay/test"); expect(mocks.checkoutEvent).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({ method: "POST", body: "{}", cache: "no-store", credentials: "same-origin" }));
    mocks.checkoutEvent.mockClear();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "/account", alreadyActive: true })));
    expect(await beginCheckout()).toBe("/account"); expect(mocks.checkoutEvent).not.toHaveBeenCalled();
  });
  it("rejects inconsistent already-active checkout redirects without tracking", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "https://checkout.stripe.com/c/pay/test", alreadyActive: true })));
    await expect(beginCheckout()).rejects.toThrow("unavailable"); expect(mocks.checkoutEvent).not.toHaveBeenCalled();
  });
  it.each([401, 503])("does not track or expose server details for checkout failure %s", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "secret-provider-token" }), { status }));
    await expect(beginCheckout()).rejects.not.toThrow("secret-provider-token"); expect(mocks.checkoutEvent).not.toHaveBeenCalled();
  });
  it.each(["javascript:alert(1)", "https://checkout.stripe.com.evil.example/pay", "//checkout.stripe.com/pay", "https://user:pw@checkout.stripe.com/pay", "https://evil.example", undefined])("rejects unsafe destination %s", href => expect(checkoutDestination(href)).toBeNull());
  it("only accepts the real Stripe portal destination and sends a no-store strict body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "https://billing.stripe.com/p/session/test" })));
    expect(await openBillingPortal()).toBe("https://billing.stripe.com/p/session/test");
    expect(fetch).toHaveBeenCalledWith("/api/billing/portal", expect.objectContaining({ method: "POST", body: "{}", cache: "no-store", credentials: "same-origin" }));
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "https://evil.example" })));
    await expect(openBillingPortal()).rejects.toThrow("unavailable");
  });
  it.each(["processing", "active", "refunded", "expired"])("reads verified status %s without checkout or grant requests", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status, accessUntil: status === "active" ? paid.accessUntil : null })));
    expect(await readCheckoutStatus("cs_test_owned")).toEqual({ status, accessUntil: status === "active" ? paid.accessUntil : null });
    expect(fetch).toHaveBeenCalledWith("/api/billing/status?session_id=cs_test_owned", expect.objectContaining({ cache: "no-store", credentials: "same-origin" }));
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not turn DB 503 or malformed status/date into payment success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "private DB failure" }), { status: 503 }));
    await expect(readCheckoutStatus("cs_test_owned")).rejects.toThrow("could not be verified");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "active", accessUntil: "not-a-date" })));
    await expect(readCheckoutStatus("cs_test_owned")).rejects.toThrow("could not be verified");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ status: "paid", accessUntil: null })));
    await expect(readCheckoutStatus("cs_test_owned")).rejects.toThrow("could not be verified");
  });
  it("renders accessible initial checkout controls and never a fabricated success", () => {
    expect(renderToStaticMarkup(createElement(CheckoutButton))).toContain("Get PMLE Pass");
    expect(renderToStaticMarkup(createElement(CheckoutStatus, { sessionId: "cs_test_owned" }))).not.toContain("Pass is active");
  });
});


describe("bounded checkout verification and authoritative focus reload", () => {
  function browser() {
    const listeners = new Map<string, () => void>();
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:3000", reload }, addEventListener: (name: string, callback: () => void) => listeners.set(name, callback), removeEventListener: (name: string) => listeners.delete(name) });
    return { listeners, reload };
  }
  it("accepts only exact same-origin local checkout confirmation and never tracks it as Stripe", async () => {
    browser();
    const href = "http://127.0.0.1:3000/checkout/success?session_id=cs_test_local";
    expect(checkoutDestination(href)).toBe(href);
    expect(checkoutDestination(href + "&next=https://evil.example")).toBeNull();
    expect(checkoutDestination("https://evil.example/checkout/success?session_id=cs_test_local")).toBeNull();
    expect(checkoutDestination("http://127.0.0.1:3000/checkout/success?session_id=cs_test_local#grant")).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href })));
    expect(await beginCheckout()).toBe(href); expect(mocks.checkoutEvent).not.toHaveBeenCalled();
  });
  it("accepts only exact same-origin local portal account return", async () => {
    browser();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href: "http://127.0.0.1:3000/account" })));
    expect(await openBillingPortal()).toBe("http://127.0.0.1:3000/account");
    expect(fetch).toHaveBeenCalledWith("/api/billing/portal", expect.objectContaining({ method: "POST", body: "{}", cache: "no-store", credentials: "same-origin" }));
    for (const href of ["http://127.0.0.1:3000/account?next=https://evil.example", "http://127.0.0.1:3000/account#billing", "http://user:pw@127.0.0.1:3000/account", "http://evil.example/account", "http://127.0.0.1:3001/account", "http://127.0.0.1:3000/account/", "http://127.0.0.1:3000/dashboard", "javascript:alert(1)"]) {
      vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ href })));
      await expect(openBillingPortal()).rejects.toThrow("unavailable");
    }
  });
  it("stops polling processing after six checks and cleans up focus listeners", async () => {
    const { listeners } = browser(); vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ status: "processing", accessUntil: null })));
    renderToStaticMarkup(createElement(CheckoutStatus, { sessionId: "cs_test_owned" }));
    const cleanup = mocks.effects[0]();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).toHaveBeenCalledTimes(MAX_STATUS_CHECKS);
    expect(listeners.has("focus")).toBe(true);
    if (typeof cleanup === "function") cleanup();
    expect(listeners.has("focus")).toBe(false);
  });
  it.each(["active", "refunded", "expired"])("stops short polling on verified %s", async status => {
    browser(); vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ status, accessUntil: status === "active" ? paid.accessUntil : null })));
    renderToStaticMarkup(createElement(CheckoutStatus, { sessionId: "cs_test_owned" }));
    const cleanup = mocks.effects[0]();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).toHaveBeenCalledOnce();
    if (typeof cleanup === "function") cleanup();
  });
  it("stops on DB 503 and offers retry rather than repeating or claiming payment success", async () => {
    browser(); vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => new Response("{}", { status: 503 }));
    renderToStaticMarkup(createElement(CheckoutStatus, { sessionId: "cs_test_owned" }));
    const cleanup = mocks.effects[0]();
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).toHaveBeenCalledOnce();
    if (typeof cleanup === "function") cleanup();
  });
  it("does no status request for a missing reference", () => {
    browser(); renderToStaticMarkup(createElement(CheckoutStatus, { sessionId: null }));
    mocks.effects[0](); expect(fetch).not.toHaveBeenCalled();
  });
  it("reloads account access authoritatively on focus after refunds, with cleanup", () => {
    const { listeners, reload } = browser();
    renderToStaticMarkup(createElement(BillingAccount, { access: paid }));
    const cleanup = mocks.effects[0]();
    listeners.get("focus")?.(); expect(reload).toHaveBeenCalledOnce();
    if (typeof cleanup === "function") cleanup();
    expect(listeners.has("focus")).toBe(false);
  });
});
