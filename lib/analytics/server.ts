import "server-only";
import { after } from "next/server";
import { createHash } from "node:crypto";

/** Only a salted-by-purpose hash of an opaque purchase ID leaves the server. */
export async function trackPurchaseCompleted(checkoutId: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const purchase = createHash("sha256").update(`testero:purchase:${checkoutId}`).digest("hex");
  try {
    await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/capture/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({ api_key: key, event: "purchase_completed", properties: {
        distinct_id: `purchase_${purchase}`, $insert_id: purchase, $process_person_profile: false, plan_name: "PMLE Pass",
      } }),
    });
  } catch { /* Analytics must never change payment fulfillment or expose billing errors. */ }
}

type FunnelEvent = "diagnostic_started" | "diagnostic_completed" | "signup_completed" | "checkout_started";

/** Analytics scheduling and transport failures never change a successful response. */
export function scheduleFunnelEvent(request: Request, event: FunnelEvent, fallbackId: string, properties: { session_id?: string; plan_name?: string } = {}, insertId?: string) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    const suppliedId = request.headers.get("X-PostHog-Distinct-Id");
    const distinctId = suppliedId && /^[a-zA-Z0-9_-]{1,200}$/.test(suppliedId) ? suppliedId : fallbackId;
    after(() => captureFunnelEvent(event, distinctId, properties, insertId));
  } catch { /* A missing after context must not affect the response. */ }
}

export async function captureFunnelEvent(event: FunnelEvent, distinctId: string, properties: { session_id?: string; plan_name?: string } = {}, insertId?: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  try {
    await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(1000),
      body: JSON.stringify({ api_key: key, event, properties: {
        distinct_id: distinctId, source: "server", $process_person_profile: false,
        ...(properties.session_id ? { session_id: properties.session_id } : {}),
        ...(properties.plan_name ? { plan_name: properties.plan_name } : {}),
        ...(insertId || properties.session_id || event === "signup_completed"
          ? { $insert_id: `server:${insertId || `${event}:${properties.session_id || distinctId}`}` } : {}),
      } }),
    });
  } catch { /* Analytics is best effort. */ }
}
