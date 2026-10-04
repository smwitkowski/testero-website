import "server-only";
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
