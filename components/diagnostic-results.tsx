"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { trackResults } from "@/lib/analytics/client";
import { FreeDiagnosticExplanation } from "@/components/free-diagnostic-explanation";
import { ResultsEmailForm } from "@/components/results-email-form";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { Button } from "@/components/ui/button";
import { DomainScores, ScoreReport } from "@/components/readiness-report";
import { weakestFirst } from "@/lib/readiness";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { QuestionReviewList } from "@/components/question-review";

export function DiagnosticResults({ sessionId }: { sessionId: string }) {
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

  const orderedDomains = weakestFirst(data.domainBreakdown);
  const weakest = orderedDomains[0];
  const dashboardPath = weakest ? `/dashboard?domain=${encodeURIComponent(weakest.domainCode)}` : "/dashboard";
  const practiceHref = data.review ? dashboardPath : `/signup?next=${encodeURIComponent(dashboardPath)}`;

  return <div className="mx-auto max-w-[896px] space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">PMLE readiness report</h1><p className="text-sm text-muted-foreground">{data.totalQuestions} questions</p></header>
    {data.totalQuestions < 20 && <section className="space-y-3 rounded-lg border border-border bg-card p-5"><h2 className="text-xl font-semibold">A lower-confidence snapshot</h2><p className="text-muted-foreground">This shorter check gives lower-confidence results than the full 20-question diagnostic. Take the full version for a broader signal across all six domains.</p><Button asChild><Link href="/diagnostic">Take full readiness (20)</Link></Button></section>}
    <div className="grid gap-6 md:grid-cols-2">
      <ScoreReport score={data.score} correctAnswers={data.correctAnswers} totalQuestions={data.totalQuestions} />
      {weakest && <section aria-labelledby="next-step" className="on-dark flex flex-col items-start gap-4 rounded-lg bg-foreground p-5 text-card sm:p-7">
        <h2 id="next-step" className="text-sm font-medium text-on-dark-secondary">Recommended next step</h2>
        <p className="text-xl font-semibold leading-snug">{weakest.domainName}</p>
        <p className="text-sm leading-relaxed text-on-dark-secondary">{data.review ? "Choose this domain on your dashboard for a focused 5-question session." : "A free account saves this report and includes 5 practice questions a week."}</p>
        <Button variant="outline" className="mt-auto border-card bg-card text-foreground hover:bg-muted" asChild><Link href={practiceHref}>Start practice</Link></Button>
        {!data.review && <p className="text-sm text-on-dark-secondary">Create a free account to continue.</p>}
      </section>}
    </div>
    <section aria-labelledby="domains-heading" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7">
      <h2 id="domains-heading" className="text-xl font-semibold">Score by domain</h2>
      <DomainScores domains={orderedDomains} />
      <p className="text-sm leading-relaxed text-muted-foreground">Each domain has only a few questions, so these results are an early signal of where to look, not a full measure of your knowledge. Domains with the same score are listed in exam-guide order.</p>
    </section>
    <ResultsEmailForm sessionId={sessionId} />
    {!data.review && <FreeDiagnosticExplanation key={data.sessionId} result={data} />}
    {data.review && <QuestionReviewList review={data.review} sessionId={sessionId} kind="diagnostic" />}
    {!data.review && <section className="space-y-3"><h2 className="text-xl font-semibold">Review your answers</h2><p className="leading-relaxed text-muted-foreground">Your full score, readiness tier, and domain breakdown are available without an account. Create an account to see your questions and start free practice.</p><Button variant="outline" asChild><Link href={`/signup?next=${encodeURIComponent(`/diagnostic/${sessionId}/results`)}`}>Create an account to see your questions</Link></Button></section>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="text-sm text-muted-foreground">Study guidance, not a prediction of your exam result.</p><Link href="/diagnostic" className="text-sm font-medium text-primary underline">Retake the diagnostic</Link></div>
  </div>;
}
