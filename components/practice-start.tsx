"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard/types";
import type { PracticeStartResponse } from "@/lib/practice/types";
import { trackPractice } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { practiceRequest, practiceError, type PracticeRequestError } from "@/components/practice-resource";

export function PracticeStart({ domains, weakestDomains, remaining, hasPaidAccess = false }: Pick<DashboardData, "domains" | "weakestDomains"> & { remaining: number; hasPaidAccess?: boolean }) {
  const router = useRouter();
  const [domainCode, setDomainCode] = useState(domains[0]?.domainCode ?? "");
  const [pending, setPending] = useState(false);
  const [exhausted, setExhausted] = useState(false);
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

  return <section aria-labelledby="practice-start-heading" className="space-y-5">
    <h2 id="practice-start-heading" className="text-xl font-semibold">Targeted practice</h2>
    <p className="leading-relaxed text-muted-foreground">{hasPaidAccess ? "Your paid access includes unlimited practice sessions. Each session has 5 questions and focuses on one domain." : "Free accounts get 5 practice questions each week. Each session focuses on one domain."}</p>
    {!hasPaidAccess && <p className="text-sm text-muted-foreground">{remaining} free practice questions remaining this week</p>}
    {exhausted || (!hasPaidAccess && remaining < 5) ? <div className="space-y-3">
      <p role="status">You have used your 5 free practice questions for this week. Your free allowance resets next week.</p>
      <Button asChild><Link href="/pricing">Upgrade to PMLE Pass</Link></Button>
    </div> : error ? <div className="space-y-3">
      <p role="alert" className="text-destructive">{error.message} Reload your dashboard before starting another session.</p>
      {error.status === 401 ? <Button asChild><Link href="/login?next=%2Fdashboard">Sign in</Link></Button> : <Button onClick={() => window.location.reload()}>Reload dashboard</Button>}
    </div> : <>
      {weakestDomains.length > 0 && <div className="space-y-3">
        <h3 className="font-medium">Practice your weakest domains</h3>
        <div className="flex flex-col items-start gap-3">
          {weakestDomains.map(domain => <Button key={domain.domainCode} disabled={pending} onClick={() => void start(domain.domainCode)} className="max-w-full whitespace-normal text-left">Practice {domain.domainName}</Button>)}
        </div>
      </div>}
      <form onSubmit={submit} className="space-y-3" aria-busy={pending}>
        <label htmlFor="practice-domain" className="block text-sm font-medium">Practice domain</label>
        <select id="practice-domain" value={domainCode} onChange={event => setDomainCode(event.target.value)} disabled={pending} className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-3 text-foreground">
          {domains.map(domain => <option key={domain.domainCode} value={domain.domainCode}>{domain.domainName}</option>)}
        </select>
        <Button type="submit" disabled={pending || !domainCode}>{pending ? "Starting practice…" : "Start practice"}</Button>
      </form>
      {pending && <p role="status" className="text-sm text-muted-foreground">Starting your practice session…</p>}
    </>}
  </section>;
}
