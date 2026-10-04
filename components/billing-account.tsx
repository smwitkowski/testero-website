"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaidAccess } from "@/lib/billing/paid-access";
import { Button } from "@/components/ui/button";

/** A restored tab must recheck access after a refund or expiry. */
export function useFreshAccessOnFocus() {
  useEffect(() => {
    const refresh = () => window.location.reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
}

export function accessDate(value: string | null): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function PassStatus({ access }: { access: PaidAccess }) {
  if (access.unavailable) return <p role="alert">Your access status could not be verified. Please reload to retry.</p>;
  const until = access.hasPaidAccess && access.pass ? accessDate(access.pass.expires_at) : null;
  return <div className="space-y-2">
    {until ? <p>Access until <time dateTime={access.pass!.expires_at}>{until}</time></p>
      : access.isLegacySubscriber && access.hasPaidAccess ? <p>Active legacy subscription</p>
      : <p>Free account. 5 practice questions each week.</p>}
  </div>;
}

export async function openBillingPortal(): Promise<string> {
  const response = await fetch("/api/billing/portal", { method: "POST", cache: "no-store", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error("Billing management is unavailable. Please retry.");
  const result = await response.json();
  try {
    const url = new URL(result.href);
    if (url.protocol === "https:" && url.hostname === "billing.stripe.com" && !url.username && !url.password && !url.port) return url.href;
    // The local Stripe adapter returns to the authenticated account page.
    if (typeof window !== "undefined" && url.origin === window.location.origin && ["http:", "https:"].includes(url.protocol)
      && !url.username && !url.password && url.pathname === "/account" && !url.search && !url.hash) return url.href;
  } catch { /* Invalid response; do not navigate. */ }
  throw new Error("Billing management is unavailable. Please retry.");
}

export function BillingAccount({ access, unavailable = false }: { access: PaidAccess | null; unavailable?: boolean }) {
  useFreshAccessOnFocus();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function portal() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true); setError(null);
    try { window.location.assign(await openBillingPortal()); }
    catch { setError("Billing management is unavailable. Please retry."); setPending(false); inFlight.current = false; }
  }
  if (unavailable || !access || access.unavailable) return <section className="space-y-3"><p role="alert">Your access status could not be loaded. Please retry.</p><Button onClick={() => router.refresh()}>Retry</Button></section>;
  return <section aria-labelledby="account-access" className="space-y-4">
    <h2 id="account-access" className="text-xl font-semibold">Your access</h2>
    <PassStatus access={access} />
    {!access.hasPaidAccess && <Button asChild><Link href="/pricing">Get PMLE Pass</Link></Button>}
    {access.isLegacySubscriber && <Button variant="outline" disabled={pending} onClick={() => void portal()}>{pending ? "Opening billing…" : "Manage legacy subscription"}</Button>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
