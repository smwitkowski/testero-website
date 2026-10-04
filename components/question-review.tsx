"use client";

import { useFreshAccessOnFocus } from "@/components/billing-account";
import type { PaidQuestionReview } from "@/lib/diagnostic/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function QuestionReviewList({ review }: { review: PaidQuestionReview[] }) {
  useFreshAccessOnFocus();
  return (
    <section aria-labelledby="question-review-heading" className="space-y-4">
      <h2 id="question-review-heading" className="text-xl font-semibold">Question review</h2>
      <ol className="space-y-6">
        {review.map(question => (
          <li key={question.itemId}>
            <Card>
              <CardHeader className="space-y-3">
                <p className="text-sm text-muted-foreground">Question {question.ordinal} · {question.domainName}</p>
                <h3 className="font-medium leading-relaxed">{question.stem}</h3>
                <p className="text-sm font-medium">{question.isCorrect ? "Correct" : "Incorrect"}</p>
              </CardHeader>
              <CardContent className="space-y-5">
                {question.explanation && <section className="space-y-2"><h4 className="font-semibold">Explanation</h4><p className="whitespace-pre-line leading-relaxed">{question.explanation}</p></section>}
                <ul className="space-y-3">
                  {question.options.map(option => (
                    <li key={option.label} className={`rounded-lg border p-4 ${option.label === question.correctLabel ? "border-primary" : "border-border"}`}>
                      <p className="leading-relaxed"><span className="font-medium">{option.label}.</span> {option.text}</p>
                      {option.explanation && <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{option.explanation}</p>}
                      {(option.label === question.selectedLabel || option.label === question.correctLabel) && (
                        <p className="mt-2 text-sm font-medium">
                          {option.label === question.selectedLabel && <span>Your answer</span>}
                          {option.label === question.selectedLabel && option.label === question.correctLabel && <span> · </span>}
                          {option.label === question.correctLabel && <span>Correct answer</span>}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
