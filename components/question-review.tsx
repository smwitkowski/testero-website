import type { QuestionReview } from "@/lib/diagnostic/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function QuestionReviewList({ review }: { review: QuestionReview[] }) {
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
              <CardContent>
                <ul className="space-y-3">
                  {question.options.map(option => (
                    <li key={option.label} className={`rounded-lg border p-4 ${option.label === question.correctLabel ? "border-primary" : "border-border"}`}>
                      <p className="leading-relaxed"><span className="font-medium">{option.label}.</span> {option.text}</p>
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
