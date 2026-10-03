import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mapReview } from "@/lib/diagnostic/types";
import { QuestionReviewList } from "@/components/question-review";

const source = {
  id: "item", ordinal: 1, stem: "Which choice?", domain_code: "A", domain_name: "Domain A",
  options: [{ label: "A", text: "First", explanation: "secret explanation", source_url: "secret link", answer_id: "secret answer" }, { label: "B", text: "Second" }],
  selected_label: "B", correct_label: "A", is_correct: false,
  explanation: "secret explanation", document_url: "secret link", question_id: "bank-id",
};

describe("shared question review", () => {
  it("copies only review fields and strips explanation/source/answer metadata from JSON", () => {
    const review = mapReview(source);
    expect(Object.keys(review).sort()).toEqual(["correctLabel", "domainCode", "domainName", "isCorrect", "itemId", "options", "ordinal", "selectedLabel", "stem"]);
    expect(review.options).toEqual([{ label: "A", text: "First" }, { label: "B", text: "Second" }]);
    expect(JSON.stringify(review)).not.toMatch(/explanation|source_url|answer_id|document_url|question_id|secret/);
    expect(review.options).not.toBe(source.options);
  });
  it("shows question, choices, selection and correct answer as text without explanations/paywalls", () => {
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [mapReview(source)] }));
    expect(html).toContain("Question review");
    expect(html).toContain("Which choice?");
    expect(html).toContain("Incorrect");
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html).toContain("Your answer");
    expect(html).toContain("Correct answer");
    expect(html).not.toMatch(/explanation|secret|unlock|blur|paywall/i);
  });
  it("marks a correct selected choice with both accessible text labels", () => {
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [mapReview({ ...source, selected_label: "A", is_correct: true })] }));
    expect(html).toContain("Your answer");
    expect(html).toContain("Correct answer");
    expect(html).not.toContain("Incorrect");
  });
});
