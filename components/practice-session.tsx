"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PracticeAnswerResponse, PracticeProgress } from "@/lib/practice/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useFreshAccessOnFocus } from "@/components/billing-account";
import { PracticeError, PracticeLoading, PracticeRequestError, practiceError, practiceRequest, usePracticeResource } from "@/components/practice-resource";

export function PracticeSession({ sessionId }: { sessionId: string }) {
  useFreshAccessOnFocus();
  const router = useRouter();
  const nextPath = `/practice/${encodeURIComponent(sessionId)}`;
  const summaryPath = `${nextPath}/summary`;
  const path = `/api${nextPath}`;
  const { data, error, reload } = usePracticeResource<PracticeProgress>(path);
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<PracticeAnswerResponse | null>(null);
  const [answerError, setAnswerError] = useState<PracticeRequestError | null>(null);
  const controller = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { controller.current = new AbortController(); return () => controller.current?.abort(); }, []);
  useEffect(() => {
    if (data?.status === "completed") router.replace(summaryPath);
    else if (data?.currentQuestion) heading.current?.focus();
  }, [data, router, summaryPath]);

  function nextQuestion() {
    setSelected(""); setAnswer(null); setAnswerError(null); submitting.current = false; setPending(false); reload();
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
      if (!signal.aborted) setAnswer(result);
    } catch (reason) {
      if (!signal.aborted) {
        const failure = practiceError(reason);
        setAnswerError(new PracticeRequestError(failure.status, `${failure.message} Retry loads your saved progress before you answer again.`));
      }
    } finally {
      if (!signal.aborted) { submitting.current = false; setPending(false); }
    }
  }

  if (error || answerError) return <PracticeError error={error || answerError!} nextPath={nextPath} onRetry={nextQuestion} />;
  if (!data || data.status === "completed") return <PracticeLoading message={data ? "Opening your practice summary…" : "Loading your saved practice…"} />;
  const question = data.currentQuestion;
  if (!question) return <PracticeError error={new PracticeRequestError(0, "Your next question could not be loaded. Retry to load your saved progress.")} nextPath={nextPath} onRetry={nextQuestion} />;
  const answeredCount = answer?.answeredCount ?? data.answeredCount;
  const correctOption = question.options.find(option => option.label === answer?.feedback.correctLabel);

  return <div className="space-y-6">
    <div className="space-y-3">
      <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>Question {question.ordinal} of {data.totalQuestions}</span><span>{answeredCount} answers saved</span></div>
      <div role="progressbar" aria-label="Practice progress" aria-valuemin={0} aria-valuemax={data.totalQuestions} aria-valuenow={answeredCount} className="h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full bg-primary" style={{ width: `${answeredCount / data.totalQuestions * 100}%` }} />
      </div>
    </div>
    <Card>
      <CardHeader><h1 ref={heading} tabIndex={-1} className="whitespace-pre-line text-2xl font-semibold leading-relaxed">{question.stem}</h1></CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={submit} className="space-y-6" aria-busy={pending}>
          <fieldset disabled={pending || !!answer} className="space-y-3">
            <legend className="mb-3 text-sm font-medium">Choose one answer</legend>
            {question.options.map(option => <label key={option.label} className={`flex min-h-14 items-start gap-3 rounded-md border p-4 leading-relaxed ${answer ? "cursor-default" : "cursor-pointer"} ${selected === option.label ? "border-primary bg-muted" : "border-border hover:bg-muted/50"}`}>
              <input type="radio" name="answer" value={option.label} checked={selected === option.label} onChange={() => setSelected(option.label)} className="mt-1.5 size-4 shrink-0" />
              <span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}</span>
            </label>)}
          </fieldset>
          {!answer && <Button type="submit" disabled={!selected || pending}>{pending ? "Saving answer…" : "Submit answer"}</Button>}
          {pending && <p role="status" className="text-sm text-muted-foreground">Saving your answer…</p>}
        </form>
        {answer && <div className="space-y-4 border-t border-border pt-5">
          <div role="status" className="space-y-2"><p className="text-xl font-semibold">{answer.feedback.isCorrect ? "Correct" : "Incorrect"}</p>
            <p className="leading-relaxed"><span className="font-medium">Correct answer: {answer.feedback.correctLabel}.</span> {correctOption?.text}</p>
          </div>
          {answer.feedback.explanation && <section className="space-y-2"><h2 className="font-semibold">Explanation</h2><p className="whitespace-pre-line leading-relaxed">{answer.feedback.explanation}</p></section>}
          {answer.feedback.optionExplanations && answer.feedback.optionExplanations.length > 0 && <section className="space-y-3"><h2 className="font-semibold">Option explanations</h2><ul className="space-y-3">{answer.feedback.optionExplanations.map(option => <li key={option.label} className="space-y-2"><p className="font-medium">{option.label}. {option.text}</p><p className="whitespace-pre-line leading-relaxed text-muted-foreground">{option.explanation}</p></li>)}</ul></section>}
          {answer.completed ? <Button asChild><Link href={summaryPath}>View summary</Link></Button> : <Button onClick={nextQuestion}>Next question</Button>}
        </div>}
      </CardContent>
    </Card>
    <Button variant="ghost" asChild><Link href="/dashboard">Back to dashboard</Link></Button>
  </div>;
}
