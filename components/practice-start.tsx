"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard/types";
import type { PracticeStartResponse } from "@/lib/practice/types";
import { trackPractice } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { practiceRequest, practiceError, type PracticeRequestError } from "@/components/practice-resource";

/** The free allowance resets at 00:00 UTC on the first of the next month. */
export function quotaResetDate(monthStart?: string): string | null {
  if (!monthStart || !/^\d{4}-\d{2}-01$/.test(monthStart)) return null;
  const start = new Date(`${monthStart}T00:00:00Z`);
  if (!Number.isFinite(start.getTime())) return null;
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function PracticeStart({ domains, weakestDomains, remaining, hasPaidAccess = false, requestedDomain, quotaMonthStart }: Pick<DashboardData, "domains" | "weakestDomains"> & { remaining: number; hasPaidAccess?: boolean; requestedDomain?: string; quotaMonthStart?: string }) {
  const resetsOn = quotaResetDate(quotaMonthStart);
  const [quotaChanged, setQuotaChanged] = useState(false);
  const router = useRouter();
  const [domainCode, setDomainCode] = useState(domains.find(domain => domain.domainCode === requestedDomain)?.domainCode ?? domains.find(domain => domain.domainCode === weakestDomains[0]?.domainCode)?.domainCode ?? domains[0]?.domainCode ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PracticeRequestError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current?.abort(); }, []);

  async function start(code: string) {
    const signal = controller.current?.signal;
    if (!code || submitting.current || !signal || error || quotaChanged || (!hasPaidAccess && remaining < 1)) return;
    submitting.current = true;
    setPending(true);
    try {
      const result = await practiceRequest<PracticeStartResponse>("/api/practice", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainCode: code }), signal,
      });
      if (signal.aborted) return;
      trackPractice(result.sessionId, hasPaidAccess ? null : remaining);
      router.push(`/practice/${encodeURIComponent(result.sessionId)}`);
    } catch (reason) {
      if (signal.aborted) return;
      const failure = practiceError(reason);
      if (failure.status === 429 && !hasPaidAccess) setQuotaChanged(true);
      else setError(failure);
      submitting.current = false;
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void start(domainCode); }

  return <section aria-labelledby="practice-start-heading" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 id="practice-start-heading" className="text-xl font-semibold">Targeted practice</h2>
    <p className="leading-relaxed text-muted-foreground">{hasPaidAccess ? "Your paid access includes unlimited practice sessions. Each session has 5 questions and focuses on one domain." : "Free accounts get 60 practice questions each calendar month. Sessions use up to 5 questions, capped at your remaining allowance, and focus on one domain. Questions count when you start, even if you do not finish."}</p>
    {!hasPaidAccess && !quotaChanged && <p role="status" className="text-sm text-muted-foreground">{remaining} of 60 free practice questions left this month · resets {resetsOn ? `${resetsOn} at 00:00 UTC` : "on the 1st at 00:00 UTC"}</p>}
    {quotaChanged ? <div className="space-y-3"><p role="status">Your free allowance changed. Reload to see how many questions remain and start a session that fits.</p><Button onClick={() => window.location.reload()}>Reload allowance</Button></div> : !hasPaidAccess && remaining < 1 ? <div className="space-y-3">
      <p>You have used your free practice allowance for this month.</p>
      <Button asChild><Link href="/pricing">Upgrade to PMLE Pass</Link></Button>
    </div> : error ? <div className="space-y-3">
      <p role="alert" className="text-destructive">{error.message} Reload your dashboard before starting another session.</p>
      {error.status === 401 ? <Button asChild><Link href="/login?next=%2Fdashboard">Sign in</Link></Button> : <Button onClick={() => window.location.reload()}>Reload dashboard</Button>}
    </div> : <>
      {weakestDomains[0] && <p className="text-sm text-muted-foreground">Recommended: {weakestDomains[0].domainName}. Choose a domain below to practice.</p>}
      <form onSubmit={submit} className="space-y-3" aria-busy={pending}>
        <label htmlFor="practice-domain" className="block text-sm font-medium">Practice domain</label>
        <select id="practice-domain" value={domainCode} onChange={event => setDomainCode(event.target.value)} disabled={pending} className="min-h-12 w-full rounded-md border border-input bg-card px-3 py-3 text-foreground">
          {domains.map(domain => <option key={domain.domainCode} value={domain.domainCode}>{domain.domainName}</option>)}
        </select>
        <Button type="submit" className="h-auto min-h-12 max-w-full whitespace-normal text-left" disabled={pending || !domainCode}>{pending ? "Starting practice…" : weakestDomains[0]?.domainCode === domainCode ? `Practice ${weakestDomains[0].domainName}` : "Start practice"}</Button>
      </form>
      {pending && <p role="status" className="text-sm text-muted-foreground">Starting your practice session…</p>}
    </>}
  </section>;
}
