"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticAnswerResponse, DiagnosticProgress } from "@/lib/diagnostic/types";
import { trackDiagnostic, trackDiagnosticAnswer } from "@/lib/analytics/client";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { PMLE_BLUEPRINT_MAP } from "@/lib/constants/pmle-blueprint";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { diagnosticRequest, requestError, useDiagnosticResource } from "@/components/diagnostic-resource";

export function DiagnosticSession({ sessionId, initialData = null }: { sessionId: string; initialData?: DiagnosticProgress | null }) {
  const router = useRouter();
  const path = `/api/diagnostic/${encodeURIComponent(sessionId)}`;
  const { data, error, reload } = useDiagnosticResource<DiagnosticProgress>(path, initialData);
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
      trackDiagnosticAnswer(sessionId, question.ordinal, question.domainCode);
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

  const header = <header className="mx-auto flex max-w-[760px] flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
    <SiteLogo />
  </header>;
  if (error || answerError) return <div className="space-y-6">{header}<DiagnosticError message={error || answerError!} onRetry={retry} /></div>;
  if (!data || data.status === "completed") return <div className="space-y-6">{header}<DiagnosticLoading message={data ? "Opening your results…" : "Loading your saved progress…"} /></div>;
  const question = data.currentQuestion;
  if (!question) return <div className="space-y-6">{header}<DiagnosticError message="Your next question could not be loaded. Retry to load your saved progress." onRetry={retry} /></div>;

  // ~60s per remaining question (this one included), rounded up; hidden under a minute.
  const secondsLeft = (data.totalQuestions - data.answeredCount) * 60;
  const minutesLeft = secondsLeft >= 60 ? Math.ceil(secondsLeft / 60) : 0;
  const last = question.ordinal === data.totalQuestions;
  // Shown only while answering question 11, i.e. right after the 10th answer was committed.
  const halfway = data.answeredCount === 10 && question.ordinal === 11;

  return (
    <div className="mx-auto max-w-[760px] space-y-6 pb-28 sm:pb-0">
      {header}
      <div className="space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>Question {question.ordinal} of {data.totalQuestions}</span>
          {minutesLeft > 0 && <span>~{minutesLeft} min left</span>}
        </div>
        <div role="progressbar" aria-label="Diagnostic progress" aria-valuemin={0} aria-valuemax={data.totalQuestions} aria-valuenow={data.answeredCount} className="h-2 overflow-hidden rounded border border-input bg-border">
          <div className="h-full bg-primary" style={{ width: `${data.answeredCount / data.totalQuestions * 100}%` }} />
        </div>
      </div>
      {halfway && <p role="status" className="halfway-note rounded-md border border-border bg-muted px-4 py-3 text-sm font-medium">Halfway there. Your domain picture is taking shape.</p>}
      <Card>
        <CardHeader className="space-y-4"><p className="text-sm text-muted-foreground">{PMLE_BLUEPRINT_MAP[question.domainCode]?.displayName ?? question.domainCode}</p><h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-lg font-normal leading-relaxed sm:text-xl">{question.stem}</h1></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
            <fieldset disabled={pending} className="space-y-3">
              <legend className="mb-3 text-sm font-medium">Choose one answer</legend>
              {question.options.map((option) => (
                <label key={option.label} className={`answer-option flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-4 leading-relaxed ${selected === option.label ? "border-primary bg-muted" : "border-input hover:bg-muted/50"}`}>
                  <input type="radio" name="answer" value={option.label} checked={selected === option.label} onChange={() => setSelected(option.label)} className="mt-1.5 size-4 shrink-0" />
                  <span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}</span>
                </label>
              ))}
            </fieldset>
            {/* Pinned to the bottom of the viewport on phones; inline from sm up. */}
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
              <Button type="submit" className="w-full sm:w-auto" disabled={!selected || pending}>{pending ? "Saving answer…" : last ? "See my results" : "Next question"}</Button>
            </div>
            {pending && <p role="status" className="text-sm text-muted-foreground">Saving your answer…</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
