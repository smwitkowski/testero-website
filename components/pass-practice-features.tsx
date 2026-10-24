"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PracticeStartResponse } from "@/lib/practice/types";
import { practiceRequest, practiceError } from "@/components/practice-resource";
import { trackPractice } from "@/lib/analytics/client";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";

export function PassPracticeFeatures({ hasPaidAccess }: { hasPaidAccess: boolean }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function drill() {
    if (!hasPaidAccess || submitting.current) return;
    submitting.current = true; setPending(true); setError(null);
    try {
      const result = await practiceRequest<PracticeStartResponse & { selection?: { message: string } }>("/api/practice", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "weak" }),
      });
      trackPractice(result.sessionId);
      // The saved session supplies its focus on every load and resume.
      router.push(`/practice/${encodeURIComponent(result.sessionId)}`);
    } catch (reason) {
      setError(practiceError(reason).message); submitting.current = false; setPending(false);
    }
  }
  const features = [
    { title: "Timed mock exams", description: "50 questions across PMLE domains, a 120-minute timer, and a scored review after submission." },
    { title: "Fresh-first practice", description: "Questions you have not answered come first; seen questions return when the unseen pool runs out." },
    { title: "Weak-area drills", description: "Practice your lowest-scoring domains after enough answers, or start from your diagnostic study focus." },
  ];
  return <section aria-labelledby="pass-features-heading" className="space-y-4">
    <div className="space-y-2"><h2 id="pass-features-heading" className="text-xl font-semibold">PMLE Pass prep tools</h2><p className="text-sm text-muted-foreground">{hasPaidAccess ? "Your Pass also includes explanations for every option." : `Explanations and these prep tools are part of PMLE Pass: ${PMLE_PASS_PRICE_DISPLAY} one-time for 90 days.`}</p></div>
    <div className="divide-y divide-border rounded-lg border border-border bg-card px-5 sm:px-7">
      {features.map((feature, index) => <div key={feature.title} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="min-w-0 flex-1 basis-60 space-y-2"><h3 className="font-semibold">{feature.title}{!hasPaidAccess && <span className="ml-2 text-xs font-normal text-muted-foreground">Locked · Pass only</span>}</h3><p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p></div>
        {!hasPaidAccess ? <Button variant="outline" asChild><Link href="/pricing" aria-label={`Unlock ${feature.title} with PMLE Pass`}>Explore PMLE Pass</Link></Button>
          : index === 0 ? <Button asChild><Link href="/mock">Open mock exams</Link></Button>
          : index === 1 ? <Button variant="outline" asChild><a href="#practice-start-heading">Use fresh-first practice</a></Button>
          : <Button variant="outline" onClick={drill} disabled={pending}>{pending ? "Starting drill…" : "Start weak-area drill"}</Button>}
      </div>)}
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}
