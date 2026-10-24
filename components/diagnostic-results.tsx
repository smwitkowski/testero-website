"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
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
  const { data, error } = useDiagnosticResource<DiagnosticResult>(`/api/diagnostic/${encodeURIComponent(sessionId)}/results`);
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (data && viewed.current !== data.sessionId) {
      viewed.current = data.sessionId;
      trackResults("results_viewed", data);
    }
  }, [data]);
  if (error) return <DiagnosticError message={error} />;
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

  const quickCheck = data.totalQuestions < 10;
  const orderedDomains = weakestFirst(data.domainBreakdown.filter(domain => domain.total > 0));
  const weakest = orderedDomains[0];
  const dashboardPath = weakest ? `/dashboard?domain=${encodeURIComponent(weakest.domainCode)}` : "/dashboard";
  const practiceHref = data.review ? dashboardPath : `/signup?next=${encodeURIComponent(dashboardPath)}`;

  return <div className="mx-auto max-w-[896px] space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">{quickCheck ? "Your 5-question PMLE check" : "PMLE readiness report"}</h1><p className="text-sm text-muted-foreground">{data.totalQuestions} questions</p></header>
    <div className="grid gap-6 md:grid-cols-2">
      <ScoreReport score={data.score} correctAnswers={data.correctAnswers} totalQuestions={data.totalQuestions} />
      {weakest && <Card aria-labelledby="next-step" className="flex flex-col">
        <CardHeader><p className="text-sm font-medium text-muted-foreground">Recommended next step</p><CardTitle id="next-step">{weakest.domainName}</CardTitle></CardHeader>
        <CardContent className="flex-1"><p className="text-sm leading-relaxed text-muted-foreground">{quickCheck ? "Start here. With 5 questions this is a rough pointer, not a firm ranking." : "Choose this domain on your dashboard for a focused 5-question session."}</p></CardContent>
      </Card>}
    </div>
    {data.totalQuestions < 20 && <p className="text-sm leading-relaxed text-muted-foreground">Based on {data.totalQuestions} questions. For a broader signal, <Link href="/diagnostic?length=20" className="text-primary underline">take the 20-question diagnostic →</Link></p>}
    <section aria-labelledby="domains-heading" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
      <h2 id="domains-heading" className="text-xl font-semibold">{quickCheck ? "Sampled domain reads" : "Score by domain"}</h2>
      <DomainScores domains={orderedDomains} sampled={quickCheck} />
      <p className="text-sm leading-relaxed text-muted-foreground">{quickCheck ? "Only the domains sampled are shown. One question cannot measure a domain: use these reads to choose what to review, not as domain scores. Ties follow exam-guide order." : "Each domain has only a few questions, so these results are an early signal of where to look, not a full measure of your knowledge. Domains with the same score are listed in exam-guide order."}</p>
    </section>
    {!data.review && <FreeDiagnosticExplanation key={data.sessionId} result={data} />}
    {data.review && <QuestionReviewList review={data.review} sessionId={sessionId} kind="diagnostic" />}
    {aboveFoldCta}
    <section aria-labelledby="keep-going-heading" className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-7">
      <h2 id="keep-going-heading" className="text-xl font-semibold">Keep going</h2>
      {!data.review && <p className="text-sm text-muted-foreground">Free account: review every answer, save this report, practice with no monthly limit and track your progress.</p>}
      <Button asChild><Link href={practiceHref}>{data.review ? "Start practice" : "Create free account"}</Link></Button>
      {data.review ? <SignedInDiagnosticUnlock result={data} /> : <>
        <p className="text-sm text-muted-foreground">Want explanations, timed mock exams, fresh-first practice and weak-area drills? PMLE Pass is {PMLE_PASS_PRICE_DISPLAY} once for 90 days. No auto-renew, 7-day refund.</p>
        <DiagnosticPassOption result={data} />
      </>}
    </section>
    {!data.review && (emailCard === undefined ? <ResultsEmailForm sessionId={sessionId} /> : emailCard)}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p><Link href="/diagnostic" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline">Retake the diagnostic</Link></div>
  </div>;
}
