"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticAnswerResponse, DiagnosticProgress } from "@/lib/diagnostic/types";
import { trackDiagnostic } from "@/lib/analytics/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { diagnosticRequest, requestError, useDiagnosticResource } from "@/components/diagnostic-resource";

export function DiagnosticSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const path = `/api/diagnostic/${encodeURIComponent(sessionId)}`;
  const { data, error, reload } = useDiagnosticResource<DiagnosticProgress>(path);
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsPath = `/diagnostic/${encodeURIComponent(sessionId)}/results`;

  useEffect(() => {
    controller.current = new AbortController();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (data?.status === "completed") router.replace(resultsPath);
    else if (data?.currentQuestion) heading.current?.focus();
  }, [data, router, resultsPath]);

  function retry() {
    setAnswerError(null);
    setSelected("");
    reload();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = data?.currentQuestion;
    const signal = controller.current?.signal;
    if (!question || !selected || !signal || submitting.current) return;
    submitting.current = true;
    setPending(true);
    let completed = false;
    try {
      const result = await diagnosticRequest<DiagnosticAnswerResponse>(`${path}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: question.id, selectedLabel: selected }), signal,
      });
      if (signal.aborted) return;
      if (result.completed) {
        completed = true;
        trackDiagnostic("diagnostic_completed", sessionId);
        router.replace(resultsPath);
      } else {
        setSelected("");
        reload();
      }
    } catch (reason) {
      if (!signal.aborted) setAnswerError(`${requestError(reason)} Retry loads your saved progress before you answer again.`);
    } finally {
      if (!signal.aborted && !completed) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  if (error || answerError) return <DiagnosticError message={error || answerError!} onRetry={retry} />;
  if (!data || data.status === "completed") return <DiagnosticLoading message={data ? "Opening your results…" : "Loading your saved progress…"} />;
  const question = data.currentQuestion;
  if (!question) return <DiagnosticError message="Your next question could not be loaded. Retry to load your saved progress." onRetry={retry} />;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>Question {question.ordinal} of {data.totalQuestions}</span>
          <span>{data.answeredCount} answers saved</span>
        </div>
        <div role="progressbar" aria-label="Diagnostic progress" aria-valuemin={0} aria-valuemax={data.totalQuestions} aria-valuenow={data.answeredCount} className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-primary" style={{ width: `${data.answeredCount / data.totalQuestions * 100}%` }} />
        </div>
      </div>
      <Card>
        <CardHeader><h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-2xl font-semibold leading-relaxed">{question.stem}</h1></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
            <fieldset disabled={pending} className="space-y-3">
              <legend className="mb-3 text-sm font-medium">Choose one answer</legend>
              {question.options.map((option) => (
                <label key={option.label} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-4 leading-relaxed ${selected === option.label ? "border-primary bg-muted" : "border-border hover:bg-muted/50"}`}>
                  <input type="radio" name="answer" value={option.label} checked={selected === option.label} onChange={() => setSelected(option.label)} className="mt-1.5 size-4 shrink-0" />
                  <span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}</span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">No correctness is shown during the diagnostic.</p>
              <Button type="submit" disabled={!selected || pending}>{pending ? "Saving answer…" : "Submit answer"}</Button>
            </div>
            {pending && <p role="status" className="text-sm text-muted-foreground">Saving your answer…</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
