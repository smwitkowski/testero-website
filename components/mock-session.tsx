"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MockError, mockRequest, useMockResource } from "@/components/mock-resource";
import type { MockProgress } from "@/lib/mock/types";
import { startMockCountdown } from "@/lib/mock/timer";
export function MockSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const path = `/api/mock/${encodeURIComponent(sessionId)}`;
  const { data, setData, error, setError, reload } = useMockResource<MockProgress>(path);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true; setPending(true);
    try {
      const next = await mockRequest<MockProgress>(`${path}/submit`, { method: "POST" });
      setData(next);
    } catch (reason) { setData(null); setError(reason instanceof Error ? reason : new Error("Submission failed. Reload your saved mock.")); }
    finally { submitting.current = false; setPending(false); }
  }, [path, setData, setError]);
  useEffect(() => {
    if (data?.status === "completed") router.replace(`/mock/${encodeURIComponent(sessionId)}/results`);
    if (!data || data.status !== "in_progress") return;
    return startMockCountdown({ deadlineAt: data.deadlineAt, serverNow: data.serverNow, onTick: setSeconds, onExpire: () => {
      // Do not race an in-flight save. Retry next tick, then let the database
      // serialize the answer/timeout and reject any late answer atomically.
      if (submitting.current) return false;
      void submit();
      return true;
    } });
  }, [data, router, sessionId, submit]);
  useEffect(() => { heading.current?.focus(); }, [index]);
  async function save() {
    const question = data?.questions[index];
    const label = draft ?? question?.selectedLabel;
    if (!question || !label || submitting.current) return;
    submitting.current = true; setPending(true);
    try {
      const next = await mockRequest<MockProgress>(`${path}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: question.id, selectedLabel: label }) });
      setData(next); setDraft(null); if (index < next.totalQuestions - 1) setIndex(index + 1);
    } catch (reason) { setData(null); setError(reason instanceof Error ? reason : new Error("Your answer could not be saved.")); }
    finally { submitting.current = false; setPending(false); }
  }
  function navigate(next: number) { setIndex(next); setDraft(null); setConfirm(false); }
  if (error) return <MockError error={error} retry={reload} />;
  if (!data || data.status === "completed") return <p role="status">{data ? "Opening mock results…" : "Loading your saved mock…"}</p>;
  const question = data.questions[index];
  if (!question) return <MockError error={new Error("This question could not be loaded.")} retry={reload} />;
  const selected = draft ?? question.selectedLabel;
  return <div className="mx-auto max-w-3xl space-y-6">
    <header className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">PMLE mock exam</h1><p role="timer" aria-label="Time remaining" className="font-mono text-lg tabular-nums">{seconds === null ? "120:00" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</p></div><p className="text-sm text-muted-foreground">{data.answeredCount} of {data.totalQuestions} answers saved · Answers stay hidden until submission.</p><p className="text-sm text-muted-foreground">Leaving does not pause the timer. Only saved answers count.</p></header>
    {data.allocationNotice && <p role="note" className="rounded-md border border-border bg-muted p-4 text-sm">{data.allocationNotice}</p>}
    <Card><CardHeader className="space-y-3"><p className="text-sm text-muted-foreground">Question {question.ordinal} of {data.totalQuestions} · {question.domainName}</p><h2 ref={heading} tabIndex={-1} className="whitespace-pre-line text-lg font-normal leading-relaxed sm:text-xl">{question.stem}</h2></CardHeader><CardContent className="space-y-6">
      <fieldset disabled={pending || seconds === 0} className="space-y-3"><legend className="mb-3 text-sm font-medium">Choose one answer</legend>{question.options.map(option => <label key={option.label} className={`answer-option flex min-h-14 cursor-pointer items-start gap-3 rounded-md border p-4 leading-relaxed ${selected === option.label ? "border-primary bg-muted" : "border-input hover:bg-muted/50"}`}><input className="mt-1.5 size-4 shrink-0" type="radio" name="mock-answer" value={option.label} checked={selected === option.label} onChange={() => setDraft(option.label)} /><span><span className="mr-2 font-semibold">{option.label}.</span>{option.text}</span></label>)}</fieldset>
      <div className="flex flex-wrap gap-3"><Button disabled={pending || !selected || seconds === 0} onClick={save}>{pending ? "Saving…" : "Save and next"}</Button><Button variant="outline" disabled={pending || index === 0} onClick={() => navigate(index - 1)}>Previous</Button><Button variant="outline" disabled={pending || index === data.totalQuestions - 1} onClick={() => navigate(index + 1)}>Skip for now</Button></div>
      {draft !== null && draft !== question.selectedLabel && <p role="status" className="text-sm text-muted-foreground">This choice is not saved yet. Select “Save and next” before leaving it.</p>}
    </CardContent></Card>
    <nav aria-label="Mock questions" className="space-y-3"><h2 className="font-semibold">Question navigator</h2><p className="text-sm text-muted-foreground">A check mark means your answer is saved, not that it is correct.</p><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{data.questions.map((row, next) => <Button key={row.id} className="min-w-0 whitespace-nowrap px-2 text-sm tabular-nums" variant={next === index ? "default" : "outline"} disabled={pending} aria-label={`Question ${row.ordinal}${row.selectedLabel ? ", saved" : ", unanswered"}`} aria-current={next === index ? "step" : undefined} onClick={() => navigate(next)}>{row.ordinal}{row.selectedLabel ? " ✓" : ""}</Button>)}</div></nav>
    <section className="space-y-3 border-t border-border pt-6">{confirm ? <><p>Submit with {data.answeredCount} of {data.totalQuestions} answers saved? Unanswered questions count as incorrect. You cannot change answers after submission.</p>{draft !== null && <p className="text-sm">Your current unsaved choice will not be included.</p>}<div className="flex flex-wrap gap-3"><Button disabled={pending} onClick={() => void submit()}>Confirm submission</Button><Button variant="outline" disabled={pending} onClick={() => setConfirm(false)}>Keep working</Button></div></> : <Button variant="outline" disabled={pending} onClick={() => setConfirm(true)}>Submit mock exam</Button>}</section>
    <Link className="inline-block underline" href="/mock">Leave mock (saved answers persist; timer keeps running)</Link>
  </div>;
}
