"use client";

import { ReportQuestion } from "@/components/report-question";

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
  const { data, error, reload, setData } = useDiagnosticResource<DiagnosticProgress>(path, initialData);
  const [selected, setSelected] = useState("");
  const [viewOrdinal, setViewOrdinal] = useState<number | null>(null);
  const savedQuestion = data?.answeredQuestions.find(question => question.ordinal === viewOrdinal);
  const question = savedQuestion ?? data?.currentQuestion;
  const readOnly = !!savedQuestion;
  const displayedSelection = savedQuestion?.selectedLabel ?? selected;
  const [pending, setPending] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultsPath = `/diagnostic/${encodeURIComponent(sessionId)}/results`;

  useEffect(() => {
    const requestController = new AbortController();
    controller.current = requestController;
    return () => requestController.abort();
  }, []);
  useEffect(() => {
    if (data?.status === "completed") router.replace(resultsPath);
  }, [data?.status, router, resultsPath]);
  useEffect(() => {
    heading.current?.focus();
  }, [question?.id]);

  function retry() {
    setAnswerError(null);
    setSelected("");
    setViewOrdinal(null);
    reload();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = data?.currentQuestion;
    const signal = controller.current?.signal;
    if (!question || readOnly || pending || !selected || !signal || submitting.current) return;
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
        setViewOrdinal(null);
        setData(result.progress);
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

  const header = <header className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-3 border-b border-border pb-3 sm:pb-5">
    <SiteLogo />
  </header>;
  if (error || answerError) return <div className="space-y-6">{header}<DiagnosticError message={error || answerError!} onRetry={retry} /></div>;
  if (!data || data.status === "completed") return <div className="space-y-6">{header}<DiagnosticLoading message={data ? "Opening your results…" : "Loading your saved progress…"} /></div>;
  if (!question) return <div className="space-y-6">{header}<DiagnosticError message="Your next question could not be loaded. Retry to load your saved progress." onRetry={retry} /></div>;

  // ~60s per remaining question (this one included), rounded up; hidden under a minute.
  const secondsLeft = (data.totalQuestions - data.answeredCount) * 60;
  const minutesLeft = secondsLeft >= 60 ? Math.ceil(secondsLeft / 60) : 0;
  const last = question.ordinal === data.totalQuestions;
  const midpoint = Math.floor(data.totalQuestions / 2);
  const halfway = !readOnly && data.totalQuestions >= 10 && data.answeredCount === midpoint && question.ordinal === midpoint + 1;

  return (
    <div className="fixed inset-0 z-0 flex flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(1.25rem,env(safe-area-inset-left),env(safe-area-inset-right))] py-4 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-[720px] space-y-4 sm:space-y-6">
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
          <Card className="rounded-none border-0 bg-transparent shadow-none sm:rounded-lg sm:border sm:bg-card sm:shadow-sm">
            <CardHeader className="space-y-3 px-0 pt-0 pb-4 sm:space-y-4 sm:p-8">
              <p className="text-sm text-muted-foreground">{PMLE_BLUEPRINT_MAP[question.domainCode]?.displayName ?? question.domainCode}</p>
              <h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-lg font-normal leading-relaxed sm:text-2xl">{question.stem}</h1>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-8 sm:pb-8">
              <form id="diagnostic-answer" onSubmit={submit} className="space-y-6" aria-busy={pending}>
                {readOnly && <p className="text-sm text-muted-foreground">Saved answer. Previous answers are read-only and cannot be changed.</p>}
                <fieldset disabled={pending || readOnly} className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">{readOnly ? "Your saved answer" : "Choose one answer"}</legend>
                  {question.options.map((option) => (
                    <label key={option.label} className={`answer-option flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-4 text-[17px] leading-relaxed sm:[--answer-padding:1.25rem] sm:p-5 sm:text-lg ${displayedSelection === option.label ? "border-primary bg-muted" : "border-input hover:bg-muted/50"}`}>
                      <input type="radio" name="answer" value={option.label} checked={displayedSelection === option.label} onChange={() => setSelected(option.label)} className="mt-1.5 size-4 shrink-0" />
                      <span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}</span>
                    </label>
                  ))}
                </fieldset>
                {pending && <p role="status" className="text-sm text-muted-foreground">Saving your answer…</p>}
              </form>
            </CardContent>
          </Card>
          <ReportQuestion key={question.id} sessionId={sessionId} itemId={question.id} kind="diagnostic" />
        </div>
      </div>
      {/* Keep actions outside the scrolling pane so they cannot cover an answer. */}
      <div data-diagnostic-actions className="shrink-0 border-t border-border bg-card px-[max(1.25rem,env(safe-area-inset-left),env(safe-area-inset-right))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto flex max-w-[720px] gap-3">
          <Button type="button" variant="outline" disabled={pending || question.ordinal <= 1} onClick={() => setViewOrdinal(question.ordinal - 1)}>Previous</Button>
          {readOnly ? (
            <Button key="history-next" type="button" className="ml-auto w-44 shrink-0" disabled={pending} onClick={() => setViewOrdinal(question.ordinal + 1)}>Next question</Button>
          ) : (
            <Button key="answer-submit" type="submit" form="diagnostic-answer" className="ml-auto w-44 shrink-0" disabled={!selected || pending}>{pending ? "Saving answer…" : last ? "See my results" : "Next question"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
