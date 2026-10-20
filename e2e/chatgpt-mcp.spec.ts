import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("ChatGPT MCP SDK client smoke on the local QA server", async ({}, info) => {
  test.skip(process.env.TESTERO_QA !== "1" || info.project.name !== "qa-1280", "Recorded once through npm run qa:local");
  test.setTimeout(120_000);
  // Official client verifies real responses in memory; saved evidence redacts all question content.
  // @ts-expect-error Standalone Node utility intentionally has no TypeScript declaration.
  const { runChatgptSmoke } = await import("../scripts/chatgpt/smoke.mjs");
  const transcript = await runChatgptSmoke(new URL("/api/mcp", info.project.use.baseURL).href);
  expect(transcript.authenticated).toBe(false);
  await writeFile(".qa/chatgpt-mcp-smoke.json", JSON.stringify(transcript, null, 2) + "\n");
  console.log(`MCP smoke PASS: ${transcript.protocol_version}, ${transcript.exchanges.length} HTTP exchanges`);
});
