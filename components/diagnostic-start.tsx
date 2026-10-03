"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiagnosticStartResponse } from "@/lib/diagnostic/types";
import { trackDiagnostic } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { diagnosticRequest, requestError } from "@/components/diagnostic-resource";

export function DiagnosticStart() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const starting = useRef(false);
  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);

  async function start() {
    const signal = controller.current?.signal;
    if (!signal || starting.current) return;
    starting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await diagnosticRequest<DiagnosticStartResponse>("/api/diagnostic", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal,
      });
      if (signal.aborted) return;
      trackDiagnostic("diagnostic_started", result.sessionId);
      router.push(`/diagnostic/${encodeURIComponent(result.sessionId)}`);
    } catch (reason) {
      if (!signal.aborted) {
        setError(requestError(reason));
        setPending(false);
        starting.current = false;
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-3xl font-semibold tracking-tight">Your PMLE starting point</h1>
        <p className="leading-relaxed text-muted-foreground">A free diagnostic across the six Google Cloud Professional Machine Learning Engineer exam domains. No account required.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <ul className="list-disc space-y-3 pl-5 leading-relaxed">
          <li>Answer 20 questions, one at a time.</li>
          <li>Choose your best answer. You will not see correctness during the test.</li>
          <li>See your score, readiness tier, and domain breakdown at the end.</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">Your progress is saved after each answer in this browser. Keep cookies enabled. Answers cannot be changed after submission.</p>
        {error && <p role="alert" className="text-sm leading-relaxed text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start} disabled={pending}>
            {pending ? "Starting diagnostic…" : error ? "Retry start" : "Start 20-question diagnostic"}
          </Button>
          <Button variant="ghost" asChild><Link href="/">Back to home</Link></Button>
        </div>
        {pending && <p role="status" className="text-sm text-muted-foreground">Preparing your questions…</p>}
      </CardContent>
    </Card>
  );
}
