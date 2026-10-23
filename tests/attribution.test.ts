import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_ID_COOKIE, ATTRIBUTION_COOKIE, attributionFromCookies, browserIdentity, checkoutAnalyticsMetadata, cookieValue, isKnownBotUserAgent, rememberFirstTouch, sanitizeAttribution } from "@/lib/analytics/attribution";
import { scheduleFunnelEvent, trackPurchaseCompleted } from "@/lib/analytics/server";
const deferred = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: deferred }));
const sdk = vi.hoisted(() => ({ init: vi.fn(), identify: vi.fn(), get_property: vi.fn(() => "anonymous"), get_distinct_id: vi.fn(() => "anonymous-browser"), reset: vi.fn() }));
vi.mock("posthog-js", () => ({ default: sdk }));
const first = { utm_source: "google", utm_medium: "cpc", utm_campaign: "pmle_search", utm_content: "five-question", gclid: "Click_123-xyz" };
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cookies = (identity = "a.anonymous-browser") => `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(first))}; ${ANALYTICS_ID_COOKIE}=${identity}`;
const fetchMock = vi.fn();
function browser(search = "?" + new URLSearchParams(first)) {
  const jar = new Map<string, string>();
  const writes: string[] = [];
  const document = { get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); }, set cookie(value: string) { writes.push(value); const [pair] = value.split(";"); const at = pair.indexOf("="); jar.set(pair.slice(0, at), pair.slice(at + 1)); } };
  const location = { search, protocol: "https:", pathname: "/diagnostic" };
  vi.stubGlobal("document", document); vi.stubGlobal("window", { location }); vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
  return { document, location, writes };
}
beforeEach(() => {
  vi.resetModules(); deferred.mockReset(); fetchMock.mockReset().mockResolvedValue(new Response("{}"));
  sdk.init.mockReset(); sdk.identify.mockReset(); sdk.get_property.mockReturnValue("anonymous"); sdk.get_distinct_id.mockReturnValue("anonymous-browser");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "unit-public-placeholder"); vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("first-party first-touch attribution", () => {
  it("keeps all five first-touch identifiers across SPA navigation, reloads and later campaigns", () => {
    const b = browser();
    expect(rememberFirstTouch()).toEqual(first);
    b.location.search = "?utm_source=reddit&gclid=later";
    expect(rememberFirstTouch()).toEqual(first);
    expect(attributionFromCookies(b.document.cookie)).toEqual(first);
    expect(b.writes).toHaveLength(1);
    expect(b.writes[0]).toMatch(/Path=\/; Max-Age=7776000; SameSite=Lax; Secure$/);
    expect(b.document.cookie).not.toMatch(/diagnostic|https|email/);
  });
  it("records a direct first visit without borrowing a later campaign", () => {
    const b = browser(""); expect(rememberFirstTouch()).toEqual({});
    b.location.search = "?utm_source=later"; expect(rememberFirstTouch()).toEqual({});
  });
  it("rejects PII syntax, controls, non-strings, URLs, unbounded fields and unknown keys", () => {
    expect(sanitizeAttribution({ ...first, email: "private@example.com", utm_source: "private@example.com", utm_medium: "https://private.test", utm_campaign: "x".repeat(121), utm_content: "name\nprivate", gclid: {} })).toEqual({});
    expect(attributionFromCookies(`${ATTRIBUTION_COOKIE}=%INVALID`)).toEqual({});
    expect(attributionFromCookies(`${ATTRIBUTION_COOKIE}=${encodeURIComponent("not JSON")}`)).toEqual({});
    expect(cookieValue(`${ATTRIBUTION_COOKIE}=${"x".repeat(2501)}`, ATTRIBUTION_COOKIE)).toBeUndefined();
    expect(browserIdentity(`${ANALYTICS_ID_COOKIE}=a.private%40example.com`)).toBeUndefined();
  });
  it("synchronously saves landing attribution and browser identity even if CTA beats pageview effects", async () => {
    const b = browser(); const client = await import("@/lib/analytics/client");
    expect(client.analyticsHeaders()).toEqual({ "X-PostHog-Distinct-Id": "anonymous-browser" });
    expect(attributionFromCookies(b.document.cookie)).toEqual(first);
    expect(browserIdentity(b.document.cookie)).toEqual({ id: "anonymous-browser", anonymous: true });
    client.identifyAnalytics(user);
    expect(sdk.identify).toHaveBeenCalledWith(user, undefined, Object.fromEntries(Object.entries(first).map(([k,v]) => [`$initial_${k}`,v])));
    expect(browserIdentity(b.document.cookie)?.anonymous).toBe(false);
  });
  it("does not write cookies or initialize PostHog for excluded browsers or an absent key", async () => {
    const b = browser(); b.document.cookie = "testero_internal=1"; b.writes.length = 0;
    const client = await import("@/lib/analytics/client"); expect(client.analyticsHeaders()).toEqual({});
    expect(b.writes).toEqual([]); expect(sdk.init).not.toHaveBeenCalled();
    b.document.cookie = "testero_internal=0"; b.writes.length = 0; vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(client.analyticsHeaders()).toEqual({}); expect(b.writes).toEqual([]);
  });
  it("returns empty request headers when browser cookie storage throws SecurityError with analytics configured", async () => {
    browser(); vi.stubGlobal("document", { get cookie() { throw new DOMException("Cookie access blocked", "SecurityError"); } });
    const client = await import("@/lib/analytics/client");
    expect(rememberFirstTouch()).toEqual({});
    expect(() => client.analyticsHeaders()).not.toThrow();
    expect(client.analyticsHeaders()).toEqual({});
    expect(sdk.init).not.toHaveBeenCalled();
  });
  it("returns empty request headers when SDK initialization fails", async () => {
    browser(); sdk.init.mockImplementation(() => { throw new Error("SDK unavailable"); });
    const client = await import("@/lib/analytics/client");
    expect(() => client.analyticsHeaders()).not.toThrow();
    expect(client.analyticsHeaders()).toEqual({});
  });
  it("returns empty request headers when SDK identity access fails", async () => {
    browser(); sdk.get_distinct_id.mockImplementation(() => { throw new Error("Identity unavailable"); });
    const client = await import("@/lib/analytics/client");
    expect(() => client.analyticsHeaders()).not.toThrow();
    expect(client.analyticsHeaders()).toEqual({});
  });
});
describe("named Google ad crawlers", () => {
  it.each([
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; Mozilla/5.0, Google-AdWords-Express) Chrome/153...",
    "AdsBot-Google (+http://www.google.com/adsbot.html)",
    "AdsBot-Google-Mobile (+http://www.google.com/mobile/adsbot.html)",
    "Google-Ads",
    "Mediapartners-Google",
  ])("excludes %s from client init, server scheduling and durable checkout collection", async userAgent => {
    const b = browser(); vi.stubGlobal("navigator", { userAgent });
    expect(isKnownBotUserAgent(userAgent)).toBe(true);
    const client = await import("@/lib/analytics/client");
    client.initializeAnalytics("/diagnostic");
    expect(client.analyticsHeaders()).toEqual({});
    expect(sdk.init).not.toHaveBeenCalled(); expect(b.writes).toEqual([]);
    const request = new Request("https://testero.ai/api/diagnostic", { headers: { "user-agent": userAgent, cookie: cookies() } });
    scheduleFunnelEvent(request, "diagnostic_started", "session", { session_id: "session" });
    expect(deferred).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
    expect(checkoutAnalyticsMetadata(request)).toEqual({ analytics_enabled: "0" });
  });
  it.each(["HeadlessChrome", "Playwright", "Googlebot", "crawler", "spider"])("preserves existing bot exclusion: %s", userAgent => {
    expect(isKnownBotUserAgent(userAgent)).toBe(true);
  });
  it("does not classify a normal mobile browser as a bot", () => {
    expect(isKnownBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148 Safari/604.1")).toBe(false);
  });
});
describe("server attribution and identity", () => {
  it.each(["diagnostic_started", "diagnostic_completed"] as const)("enriches %s with landing first-touch and browser identity without requiring a header", async event => {
    scheduleFunnelEvent(new Request("https://testero.ai/api/diagnostic", { headers: { cookie: cookies() } }), event, "session", { session_id: "session" });
    expect(fetchMock).not.toHaveBeenCalled(); await deferred.mock.calls[0][0]();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject({ ...first, distinct_id: "anonymous-browser", source: "server" });
  });
  it("links a confirmed signup GET's anonymous cookie to verified account before capturing signup", async () => {
    scheduleFunnelEvent(new Request("https://testero.ai/auth/confirm?token_hash=never-captured", { headers: { cookie: cookies(), "X-PostHog-Distinct-Id": "untrusted-other" } }), "signup_completed", user);
    await deferred.mock.calls[0][0]();
    const payloads = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(payloads.map(p => p.event)).toEqual(["$identify", "signup_completed"]);
    expect(payloads[0].properties).toMatchObject({ distinct_id: user, $anon_distinct_id: "anonymous-browser", $process_person_profile: true });
    expect(payloads[1].properties).toMatchObject({ ...first, distinct_id: user, source: "server" });
    expect(payloads[1].properties.$set_once.$initial_gclid).toBe(first.gclid);
    expect(JSON.stringify(payloads)).not.toContain("token_hash");
  });
  it("does not merge another identified account or require cookies to complete signup", async () => {
    for (const cookie of [cookies(`i.bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`), ""]) {
      scheduleFunnelEvent(new Request("https://testero.ai/auth/confirm", { headers: { cookie } }), "signup_completed", user);
    }
    for (const [cb] of deferred.mock.calls) await cb();
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).event)).toEqual(["signup_completed", "signup_completed"]);
  });
  it.each(["diagnostic_started", "diagnostic_completed"] as const)("uses verified account identity for authenticated %s even if browser SDK/header is absent or stale", async event => {
    for (const headers of [{ cookie: cookies(), "X-PostHog-Distinct-Id": "stale-other" }, {}]) {
      scheduleFunnelEvent(new Request("https://testero.ai/api/diagnostic", { headers: headers as Record<string, string> }), event, "session", { session_id: "session" }, undefined, user);
    }
    for (const [callback] of deferred.mock.calls) await callback();
    for (const [, init] of fetchMock.mock.calls) expect(JSON.parse(init.body).properties).toMatchObject({ distinct_id: user, session_id: "session", source: "server" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject(first);
  });
  it("checkout uses verified account rather than arbitrary header or anonymous cookie", async () => {
    scheduleFunnelEvent(new Request("https://testero.ai/api/billing/checkout", { headers: { cookie: cookies(), "X-PostHog-Distinct-Id": "other-person" } }), "checkout_started", user, { plan_name: "PMLE Pass" });
    await deferred.mock.calls[0][0]();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).properties).toMatchObject({ ...first, distinct_id: user, source: "server" });
  });
  it.each([{ cookie: cookies() + "; testero_internal=1" }, { cookie: cookies(), "user-agent": "HeadlessChrome" }])("excludes internal/bot server traffic and saves a durable checkout opt-out: %j", headers => {
    const request = new Request("https://testero.ai/api/billing/checkout", { headers: headers as Record<string, string> });
    expect(checkoutAnalyticsMetadata(request)).toEqual({ analytics_enabled: "0" });
    scheduleFunnelEvent(request, "signup_completed", user); expect(deferred).not.toHaveBeenCalled();
  });
  it("purchase uses only durable checkout metadata and verified user, not webhook cookies", async () => {
    const metadata = checkoutAnalyticsMetadata(new Request("https://testero.ai/api/billing/checkout", { headers: { cookie: cookies() } }));
    expect(metadata).toEqual({ analytics_enabled: "1", ...first });
    await trackPurchaseCompleted("cs_opaque", user, { ...metadata, email: "private@example.com", user_id: "other" });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.properties).toMatchObject({ ...first, distinct_id: user, source: "server", $process_person_profile: true });
    expect(payload.properties.$insert_id).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.properties.$set_once.$initial_gclid).toBe(first.gclid);
    expect(JSON.stringify(payload)).not.toMatch(/private|other|cs_opaque|anonymous-browser/);
  });
  it.each([null, {}, { analytics_enabled: "0", ...first }])("never captures a purchase without explicit checkout collection permission: %j", async metadata => {
    await trackPurchaseCompleted("cs_opaque", user, metadata); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports verified Stripe amount as numeric dollar revenue and uppercase currency", async () => {
    await trackPurchaseCompleted("cs_opaque", user, { analytics_enabled: "1" }, { amountTotal: 3900, currency: "usd" });
    const properties = JSON.parse(fetchMock.mock.calls[0][1].body).properties;
    expect(properties).toMatchObject({ revenue: 39, currency: "USD" }); expect(typeof properties.revenue).toBe("number");
  });
  it.each([{ amountTotal: -1, currency: "usd" }, { amountTotal: 39.5, currency: "usd" }, { amountTotal: null, currency: null }, { amountTotal: 3900, currency: "private@example.com" }])("omits invalid revenue instead of inventing a payment value: %j", async payment => {
    await trackPurchaseCompleted("cs_opaque", user, { analytics_enabled: "1" }, payment);
    const properties = JSON.parse(fetchMock.mock.calls[0][1].body).properties;
    expect(properties).not.toHaveProperty("revenue"); expect(properties).not.toHaveProperty("currency");
  });
  it("purchase analytics failure remains best effort", async () => {
    fetchMock.mockRejectedValue(new Error("transport unavailable"));
    await expect(trackPurchaseCompleted("cs_opaque", user, { analytics_enabled: "1", ...first })).resolves.toBeUndefined();
  });
});
