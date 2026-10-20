import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const modulePath = "../scripts/chatgpt/transcript.mjs";
const { redactMcpStructure, publicMcpTranscript } = await import(modulePath);

describe("public MCP transcript redaction", () => {
  const question = { question_id: "private-question-identifier", stem: "SENTINEL private question stem", correct_option: "B",
    selected_label: "A", is_correct: false,
    options: [{ label: "A", text: "SENTINEL option text", explanation: "SENTINEL full explanation" }] };
  it("redacts all content, identifiers and labels recursively, including serialized MCP text", () => {
    const redacted = publicMcpTranscript({ exchanges: [{ method: "POST", status: 200, request: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_answer", arguments: { question_id: question.question_id, selected_label: "A" } } },
      response: { result: { content: [{ type: "text", text: JSON.stringify(question) }], structuredContent: question } } }] });
    const encoded = JSON.stringify(redacted);
    expect(encoded).not.toContain("SENTINEL"); expect(encoded).not.toContain(question.question_id);
    const result = redacted.exchanges[0].response.result;
    expect(result.structuredContent.correct_option).toBe("[redacted string]");
    expect(result.structuredContent.options[0].label).toBe("[redacted string]");
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    expect(result.structuredContent.is_correct).toBe(false);
    expect(redacted.exchanges[0].request.method).toBe("tools/call");
    expect(redacted.exchanges[0].request.params.name).toBe("check_answer");
  });
  it("redacts arbitrary property names including nested serialized content", () => {
    const body = { SENTINEL_PRIVATE_PROPERTY: "private value", options: [{ SENTINEL_NESTED_PROPERTY: "private option" }] };
    const value = redactMcpStructure({ structuredContent: body, content: [{ type: "text", text: JSON.stringify(body) }] });
    expect(JSON.stringify(value)).not.toContain("SENTINEL");
    expect(JSON.parse(value.content[0].text)).toEqual(value.structuredContent);
    expect(redactMcpStructure(value)).toEqual(value);
  });
  it("preserves only safe protocol/evidence strings and structural values", () => {
    expect(redactMcpStructure({ protocolVersion: "2025-11-25", name: "SENTINEL hostile name", type: "text", max: 40, error: null, is_correct: true }))
      .toEqual({ protocolVersion: "2025-11-25", name: "[redacted string]", type: "text", max: 40, error: null, is_correct: true });
  });
  it("keeps committed evidence structure-only with no unredacted result strings", () => {
    const transcript = JSON.parse(readFileSync("docs/chatgpt-mcp-smoke-transcript.json", "utf8"));
    expect(transcript.redaction.scope).toContain("Structure");
    for (const exchange of transcript.exchanges) {
      if (!exchange.response) continue;
      expect(redactMcpStructure(exchange.response)).toEqual(exchange.response);
    }
  });
});
