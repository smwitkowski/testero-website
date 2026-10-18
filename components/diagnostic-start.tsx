"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiagnosticSession } from "@/components/diagnostic-session";
import type { DiagnosticStartResponse } from "@/lib/diagnostic/types";
import { trackDiagnostic } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { diagnosticRequest, requestError } from "@/components/diagnostic-resource";

export function DiagnosticStart({ resumeId = null, children }: { resumeId?: string | null; children?: ReactNode }) {
  const pathname = usePathname();
  const restoredId = /^\/diagnostic\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname)?.[1] ?? null;
  const [created, setCreated] = useState<DiagnosticStartResponse | null>(null);
  const [questionCount, setQuestionCount] = useState(20);
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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionCount }), signal,
      });
      if (signal.aborted) return;
      trackDiagnostic("diagnostic_started", result.sessionId, questionCount);
      window.history.replaceState(null, "", result.href);
      setCreated(result);
    } catch (reason) {
      if (!signal.aborted) {
        setError(requestError(reason));
        setPending(false);
        starting.current = false;
      }
    }
  }

  const sessionId = restoredId;
  if (sessionId) return <DiagnosticSession key={sessionId} sessionId={sessionId} initialData={created?.sessionId === sessionId ? created.progress : null} />;

  return <><div className="mx-auto max-w-[696px] space-y-8">
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Free PMLE diagnostic</p>
      <h1 className="text-3xl font-semibold leading-tight">PMLE readiness diagnostic</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">Scenario questions from the Professional Machine Learning Engineer exam guide.</p>
    </header>
    <fieldset disabled={pending} className="space-y-3">
      <legend className="font-medium">Choose your diagnostic length</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ count: 5, label: "Quick check (5)" }, { count: 10, label: "Short (10)" }, { count: 20, label: "Full readiness (20)" }].map(({ count, label }) => <label key={count} className="answer-option flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-input bg-card p-4 text-sm font-medium"><input type="radio" name="diagnostic-length" value={count} checked={questionCount === count} onChange={() => setQuestionCount(count)} />{label}</label>)}</div>
      <p className="text-sm leading-relaxed text-muted-foreground">{questionCount === 5 ? "A quick signal across the five highest-weight domains." : "Questions across all six exam domains."} Shorter checks give lower-confidence results than the full 20.</p>
    </fieldset>
    <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Questions</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">{questionCount}</dd></div>
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Time</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">~{questionCount} min</dd></div>
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Domains</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">{questionCount === 5 ? 5 : 6}</dd></div>
    </dl>
    <p className="-mt-5 text-xs text-muted-foreground">Time is an estimate based on about one minute per question. Go at your own pace.</p>
    {resumeId ? <section aria-labelledby="resume-heading" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 id="resume-heading" className="font-semibold">You have a diagnostic in progress</h2>
      <p className="text-sm text-muted-foreground">Your saved answers are kept. Starting over begins a new set of {questionCount} questions.</p>
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
      <ul className="list-disc space-y-2 pl-5 text-body"><li>An overall score out of 100 and a readiness tier (Low, Building, Ready or Strong)</li><li>Scores for the domains covered, weakest first</li><li>A recommended domain to practice next</li></ul>
    </section>
    <p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result. Testero is independent and not affiliated with Google.</p>
    <Link href="/" className="inline-block text-sm text-primary hover:underline">Back to home</Link>
  </div>{children}</>;
}
