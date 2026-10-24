import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { mockHistory } from "@/lib/mock/service";
import { MockStart } from "@/components/mock-start";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Timed PMLE mock exams", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function MockPage() {
  const user = await requireUser("/mock");
  const client = createServiceSupabaseClient();
  const access = await getPaidAccess(user.id, client);
  const history = access.hasPaidAccess ? await mockHistory(client, user.id).catch(() => null) : [];
  return <div className="mx-auto max-w-3xl space-y-8">
    <header className="space-y-4"><p className="text-sm font-medium text-muted-foreground">PMLE Pass · Timed practice</p><h1 className="text-3xl font-semibold">Timed mock exams</h1><p className="text-lg text-muted-foreground">50 questions. 120 minutes. See your score by domain, then review every answer and explanation.</p></header>
    <section className="space-y-5 rounded-lg border border-border bg-card p-6"><h2 className="text-xl font-semibold">Before you start</h2><ul className="list-disc space-y-2 pl-5 text-muted-foreground"><li>The clock starts when you start the mock. Leaving does not pause it.</li><li>Your saved answers return when you resume. You can change them until submission.</li><li>Answers and explanations stay hidden until you submit or time runs out. Unanswered questions count as incorrect.</li><li>Questions follow the exam blueprint where the bank allows it. Any shortfall or repeats are disclosed in your mock.</li></ul><p className="text-sm text-muted-foreground">This is a practice score, not a prediction of your Google exam result. Testero is independent and not affiliated with Google.</p>
      {access.unavailable ? <p role="alert">Access could not be checked. Please reload before starting.</p> : access.hasPaidAccess ? <MockStart /> : <div className="space-y-3"><p>Locked · PMLE Pass adds a timed 50-question mock with domain scores and explanation review.</p><Button asChild><Link href="/pricing">Explore PMLE Pass</Link></Button></div>}
    </section>
    {access.hasPaidAccess && <section className="space-y-4"><h2 className="text-xl font-semibold">Past attempts</h2>{history === null ? <p role="alert">Your attempts could not be loaded. Reload to try again.</p> : !history.length ? <p className="text-muted-foreground">No mock attempts yet. Your scores and dates will appear here.</p> : <ul className="divide-y divide-border border-y border-border">{history.map(attempt => <li key={attempt.sessionId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p>{new Date(attempt.startedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })} · UTC</p><p className="text-sm text-muted-foreground">{attempt.score === null ? "In progress · clock still running" : `${attempt.score}% · ${attempt.totalQuestions} questions`}</p></div><Link className="font-medium underline" href={`/mock/${attempt.sessionId}${attempt.completedAt ? "/results" : ""}`}>{attempt.completedAt ? "Review results" : "Resume mock"}</Link></li>)}</ul>}</section>}
    <Link className="inline-block underline" href="/dashboard">Back to dashboard</Link>
  </div>;
}
