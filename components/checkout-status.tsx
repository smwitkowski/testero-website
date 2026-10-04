"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { accessDate } from "@/components/billing-account";

type BillingStatus = { status: "processing" | "active" | "refunded" | "expired"; accessUntil: string | null };
export const MAX_STATUS_CHECKS = 6;

export async function readCheckoutStatus(sessionId: string, signal?: AbortSignal): Promise<BillingStatus> {
  const response = await fetch(`/api/billing/status?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store", credentials: "same-origin", signal });
  if (!response.ok) throw new Error(response.status === 401 ? "Please sign in again to check your payment." : "Your payment status could not be verified. Please retry.");
  const result = await response.json();
  if (!["processing", "active", "refunded", "expired"].includes(result.status) || !(result.accessUntil === null || typeof result.accessUntil === "string")) throw new Error("Your payment status could not be verified. Please retry.");
  if (result.status === "active" && !accessDate(result.accessUntil)) throw new Error("Your payment status could not be verified. Please retry.");
  return result;
}

export function CheckoutStatus({ sessionId }: { sessionId: string | null }) {
  const [result, setResult] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(Boolean(sessionId));
  useEffect(() => {
    if (!sessionId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let count = 0;
    async function check() {
      try {
        const value = await readCheckoutStatus(sessionId!, controller.signal);
        if (controller.signal.aborted) return;
        setError(null); setResult(value); count += 1;
        if (value.status === "processing" && count < MAX_STATUS_CHECKS) timer = setTimeout(() => void check(), 2000);
        else setWaiting(false);
      } catch (reason) {
        if (!controller.signal.aborted) { setResult(null); setError(reason instanceof Error ? reason.message : "Your payment status could not be verified. Please retry."); setWaiting(false); }
      }
    }
    void check();
    const refresh = () => { controller.abort(); clearTimeout(timer); setResult(null); setError(null); setWaiting(true); setAttempt(value => value + 1); };
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener("focus", refresh); };
  }, [sessionId, attempt]);
  function retry() { setResult(null); setError(null); setWaiting(true); setAttempt(value => value + 1); }
  return <section className="space-y-5" aria-busy={waiting}>
    {!sessionId ? <p role="alert">No valid checkout reference was provided. Open your account to verify your access.</p>
      : error ? <p role="alert" className="text-destructive">{error}</p>
      : result?.status === "active" ? <div role="status" className="space-y-2"><p>Your PMLE Pass is active.</p><p>Access until <time dateTime={result.accessUntil!}>{accessDate(result.accessUntil)}</time></p></div>
      : result?.status === "refunded" ? <p role="status">This payment was refunded. It no longer provides PMLE Pass access.</p>
      : result?.status === "expired" ? <p role="status">This PMLE Pass has expired.</p>
      : <p role="status">Your payment is processing. Access starts only after your payment is verified. {waiting ? "Checking your payment…" : "Verification is taking longer than expected. Retry or check your account later."}</p>}
    <div className="flex flex-wrap gap-3">
      {sessionId && !waiting && (error || !result || result.status === "processing") && <Button onClick={retry}>Retry verification</Button>}
      <Button variant="outline" asChild><Link href="/account">View account</Link></Button>
      {result?.status === "active" && <Button asChild><Link href="/dashboard">Start studying</Link></Button>}
    </div>
  </section>;
}
