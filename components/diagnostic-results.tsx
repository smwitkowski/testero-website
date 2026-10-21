"use client";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { trackResults } from "@/lib/analytics/client";
import { FreeDiagnosticExplanation } from "@/components/free-diagnostic-explanation";
import { ResultsEmailForm } from "@/components/results-email-form";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { Button } from "@/components/ui/button";
import { DomainScores, ScoreReport } from "@/components/readiness-report";
import { getExamReadinessTier, weakestFirst } from "@/lib/readiness";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { DiagnosticPassOption, SignedInDiagnosticUnlock } from "@/components/diagnostic-unlock";
import { QuestionReviewList } from "@/components/question-review";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";

export function DiagnosticResults({ sessionId, aboveFoldCta, emailCard }: { sessionId: string; aboveFoldCta?: ReactNode; emailCard?: ReactNode }) {
  const { data, error, reload } = useDiagnosticResource<DiagnosticResult>(`/api/diagnostic/${encodeURIComponent(sessionId)}/results`);
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (data && viewed.current !== data.sessionId) {
      viewed.current = data.sessionId;
      trackResults("results_viewed", data);
    }
  }, [data]);
  if (error) return <DiagnosticError message={error} onRetry={reload} />;
  if (!data) return <DiagnosticLoading message="Loading your readiness results…" />;

  // Beta results never render PMLE commerce, practice, review, explanation or email slots.
  if (data.certId && data.certId !== PMLE_CERT_ID) {
    const certId = data.certId;
    const certName = certifications.find(cert => cert.cert_id === certId)?.name ?? certId;
    return <div data-beta-diagnostic-results className="mx-auto max-w-[696px] space-y-8">
      <style>{'body:has([data-beta-diagnostic-results]) header a[href="/pricing"] { display: none; }'}</style>
      <header className="space-y-3"><p className="text-sm font-medium text-muted-foreground">Beta diagnostic</p><h1 className="text-3xl font-semibold tracking-tight">{certName} readiness report</h1><p className="text-sm text-muted-foreground">{data.totalQuestions} questions</p></header>
      <Card aria-label="Readiness tier">
        <CardHeader><CardTitle>Your readiness tier</CardTitle></CardHeader>
        <CardContent><p className="text-3xl font-semibold">Tier: {data.readiness?.label ?? getExamReadinessTier(data.score).label}</p></CardContent>
      </Card>
      <p className="text-sm leading-relaxed text-muted-foreground">Based on {data.totalQuestions} questions. This is an early readiness signal, not a per-domain assessment or a prediction of your exam result.</p>
      <section aria-labelledby="beta-practice" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
        <h2 id="beta-practice" className="text-xl font-semibold">Practice for {certName} is in beta and coming soon</h2>
        <CertWaitlistForm certId={certId} certName={certName} notificationTarget="practice" />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p><Link href={`/diagnostic?cert=${encodeURIComponent(certId)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Retake the diagnostic</Link></div>
    </div>;
  }

  const tierOnly = data.totalQuestions < 10;
  const orderedDomains = weakestFirst(data.domainBreakdown);
  const weakest = tierOnly ? undefined : orderedDomains[0];
  const dashboardPath = weakest ? `/dashboard?domain=${encodeURIComponent(weakest.domainCode)}` : "/dashboard";
  const practiceHref = data.review ? dashboardPath : `/signup?next=${encodeURIComponent(dashboardPath)}`;

  return <div className="mx-auto max-w-[896px] space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">PMLE readiness report</h1><p className="text-sm text-muted-foreground">{data.totalQuestions} questions</p></header>
    <div className="grid gap-6 md:grid-cols-2">
      <ScoreReport score={data.score} correctAnswers={data.correctAnswers} totalQuestions={data.totalQuestions} />
      {(tierOnly || weakest) && <Card aria-labelledby="next-step" className="flex flex-col">
        <CardHeader><p className="text-sm font-medium text-muted-foreground">Recommended next step</p><CardTitle id="next-step">{tierOnly ? "Keep building your readiness" : weakest?.domainName}</CardTitle></CardHeader>
        <CardContent className="flex-1"><p className="text-sm leading-relaxed text-muted-foreground">{data.review ? (tierOnly ? "Start a 5-question practice session from your dashboard." : "Choose this domain on your dashboard for a focused 5-question session.") : "Create a free account to review your answers, save this report and get 60 free practice questions per month."}</p></CardContent>
        <CardFooter className="flex flex-col items-start gap-3"><Button asChild><Link href={practiceHref}>Start practice</Link></Button>{!data.review && <p className="text-sm text-muted-foreground">Create a free account to continue.</p>}{data.review ? <SignedInDiagnosticUnlock result={data} compact /> : <DiagnosticPassOption result={data} />}</CardFooter>
      </Card>}
    </div>
    {data.totalQuestions < 20 && <p className={tierOnly ? "rounded-lg border border-border bg-card p-5 text-base font-medium leading-relaxed sm:p-7" : "text-sm leading-relaxed text-muted-foreground"}>Based on {data.totalQuestions} questions. {tierOnly ? "For a per-domain breakdown, " : "For a broader signal, "}<Link href="/diagnostic?length=20" className="text-primary underline">take the 20-question diagnostic →</Link></p>}
    {aboveFoldCta}
    {!tierOnly && <section aria-labelledby="domains-heading" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
      <h2 id="domains-heading" className="text-xl font-semibold">Score by domain</h2>
      <DomainScores domains={orderedDomains} />
      <p className="text-sm leading-relaxed text-muted-foreground">Each domain has only a few questions, so these results are an early signal of where to look, not a full measure of your knowledge. Domains with the same score are listed in exam-guide order.</p>
    </section>}
    {!data.review && <FreeDiagnosticExplanation key={data.sessionId} result={data} />}
    {data.review && <QuestionReviewList review={data.review} sessionId={sessionId} kind="diagnostic" />}
    {data.review && <SignedInDiagnosticUnlock result={data} />}
    {!data.review && (emailCard === undefined ? <ResultsEmailForm sessionId={sessionId} /> : emailCard)}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p><Link href="/diagnostic" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Retake the diagnostic</Link></div>
  </div>;
}
