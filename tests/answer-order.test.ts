import { afterEach, describe, expect, it, vi } from "vitest";
import { answerLabel, createAnswerSnapshot, resolveAnswerOrder, shuffleArray } from "@/lib/questions/answer-order";

afterEach(() => vi.restoreAllMocks());

describe("Fisher-Yates answer order", () => {
  it("returns a shuffled copy without changing source rows", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const source = Object.freeze(["A", "B", "C", "D"]);
    expect(shuffleArray(source)).toEqual(["B", "C", "D", "A"]);
    expect(source).toEqual(["A", "B", "C", "D"]);
  });

  it("retains every item exactly once", () => {
    const source = Array.from({ length: 100 }, (_, i) => i);
    expect(shuffleArray(source).sort((a, b) => a - b)).toEqual(source);
  });

  it("handles empty and one-element arrays", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([1])).toEqual([1]);
  });

  it("assigns contiguous display labels", () => {
    expect([0, 1, 2, 3].map(answerLabel)).toEqual(["A", "B", "C", "D"]);
  });

  it("persists shuffled labels and the correct answer together", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const answers = Object.freeze([
      Object.freeze({ text: "correct", is_correct: true }),
      Object.freeze({ text: "wrong 1", is_correct: false }),
      Object.freeze({ text: "wrong 2", is_correct: false }),
      Object.freeze({ text: "wrong 3", is_correct: false }),
    ]);
    const snapshot = createAnswerSnapshot(answers);
    expect(snapshot).toEqual({
      options: [
        { label: "A", text: "wrong 1" }, { label: "B", text: "wrong 2" },
        { label: "C", text: "wrong 3" }, { label: "D", text: "correct" },
      ],
      correct_label: "D",
    });
    expect(Object.keys(snapshot.options[0])).toEqual(["label", "text"]);
    expect(answers[0].text).toBe("correct");
  });

  it("keeps the correct label matched across varied random draws", () => {
    const answers = [
      { text: "correct", is_correct: true }, { text: "wrong", is_correct: false },
      { text: "also wrong", is_correct: false },
    ];
    for (const random of [0, 0.1, 0.4, 0.7, 0.999]) {
      vi.spyOn(Math, "random").mockReturnValue(random);
      const snapshot = createAnswerSnapshot(answers);
      expect(snapshot.options.find((option) => option.label === snapshot.correct_label)?.text).toBe("correct");
    }
  });

  it("preserves the ported empty-answer fallback", () => {
    expect(createAnswerSnapshot([])).toEqual({ options: [], correct_label: "" });
  });
});

describe("server-owned answer ID validation", () => {
  const answers = [{ id: "first", text: "1" }, { id: "second", text: "2" }];
  it("resolves a valid requested permutation", () => {
    expect(resolveAnswerOrder(answers, ["second", "first"])).toEqual([answers[1], answers[0]]);
  });
  it.each([
    null, "first", ["first"], ["first", "first"], ["first", "missing"], [1, "second"],
  ].map((order) => ({ order })))("rejects invalid order %#", ({ order }) => {
    expect(resolveAnswerOrder(answers, order)).toBeNull();
  });
});
