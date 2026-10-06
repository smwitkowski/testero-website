import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Snapshot of the June 2026 official exam guide. No content-pipeline runtime dependency.
const overview = {
  "guide_url": "https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf",
  "guide_as_of": "2026-06-01",
  "domains": [
    {
      "number": 1,
      "title": "Architecting low-code AI solutions",
      "weight_percent": 13,
      "domain_code": "ARCHITECTING_LOW_CODE_ML_SOLUTIONS"
    },
    {
      "number": 2,
      "title": "Collaborating within and across teams to manage data and models",
      "weight_percent": 16,
      "domain_code": "COLLABORATING_TO_MANAGE_DATA_AND_MODELS"
    },
    {
      "number": 3,
      "title": "Scaling prototypes into ML models",
      "weight_percent": 21,
      "domain_code": "SCALING_PROTOTYPES_INTO_ML_MODELS"
    },
    {
      "number": 4,
      "title": "Serving and scaling models",
      "weight_percent": 20,
      "domain_code": "SERVING_AND_SCALING_MODELS"
    },
    {
      "number": 5,
      "title": "Automating and orchestrating ML pipelines",
      "weight_percent": 18,
      "domain_code": "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES"
    },
    {
      "number": 6,
      "title": "Monitoring AI solutions",
      "weight_percent": 13,
      "domain_code": "MONITORING_ML_SOLUTIONS"
    }
  ],
  "format": {
    "question_count_min": 50,
    "question_count_max": 60,
    "duration_minutes": 120,
    "question_types": [
      "multiple_choice",
      "multiple_select"
    ]
  },
  "weight_note": "Guide weights are approximate and total 101% due to rounding; they are not normalized."
};
const { questions } = JSON.parse(readFileSync(new URL("./data/demo-questions.json", import.meta.url), "utf8"));
const labels = ["A", "B", "C", "D"];
const tokenLifetimeMs = 60 * 60 * 1000;
const maxTokens = 1000;
const diagnostic = "Get a full readiness diagnostic at https://testero.ai/diagnostic";

const reply = (data) => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
  structuredContent: data,
});
const failure = (message) => ({ isError: true, content: [{ type: "text", text: message }] });
const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

function shuffle(options) {
  const result = [...options];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createPracticeServer(tokens) {
  const server = new McpServer({ name: "testero-pmle", version: "0.1.0" });
  server.registerTool("pmle_exam_overview", {
    title: "PMLE exam overview",
    description: "Official June 2026 PMLE guide domains, approximate weights, exam format, and guide link.",
    inputSchema: {}, annotations,
  }, async () => reply(overview));

  server.registerTool("get_practice_question", {
    title: "Get a PMLE practice question",
    description: "Get one of three demo questions with shuffled A–D options and an opaque token. No answers or explanations. Present it and wait for the user's choice before calling check_answer. Domain accepts a guide title, number 1–6, or domain code; demos cover 1, 3, and 6 only. Repeats are possible.",
    inputSchema: { domain: z.string().trim().min(1).optional() },
    annotations: { ...annotations, idempotentHint: false },
  }, async ({ domain }) => {
    let pool = questions;
    if (domain) {
      const key = domain.toLowerCase();
      const selected = overview.domains.find((item) =>
        [String(item.number), item.title.toLowerCase(), item.domain_code.toLowerCase()].includes(key));
      if (!selected) return failure("Unknown domain. Call pmle_exam_overview for guide titles, numbers, and domain codes.");
      pool = questions.filter((question) => question.domain_code === selected.domain_code);
      if (!pool.length) return failure("No demo questions are available for that domain. This prototype covers domains 1, 3, and 6 only. Choose one of those domains or omit domain.");
    }
    const now = Date.now();
    for (const [token, entry] of tokens) {
      if (entry.expiresAt <= now) tokens.delete(token);
    }
    if (tokens.size >= maxTokens) tokens.delete(tokens.keys().next().value);
    const question = pool[randomInt(pool.length)];
    const options = shuffle(question.options);
    const question_token = randomUUID();
    // Keep the original options and answer flags only on the server.
    tokens.set(question_token, { options, expiresAt: now + tokenLifetimeMs });
    return reply({
      question_token,
      domain: overview.domains.find((item) => item.domain_code === question.domain_code).title,
      stem: question.stem,
      options: options.map((option, i) => ({ label: labels[i], text: option.text })),
    });
  });

  server.registerTool("check_answer", {
    title: "Check a PMLE practice answer",
    description: "After the user chooses A–D, grade the token's shuffled options and return chosen/correct explanations with official documentation links and quotes. Tokens expire after one hour or a server restart.",
    inputSchema: { question_token: z.string().uuid(), choice: z.enum(labels) },
    annotations: { ...annotations, idempotentHint: true },
  }, async ({ question_token, choice }) => {
    const entry = tokens.get(question_token);
    if (!entry || entry.expiresAt <= Date.now()) {
      tokens.delete(question_token);
      return failure("Unknown or expired question token. Get a new practice question and ask for the user's answer again.");
    }
    const chosenIndex = labels.indexOf(choice);
    const correctIndex = entry.options.findIndex((option) => option.correct);
    const describe = (index) => {
      const option = entry.options[index];
      return { label: labels[index], text: option.text, explanation: option.explanation,
        doc_url: option.doc_url, doc_quote: option.doc_quote };
    };
    return reply({ correct: chosenIndex === correctIndex,
      chosen_option: describe(chosenIndex), correct_option: describe(correctIndex), diagnostic });
  });
  return server;
}

export function createHttpServer() {
  // Stateless HTTP transports share this bounded, server-local practice token store.
  const tokens = new Map();
  return createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (pathname === "/mcp") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version");
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "content-type, mcp-session-id, mcp-protocol-version, last-event-id, authorization",
        }).end();
        return;
      }
      if (["POST", "GET", "DELETE"].includes(req.method)) {
        const server = createPracticeServer(tokens);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, enableJsonResponse: true,
        });
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        try {
          await server.connect(transport);
          await transport.handleRequest(req, res);
        } catch {
          // Never log question tokens or request bodies.
          if (!res.headersSent) res.writeHead(500).end("Internal server error");
        }
        return;
      }
      res.writeHead(405, { Allow: "POST, GET, DELETE, OPTIONS" }).end("Method Not Allowed");
      return;
    }
    if (req.method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("Testero PMLE prototype MCP server");
      return;
    }
    // No OAuth or other routes in this unauthenticated prototype.
    res.writeHead(404).end("Not Found");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be an integer from 0 to 65535");
  const httpServer = createHttpServer();
  httpServer.listen(port, "127.0.0.1", () => {
    console.log(`Testero MCP server listening on http://localhost:${httpServer.address().port}/mcp`);
  });
}
