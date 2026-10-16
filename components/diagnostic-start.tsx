"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiagnosticStartResponse } from "@/lib/diagnostic/types";
import { trackDiagnostic } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { diagnosticRequest, requestError } from "@/components/diagnostic-resource";

export function DiagnosticStart({ resumeId = null }: { resumeId?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const starting = useRef(false);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);

  async function start() {
    const signal = controller.current?.signal;
    if (!signal || starting.current) return;
    starting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await diagnosticRequest<DiagnosticStartResponse>("/api/diagnostic", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal,
      });
      if (signal.aborted) return;
      trackDiagnostic("diagnostic_started", result.sessionId);
      router.push(`/diagnostic/${encodeURIComponent(result.sessionId)}`);
    } catch (reason) {
      if (!signal.aborted) {
        setError(requestError(reason));
        setPending(false);
        starting.current = false;
      }
    }
  }

  return <div className="mx-auto max-w-[696px] space-y-8">
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Free PMLE diagnostic</p>
      <h1 className="text-3xl font-semibold leading-tight">PMLE readiness diagnostic</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">Scenario questions across all six domains of the Professional Machine Learning Engineer exam guide.</p>
    </header>
    <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
      <div className="p-4 sm:px-5"><dt className="text-sm text-muted-foreground">Questions</dt><dd className="text-2xl font-semibold">20</dd></div>
      <div className="p-4 sm:px-5"><dt className="text-sm text-muted-foreground">Time</dt><dd className="text-2xl font-semibold">~20 min</dd></div>
      <div className="p-4 sm:px-5"><dt className="text-sm text-muted-foreground">Domains</dt><dd className="text-2xl font-semibold">6</dd></div>
    </dl>
    {resumeId ? <section aria-labelledby="resume-heading" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 id="resume-heading" className="font-semibold">You have a diagnostic in progress</h2>
      <p className="text-sm text-muted-foreground">Your saved answers are kept. Starting over begins a new set of 20 questions.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild><Link href={`/diagnostic/${encodeURIComponent(resumeId)}`}>Resume diagnostic</Link></Button>
        <Button variant="outline" onClick={start} disabled={pending}>{pending ? "Starting diagnostic…" : error ? "Retry start" : "Start over"}</Button>
      </div>
    </section> : <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Button onClick={start} disabled={pending}>{pending ? "Starting diagnostic…" : error ? "Retry start" : "Begin diagnostic"}</Button>
      <span className="text-sm text-muted-foreground">No account required.</span>
    </div>}
    {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
    {pending && <p role="status" className="text-sm text-muted-foreground">Preparing your questions…</p>}
    <p className="leading-relaxed text-muted-foreground">Questions appear one at a time. Answers are recorded as you go and can&apos;t be changed once submitted. Results are shown at the end. Keep cookies enabled.</p>
    <section aria-labelledby="report" className="space-y-3 border-t border-border pt-6">
      <h2 id="report" className="text-xl font-semibold">Your report includes</h2>
      <ul className="list-disc space-y-2 pl-5 text-body"><li>An overall score out of 100 and a readiness tier (Low, Building, Ready or Strong)</li><li>A score for each of the six domains, weakest first</li><li>A recommended domain to practice next</li></ul>
    </section>
    <p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result. Testero is independent and not affiliated with Google.</p>
    <Link href="/" className="inline-block text-sm text-primary hover:underline">Back to home</Link>
  </div>;
}
