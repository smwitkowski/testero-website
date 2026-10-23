"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiagnosticSession } from "@/components/diagnostic-session";
import type { DiagnosticStartResponse } from "@/lib/diagnostic/types";
import { trackDiagnostic } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { diagnosticRequest, requestError } from "@/components/diagnostic-resource";
import { PMLE_CERT_ID } from "@/lib/certifications/catalog";

export function DiagnosticStart({ resumeId: serverResumeId = null, autoStart = false, paidLanding = false, initialCount = 5, certId = PMLE_CERT_ID, certName, children }: { resumeId?: string | null; autoStart?: boolean; paidLanding?: boolean; initialCount?: 5 | 10 | 20; certId?: string; certName?: string; domainCount?: number; children?: ReactNode }) {
  const beta = certId !== PMLE_CERT_ID;
  const certQuery = beta ? `?cert=${encodeURIComponent(certId)}` : "";
  const pathname = usePathname();
  const restoredId = /^\/diagnostic\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(pathname)?.[1] ?? null;
  const [created, setCreated] = useState<DiagnosticStartResponse | null>(null);
  const [questionCount, setQuestionCount] = useState<number>(beta && initialCount === 20 ? 5 : initialCount);
  const [pending, setPending] = useState(false);
  const [resumeId, setResumeId] = useState(serverResumeId);
  const [checkingResume, setCheckingResume] = useState(true);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resumeAttempt, setResumeAttempt] = useState(0);
  const autoAttempted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const starting = useRef(false);
  const resumeLookup = useRef<AbortController | null>(null);
  const resumeVersion = useRef(0);
  useEffect(() => {
    controller.current = new AbortController();
    // The POST response seeds only the first view. Back/Forward reloads saved answers.
    const clearSeed = () => setCreated(null);
    window.addEventListener("popstate", clearSeed);
    return () => { controller.current?.abort(); window.removeEventListener("popstate", clearSeed); };
  }, []);

  const start = useCallback(async () => {
    const signal = controller.current?.signal;
    if (!signal || starting.current) return;
    starting.current = true;
    autoAttempted.current = true;
    // A lookup started before this POST must never replace the newly created session.
    resumeVersion.current += 1;
    resumeLookup.current?.abort();
    setCheckingResume(false);
    setResumeError(null);
    setPending(true);
    setError(null);
    try {
      const result = await diagnosticRequest<DiagnosticStartResponse>("/api/diagnostic", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionCount, ...(beta ? { certId } : {}) }), signal,
      });
      if (signal.aborted) return;
      trackDiagnostic("diagnostic_started", result.sessionId, questionCount, result.progress.certId ?? certId);
      // Keep the start page in history so Browser Back can offer the saved session.
      // Consume explicit autostart before pushing; Back must never create a second run.
      window.history.replaceState(null, "", paidLanding ? "/diagnostic?length=5&src=ad" : `/diagnostic${certQuery}`);
      setResumeId(result.sessionId);
      setCreated(result);
      setPending(false);
      starting.current = false;
      window.history.pushState(null, "", `${result.href}${certQuery}`);
    } catch (reason) {
      if (!signal.aborted) {
        setError(requestError(reason));
        setPending(false);
        starting.current = false;
        setResumeAttempt(value => value + 1);
      }
    }
  }, [beta, certId, certQuery, paidLanding, questionCount]);

  useEffect(() => {
    if (restoredId) return;
    function checkResume() {
      if (starting.current) return;
      resumeLookup.current?.abort();
      const lookup = new AbortController();
      resumeLookup.current = lookup;
      const version = ++resumeVersion.current;
      setCheckingResume(true);
      setResumeError(null);
      diagnosticRequest<{ resumeId: string | null }>(`/api/diagnostic${certQuery}`, { signal: lookup.signal }).then(
        result => {
          if (lookup.signal.aborted || version !== resumeVersion.current) return;
          setResumeId(result.resumeId);
          setCheckingResume(false);
        },
        reason => {
          if (lookup.signal.aborted || version !== resumeVersion.current) return;
          setResumeError(requestError(reason));
          setCheckingResume(false);
        },
      );
    }
    checkResume();
    // BFCache restores do not remount React. Recheck owner state on those restores too.
    window.addEventListener("pageshow", checkResume);
    return () => { resumeLookup.current?.abort(); window.removeEventListener("pageshow", checkResume); };
  }, [certQuery, restoredId, resumeAttempt]);

  useEffect(() => {
    if (!autoStart || autoAttempted.current || restoredId || checkingResume || resumeError || resumeId) return;
    // A cached server payload can outlive its query. Back to a consumed URL must not start.
    const explicitStart = new URLSearchParams(window.location.search).getAll("start");
    if (explicitStart.length !== 1 || explicitStart[0] !== "1") return;
    autoAttempted.current = true;
    void start();
  }, [autoStart, restoredId, checkingResume, resumeError, resumeId, start]);

  const sessionId = restoredId;
  if (sessionId) return <DiagnosticSession key={sessionId} sessionId={sessionId} initialData={created?.sessionId === sessionId ? created.progress : null} />;

  const lengthPicker = <fieldset disabled={pending} className="space-y-3">
    <legend className="font-medium">How many questions?</legend>
    <div className={`grid grid-cols-1 gap-3 ${beta ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>{[5, 10, 20].filter(count => !beta || count !== 20).map(count => <label key={count} className="answer-option flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-input bg-card p-4 text-sm font-medium"><input type="radio" name="diagnostic-length" value={count} checked={questionCount === count} onChange={() => setQuestionCount(count)} /><span>{count} questions · ~{count} min</span></label>)}</div>
    <p className="text-sm leading-relaxed text-muted-foreground">{beta ? "Questions sampled across this certification’s exam-guide sections. This short beta check gives an early readiness signal, not a full assessment." : <>{questionCount === 5 ? "Covers 5 of the 6 exam domains." : "Covers all 6 exam domains."} More questions give a more reliable read.</>}</p>
  </fieldset>;

  return <><div className="mx-auto max-w-[696px] space-y-6" data-paid-landing={paidLanding || undefined}>
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{beta ? "Free beta diagnostic" : `Free · No account · About ${questionCount} minutes`}</p>
      <h1 className="text-3xl font-semibold leading-tight">{beta ? `${certName} beta diagnostic` : `Free ${questionCount}-question PMLE check`}</h1>
      <p className="text-base leading-relaxed text-muted-foreground">{beta ? `Original scenario questions aligned with the ${certName} exam guide. See the right answer after each one.` : "Original scenario questions aligned with the June 2026 exam guide. See the right answer after each one."}</p>
    </header>
    {resumeId ? <section aria-labelledby="resume-heading" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 id="resume-heading" className="font-semibold">You have an unfinished check</h2>
      <p className="text-sm text-muted-foreground">Your saved answers are kept. Starting a new check begins a new set of {questionCount} questions.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild><Link href={`/diagnostic/${encodeURIComponent(resumeId)}${certQuery}`} aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }}>Continue where I left off</Link></Button>
        <Button variant="outline" onClick={start} disabled={pending}>{pending ? "Loading questions…" : error ? "Try again" : `Start a new ${questionCount}-question check`}</Button>
      </div>
    </section> : <div className="space-y-3">
      <Button onClick={start} disabled={pending}>{pending ? "Loading questions…" : error ? "Try again" : `Start the ${questionCount}-question check`}</Button>
      <p className="text-sm text-muted-foreground">Free. No account or email needed.</p>
    </div>}
    {resumeError && <div role="status" className="space-y-3"><p className="text-sm text-muted-foreground">We could not check your saved progress. You can retry or start a new check. Your saved answers are kept.</p><Button variant="outline" onClick={() => setResumeAttempt(value => value + 1)} disabled={pending}>Retry saved progress</Button></div>}
    {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
    {pending && <p role="status" className="text-sm text-muted-foreground">Preparing your questions…</p>}
    {paidLanding ? <details className="space-y-3"><summary className="cursor-pointer text-sm font-medium text-primary">Choose a different length</summary><div className="pt-3">{lengthPicker}</div></details> : lengthPicker}
    <p className="leading-relaxed text-muted-foreground">After each answer you&apos;ll see whether you were right and which option is correct. Answers lock once checked. Your score and study focus come at the end.</p>
    <section aria-labelledby="report" className="space-y-3 border-t border-border pt-6">
      <h2 id="report" className="text-xl font-semibold">Your report includes</h2>
      <ul className="list-disc space-y-2 pl-5 text-body"><li>{beta ? "A readiness tier (Low, Building, Ready or Strong)" : "An overall score out of 100 and a readiness tier (Low, Building, Ready or Strong)"}</li>{beta ? <li>An option to get notified when practice opens for this certification</li> : <><li>{questionCount === 5 ? "Right or wrong for each domain sampled" : "Scores for the domains covered, weakest first"}</li><li>A recommended domain to practice next</li><li>One question explained in full, free</li></>}</ul>
    </section>
    <p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p>
    <Link href="/" className="inline-block text-sm text-primary hover:underline">Back to home</Link>
  </div>{children}</>;
}
