"use client";

import Link from "next/link";
import type { PracticeSummary as PracticeSummaryData } from "@/lib/practice/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { QuestionReviewList } from "@/components/question-review";
import { PracticeError, PracticeLoading, usePracticeResource } from "@/components/practice-resource";

export function PracticeSummary({ sessionId }: { sessionId: string }) {
  const nextPath = `/practice/${encodeURIComponent(sessionId)}/summary`;
  const { data, error, reload } = usePracticeResource<PracticeSummaryData>(`/api${nextPath}`);
  if (error) return <PracticeError error={error} nextPath={nextPath} onRetry={reload} />;
  if (!data) return <PracticeLoading message="Loading your practice summary…" />;
  return <div className="space-y-8">
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Your practice summary</h1>
      <p className="leading-relaxed text-muted-foreground">Review your answers to decide what to study next. This short session is study guidance, not an exam readiness guarantee.</p>
    </section>
    <Card>
      <CardHeader><div className="flex flex-wrap items-baseline justify-between gap-4"><h2 className="text-xl font-semibold">Practice score</h2><p className="text-3xl font-semibold tabular-nums">{data.score}%</p></div></CardHeader>
      <CardContent><p>{data.correctAnswers} of {data.totalQuestions} correct</p></CardContent>
    </Card>
    <QuestionReviewList review={data.review} />
    <Button asChild><Link href="/dashboard">Back to dashboard</Link></Button>
  </div>;
}
