import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import freeSet from "@/lib/chatgpt/free-set.json";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { getCertification } from "@/lib/certifications/data";

const analytics = vi.hoisted(() => ({ schedule: vi.fn() }));
const rng = vi.hoisted(() => ({ randomInt: vi.fn() }));
vi.mock("node:crypto", async importOriginal => ({ ...await importOriginal<typeof import("node:crypto")>(), randomInt: rng.randomInt }));
vi.mock("@/lib/chatgpt/analytics", () => ({ scheduleChatgptEvent: analytics.schedule }));

// Authored synthetic fixtures only. The checked-in selection supplies IDs, never content.
const fixtureQuestions = freeSet.question_ids.map((id, index) => {
  const domainIndex = index < 5 ? 0 : index < 11 ? 1 : index < 19 ? 2 : index < 27 ? 3 : index < 34 ? 4 : 5;
  return { id, exam: "GCP_PM_ML_ENG", question_type: "single_select", status: "ACTIVE", review_status: "GOOD", parent_question_id: null,
    domain: PMLE_BLUEPRINT[domainIndex].domainCode, stem: `Synthetic practice scenario ${index}: choose the designated test response.`,
    options: (["A", "B", "C", "D"] as const).map((label, optionIndex) => ({ label,
      text: `Synthetic response ${label} for scenario ${index}.`, is_correct: optionIndex === index % 4,
      explanation: `Synthetic explanation for response ${label} in scenario ${index}; this is test-authored content.`,
    })),
  };
});
const fixtureRows = fixtureQuestions.map(question => ({ ...question, exam_domains: { code: question.domain },
  answers: question.options.map(option => ({ choice_label: option.label, choice_text: option.text,
    is_correct: option.is_correct, explanation_text: option.explanation })),
}));
const additionalExamId = "data-engineer";
const additionalRows = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"].map((id, index) => ({
  id, exam: additionalExamId, question_type: "single_select", status: "ACTIVE", review_status: "GOOD", parent_question_id: null,
  stem: `Synthetic data practice scenario ${index}: select the designated response.`,
  exam_domains: { code: `data-engineer:standard:${index + 1}` },
  answers: (["A", "B", "C", "D"] as const).map((label, optionIndex) => ({
    choice_label: label, choice_text: `Synthetic data response ${label} for scenario ${index}.`,
    is_correct: optionIndex === index + 1,
    explanation_text: `Synthetic data explanation for response ${label} in scenario ${index}.`,
  })),
}));
const syntheticSource = { kind: "local-export", upstream: "read-only-database-content-export",
  exported_at: "2026-10-22T00:00:00.000Z", export_sha256: "0".repeat(64), blueprint_sha256: "0".repeat(64), selection: "synthetic-test" };
const additionalSets = { [additionalExamId]: { version: 1, source: syntheticSource, question_ids: additionalRows.map(row => row.id) } };
const database = vi.hoisted(() => ({ create: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: database.create }));

