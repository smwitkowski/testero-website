"use client";

import Link from "next/link";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { QuestionReviewList } from "@/components/question-review";

export function DiagnosticResults({ sessionId }: { sessionId: string }) {
  const { data, error, reload } = useDiagnosticResource<DiagnosticResult>(`/api/diagnostic/${encodeURIComponent(sessionId)}/results`);
  if (error) return <DiagnosticError message={error} onRetry={reload} />;
  if (!data) return <DiagnosticLoading message="Loading your readiness results…" />;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Your PMLE readiness</h1>
        <p className="leading-relaxed text-muted-foreground">Use this snapshot to decide what to study next. It is study guidance, not an official exam pass threshold or a guarantee.</p>
      </section>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">{data.readiness.label} readiness</h2>
            <p className="text-3xl font-semibold tabular-nums">{data.score}%<span className="ml-2 text-sm font-normal text-muted-foreground">score</span></p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p>{data.correctAnswers} of {data.totalQuestions} correct</p>
          <p className="leading-relaxed text-muted-foreground">{data.readiness.description}</p>
        </CardContent>
      </Card>
      <section aria-labelledby="domains-heading" className="space-y-4">
        <h2 id="domains-heading" className="text-xl font-semibold">Your domain breakdown</h2>
        <ul className="divide-y divide-border border-y border-border">
          {data.domainBreakdown.map((domain) => (
            <li key={domain.domainCode} className="flex items-start justify-between gap-4 py-4">
              <div className="min-w-0 space-y-1">
                <h3 className="font-medium leading-relaxed">{domain.domainName}</h3>
                <p className="text-sm text-muted-foreground">{domain.correct} of {domain.total} correct</p>
              </div>
              <span className="shrink-0 pt-1 font-semibold tabular-nums">{domain.percentage}%</span>
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">Each domain has only a few questions. Treat lower scores as areas to explore, not a complete measure of your knowledge.</p>
      </section>
      {data.review && <QuestionReviewList review={data.review} />}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Keep building your knowledge</h2>
        {data.review ? (
          <Button asChild><Link href="/dashboard">Go to your dashboard</Link></Button>
        ) : (
          <>
            <p className="leading-relaxed text-muted-foreground">Your full score, readiness tier, and domain breakdown are available without an account. Create an account to see your questions and start free practice.</p>
            <Button asChild><Link href={`/signup?next=${encodeURIComponent(`/diagnostic/${sessionId}/results`)}`}>Create an account to see your questions</Link></Button>
          </>
        )}
        <Button variant="outline" asChild><Link href="/diagnostic">Take a new diagnostic</Link></Button>
      </section>
    </div>
  );
}
