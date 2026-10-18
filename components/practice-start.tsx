"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard/types";
import type { PracticeStartResponse } from "@/lib/practice/types";
import { trackPractice } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { practiceRequest, practiceError, type PracticeRequestError } from "@/components/practice-resource";

/** The free allowance resets 7 days after the UTC week start (Monday 00:00 UTC). */
export function quotaResetDate(weekStart?: string): string | null {
  const start = weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? Date.parse(`${weekStart}T00:00:00Z`) : NaN;
  if (!Number.isFinite(start)) return null;
  return new Date(start + 7 * 86_400_000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

export function PracticeStart({ domains, weakestDomains, remaining, hasPaidAccess = false, requestedDomain, quotaWeekStart }: Pick<DashboardData, "domains" | "weakestDomains"> & { remaining: number; hasPaidAccess?: boolean; requestedDomain?: string; quotaWeekStart?: string }) {
  const resetsOn = quotaResetDate(quotaWeekStart);
  const [exhausted, setExhausted] = useState(false);
  const resetLabel = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!quotaWeekStart || !/^\d{4}-\d{2}-\d{2}$/.test(quotaWeekStart)) return;
    const reset = Date.parse(`${quotaWeekStart}T00:00:00Z`) + 7 * 86_400_000;
    if (Number.isFinite(reset) && resetLabel.current) resetLabel.current.textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(reset);
  }, [quotaWeekStart, remaining, exhausted]);
  const router = useRouter();
  const [domainCode, setDomainCode] = useState(domains.find(domain => domain.domainCode === requestedDomain)?.domainCode ?? domains.find(domain => domain.domainCode === weakestDomains[0]?.domainCode)?.domainCode ?? domains[0]?.domainCode ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PracticeRequestError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current?.abort(); }, []);

  async function start(code: string) {
    const signal = controller.current?.signal;
    if (!code || submitting.current || !signal || error || exhausted || (!hasPaidAccess && remaining < 5)) return;
    submitting.current = true;
    setPending(true);
    try {
      const result = await practiceRequest<PracticeStartResponse>("/api/practice", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domainCode: code }), signal,
      });
      if (signal.aborted) return;
      trackPractice(result.sessionId);
      router.push(`/practice/${encodeURIComponent(result.sessionId)}`);
    } catch (reason) {
      if (signal.aborted) return;
      const failure = practiceError(reason);
      if (failure.status === 429 && !hasPaidAccess) setExhausted(true);
      else setError(failure);
      submitting.current = false;
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void start(domainCode); }

  return <section aria-labelledby="practice-start-heading" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 id="practice-start-heading" className="text-xl font-semibold">Targeted practice</h2>
    <p className="leading-relaxed text-muted-foreground">{hasPaidAccess ? "Your paid access includes unlimited practice sessions. Each session has 5 questions and focuses on one domain." : "Free accounts get 5 practice questions each week. Each session focuses on one domain."}</p>
    {!hasPaidAccess && !exhausted && remaining >= 5 && <p className="text-sm text-muted-foreground">{remaining} free practice questions remaining this week</p>}
    {exhausted || (!hasPaidAccess && remaining < 5) ? <div className="space-y-3">
      <p role="status">You have used your 5 free practice questions for this week. {resetsOn ? <>Your free allowance resets on <span ref={resetLabel} title={`${resetsOn} at 00:00 UTC`}>{`${resetsOn} at 00:00 UTC`}</span>.</> : "Your free allowance resets next week."}</p>
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
