"use client";

import { ReportQuestion } from "@/components/report-question";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DiagnosticAnswerResponse, DiagnosticProgress } from "@/lib/diagnostic/types";
import { trackDiagnostic, trackDiagnosticAnswer } from "@/lib/analytics/client";
import { SiteLogo } from "@/components/site-logo";
import { Button } from "@/components/ui/button";
import { PMLE_BLUEPRINT_MAP } from "@/lib/constants/pmle-blueprint";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DiagnosticError, DiagnosticLoading } from "@/components/diagnostic-state";
import { diagnosticRequest, requestError, useDiagnosticResource } from "@/components/diagnostic-resource";

export function DiagnosticSession({ sessionId, initialData = null }: { sessionId: string; initialData?: DiagnosticProgress | null }) {
  const router = useRouter();
  const path = `/api/diagnostic/${encodeURIComponent(sessionId)}`;
  const { data, error, reload, setData } = useDiagnosticResource<DiagnosticProgress>(path, initialData);
  const [selected, setSelected] = useState("");
  const [viewOrdinal, setViewOrdinal] = useState<number | null>(null);
  // The saved answer's right/wrong reveal, shown until the user moves on.
  const [answer, setAnswer] = useState<DiagnosticAnswerResponse | null>(null);
  const savedQuestion = data?.answeredQuestions.find(question => question.ordinal === viewOrdinal);
  const question = savedQuestion ?? data?.currentQuestion;
  const readOnly = !!savedQuestion;
  const displayedSelection = savedQuestion?.selectedLabel ?? selected;
  const [pending, setPending] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reveal = useRef<HTMLDivElement>(null);
  const certId = data?.certId ?? PMLE_CERT_ID;
  const beta = certId !== PMLE_CERT_ID;
  const certName = certifications.find(cert => cert.cert_id === certId)?.name;
  const resultsPath = `/diagnostic/${encodeURIComponent(sessionId)}/results${beta ? `?cert=${encodeURIComponent(certId)}` : ""}`;

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
  useEffect(() => {
    reveal.current?.scrollIntoView?.({ block: "nearest" });
  }, [answer]);

  function retry() {
    setAnswerError(null);
    setSelected("");
    setViewOrdinal(null);
    setAnswer(null);
    reload();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = data?.currentQuestion;
    const signal = controller.current?.signal;
    if (!question || readOnly || answer || pending || !selected || !signal || submitting.current) return;
    submitting.current = true;
    setPending(true);
    try {
      const result = await diagnosticRequest<DiagnosticAnswerResponse>(`${path}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: question.id, selectedLabel: selected }), signal,
      });
      if (signal.aborted) return;
      trackDiagnosticAnswer(sessionId, question.ordinal, question.domainCode, result.feedback.isCorrect, result.progress.certId ?? certId);
      if (result.completed) trackDiagnostic("diagnostic_completed", sessionId, undefined, result.progress.certId ?? certId);
      setAnswer(result);
    } catch (reason) {
      if (!signal.aborted) setAnswerError(`${requestError(reason)} Retry loads your saved progress before you answer again.`);
    } finally {
      if (!signal.aborted) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  function next() {
    if (!answer) return;
    if (answer.completed) return router.replace(resultsPath);
    setSelected("");
    setViewOrdinal(null);
    setAnswer(null);
    setData(answer.progress);
  }

  const header = <header className="mx-auto flex max-w-[720px] flex-wrap items-center justify-between gap-3 border-b border-border pb-3 sm:pb-5">
    <SiteLogo />
    {beta && certName && <p className="text-sm text-muted-foreground">{certName} · Beta diagnostic</p>}
  </header>;
  if (error || answerError) return <div className="space-y-6">{header}<DiagnosticError message={error || answerError!} onRetry={retry} /></div>;
  if (!data || data.status === "completed") return <div className="space-y-6">{header}<DiagnosticLoading message={data ? "Opening your results…" : "Loading your saved progress…"} /></div>;
  if (!question) return <div className="space-y-6">{header}<DiagnosticError message="Your next question could not be loaded. Retry to load your saved progress." onRetry={retry} /></div>;

  // ~60s per remaining question (this one included), rounded up; hidden under a minute.
  const secondsLeft = (data.totalQuestions - data.answeredCount) * 60;
  const minutesLeft = secondsLeft >= 60 ? Math.ceil(secondsLeft / 60) : 0;
  const midpoint = Math.floor(data.totalQuestions / 2);
  const answeredCount = answer?.answeredCount ?? data.answeredCount;
  const feedback = answer?.feedback.itemId === question.id ? answer.feedback : null;
  const halfway = !readOnly && !feedback && data.totalQuestions >= 10 && data.answeredCount === midpoint && question.ordinal === midpoint + 1;

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
            <div role="progressbar" aria-label="Diagnostic progress" aria-valuemin={0} aria-valuemax={data.totalQuestions} aria-valuenow={answeredCount} className="h-2 overflow-hidden rounded border border-input bg-border">
              <div className="h-full bg-primary" style={{ width: `${answeredCount / data.totalQuestions * 100}%` }} />
            </div>
          </div>
          {halfway && <p role="status" className="halfway-note rounded-md border border-border bg-muted px-4 py-3 text-sm font-medium">{beta ? "Halfway there. Your readiness signal is taking shape." : "Halfway there. Your domain picture is taking shape."}</p>}
          <Card className="rounded-none border-0 bg-transparent shadow-none sm:rounded-lg sm:border sm:bg-card sm:shadow-sm">
            <CardHeader className="space-y-3 px-0 pt-0 pb-4 sm:space-y-4 sm:p-8">
              <p className="text-sm text-muted-foreground">{beta ? question.domainName ?? question.domainCode : PMLE_BLUEPRINT_MAP[question.domainCode]?.displayName ?? question.domainCode}</p>
              <h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-base font-normal leading-relaxed sm:text-xl">{question.stem}</h1>
            </CardHeader>
            <CardContent className="px-0 pb-0 sm:px-8 sm:pb-8">
              <form id="diagnostic-answer" onSubmit={submit} className="space-y-6" aria-busy={pending}>
                {readOnly && <p className="text-sm text-muted-foreground">Saved answer. Previous answers are read-only and cannot be changed.</p>}
                <fieldset disabled={pending || readOnly || !!feedback} className="space-y-3">
                  <legend className="mb-3 text-sm font-medium">{readOnly ? "Your saved answer" : feedback ? "Your answer" : "Choose one answer"}</legend>
                  {question.options.map((option) => {
                    const tag = feedback && (option.label === feedback.correctLabel ? "Correct answer" : option.label === feedback.selectedLabel ? "Your answer" : null);
                    const tone = feedback ? option.label === feedback.correctLabel ? "border-[var(--solid)] bg-solid-background" : option.label === feedback.selectedLabel ? "border-[var(--focus-area)] bg-focus-area-background" : "border-input" : displayedSelection === option.label ? "border-primary bg-muted" : "border-input hover:bg-muted/50";
                    return <label key={option.label} className={`answer-option flex min-h-14 items-start gap-3 rounded-md border p-4 text-[15px] leading-relaxed sm:[--answer-padding:1.25rem] sm:p-5 sm:text-base ${feedback ? "cursor-default" : "cursor-pointer"} ${tone}`}>
                      <input type="radio" name="answer" value={option.label} checked={displayedSelection === option.label} onChange={() => setSelected(option.label)} className="mt-1 size-4 shrink-0" />
                      <span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}{tag && <span className="mt-1 block text-sm font-semibold">{tag}</span>}</span>
                    </label>;
                  })}
                </fieldset>
                {feedback && <div ref={reveal} role="status" className={`rounded-md p-4 ${feedback.isCorrect ? "bg-solid-background text-solid" : "bg-focus-area-background text-focus-area"}`}>
                  <p className="font-semibold">{feedback.isCorrect ? "Correct" : "Not quite"}. You chose {feedback.selectedLabel}; the correct answer is {feedback.correctLabel}.</p>
                  <p className="mt-1 text-sm">{beta ? "Your readiness tier comes at the end." : data.totalQuestions < 10 ? "Your overall readiness score comes at the end." : "Your full report, with your strongest and weakest domains, comes at the end."}</p>
                </div>}
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
          <Button type="button" variant="outline" disabled={pending || !!feedback || question.ordinal <= 1} onClick={() => setViewOrdinal(question.ordinal - 1)}>Previous</Button>
          {feedback ? (
            <Button key="reveal-next" type="button" className="ml-auto w-44 shrink-0" onClick={next}>{answer!.completed ? "See my results" : "Next question"}</Button>
          ) : readOnly ? (
            <Button key="history-next" type="button" className="ml-auto w-44 shrink-0" disabled={pending} onClick={() => setViewOrdinal(question.ordinal + 1)}>Next question</Button>
          ) : (
            <Button key="answer-submit" type="submit" form="diagnostic-answer" className="ml-auto w-44 shrink-0" disabled={!selected || pending}>{pending ? "Saving answer…" : "Check answer"}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
