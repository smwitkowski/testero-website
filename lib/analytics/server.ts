import "server-only";
import { PMLE_PASS_PRICE } from "@/lib/billing/pmle-pass";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { attributionFromCookies, browserIdentity, excludedTraffic, firstTouchPersonProperties, isAccountId, isAnalyticsId, sanitizeAttribution, type Attribution } from "./attribution";

type FunnelEvent = "diagnostic_started" | "diagnostic_completed" | "signup_completed" | "checkout_started" | "cert_waitlist_joined";
type FunnelProperties = { session_id?: string; plan_name?: string; cert_id?: string; length?: number } & Attribution;

/** Only server-verified account identity and allowlisted checkout metadata reach analytics.
 * Webhook cookies are neither available nor relevant; collection exclusions travel with checkout. */
export async function trackPurchaseCompleted(checkoutId: string, userId: string, metadata: Record<string, string> | null, payment?: { amountTotal: number | null; currency: string | null }) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || !isAccountId(userId) || metadata?.analytics_enabled !== "1") return;
  const purchase = createHash("sha256").update(`testero:purchase:${checkoutId}`).digest("hex");
  const first = sanitizeAttribution(metadata);
  const revenue = payment && payment.amountTotal !== null && Number.isSafeInteger(payment.amountTotal)
    && payment.amountTotal >= 0 && payment.currency && /^[a-z]{3}$/i.test(payment.currency)
    ? { revenue: payment.amountTotal / 100, currency: payment.currency.toUpperCase() }
    : { revenue: PMLE_PASS_PRICE, currency: "USD" };
  try {
    await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/capture/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(1000),
      body: JSON.stringify({ api_key: key, event: "purchase_completed", properties: {
        distinct_id: userId, source: "server", $insert_id: purchase, $process_person_profile: true,
        plan_name: "PMLE Pass", ...first, ...revenue, $set_once: firstTouchPersonProperties(first),
      } }),
    });
  } catch { /* Analytics must never change payment fulfillment or expose billing errors. */ }
}

/** Our own automation (headless browsers, crawlers) or anyone with the testero_internal=1 cookie. */
export function isInternalRequest(request: Request): boolean {
  return excludedTraffic(request.headers.get("cookie") ?? "", request.headers.get("user-agent") ?? "");
}

/** Analytics scheduling and transport failures never change a successful response. */
export function scheduleFunnelEvent(request: Request, event: FunnelEvent, fallbackId: string, properties: FunnelProperties = {}, insertId?: string, verifiedUserId?: string | null) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || isInternalRequest(request)) return;
  try {
    const cookies = request.headers.get("cookie") ?? "";
    const browser = browserIdentity(cookies);
    const suppliedId = request.headers.get("X-PostHog-Distinct-Id");
    // Signup and checkout fallback IDs are verified account IDs, not a client assertion.
    const accountEvent = event === "signup_completed" || event === "checkout_started";
    const distinctId = verifiedUserId && isAccountId(verifiedUserId) ? verifiedUserId
      : accountEvent ? fallbackId : isAnalyticsId(suppliedId) ? suppliedId : browser?.id ?? fallbackId;
    const first = attributionFromCookies(cookies);
    after(async () => {
      // Only merge an anonymous browser. Never merge another identified account in a shared browser.
      if (event === "signup_completed" && browser?.anonymous && !isAccountId(browser.id) && browser.id !== fallbackId && isAccountId(fallbackId)) {
        await captureIdentity(fallbackId, browser.id, first);
      }
      await captureFunnelEvent(event, distinctId, { ...properties, ...first }, insertId);
    });
  } catch { /* A missing after context must not affect the response. */ }
}

async function captureIdentity(userId: string, anonymousId: string, first: Attribution) {
  try {
    await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(1000),
      body: JSON.stringify({ api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY, event: "$identify", properties: {
        distinct_id: userId, $anon_distinct_id: anonymousId, $process_person_profile: true, source: "server",
        $insert_id: `server:signup-identify:${userId}:${anonymousId}`, $set_once: firstTouchPersonProperties(first),
      } }),
    });
  } catch { /* Client identify is an independent best-effort link after confirmation. */ }
}

export async function captureFunnelEvent(event: FunnelEvent, distinctId: string, properties: FunnelProperties = {}, insertId?: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const first = sanitizeAttribution(properties);
  const identified = isAccountId(distinctId) && (event === "signup_completed" || event === "checkout_started");
  try {
    await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(1000),
      body: JSON.stringify({ api_key: key, event, properties: {
        distinct_id: distinctId, source: "server", $process_person_profile: identified,
        ...(properties.session_id ? { session_id: properties.session_id } : {}),
        ...(properties.plan_name ? { plan_name: properties.plan_name } : {}),
        ...(properties.cert_id ? { cert_id: properties.cert_id } : {}),
        ...([5, 10, 20].includes(properties.length ?? 0) ? { length: properties.length } : {}),
        ...first,
        ...(identified ? { $set_once: firstTouchPersonProperties(first) } : {}),
        ...(insertId || properties.session_id || event === "signup_completed"
          ? { $insert_id: `server:${insertId || `${event}:${properties.session_id || distinctId}`}` } : {}),
      } }),
    });
  } catch { /* Analytics is best effort. */ }
}
