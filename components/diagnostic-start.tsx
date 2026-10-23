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

export function DiagnosticStart({ resumeId: serverResumeId = null, autoStart = false, initialCount = 5, certId = PMLE_CERT_ID, certName, domainCount, children }: { resumeId?: string | null; autoStart?: boolean; initialCount?: 5 | 10 | 20; certId?: string; certName?: string; domainCount?: number; children?: ReactNode }) {
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
  useEffect(() => {
    controller.current = new AbortController();
    // The POST response seeds only the first view. Back/Forward reloads saved answers.
    const clearSeed = () => setCreated(null);
    window.addEventListener("popstate", clearSeed);
    return () => { controller.current?.abort(); window.removeEventListener("popstate", clearSeed); };
  }, []);

  const start = useCallback(async () => {
    const signal = controller.current?.signal;
    if (!signal || starting.current || checkingResume || resumeError) return;
    starting.current = true;
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
      window.history.replaceState(null, "", `/diagnostic${certQuery}`);
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
      }
    }
  }, [beta, certId, certQuery, questionCount, checkingResume, resumeError]);

  useEffect(() => {
    if (restoredId) return;
    const lookup = new AbortController();
    function checkResume() {
      setCheckingResume(true);
      setResumeError(null);
      diagnosticRequest<{ resumeId: string | null }>(`/api/diagnostic${certQuery}`, { signal: lookup.signal }).then(
        result => {
          if (lookup.signal.aborted) return;
          setResumeId(result.resumeId);
          setCheckingResume(false);
        },
        reason => {
          if (lookup.signal.aborted) return;
          setResumeError(requestError(reason));
          setCheckingResume(false);
        },
      );
    }
    checkResume();
    // BFCache restores do not remount React. Recheck owner state on those restores too.
    window.addEventListener("pageshow", checkResume);
    return () => { lookup.abort(); window.removeEventListener("pageshow", checkResume); };
  }, [certQuery, restoredId, resumeAttempt]);

  useEffect(() => {
    if (!autoStart || autoAttempted.current || restoredId || checkingResume || resumeError || resumeId) return;
    autoAttempted.current = true;
    void start();
  }, [autoStart, restoredId, checkingResume, resumeError, resumeId, start]);

  const sessionId = restoredId;
  if (sessionId) return <DiagnosticSession key={sessionId} sessionId={sessionId} initialData={created?.sessionId === sessionId ? created.progress : null} />;

  return <><div className="mx-auto max-w-[696px] space-y-8">
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{beta ? "Free beta diagnostic" : "Free PMLE diagnostic"}</p>
      <h1 className="text-3xl font-semibold leading-tight">{beta ? `${certName} beta diagnostic` : "PMLE readiness diagnostic"}</h1>
      <p className="text-lg leading-relaxed text-muted-foreground">{beta ? `Scenario questions from the ${certName} exam guide.` : "Scenario questions from the Professional Machine Learning Engineer exam guide."}</p>
    </header>
    <fieldset disabled={pending || checkingResume} className="space-y-3">
      <legend className="font-medium">Choose your diagnostic length</legend>
      <div className={`grid grid-cols-1 gap-3 ${beta ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>{[{ count: 5, label: "Quick check (5)" }, { count: 10, label: "Short (10)" }, { count: 20, label: "Full readiness (20)" }].filter(({ count }) => !beta || count !== 20).map(({ count, label }) => <label key={count} className="answer-option flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-input bg-card p-4 text-sm font-medium"><input type="radio" name="diagnostic-length" value={count} checked={questionCount === count} onChange={() => setQuestionCount(count)} /><span>{label}</span></label>)}</div>
      <p className="text-sm leading-relaxed text-muted-foreground">{beta ? "Questions sampled across this certification’s exam-guide sections. This short beta check gives an early readiness signal, not a full assessment." : <>{questionCount === 5 ? "A quick signal across the five highest-weight domains." : "Questions across all six exam domains."} Shorter checks give lower-confidence results than the full 20.</>}</p>
    </fieldset>
    <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Questions</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">{questionCount}</dd></div>
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Time</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">~{questionCount} min</dd></div>
      <div className="min-w-0 px-3 py-4 sm:px-5"><dt className="text-sm text-muted-foreground">Domains</dt><dd className="whitespace-nowrap text-xl font-semibold sm:text-2xl">{beta ? Math.min(questionCount, domainCount ?? questionCount) : questionCount === 5 ? 5 : 6}</dd></div>
    </dl>
    <p className="-mt-5 text-xs text-muted-foreground">Time is an estimate based on about one minute per question. Go at your own pace.</p>
    {resumeId ? <section aria-labelledby="resume-heading" className="space-y-3 rounded-lg border border-border bg-card p-5">
      <h2 id="resume-heading" className="font-semibold">You have a diagnostic in progress</h2>
      <p className="text-sm text-muted-foreground">Your saved answers are kept. Starting over begins a new set of {questionCount} questions.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild><Link href={`/diagnostic/${encodeURIComponent(resumeId)}${certQuery}`}>Resume your diagnostic</Link></Button>
        <Button variant="outline" onClick={start} disabled={pending || checkingResume || !!resumeError}>{pending ? "Starting diagnostic…" : error ? "Retry start" : "Start over"}</Button>
      </div>
    </section> : <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <Button onClick={start} disabled={pending || checkingResume || !!resumeError}>{pending ? "Starting diagnostic…" : error ? "Retry start" : "Begin diagnostic"}</Button>
      <span className="text-sm text-muted-foreground">No account required.</span>
    </div>}
    {checkingResume && <p role="status" className="text-sm text-muted-foreground">Checking for saved progress…</p>}
    {resumeError && <div role="alert" className="space-y-3"><p className="text-sm text-destructive">We could not check your saved progress. Retry before starting so you do not lose a diagnostic in progress.</p><Button variant="outline" onClick={() => setResumeAttempt(value => value + 1)}>Retry saved progress</Button></div>}
    {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
    {pending && <p role="status" className="text-sm text-muted-foreground">Preparing your questions…</p>}
    <p className="leading-relaxed text-muted-foreground">Questions appear one at a time. After each answer you&apos;ll see whether you got it right and which option is correct. Answers can&apos;t be changed once submitted. {beta ? "Your readiness result comes at the end." : "Your full report comes at the end."} Keep cookies enabled.</p>
    <section aria-labelledby="report" className="space-y-3 border-t border-border pt-6">
      <h2 id="report" className="text-xl font-semibold">Your report includes</h2>
      <ul className="list-disc space-y-2 pl-5 text-body"><li>{beta ? "A readiness tier (Low, Building, Ready or Strong)" : "An overall score out of 100 and a readiness tier (Low, Building, Ready or Strong)"}</li>{beta ? <li>An option to get notified when practice opens for this certification</li> : <><li>{questionCount === 5 ? "Sampled-domain reads with the question count for each" : "Scores for the domains covered, weakest first"}</li><li>A recommended domain to practice next</li></>}</ul>
    </section>
    <p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p>
    <Link href="/" className="inline-block text-sm text-primary hover:underline">Back to home</Link>
  </div>{children}</>;
}
