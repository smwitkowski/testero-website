"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PracticeStart } from "@/components/practice-start";

export function DashboardLoadError() {
  const router = useRouter();
  return <section className="space-y-5">
    <h1 className="text-3xl font-semibold tracking-tight">Your study dashboard</h1>
    <p role="alert" className="text-destructive">Your dashboard could not be loaded. Retry to load your saved results and practice.</p>
    <Button onClick={() => router.refresh()}>Retry</Button>
  </section>;
}

export function DashboardPanel({ data }: { data: DashboardData }) {
  const diagnostic = data.diagnostic;
  return <div className="space-y-8">
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Your study dashboard</h1>
      <p className="leading-relaxed text-muted-foreground">Use your latest diagnostic to choose what to study next.</p>
    </section>
    {diagnostic ? <>
      <Card>
        <CardHeader><div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">{diagnostic.readiness.label} readiness</h2>
          <p className="text-3xl font-semibold tabular-nums">{diagnostic.score}%<span className="ml-2 text-sm font-normal text-muted-foreground">score</span></p>
        </div></CardHeader>
        <CardContent className="space-y-3">
          <p>{diagnostic.correctAnswers} of {diagnostic.totalQuestions} correct</p>
          <p className="leading-relaxed text-muted-foreground">{diagnostic.readiness.description}</p>
          <p className="text-sm text-muted-foreground">Study guidance, not an official exam pass threshold or a guarantee.</p>
          <Button variant="outline" asChild><Link href={`/diagnostic/${encodeURIComponent(diagnostic.sessionId)}/results`}>View diagnostic results</Link></Button>
        </CardContent>
      </Card>
      <section aria-labelledby="dashboard-domains" className="space-y-4">
        <h2 id="dashboard-domains" className="text-xl font-semibold">Your domain breakdown</h2>
        <ul className="divide-y divide-border border-y border-border">
          {diagnostic.domainBreakdown.map(domain => <li key={domain.domainCode} className="flex items-start justify-between gap-4 py-4">
            <div className="min-w-0 space-y-1"><h3 className="font-medium leading-relaxed">{domain.domainName}</h3><p className="text-sm text-muted-foreground">{domain.correct} of {domain.total} correct</p></div>
            <span className="shrink-0 font-semibold tabular-nums">{domain.percentage}%</span>
          </li>)}
        </ul>
      </section>
    </> : <section className="space-y-3 rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Start with a readiness snapshot</h2>
      <p className="leading-relaxed text-muted-foreground">You do not have a completed diagnostic yet. Take one to find areas to study, or choose a practice domain below.</p>
      <Button asChild><Link href="/diagnostic">Take a diagnostic</Link></Button>
    </section>}
    {data.openPractice && <section className="space-y-3">
      <h2 className="text-xl font-semibold">Continue your practice</h2>
      <p className="text-muted-foreground">{data.openPractice.domainName}</p>
      <Button asChild><Link href={`/practice/${encodeURIComponent(data.openPractice.sessionId)}`}>Resume practice</Link></Button>
    </section>}
    <PracticeStart domains={data.domains} weakestDomains={data.weakestDomains} remaining={data.quota.remaining} />
    {diagnostic && <Button variant="outline" asChild><Link href="/diagnostic">Retake diagnostic</Link></Button>}
    <section className="space-y-2 border-t border-border pt-5">
      <h2 className="text-xl font-semibold">Pass status</h2>
      <p className="text-muted-foreground">Your verified PMLE Pass status will appear here when billing is available in Phase 3.</p>
    </section>
  </div>;
}
