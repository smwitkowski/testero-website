import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { redactMcpStructure, publicMcpTranscript } from "./transcript.mjs";

/** Real SDK client against the loopback Next server started by npm run qa:local. */
export async function runChatgptSmoke(endpoint = "http://127.0.0.1:3000/api/mcp") {
  const url = new URL(endpoint);
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && url.protocol === "http:" && url.pathname === "/api/mcp");
  const exchanges = [];
  const transport = new StreamableHTTPClientTransport(url, { fetch: async (input, init) => {
    const request = new Request(input, init);
    // Suppress analytics exactly like other local automation. Do not record headers/cookies/IPs.
    request.headers.set("User-Agent", "Testero Playwright MCP smoke");
    const requestText = request.method === "POST" ? await request.clone().text() : "";
    const response = await fetch(request);
    const responseText = await response.clone().text();
    exchanges.push({ method: request.method, request: requestText ? redactMcpStructure(JSON.parse(requestText)) : null,
      status: response.status, response: responseText ? redactMcpStructure(JSON.parse(responseText)) : null });
    return response;
  } });
  const client = new Client({ name: "testero-local-mcp-smoke", version: "1.0.0" });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ["check_answer", "get_practice_question", "list_practice_domains", "pmle_exam_overview"]);
    async function call(name, args = {}) {
      const output = await client.callTool({ name, arguments: args });
      assert(!output.isError);
      return output.structuredContent;
    }
    const overview = await call("pmle_exam_overview");
    assert.equal(overview.domains.length, 6);
    const inventory = await call("list_practice_domains");
    assert.equal(inventory.total_questions, 40);
    assert.equal(inventory.available_questions, 40);
    assert.equal(inventory.domains.reduce((total, domain) => total + domain.question_count, 0), 40);
    for (const domain of inventory.domains) {
      const question = await call("get_practice_question", { domain: domain.domain });
      assert.equal(question.domain, domain.domain);
      assert(question.options.every(option => Object.keys(option).sort().join(",") === "label,text"));
      const answer = await call("check_answer", { question_id: question.question_id, selected_label: "A" });
      assert.equal(answer.options.length, 4);
      assert(answer.options.every(option => option.explanation.length > 0));
      assert.equal(answer.is_correct, answer.correct_option === "A");
      const other = ["A", "B", "C", "D"].find(label => label !== answer.correct_option);
      const incorrect = await call("check_answer", { question_id: question.question_id, selected_label: other });
      assert.equal(incorrect.is_correct, false);
    }
    const rejected = await client.callTool({ name: "check_answer", arguments: { question_id: "00000000-0000-4000-8000-000000000000", selected_label: "A" } });
    assert.equal(rejected.isError, true);
    const challenge = await fetch(new URL("/.well-known/openai-apps-challenge", url));
    assert.equal(challenge.status, 404);
    const initialize = exchanges.find(item => item.request?.method === "initialize");
    const transcript = { recorded_at: new Date().toISOString(), command: process.env.TESTERO_QA_MCP === "1" ? "npm run qa:local -- --mcp-smoke" : "npm run qa:local", endpoint: url.href,
      client: "@modelcontextprotocol/sdk", protocol_version: initialize.response.result.protocolVersion,
      authenticated: false, production_writes: false, challenge_unset_status: challenge.status, exchanges };
    return publicMcpTranscript(transcript);
  } finally { await client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const transcript = await runChatgptSmoke();
  const output = new URL("../../.qa/chatgpt-mcp-smoke.json", import.meta.url);
  await writeFile(output, JSON.stringify(transcript, null, 2) + "\n");
  console.log(`MCP smoke PASS; negotiated ${transcript.protocol_version}; ${transcript.exchanges.length} HTTP exchanges; transcript .qa/chatgpt-mcp-smoke.json`);
}