type JsonObject = Record<string, unknown>;
type RpcResponse = { jsonrpc: string; id: number; result?: JsonObject; error?: { code: number; message: string } };
type ToolResult = { isError?: boolean; content: { type: string; text?: string }[]; structuredContent?: JsonObject };
let route: typeof import("@/app/api/mcp/route");
let nextId = 0;
let nextAddress = 0;
function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://testero.ai/api/mcp", { method: "POST", headers: {
    "Content-Type": "application/json", Accept: "application/json, text/event-stream",
    "x-forwarded-for": `198.51.${Math.floor(++nextAddress / 250)}.${nextAddress % 250}`, ...headers,
  }, body });
}
async function rpc(method: string, params: JsonObject = {}, headers: Record<string, string> = {}) {
  const id = ++nextId;
  const response = await route.POST(request(JSON.stringify({ jsonrpc: "2.0", id, method, params }), headers));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("mcp-session-id")).toBeNull();
  const message = await response.json() as RpcResponse;
  expect(message).toMatchObject({ jsonrpc: "2.0", id });
  return message;
}
async function call(name: string, args: JsonObject = {}) {
  const message = await rpc("tools/call", { name, arguments: args });
  expect(message.error).toBeUndefined();
  return message.result as unknown as ToolResult;
}
function data(result: ToolResult) {
  expect(result.isError).not.toBe(true);
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe("text");
  const value = JSON.parse(result.content[0].text!) as JsonObject;
  if (result.structuredContent) expect(result.structuredContent).toEqual(value);
  return value;
}
function policy(value: unknown) {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toMatch(/\$\s*\d|\b(?:USD|price|pricing|purchase|checkout|upsell|subscribe)\b|\b(?:buy|upgrade|unlock) (?:now|access|full)|PMLE Pass|https?:[^"\s]*\/(?:pricing|checkout|pass)(?:[/?"\s]|$)/i);
}
function outputPolicy(value: JsonObject) {
  policy(value);
  expect(JSON.stringify(value)).toMatch(/independent, not affiliated with Google/i);
  const links = JSON.stringify(value).match(/https?:\/\/[^"\s<>]+/g) ?? [];
  expect(links.length).toBeLessThanOrEqual(1);
  for (const link of links) {
    const url = new URL(link);
    expect(url.origin).toBe("https://testero.ai");
    expect(["/diagnostic", "/certifications/machine-learning-engineer"]).toContain(url.pathname);
    expect([...url.searchParams.entries()].sort()).toEqual([["utm_campaign", "mcp"], ["utm_medium", "app"], ["utm_source", "chatgpt"]]);
    expect(url.hash).toBe("");
  }
}

function overviewSources(value: JsonObject, certId: string) {
  const cert = getCertification(certId)!;
  const guide = cert.guides.find(item => item.variant === "standard")!;
  const latest = (role: string, url?: string) => cert.sources
    .filter(source => source.role === role && (url === undefined || source.url === url))
    .map(source => source.retrieved_at).sort().at(-1) ?? null;
  expect(value.guide_as_of).toBe(guide.as_of_date);
  expect(value.guide_retrieved_at).toBe(latest("exam_guide", guide.url));
  expect(value.certification_page_retrieved_at).toBe(latest("certification"));
  expect(value.recommended_experience_retrieved_at).toBe(latest("recommended_experience"));
  expect(value).not.toHaveProperty("source_checked_at");
}

beforeEach(async () => {
  vi.stubEnv("CHATGPT_EXAMS", undefined);
  vi.doUnmock("@/lib/chatgpt/free-sets.json");
  vi.resetModules();
  analytics.schedule.mockReset();
  rng.randomInt.mockReset().mockReturnValue(0);
  database.create.mockReset();
  database.read.mockReset().mockResolvedValue({ data: structuredClone(fixtureRows), error: null });
  database.create.mockImplementation(() => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query),
      in: vi.fn(() => database.read()),
    };
    return { from: vi.fn(() => query) };
  });
  route = await import("@/app/api/mcp/route");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("ChatGPT MCP tools over real Streamable HTTP JSON-RPC", () => {
  it("initializes without auth or a session and supports independent later requests", async () => {
    const initialized = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "testero-policy-test", version: "1.0" } });
    expect(initialized.error).toBeUndefined();
    expect(initialized.result).toHaveProperty("protocolVersion");
    const listed = await rpc("tools/list");
    expect(listed.error).toBeUndefined();
    expect((listed.result!.tools as JsonObject[])).toHaveLength(4);
  });

  it("advertises exactly four accurate read-only noauth tools with conservative annotations", async () => {
    const message = await rpc("tools/list");
    const tools = message.result!.tools as JsonObject[];
    expect(tools.map(tool => tool.name).sort()).toEqual(["check_answer", "exam_overview", "get_practice_question", "list_practice_domains"]);
    for (const tool of tools) {
      policy(tool);
      expect(tool.description).toEqual(expect.any(String));
      expect((tool.description as string).length).toBeGreaterThan(20);
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: tool.name !== "get_practice_question" });
      expect(tool._meta).toMatchObject({ securitySchemes: [{ type: "noauth" }] });
      if (tool.securitySchemes) expect(tool.securitySchemes).toEqual([{ type: "noauth" }]);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });

  it("advertises a gated optional exam enum with the PMLE default only on the first three tools", async () => {
    const tools = (await rpc("tools/list")).result!.tools as JsonObject[];
    for (const tool of tools) {
      const schema = tool.inputSchema as { properties: Record<string, JsonObject>; required?: string[]; additionalProperties?: boolean };
      expect(schema.additionalProperties).toBe(false);
      if (tool.name === "check_answer") {
        expect(Object.keys(schema.properties).sort()).toEqual(["question_id", "selected_label"]);
        expect(schema.required?.sort()).toEqual(["question_id", "selected_label"]);
      } else {
        expect(schema.properties.exam).toMatchObject({ type: "string", enum: ["GCP_PM_ML_ENG"], default: "GCP_PM_ML_ENG" });
        expect(schema.required ?? []).not.toContain("exam");
      }
    }
  });

  it.each(["exam_overview", "list_practice_domains", "get_practice_question"])("defaults %s to PMLE and accepts its explicit enabled ID", async name => {
    const implicit = data(await call(name));
    const explicit = data(await call(name, { exam: "GCP_PM_ML_ENG" }));
    expect(implicit.exam_id).toBe("GCP_PM_ML_ENG");
    expect(explicit).toEqual(implicit);
  });

  it.each(["exam_overview", "list_practice_domains", "get_practice_question"])("rejects unknown and disabled exam values on %s with available IDs", async name => {
    for (const exam of ["unknown-exam", additionalExamId, "", "gcp_pm_ml_eng", 1, null]) {
      const result = await call(name, { exam });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/Available exams: GCP_PM_ML_ENG/);
      expect(database.create).not.toHaveBeenCalled();
      expect(analytics.schedule).not.toHaveBeenCalled();
      policy(result);
    }
  });

  it("returns policy-safe overview and all six current blueprint domains", async () => {
    const overview = data(await call("exam_overview"));
    const domains = data(await call("list_practice_domains"));
    outputPolicy(overview); outputPolicy(domains);
    expect(overview).toMatchObject({ exam_id: "GCP_PM_ML_ENG", exam: "Professional Machine Learning Engineer" });
    overviewSources(overview, "machine-learning-engineer");
    expect(domains.exam_id).toBe("GCP_PM_ML_ENG");
    for (const domain of PMLE_BLUEPRINT) {
      expect(JSON.stringify(domains)).toContain(domain.domainCode);
      expect(JSON.stringify(domains)).toContain(domain.displayName);
    }
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("serves only an allowlisted database question and strips the answer key and all explanations", async () => {
    const question = data(await call("get_practice_question"));
    const original = fixtureQuestions.find(item => item.id === question.question_id)!;
    expect(original).toBeDefined();
    expect(question).toMatchObject({ exam_id: "GCP_PM_ML_ENG", question_id: original.id, domain: original.domain, stem: original.stem,
      options: original.options.map(({ label, text }) => ({ label, text })),
    });
    expect(JSON.stringify(question)).not.toMatch(/"(?:is_correct|correct_option|explanation|parent_question_id)"\s*:/);
    expect((question.options as JsonObject[]).map(option => Object.keys(option).sort())).toEqual(original.options.map(() => ["label", "text"]));
    outputPolicy(question);
    expect(analytics.schedule).toHaveBeenCalledOnce();
    expect(analytics.schedule).toHaveBeenCalledWith(expect.any(Request), "chatgpt_question_served", "GCP_PM_ML_ENG", original.domain);
  });

  it.each(PMLE_BLUEPRINT.map((domain, index) => ({ ...domain, number: String(index + 1) })))("accepts only exact code, title or number for $domainCode", async domain => {
    for (const selector of [domain.domainCode, domain.displayName, domain.number]) {
      const question = data(await call("get_practice_question", { domain: selector }));
      expect(question.domain).toBe(domain.domainCode);
      expect(fixtureQuestions.some(item => item.id === question.question_id && item.domain === domain.domainCode)).toBe(true);
      outputPolicy(question);
    }
  });

  it("enumerates every random position across mixed and domain-specific pools without key leaks", async () => {
    const served = new Set<string>();
    const pools = [{ domain: undefined, questions: fixtureQuestions }, ...PMLE_BLUEPRINT.map(domain => ({
      domain: domain.domainCode, questions: fixtureQuestions.filter(question => question.domain === domain.domainCode),
    }))];
    for (const pool of pools) {
      for (const [index, original] of pool.questions.entries()) {
        rng.randomInt.mockReturnValueOnce(index);
        const question = data(await call("get_practice_question", pool.domain ? { domain: pool.domain } : {}));
        expect(rng.randomInt).toHaveBeenLastCalledWith(pool.questions.length);
        expect(question).toEqual({ exam_id: "GCP_PM_ML_ENG", question_id: original.id, domain: original.domain, stem: original.stem,
          options: original.options.map(({ label, text }) => ({ label, text })), disclaimer: expect.any(String),
        });
        expect(JSON.stringify(question)).not.toMatch(/"(?:is_correct|correct_option|explanation|parent_question_id)"\s*:/);
        outputPolicy(question);
        served.add(question.question_id as string);
      }
    }
    expect([...served].sort()).toEqual(fixtureQuestions.map(question => question.id).sort());
    expect(analytics.schedule).toHaveBeenCalledTimes(80);
  });

  it("checks every option of all 40 questions with the full original explanations", async () => {
    for (const question of fixtureQuestions) {
      const correctOption = question.options.find(option => option.is_correct)!;
      for (const selected of question.options) {
        const result = data(await call("check_answer", { question_id: question.id, selected_label: selected.label }));
        expect(result.exam_id).toBe("GCP_PM_ML_ENG");
        expect(result.is_correct).toBe(selected.is_correct);
        expect(result.correct_option).toBe(correctOption.label);
        expect(result.options).toEqual(question.options.map(({ label, text, explanation }) => ({ label, text, explanation })));
        outputPolicy(result);
        expect(analytics.schedule).toHaveBeenLastCalledWith(expect.any(Request), "chatgpt_answer_checked", "GCP_PM_ML_ENG", question.domain, selected.is_correct);
      }
    }
    expect(analytics.schedule).toHaveBeenCalledTimes(160);
  });

  it.each([
    ["exam_overview", { irrelevant: "private-value" }],
    ["list_practice_domains", { irrelevant: "private-value" }],
    ["get_practice_question", { domain: PMLE_BLUEPRINT[0].domainCode, question_id: "private-value" }],
    ["get_practice_question", { domain: "7" }],
    ["get_practice_question", { domain: "0" }],
    ["get_practice_question", { domain: "ML" }],
    ["get_practice_question", { domain: "" }],
    ["get_practice_question", { domain: 1 }],
    ["check_answer", {}],
    ["check_answer", { question_id: fixtureQuestions[0].id, selected_label: "A", exam: "GCP_PM_ML_ENG" }],
    ["check_answer", { question_id: additionalRows[0].id, selected_label: "B" }],
    ["check_answer", { question_id: "not-a-uuid", selected_label: "A" }],
    ["check_answer", { question_id: "00000000-0000-4000-8000-000000000000", selected_label: "A" }],
    ["check_answer", { question_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selected_label: "A" }],
    ["check_answer", { question_id: "../../private", selected_label: "A" }],
    ["check_answer", { question_id: fixtureQuestions[0].id, selected_label: "E" }],
    ["check_answer", { question_id: fixtureQuestions[0].id, selected_label: "a" }],
    ["check_answer", { question_id: fixtureQuestions[0].id, selected_label: 1 }],
    ["unknown_tool", {}],
  ] as const)("rejects %s invalid input %j without serving bank content or analytics", async (name, args) => {
    const message = await rpc("tools/call", { name, arguments: args });
    expect(Boolean(message.error) || message.result?.isError === true).toBe(true);
    policy(message);
    const serialized = JSON.stringify(message);
    for (const question of fixtureQuestions) expect(serialized).not.toContain(question.stem);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });
});

