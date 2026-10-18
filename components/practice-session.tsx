"use client";

import { ReportQuestion } from "@/components/report-question";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PracticeAnswerResponse, PracticeProgress } from "@/lib/practice/types";
import { Button } from "@/components/ui/button";
import { PMLE_BLUEPRINT_MAP } from "@/lib/constants/pmle-blueprint";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFreshAccessOnFocus } from "@/components/billing-account";
import { PracticeError, PracticeLoading, PracticeRequestError, practiceError, practiceRequest, usePracticeResource } from "@/components/practice-resource";

export function PracticeSession({ sessionId, initialData = null }: { sessionId: string; initialData?: PracticeProgress | null }) {
  useFreshAccessOnFocus();
  const router = useRouter();
  const nextPath = `/practice/${encodeURIComponent(sessionId)}`;
  const summaryPath = `${nextPath}/summary`;
  const path = `/api${nextPath}`;
  const { data, error, reload, setData } = usePracticeResource<PracticeProgress>(path, initialData);
  const nextProgress = useRef<PracticeProgress | null>(null);
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<PracticeAnswerResponse | null>(null);
  const [answerError, setAnswerError] = useState<PracticeRequestError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const requestController = new AbortController();
    controller.current = requestController;
    return () => requestController.abort();
  }, []);
  useEffect(() => {
    if (data?.status === "completed") router.replace(summaryPath);
    else if (data?.currentQuestion) heading.current?.focus();
  }, [data, router, summaryPath]);

  function retry() {
    nextProgress.current = null;
    setSelected(""); setAnswer(null); setAnswerError(null); submitting.current = false; setPending(false);
    reload();
  }
  function nextQuestion() {
    const progress = nextProgress.current;
    if (!progress) return;
    nextProgress.current = null;
    setSelected(""); setAnswer(null); setAnswerError(null); submitting.current = false; setPending(false);
    setData(progress);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = data?.currentQuestion;
    const signal = controller.current?.signal;
    if (!question || !selected || !signal || submitting.current || answer || answerError) return;
    submitting.current = true;
    setPending(true);
    try {
      const result = await practiceRequest<PracticeAnswerResponse>(`${path}/answer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: question.id, selectedLabel: selected }), signal,
      });
      if (!signal.aborted) {
        setAnswer(result);
        nextProgress.current = result.progress;
      }
    } catch (reason) {
      if (!signal.aborted) {
        const failure = practiceError(reason);
        setAnswerError(new PracticeRequestError(failure.status, `${failure.message} Retry loads your saved progress before you answer again.`));
      }
    } finally {
      if (!signal.aborted) { submitting.current = false; setPending(false); }
    }
  }

  if (error || answerError) return <PracticeError error={error || answerError!} nextPath={nextPath} onRetry={retry} />;
  if (!data || data.status === "completed") return <PracticeLoading message={data ? "Opening your practice summary…" : "Loading your saved practice…"} />;
  const question = data.currentQuestion;
  if (!question) return <PracticeError error={new PracticeRequestError(0, "Your next question could not be loaded. Retry to load your saved progress.")} nextPath={nextPath} onRetry={retry} />;
  const answeredCount = answer?.answeredCount ?? data.answeredCount;

  return <div className="mx-auto max-w-[760px] space-y-6">
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>Question {question.ordinal} of {data.totalQuestions}</span><span>{answeredCount} answered</span></div>
      <div role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={data.totalQuestions} aria-valuenow={answeredCount} className="h-2 overflow-hidden rounded border border-input bg-border">
        <div className="h-full bg-primary" style={{ width: `${answeredCount / data.totalQuestions * 100}%` }} />
      </div>
    </div>
    <Card>
      <CardHeader className="space-y-4"><p className="text-sm text-muted-foreground">{PMLE_BLUEPRINT_MAP[question.domainCode]?.displayName ?? question.domainCode}</p><h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-lg font-normal leading-relaxed sm:text-xl">{question.stem}</h1></CardHeader>
      <CardContent className="space-y-6">
        {answer && <div role="status" className={`space-y-2 rounded-md p-4 ${answer.feedback.isCorrect ? "bg-solid-background text-solid" : "bg-focus-area-background text-focus-area"}`}>
          <p className="text-lg font-semibold">{answer.feedback.isCorrect ? "Correct" : "Incorrect"}. You chose {answer.feedback.selectedLabel}; the correct answer is {answer.feedback.correctLabel}.</p>
        </div>}
        {!!answer?.feedback.optionExplanations?.length && <h2 className="font-semibold">Option explanations</h2>}
        <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
          <fieldset disabled={pending || !!answer} className="space-y-3">
            <legend className={answer ? "sr-only" : "mb-3 text-sm font-medium"}>{answer ? "Answer review" : "Choose one answer"}</legend>
            {question.options.map(option => {
              const explanation = answer?.feedback.optionExplanations?.find(explanation => explanation.label === option.label);
              return <label key={option.label} className={`answer-option flex min-h-14 items-start gap-3 rounded-md border p-4 leading-relaxed ${answer ? "cursor-default" : "cursor-pointer"} ${selected === option.label ? "border-primary bg-muted" : "border-input hover:bg-muted/50"}`}>
              <input type="radio" name="answer" value={option.label} checked={selected === option.label} onChange={() => setSelected(option.label)} className="mt-1.5 size-4 shrink-0" />
              <span><span className="mr-2 font-semibold">{option.label}.</span>{explanation?.text ?? option.text}
                {answer && (option.label === answer.feedback.correctLabel || option.label === answer.feedback.selectedLabel) && <span className="mt-2 block text-sm font-semibold">{option.label === answer.feedback.correctLabel ? "Correct answer" : "Your answer"}</span>}
                {explanation?.explanation && <span className="mt-2 block whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{explanation.explanation}</span>}
              </span>
            </label>;
            })}
          </fieldset>
          {!answer && <Button type="submit" disabled={!selected || pending}>{pending ? "Saving answer…" : "Submit answer"}</Button>}
          {pending && <p role="status" className="text-sm text-muted-foreground">Saving your answer…</p>}
        </form>
        {answer && <div className="space-y-4 border-t border-border pt-5">
          {!answer.feedback.optionExplanations?.length && answer.feedback.explanation && <section className="space-y-2"><h2 className="font-semibold">Explanation</h2><p className="whitespace-pre-line leading-relaxed">{answer.feedback.explanation}</p></section>}
          <div className="flex justify-end">{answer.completed ? <Button asChild><Link href={summaryPath}>View summary</Link></Button> : <Button onClick={nextQuestion}>Next question</Button>}</div>
        </div>}
      </CardContent>
    </Card>
    <ReportQuestion key={question.id} sessionId={sessionId} itemId={question.id} kind="practice" />
    <Button variant="ghost" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
  </div>;
}
