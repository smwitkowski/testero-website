"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { PracticeSummary as PracticeSummaryData } from "@/lib/practice/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DomainScores } from "@/components/readiness-report";
import { QuestionReviewList } from "@/components/question-review";
import { PracticeError, PracticeLoading, usePracticeResource } from "@/components/practice-resource";

export function PracticeSummary({ sessionId }: { sessionId: string }) {
  const nextPath = `/practice/${encodeURIComponent(sessionId)}/summary`;
  const { data, error, reload } = usePracticeResource<PracticeSummaryData>(`/api${nextPath}`);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [data]);
  if (error) return <PracticeError error={error} nextPath={nextPath} onRetry={reload} />;
  if (!data) return <div className="mx-auto min-h-[70vh] max-w-[760px] space-y-8" aria-busy="true">
    <PracticeLoading message="Loading your practice summary…" />
    <div aria-hidden="true" className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="h-8 w-2/3 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" />
      <div className="h-32 rounded bg-muted" /><div className="h-32 rounded bg-muted" />
    </div>
  </div>;
  return <div className="mx-auto max-w-[760px] space-y-8">
    <section className="space-y-3">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight">Your practice summary</h1>
      <p className="leading-relaxed text-muted-foreground">Review your answers to decide what to study next. This short session is study guidance, not an exam readiness guarantee.</p>
    </section>
    <Card>
      <CardHeader><div className="flex flex-wrap items-baseline justify-between gap-4"><h2 className="text-xl font-semibold">Practice score</h2><p className="text-3xl font-semibold tabular-nums">{data.score}%</p></div></CardHeader>
      <CardContent className="space-y-5"><p>{data.correctAnswers} of {data.totalQuestions} correct</p><h3 className="font-semibold">Progress by domain</h3><DomainScores domains={data.domainBreakdown} /></CardContent>
    </Card>
    <QuestionReviewList review={data.review} sessionId={sessionId} kind="practice" />
    <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
  </div>;
}
