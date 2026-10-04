/** @jest-environment node */
import { answerLabel, createAnswerSnapshot, resolveAnswerOrder, shuffleArray } from "@/lib/questions/answer-order";
import { serializeQuestion } from "@/lib/practice/serialize";

const answers = [
  { id: "correct", text: "Correct", is_correct: true },
  { id: "wrong-1", text: "Wrong 1", is_correct: false },
  { id: "wrong-2", text: "Wrong 2", is_correct: false },
  { id: "wrong-3", text: "Wrong 3", is_correct: false },
];

afterEach(() => jest.restoreAllMocks());

describe("answer ordering", () => {
  it("uses Fisher-Yates without changing the source rows", () => {
    const random = jest.spyOn(Math, "random").mockReturnValue(0);
    const original = JSON.stringify(answers);
    expect(shuffleArray(answers).map((a) => a.id)).toEqual(["wrong-1", "wrong-2", "wrong-3", "correct"]);
    expect(random).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(answers)).toBe(original);
    expect(shuffleArray([])).toEqual([]);
  });

  it("persists positional labels and moves correctness with answer text", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    const first = createAnswerSnapshot(answers);
    expect(first.options.map((a) => a.label)).toEqual(["A", "B", "C", "D"]);
    expect(first.correct_label).toBe("D");
    expect(first.options.find((a) => a.label === first.correct_label)?.text).toBe("Correct");
    expect(first.options.every((a) => !("is_correct" in a))).toBe(true);
    jest.mocked(Math.random).mockReturnValue(0.999);
    const second = createAnswerSnapshot(answers);
    expect(second.correct_label).toBe("A");
    expect(second.options).not.toEqual(first.options);
    // Creating another session does not alter an existing snapshot.
    expect(first.correct_label).toBe("D");
  });

  it("keeps every answer and supports empty/single and E/F option sets", () => {
    expect(createAnswerSnapshot([])).toEqual({ options: [], correct_label: "" });
    expect(createAnswerSnapshot([answers[0]])).toEqual({ options: [{ label: "A", text: "Correct" }], correct_label: "A" });
    expect(answerLabel(5)).toBe("F");
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    expect(createAnswerSnapshot(answers).options.map((a) => a.text).sort()).toEqual(answers.map((a) => a.text).sort());
  });

  it("serializes shuffled standalone answers as A/B/C/D with stable IDs", () => {
    const serialized = serializeQuestion({ id: "q", stem: "Question" }, [
      { id: "b", choice_label: "B", choice_text: "B text" },
      { id: "a", choice_label: "A", choice_text: "A text" },
    ]);
    expect(serialized.options).toEqual([
      { id: "b", label: "A", text: "B text" },
      { id: "a", label: "B", text: "A text" },
    ]);
  });

  it("resolves only complete, unique permutations of server-owned IDs", () => {
    expect(resolveAnswerOrder(answers, ["wrong-1", "correct", "wrong-3", "wrong-2"])?.map((a) => a.id))
      .toEqual(["wrong-1", "correct", "wrong-3", "wrong-2"]);
    for (const invalid of [null, [], ["correct"], ["correct", "correct", "wrong-2", "wrong-3"],
      ["foreign", "wrong-1", "wrong-2", "wrong-3"], [1, "wrong-1", "wrong-2", "wrong-3"]]) {
      expect(resolveAnswerOrder(answers, invalid)).toBeNull();
    }
  });
});
