import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPaidExplanations, addPaidReview } from "@/lib/billing/explanations";
import { mapReview } from "@/lib/diagnostic/types";
const questionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item = { id: "item", question_id: questionId, options: [{ label: "A", text: "Wrong" }, { label: "B", text: "Correct" }] };
const answers = [{ question_id: questionId, choice_text: "Correct", explanation_text: "Why correct", doc_links: "secret" }, { question_id: questionId, choice_text: "Wrong", explanation_text: "Why wrong", source_ref: "secret" }];
const explanations = [{ question_id: questionId, explanation_text: "Whole question", doc_links: "secret" }];
function db(answerRows: unknown = answers, explanationRows: unknown = explanations, errorTable?: string, thrown = false) {
  const from = vi.fn((table: string) => {
    if (thrown) throw new Error("secret");
    const query = { select: vi.fn(() => query), in: vi.fn(async () => ({ data: table === "answers" ? answerRows : explanationRows, error: table === errorTable ? { message: "secret" } : null })) };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from };
}
describe("server-only explanation whitelist and shuffled snapshot mapping", () => {
  it("maps exact text to shuffled labels, never canonical labels; bulk reads once", async () => {
    const database = db(); const result = await loadPaidExplanations(database.client, [item, { ...item, id: "second" }]);
    expect(result.get("item")).toEqual({ explanation: "Whole question", optionExplanations: [{ label: "A", text: "Wrong", explanation: "Why wrong" }, { label: "B", text: "Correct", explanation: "Why correct" }] });
    expect(result.get("second")).toEqual(result.get("item"));
    expect(database.from.mock.calls).toEqual([["answers"], ["explanations"]]);
    expect(database.from.mock.results[0].value.in).toHaveBeenCalledWith("question_id", [questionId]);
    expect(database.from.mock.results[0].value.select).toHaveBeenCalledWith("question_id,choice_text,explanation_text");
    expect(database.from.mock.results[1].value.select).toHaveBeenCalledWith("question_id,explanation_text");
    const review = addPaidReview(mapReview({ ...item, ordinal: 1, stem: "Stem", selected_label: "A", correct_label: "B", is_correct: false, domain_code: "A", domain_name: "Domain" }), result.get(item.id));
    expect(review.options[0]).toEqual({ label: "A", text: "Wrong", explanation: "Why wrong" });
    expect(JSON.stringify(review)).not.toMatch(/question_id|doc_links|source_ref|secret/);
  });
  it.each([[], answers.slice(0, 1), [...answers, answers[0]], [answers[0], { ...answers[1], choice_text: "Correct" }], [answers[0], { ...answers[1], choice_text: "Changed" }]].map(rows => ({ rows })))("missing/changed/ambiguous canonical text redacts entire item %#", async ({ rows }) => {
    expect((await loadPaidExplanations(db(rows).client, [item])).size).toBe(0);
  });
  it.each([[{ label: "A", text: "Wrong" }, { label: "B", text: "Wrong" }], [{ label: "A", text: "Wrong" }, { label: "A", text: "Correct" }], [{ label: "A", text: "Wrong " }, { label: "B", text: "Correct" }]].map(options => ({ options })))("ambiguous/changed snapshot redacts entire item %#", async ({ options }) => {
    expect((await loadPaidExplanations(db().client, [{ ...item, options }])).size).toBe(0);
  });
  it("duplicate whole-question explanations redact", async () => { expect((await loadPaidExplanations(db(answers, [...explanations, ...explanations]).client, [item])).size).toBe(0); });
  it("does not expose blank or nonstring explanation values", async () => {
    expect((await loadPaidExplanations(db([{ ...answers[0], explanation_text: " " }, { ...answers[1], explanation_text: 123 }], [{ question_id: questionId, explanation_text: {} }]).client, [item])).size).toBe(0);
  });
  it.each(["answers", "explanations"])("any source error redacts %s", async table => { expect((await loadPaidExplanations(db(answers, explanations, table).client, [item])).size).toBe(0); });
  it.each([null, {}])("malformed lookup data redacts %#", async data => { expect((await loadPaidExplanations(db(data).client, [item])).size).toBe(0); expect((await loadPaidExplanations(db(answers, data).client, [item])).size).toBe(0); });
  it("throws no SDK errors and makes no bank request for missing trusted ids", async () => {
    expect((await loadPaidExplanations(db(answers, explanations, undefined, true).client, [item])).size).toBe(0);
    const database = db(); expect((await loadPaidExplanations(database.client, [{ ...item, question_id: undefined }, { ...item, question_id: "bad" }])).size).toBe(0); expect(database.from).not.toHaveBeenCalled();
  });
});
