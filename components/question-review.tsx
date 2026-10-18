"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReportQuestion } from "@/components/report-question";

import { useFreshAccessOnFocus } from "@/components/billing-account";
import type { PaidQuestionReview } from "@/lib/diagnostic/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function QuestionReviewList({ review, sessionId, kind = "diagnostic", paginated = kind === "diagnostic" }: { review: PaidQuestionReview[]; sessionId?: string; kind?: "diagnostic" | "practice"; paginated?: boolean }) {
  useFreshAccessOnFocus();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedIndex = Math.max(0, review.findIndex(question => question.itemId === selectedItemId));
  const visibleReview = paginated ? review.slice(selectedIndex, selectedIndex + 1) : review;
  function selectQuestion(index: number) {
    setSelectedItemId(review[index].itemId);
  }
  return (
    <section aria-label={review.length === 1 ? "Answer review" : undefined} aria-labelledby={review.length === 1 ? undefined : "question-review-heading"} className="space-y-4">
      {review.length !== 1 && <h2 id="question-review-heading" className="text-xl font-semibold">Question review</h2>}
      {paginated && review.length > 1 && <nav aria-label="Question review navigation" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" disabled={selectedIndex === 0} onClick={() => selectQuestion(selectedIndex - 1)}>Previous</Button>
          <p role="status" className="text-sm text-muted-foreground">Question {review[selectedIndex].ordinal} · {selectedIndex + 1} of {review.length}</p>
          <Button variant="outline" size="sm" disabled={selectedIndex === review.length - 1} onClick={() => selectQuestion(selectedIndex + 1)}>Next</Button>
        </div>
        <ol className="flex flex-wrap gap-2">
          {review.map((question, index) => <li key={question.itemId}>
            <Button variant={index === selectedIndex ? "default" : "outline"} size="sm" className="min-w-11" aria-current={index === selectedIndex ? "step" : undefined} aria-label={`Review question ${question.ordinal}${question.isCorrect ? ", correct" : ", incorrect"}`} onClick={() => selectQuestion(index)}>{question.ordinal}<span aria-hidden="true">{question.isCorrect ? "✓" : "✗"}</span></Button>
          </li>)}
        </ol>
      </nav>}
      <ol data-question-review-items className="space-y-6">
        {visibleReview.map(question => (
          <li key={question.itemId} value={question.ordinal}>
            <Card>
              <CardHeader className="space-y-3">
                <p className="text-sm text-muted-foreground">Question {question.ordinal} · {question.domainName}</p>
                <h3 className="font-medium leading-relaxed">{question.stem}</h3>
                <p className={`text-sm font-semibold ${question.isCorrect ? "text-solid" : "text-destructive"}`}>{question.isCorrect ? "Correct." : "Incorrect."} You chose {question.selectedLabel}. The correct answer is {question.correctLabel}.</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {!question.options.some(option => option.explanation) && question.explanation && <section className="space-y-2"><h4 className="font-semibold">Explanation</h4><p className="whitespace-pre-line leading-relaxed">{question.explanation}</p></section>}
                <ul className="space-y-3">
                  {question.options.map(option => (
                    <li key={option.label} className={`rounded-lg border p-4 ${option.label === question.correctLabel ? "border-primary" : "border-border"}`}>
                      {(option.label === question.selectedLabel || option.label === question.correctLabel) && <div className="mb-3 flex flex-wrap justify-end gap-2 text-sm font-semibold">
                        {option.label === question.selectedLabel && <span className={`rounded px-2 py-1 ${question.isCorrect ? "bg-solid-background text-solid" : "bg-focus-area-background text-destructive"}`}>Your answer {question.isCorrect ? "✓" : "✗"}</span>}
                        {option.label === question.correctLabel && <span className="rounded bg-solid-background px-2 py-1 text-solid">Correct ✓</span>}
                      </div>}
                      <p className="leading-relaxed"><span className="font-medium">{option.label}.</span> {option.text}</p>
                      {option.explanation && <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{option.explanation}</p>}
                    </li>
                  ))}
                </ul>
                {sessionId && <ReportQuestion sessionId={sessionId} itemId={question.itemId} kind={kind} />}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
