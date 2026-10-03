"use client";

import { useRef, useState } from "react";
import { trackCheckoutStarted } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";

/** Only accept the destination returned by the verified billing API. */
export function checkoutDestination(value: unknown): string | null {
  if (value === "/account") return value;
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "checkout.stripe.com" && !url.username && !url.password && !url.port) return url.href;
    // Local Stripe adapter redirects to the real confirmation page, never grants access.
    if (typeof window !== "undefined" && url.origin === window.location.origin && ["http:", "https:"].includes(url.protocol)
      && !url.username && !url.password && url.pathname === "/checkout/success" && !url.hash
      && [...url.searchParams.keys()].length === 1 && /^cs_[A-Za-z0-9_]{1,240}$/.test(url.searchParams.get("session_id") ?? "")) return url.href;
    return null;
  } catch { return null; }
}

export async function beginCheckout(): Promise<string> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST", cache: "no-store", credentials: "same-origin",
    headers: { "Content-Type": "application/json" }, body: "{}",
  });
  if (!response.ok) throw new Error(response.status === 401 ? "Please sign in again before starting checkout." : "Checkout is unavailable. Please retry.");
  const result = await response.json();
  const href = checkoutDestination(result.href);
  if (!href || (result.alreadyActive && href !== "/account")) throw new Error("Checkout is unavailable. Please retry.");
  if (href !== "/account" && new URL(href).hostname === "checkout.stripe.com" && !result.alreadyActive) trackCheckoutStarted();
  return href;
}

export function CheckoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function checkout() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null);
    try { window.location.assign(await beginCheckout()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Checkout is unavailable. Please retry."); inFlight.current = false; setPending(false); }
  }
  return <div className="space-y-3" aria-busy={pending}>
    <Button disabled={pending} onClick={() => void checkout()}>{pending ? "Opening checkout…" : "Get PMLE Pass — $39"}</Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
