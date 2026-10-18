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
  it("renders one diagnostic question with a step for each server-returned item", () => {
    const first = mapReview(source);
    const second = { ...first, itemId: "item-2", ordinal: 2, stem: "Second private stem" };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [first, second] }));
    expect(html).toContain("Question review navigation");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Review question 2, incorrect");
    expect(html).toContain("✗");
    expect(html).not.toContain(second.stem);
    expect(html).toContain(first.stem);
  });
  it("keeps practice summaries as a full list without diagnostic navigation", () => {
    const first = mapReview(source);
    const second = { ...first, itemId: "item-2", ordinal: 2, stem: "Second practice stem" };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [first, second], kind: "practice" }));
    expect(html).toContain(first.stem);
    expect(html).toContain(second.stem);
    expect(html).not.toContain("Question review navigation");
  });
  it("offers reporting for session-bound review without exposing bank identity", () => {
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [mapReview(source)], sessionId: "session", kind: "practice" }));
    expect(html).toContain("Report a problem with this question");
    expect(html).not.toContain("bank-id");
  });
  it("copies only review fields and strips explanation/source/answer metadata from JSON", () => {
    const review = mapReview(source);
    expect(Object.keys(review).sort()).toEqual(["correctLabel", "domainCode", "domainName", "isCorrect", "itemId", "options", "ordinal", "selectedLabel", "stem"]);
    expect(review.options).toEqual([{ label: "A", text: "First" }, { label: "B", text: "Second" }]);
    expect(JSON.stringify(review)).not.toMatch(/explanation|source_url|answer_id|document_url|question_id|secret/);
    expect(review.options).not.toBe(source.options);
  });
  it("shows question, choices, selection and correct answer as text without explanations/paywalls", () => {
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [mapReview(source)] }));
    expect(html).not.toContain("Question review navigation");
    expect(html).not.toContain(">Question review</h2>");
    expect(html).toContain("Which choice?");
    expect(html).toContain("Incorrect");
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html).toContain("Your answer");
    expect(html).toContain("Correct ✓");
    expect(html).toContain("You chose B. The correct answer is A.");
    expect(html.indexOf("Correct ✓")).toBeLessThan(html.indexOf(">A.</span> First"));
    expect(html).not.toMatch(/explanation|secret|unlock|blur|paywall/i);
  });
  it("renders only the optional explanation fields received in paid review", () => {
    const review = { ...mapReview(source), explanation: "Stored question explanation", options: [{ label: "A", text: "First", explanation: "Stored option explanation" }, { label: "B", text: "Second" }] };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [review] }));
    expect(html).not.toContain("Stored question explanation");
    expect(html).toContain("Stored option explanation");
    expect(html).not.toContain("secret link");
  });
  it("marks a correct selected choice with both accessible text labels", () => {
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [mapReview({ ...source, selected_label: "A", is_correct: true })] }));
    expect(html).toContain("Your answer");
    expect(html).toContain("Correct ✓");
    expect(html).toContain("Your answer ✓");
    expect(html).not.toContain("Incorrect");
  });
});

describe("paid review explanations", () => {
  it("shows each rationale once in the practice summary when the explanation repeats all options", () => {
    const options = ["A", "B", "C", "D"].map(label => ({ label, text: `Choice ${label}`, explanation: `Rationale for ${label}.` }));
    const review = { ...mapReview(source), explanation: options.map(option => `${option.label}: ${option.explanation}`).join("\n\n"), options };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [review] }));
    for (const option of options) expect(html.split(option.explanation)).toHaveLength(2);
    expect(html).not.toContain(">Explanation</h4>");
  });
  it("keeps an overall explanation when no option rationales are available", () => {
    const review = { ...mapReview(source), explanation: "Overall rationale." };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [review] }));
    expect(html.split(review.explanation)).toHaveLength(2);
  });
  it("shows a correct-option explanation that repeats the question explanation only once", () => {
    const review = { ...mapReview(source), explanation: "Because A.", options: [{ label: "A", text: "First", explanation: " Because A. " }, { label: "B", text: "Second", explanation: "B is wrong." }] };
    const html = renderToStaticMarkup(createElement(QuestionReviewList, { review: [review] }));
    expect(html.match(/Because A\./g)).toHaveLength(1);
    expect(html).toContain("B is wrong.");
  });
});
