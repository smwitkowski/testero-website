"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DiagnosticResult, PaidQuestionReview } from "@/lib/diagnostic/types";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { QuestionReviewList } from "@/components/question-review";
import { Button } from "@/components/ui/button";
import { trackResults } from "@/lib/analytics/client";

export function FreeDiagnosticExplanation({ result }: { result: DiagnosticResult }) {
  const { data, error, reload } = useDiagnosticResource<PaidQuestionReview>(`/api/diagnostic/${encodeURIComponent(result.sessionId)}/free-explanation`);
  const viewed = useRef<string | null>(null);
  useEffect(() => {
    if (data && viewed.current !== result.sessionId) {
      viewed.current = result.sessionId;
      trackResults("free_explanation_viewed", result);
    }
  }, [data, result]);
  return <section aria-labelledby="free-explanation-heading" className="space-y-5">
    <div className="space-y-2"><h2 id="free-explanation-heading" className="text-xl font-semibold">One full explanation, free</h2><p className="text-muted-foreground">Learn from a missed question in your lowest-scoring domain. If you missed none, review one from that domain.</p></div>
    {error ? <div role="status" className="space-y-3"><p>We could not load your free explanation.</p><Button variant="outline" onClick={reload}>Retry explanation</Button></div> : data ? <QuestionReviewList review={[data]} sessionId={result.sessionId} kind="diagnostic" /> : <p role="status">Loading your free explanation…</p>}
    <div className="space-y-3 rounded-lg border border-border bg-card p-5 sm:p-7">
      <Button asChild className="h-auto whitespace-normal text-center"><Link href="/signup?next=%2Fpricing" onClick={() => trackResults("unlock_cta_clicked", result)}>Unlock explanations for all questions + unlimited practice: $39 one-time, 90 days</Link></Button>
      <p className="text-sm text-muted-foreground">Create an account, then continue to checkout for PMLE Pass. No subscription or auto-renew.</p>
    </div>
  </section>;
}