describe("MCP enabled exam isolation with synthetic additional sets", () => {
  async function configure(exams = "GCP_PM_ML_ENG,data-engineer", sets = additionalSets) {
    vi.stubEnv("CHATGPT_EXAMS", exams);
    vi.doMock("@/lib/chatgpt/free-sets.json", () => ({ default: sets }));
    vi.resetModules();
    database.read.mockResolvedValue({ data: structuredClone([...fixtureRows, ...additionalRows]), error: null });
    route = await import("@/app/api/mcp/route");
  }

  it("advertises exactly the configured exams without changing check_answer inputs", async () => {
    await configure();
    const tools = (await rpc("tools/list")).result!.tools as JsonObject[];
    for (const tool of tools) {
      const schema = tool.inputSchema as { properties: Record<string, JsonObject>; required?: string[] };
      if (tool.name === "check_answer") {
        expect(Object.keys(schema.properties).sort()).toEqual(["question_id", "selected_label"]);
      } else {
        expect(schema.properties.exam).toMatchObject({ enum: ["GCP_PM_ML_ENG", additionalExamId], default: "GCP_PM_ML_ENG" });
        expect(schema.required ?? []).not.toContain("exam");
      }
    }
  });

  it("returns each exam's own facts, domains and selection count with no cross-exam leakage", async () => {
    await configure();
    const overview = data(await call("exam_overview", { exam: additionalExamId }));
    expect(overview).toMatchObject({ exam_id: additionalExamId, exam: "Professional Data Engineer", duration_minutes: 120,
      question_count: { min: 40, max: 50, approximate: false }, available_questions: 2, practice_selection_size: 2,
      guide_as_of: null });
    overviewSources(overview, additionalExamId);
    const listed = data(await call("list_practice_domains", { exam: additionalExamId }));
    expect(listed).toMatchObject({ exam_id: additionalExamId, total_questions: 2, available_questions: 2 });
    const domains = listed.domains as JsonObject[];
    expect(domains).toHaveLength(5);
    expect(domains[0]).toMatchObject({ domain: "data-engineer:standard:1", title: "Designing data processing systems", question_count: 1 });
    expect(domains[1].question_count).toBe(1);
    expect(domains.slice(2).every(domain => domain.question_count === 0)).toBe(true);
    expect(domains.reduce((sum, domain) => sum + Number(domain.sampling_weight), 0)).toBeCloseTo(1);
    expect(JSON.stringify(listed)).not.toContain(PMLE_BLUEPRINT[0].domainCode);
    const pmle = data(await call("list_practice_domains"));
    expect(pmle).toMatchObject({ exam_id: "GCP_PM_ML_ENG", total_questions: 40, available_questions: 40 });
    expect(JSON.stringify(pmle)).not.toContain("data-engineer:standard:");
    outputPolicy(overview); outputPolicy(listed); outputPolicy(pmle);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("serves and checks both exams by ID alone, with exam-specific answers and analytics", async () => {
    await configure();
    const pmle = data(await call("get_practice_question"));
    expect(pmle).toMatchObject({ exam_id: "GCP_PM_ML_ENG", question_id: fixtureRows[0].id });
    for (const [index, row] of additionalRows.entries()) {
      rng.randomInt.mockReturnValueOnce(index);
      const served = data(await call("get_practice_question", { exam: additionalExamId }));
      expect(served).toMatchObject({ exam_id: additionalExamId, question_id: row.id, domain: row.exam_domains.code, stem: row.stem,
        options: row.answers.map(answer => ({ label: answer.choice_label, text: answer.choice_text })) });
      expect(JSON.stringify(served)).not.toMatch(/is_correct|explanation|correct_option/);
      expect(analytics.schedule).toHaveBeenLastCalledWith(expect.any(Request), "chatgpt_question_served", additionalExamId, row.exam_domains.code);
      const correct = row.answers.find(answer => answer.is_correct)!;
      const checked = data(await call("check_answer", { question_id: row.id, selected_label: correct.choice_label }));
      expect(checked).toMatchObject({ exam_id: additionalExamId, question_id: row.id, domain: row.exam_domains.code,
        is_correct: true, correct_option: correct.choice_label,
        options: row.answers.map(answer => ({ label: answer.choice_label, text: answer.choice_text, explanation: answer.explanation_text })) });
      expect(analytics.schedule).toHaveBeenLastCalledWith(expect.any(Request), "chatgpt_answer_checked", additionalExamId, row.exam_domains.code, true);
      outputPolicy(served); outputPolicy(checked);
    }
    const pmleChecked = data(await call("check_answer", { question_id: fixtureRows[0].id, selected_label: "A" }));
    expect(pmleChecked).toMatchObject({ exam_id: "GCP_PM_ML_ENG", question_id: fixtureRows[0].id, is_correct: true });
    expect(analytics.schedule).toHaveBeenLastCalledWith(expect.any(Request), "chatgpt_answer_checked", "GCP_PM_ML_ENG", fixtureQuestions[0].domain, true);
    for (const result of database.create.mock.results) {
      const query = result.value.from("questions");
      expect(query.eq).toHaveBeenCalledWith("question_type", "single_select");
    }
  });

  it("resolves domain codes, titles and numbers only in the selected exam", async () => {
    await configure();
    for (const domain of ["data-engineer:standard:1", "Designing data processing systems", "1"]) {
      const served = data(await call("get_practice_question", { exam: additionalExamId, domain }));
      expect(served).toMatchObject({ exam_id: additionalExamId, question_id: additionalRows[0].id, domain: "data-engineer:standard:1" });
      outputPolicy(served);
    }
    analytics.schedule.mockClear();
    for (const args of [
      { exam: additionalExamId, domain: PMLE_BLUEPRINT[0].domainCode },
      { exam: "GCP_PM_ML_ENG", domain: "data-engineer:standard:1" },
      { exam: additionalExamId, domain: "6" },
    ]) {
      expect((await call("get_practice_question", args)).isError).toBe(true);
    }
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("rejects a disabled exam's selected ID before any database read even when its manifest exists", async () => {
    await configure("GCP_PM_ML_ENG");
    const answer = await call("check_answer", { question_id: additionalRows[0].id, selected_label: "B" });
    expect(answer.isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(database.read).not.toHaveBeenCalled();
    expect(analytics.schedule).not.toHaveBeenCalled();
    expect(JSON.stringify(answer)).not.toContain(additionalRows[0].stem);
  });

  it("does not restore the default implicitly when PMLE is disabled", async () => {
    await configure(additionalExamId);
    for (const name of ["exam_overview", "list_practice_domains", "get_practice_question"]) {
      const omitted = await call(name);
      expect(omitted.isError).toBe(true);
      expect(JSON.stringify(omitted)).toContain(`Available exams: ${additionalExamId}`);
      const unknown = await call(name, { exam: "unknown-exam" });
      expect(unknown.isError).toBe(true);
      expect(JSON.stringify(unknown)).toContain(`Available exams: ${additionalExamId}`);
    }
    expect((await call("check_answer", { question_id: fixtureRows[0].id, selected_label: "A" })).isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(analytics.schedule).not.toHaveBeenCalled();
    expect(data(await call("get_practice_question", { exam: additionalExamId })).exam_id).toBe(additionalExamId);
  });

  it("rejects rows forged across enabled exam ID boundaries", async () => {
    await configure();
    database.read.mockResolvedValue({ data: [
      { ...fixtureRows[0], exam: additionalExamId, exam_domains: additionalRows[0].exam_domains },
      { ...additionalRows[0], exam: "GCP_PM_ML_ENG", exam_domains: fixtureRows[0].exam_domains },
    ], error: null });
    for (const question_id of [fixtureRows[0].id, additionalRows[0].id]) {
      const answer = await call("check_answer", { question_id, selected_label: "A" });
      expect(answer.isError).toBe(true);
      expect(JSON.stringify(answer)).not.toMatch(/Synthetic/);
    }
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("keeps tools/list usable with zero enabled exams while all study calls fail closed", async () => {
    await configure("");
    const listed = await rpc("tools/list");
    expect(listed.error).toBeUndefined();
    const tools = listed.result!.tools as JsonObject[];
    expect(tools.map(tool => tool.name).sort()).toEqual(["check_answer", "exam_overview", "get_practice_question", "list_practice_domains"]);
    for (const name of ["exam_overview", "list_practice_domains", "get_practice_question"]) {
      for (const args of [{}, { exam: "GCP_PM_ML_ENG" }, { exam: additionalExamId }]) {
        const result = await call(name, args);
        expect(result.isError).toBe(true);
        expect(JSON.stringify(result)).toContain("Available exams: none");
      }
    }
    expect((await call("check_answer", { question_id: fixtureRows[0].id, selected_label: "A" })).isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("rejects an ambiguous ID shared by two enabled selections without accessing the database", async () => {
    await configure("GCP_PM_ML_ENG,data-engineer", { [additionalExamId]: { version: 1, source: syntheticSource, question_ids: [fixtureRows[0].id] } });
    const listed = await rpc("tools/list");
    expect(listed.error).toBeUndefined();
    for (const name of ["exam_overview", "list_practice_domains", "get_practice_question"]) {
      const result = await call(name, { exam: "GCP_PM_ML_ENG" });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("Available exams: none");
    }
    expect((await call("check_answer", { question_id: fixtureRows[0].id, selected_label: "A" })).isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("fails closed for every tool when CHATGPT_EXAMS names a missing fixed selection", async () => {
    await configure("GCP_PM_ML_ENG,cloud-engineer");
    for (const name of ["exam_overview", "list_practice_domains", "get_practice_question"]) {
      const result = await call(name, { exam: "GCP_PM_ML_ENG" });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("Available exams: none");
    }
    expect((await call("check_answer", { question_id: fixtureRows[0].id, selected_label: "A" })).isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(analytics.schedule).not.toHaveBeenCalled();
  });
});

describe("MCP fixed-set publication invariants", () => {
  it("uses exactly 40 selected IDs with synthetic ACTIVE GOOD originals with one correct option and four full explanations", () => {
    expect(fixtureQuestions).toHaveLength(40);
    expect(new Set(fixtureQuestions.map(question => question.id)).size).toBe(40);
    for (const question of fixtureQuestions) {
      expect(question).toMatchObject({ status: "ACTIVE", review_status: "GOOD", parent_question_id: null });
      expect(question.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(PMLE_BLUEPRINT.map(domain => domain.domainCode)).toContain(question.domain);
      expect(question.stem.trim().length).toBeGreaterThan(20);
      expect(question.options.map(option => option.label).sort()).toEqual(["A", "B", "C", "D"]);
      expect(question.options.filter(option => option.is_correct)).toHaveLength(1);
      for (const option of question.options) {
        expect(option.text.trim()).not.toBe("");
        expect(option.explanation.trim().length).toBeGreaterThan(20);
      }
      policy(question);
    }
  });

  it("counts only currently eligible rows and safely rejects a retired selected ID", async () => {
    database.read.mockResolvedValue({ data: [fixtureRows[1]], error: null });
    const listed = data(await call("list_practice_domains"));
    expect(listed.total_questions).toBe(40);
    expect(listed.available_questions).toBe(1);
    expect((listed.domains as JsonObject[]).reduce((total, domain) => total + Number(domain.question_count), 0)).toBe(1);
    const answer = await call("check_answer", { question_id: fixtureQuestions[0].id, selected_label: "A" });
    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer)).not.toContain(fixtureQuestions[0].stem);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("rejects an out-of-selection ID before creating a database client", async () => {
    const answer = await call("check_answer", { question_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", selected_label: "A" });
    expect(answer.isError).toBe(true);
    expect(database.create).not.toHaveBeenCalled();
    expect(database.read).not.toHaveBeenCalled();
  });

  it.each(["exam_overview", "list_practice_domains", "get_practice_question", "check_answer"])("fails closed without leaking database failures for %s", async name => {
    database.read.mockRejectedValue(new Error("SUPABASE secret diagnostic stack node_modules"));
    const answer = await call(name, name === "check_answer" ? { question_id: fixtureQuestions[0].id, selected_label: "A" } : {});
    expect(answer.isError).toBe(true);
    expect(JSON.stringify(answer)).not.toMatch(/SUPABASE|secret|diagnostic|stack|node_modules/);
    expect(JSON.stringify(answer)).not.toContain(fixtureQuestions[0].stem);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("awaits database content before serving a question and never returns its key", async () => {
    let finish!: (value: { data: typeof fixtureRows; error: null }) => void;
    database.read.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const pending = call("get_practice_question");
    await vi.waitFor(() => expect(database.read).toHaveBeenCalledOnce());
    expect(analytics.schedule).not.toHaveBeenCalled();
    finish({ data: fixtureRows, error: null });
    const question = data(await pending);
    expect(question.question_id).toBe(fixtureQuestions[0].id);
    expect(JSON.stringify(question)).not.toMatch(/is_correct|explanation|correct_option/);
  });

  it("spreads questions across all six domains in normalized blueprint proportions", () => {
    for (const domain of PMLE_BLUEPRINT) {
      const count = fixtureQuestions.filter(question => question.domain === domain.domainCode).length;
      expect(count).toBeGreaterThan(0);
      expect(Math.abs(count - 40 * domain.weight)).toBeLessThanOrEqual(1);
    }
  });
});

describe("MCP HTTP safety and statelessness", () => {
  it.each([undefined, "https://chatgpt.com", "https://chat.openai.com", "https://testero.ai", "http://127.0.0.1:3000", "http://localhost:3000"])("accepts allowed origin %s without authentication", async origin => {
    const message = await rpc("tools/list", {}, origin ? { origin } : {});
    expect(message.error).toBeUndefined();
  });

  it.each(["null", "https://evil.example", "https://chatgpt.com.evil.example", "http://chatgpt.com", "https://testero.ai:8443", "https://testero.ai/", "not-a-url"])("rejects untrusted Origin %s", async origin => {
    const response = await route.POST(request(JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method: "tools/list" }), { origin }));
    expect(response.status).toBe(403);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])("rejects local origin %s in production", async origin => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await route.POST(request(JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method: "tools/list" }), { origin }));
    expect(response.status).toBe(403);
  });

  it("has no GET/SSE or DELETE/session endpoint", async () => {
    for (const handler of [route.GET, route.DELETE]) {
      const response = await handler(new Request("https://testero.ai/api/mcp"));
      expect(response.status).toBe(405);
      expect(response.headers.get("content-type") ?? "").not.toContain("text/event-stream");
      expect(response.headers.get("mcp-session-id")).toBeNull();
    }
  });

  it("supports safe preflight without allowing untrusted origins", async () => {
    const response = await route.OPTIONS(new Request("https://testero.ai/api/mcp", { method: "OPTIONS", headers: { origin: "https://chatgpt.com", "access-control-request-method": "POST" } }));
    expect([200, 204]).toContain(response.status);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://chatgpt.com");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-credentials")).not.toBe("true");
    const rejected = await route.OPTIONS(new Request("https://testero.ai/api/mcp", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(rejected.status).toBe(403);
  });

  it.each(["x".repeat(16_385), JSON.stringify({ padding: "😀".repeat(5_000) })])("rejects bodies over 16 KiB by real byte size", async body => {
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(16_384);
    const response = await route.POST(request(body, { "content-length": "1" }));
    expect(response.status).toBe(413);
    expect(analytics.schedule).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without exposing server details", async () => {
    const response = await route.POST(request('{"jsonrpc":'));
    expect([200, 400]).toContain(response.status);
    const body = await response.text();
    expect(body).not.toMatch(/stack|node_modules|SUPABASE|STRIPE|POSTHOG_KEY/);
    expect(JSON.parse(body)).toHaveProperty("error");
  });

  it("returns HTTP 429 after 60 requests from one address", async () => {
    const body = () => JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method: "tools/list" });
    for (let index = 0; index < 60; index++) {
      const response = await route.POST(request(body(), { "x-forwarded-for": "203.0.113.20" }));
      expect(response.status).toBe(200);
      await response.text();
    }
    const denied = await route.POST(request(body(), { "x-forwarded-for": "203.0.113.20" }));
    expect(denied.status).toBe(429);
    expect(denied.headers.get("retry-after")).toBeTruthy();
  });
});

describe("MCP bounded in-memory rate limit", () => {
  const at = 1_000_000;
  const ipRequest = (address?: string) => new Request("https://testero.ai/api/mcp", { headers: address ? { "x-forwarded-for": address } : {} });
  it("allows 60 per IP per minute, separates IPs, then resets at the exact boundary", async () => {
    const { allowMcpRequest } = await import("@/lib/chatgpt/rate-limit");
    for (let index = 0; index < 60; index++) expect(allowMcpRequest(ipRequest("203.0.113.1"), at)).toBe(true);
    expect(allowMcpRequest(ipRequest("203.0.113.1"), at + 59_999)).toBe(false);
    expect(allowMcpRequest(ipRequest("203.0.113.2"), at + 59_999)).toBe(true);
    expect(allowMcpRequest(ipRequest("203.0.113.1"), at + 60_000)).toBe(true);
  });
  it("uses the first forwarded IP and a shared missing-IP bucket", async () => {
    const { allowMcpRequest } = await import("@/lib/chatgpt/rate-limit");
    for (let index = 0; index < 60; index++) {
      expect(allowMcpRequest(ipRequest(`203.0.113.1, 192.0.2.${index}`), at)).toBe(true);
      expect(allowMcpRequest(ipRequest(), at)).toBe(true);
    }
    expect(allowMcpRequest(ipRequest("203.0.113.1, 192.0.2.200"), at)).toBe(false);
    expect(allowMcpRequest(ipRequest(), at)).toBe(false);
  });
  it("caps aggregate traffic at 600 per minute even with fresh IPs", async () => {
    const { allowMcpRequest } = await import("@/lib/chatgpt/rate-limit");
    for (let index = 0; index < 600; index++) expect(allowMcpRequest(ipRequest(`address-${index}`), at)).toBe(true);
    expect(allowMcpRequest(ipRequest("fresh-address"), at + 59_999)).toBe(false);
    expect(allowMcpRequest(ipRequest("fresh-address"), at + 60_000)).toBe(true);
  });
});

describe("OpenAI domain verification challenge", () => {
  it("returns only the configured plain-text token with no-store", async () => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE", "unit-challenge-token-123");
    const { GET } = await import("@/app/.well-known/openai-apps-challenge/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).toBe("unit-challenge-token-123");
  });
  it.each([undefined, ""])("returns uncacheable 404 when challenge is %j", async token => {
    vi.stubEnv("OPENAI_APPS_CHALLENGE", token);
    const { GET } = await import("@/app/.well-known/openai-apps-challenge/route");
    const response = await GET();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("undefined");
  });
});
