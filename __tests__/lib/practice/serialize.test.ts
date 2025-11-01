/** @jest-environment node */
import { serializeQuestion } from "@/lib/practice/serialize";

describe("serializeQuestion", () => {
  it("converts question and option IDs to strings", () => {
    const question = { id: 123, stem: "Test question?" };
    const options = [
      { id: 1, label: "A", text: "Option A" },
      { id: 2, label: "B", text: "Option B" },
    ];

    const result = serializeQuestion(question, options);

    expect(result.id).toBe("123");
    expect(typeof result.id).toBe("string");
    expect(result.question_text).toBe("Test question?");
    expect(result.options).toHaveLength(2);
    expect(result.options[0].id).toBe("1");
    expect(typeof result.options[0].id).toBe("string");
    expect(result.options[1].id).toBe("2");
    expect(typeof result.options[1].id).toBe("string");
  });

  it("handles bigint IDs", () => {
    const question = { id: BigInt("9007199254740992"), stem: "Big int question?" };
    const options = [{ id: BigInt("9007199254740993"), label: "A", text: "Option A" }];

    const result = serializeQuestion(question, options);

    expect(result.id).toBe("9007199254740992");
    expect(result.options[0].id).toBe("9007199254740993");
  });

  it("handles empty options array", () => {
    const question = { id: 456, stem: "No options?" };
    const options: Array<{ id: unknown; label: string; text: string }> = [];

    const result = serializeQuestion(question, options);

    expect(result.id).toBe("456");
    expect(result.options).toEqual([]);
  });

  it("handles null/undefined options gracefully", () => {
    const question = { id: 789, stem: "Null options?" };
    const options = null as unknown as Array<{ id: unknown; label: string; text: string }>;

    const result = serializeQuestion(question, options);

    expect(result.id).toBe("789");
    expect(result.options).toEqual([]);
  });
});

