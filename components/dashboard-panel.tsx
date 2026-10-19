"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard/types";
import { Button } from "@/components/ui/button";
import { DomainScores, ScoreReport } from "@/components/readiness-report";
import { TrackingTeaser } from "@/components/tracking-teaser";
import { PracticeStart } from "@/components/practice-start";
import { PassStatus, useFreshAccessOnFocus } from "@/components/billing-account";

export function DashboardLoadError() {
  const router = useRouter();
  return <section className="space-y-5">
    <h1 className="text-3xl font-semibold tracking-tight">Your study dashboard</h1>
    <p role="alert" className="text-destructive">Your dashboard could not be loaded. Retry to load your saved results and practice.</p>
    <Button onClick={() => router.refresh()}>Retry</Button>
  </section>;
}

export function DashboardPanel({ data, requestedDomain }: { data: DashboardData; requestedDomain?: string }) {
  useFreshAccessOnFocus();
  const diagnostic = data.diagnostic;
  return <div className="mx-auto max-w-[960px] space-y-8">
    <section className="space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="leading-relaxed text-muted-foreground">Use your latest diagnostic to choose what to study next.</p>
    </section>
    {data.paidAccess.unavailable ? <section className="space-y-3"><p role="alert">Your access status could not be verified. Reload before starting practice.</p><Button onClick={() => window.location.reload()}>Reload dashboard</Button></section> : <PracticeStart requestedDomain={requestedDomain} domains={data.domains} weakestDomains={data.weakestDomains} remaining={data.quota.remaining} quotaMonthStart={data.quota.monthStart} hasPaidAccess={data.paidAccess.hasPaidAccess} />}
    {diagnostic ? <>
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4 lg:sticky lg:top-24"><ScoreReport score={diagnostic.score} correctAnswers={diagnostic.correctAnswers} totalQuestions={diagnostic.totalQuestions} /><Link href={`/diagnostic/${encodeURIComponent(diagnostic.sessionId)}/results`} className="inline-block text-sm font-medium text-primary underline">View diagnostic results</Link></div>
        <section aria-labelledby="dashboard-domains" className="space-y-5 rounded-lg border border-border bg-card p-5 sm:p-7"><h2 id="dashboard-domains" className="text-xl font-semibold">Latest diagnostic by domain</h2><DomainScores domains={diagnostic.domainBreakdown} /><p className="text-sm text-muted-foreground">Study guidance based on your latest diagnostic, not combined practice accuracy.</p></section>
      </div>
    </> : <section className="space-y-3 rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Start with a readiness snapshot</h2>
      <p className="leading-relaxed text-muted-foreground">You do not have a completed diagnostic yet. Take one to find areas to study, or choose a practice domain above.</p>
      <Button asChild><Link href="/diagnostic">Take a diagnostic</Link></Button>
    </section>}
    {data.openPractice && <section className="space-y-3">
      <h2 className="text-xl font-semibold">Continue your practice</h2>
      <p className="text-muted-foreground">{data.openPractice.domainName}</p>
      <Button asChild><Link href={`/practice/${encodeURIComponent(data.openPractice.sessionId)}`}>Resume practice</Link></Button>
    </section>}
    {!data.paidAccess.hasPaidAccess && <TrackingTeaser />}
    {diagnostic && <Button variant="outline" asChild><Link href="/diagnostic">Retake diagnostic</Link></Button>}
    <section className="space-y-2 border-t border-border pt-5">
      <h2 className="text-xl font-semibold">Pass status</h2>
      <PassStatus access={data.paidAccess} />
    </section>
  </div>;
}
