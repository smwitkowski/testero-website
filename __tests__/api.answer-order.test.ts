/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectPmleQuestionsByBlueprint } from "@/lib/diagnostic/pmle-selection";
import { selectPracticeQuestionsByDomains } from "@/lib/practice/domain-selection";
import { POST as createDiagnostic, GET as getDiagnostic } from "@/app/api/diagnostic/route";
import { POST as createAlternativeDiagnostic } from "@/app/api/diagnostic/session/route";
import { GET as diagnosticSummary } from "@/app/api/diagnostic/summary/[sessionId]/route";
import { POST as createPractice } from "@/app/api/practice/session/route";
import { POST as answerPractice } from "@/app/api/practice/session/[sessionId]/answer/route";
import { GET as getPractice } from "@/app/api/practice/session/[sessionId]/route";
import { GET as practiceSummary } from "@/app/api/practice/session/[sessionId]/summary/route";
import { GET as currentQuestion } from "@/app/api/questions/current/route";
import { GET as questionById } from "@/app/api/questions/[id]/route";
import { POST as submitQuestion } from "@/app/api/questions/submit/route";

jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock("@/lib/auth/require-subscriber", () => ({ requireSubscriber: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/auth/rate-limiter", () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }));
jest.mock("@/lib/auth/anonymous-session-server", () => ({
  getAnonymousSessionIdFromCookie: jest.fn().mockResolvedValue(null), setAnonymousSessionIdCookie: jest.fn(),
}));
jest.mock("@/lib/diagnostic/pmle-selection", () => ({ selectPmleQuestionsByBlueprint: jest.fn() }));
jest.mock("@/lib/practice/domain-selection", () => ({ selectPracticeQuestionsByDomains: jest.fn() }));
jest.mock("@/lib/access/pmleEntitlements", () => ({
  canUseFeature: jest.fn((_level, feature) => feature !== "PRACTICE_SESSION_FREE_QUOTA"),
}));
jest.mock("@/lib/access/pmleEntitlements.server", () => ({
  getPmleAccessLevelForRequest: jest.fn().mockResolvedValue({ accessLevel: "SUBSCRIBER", user: { id: "user" } }),
}));
jest.mock("@/lib/analytics/server-analytics", () => ({ getServerPostHog: jest.fn().mockReturnValue(null) }));
jest.mock("@/lib/analytics/campaign-analytics-integration", () => ({
  trackDiagnosticStartWithCampaign: jest.fn(), trackDiagnosticCompleteWithCampaign: jest.fn(),
}));
jest.mock("@/lib/analytics/analytics", () => ({ trackEvent: jest.fn(), ANALYTICS_EVENTS: {} }));
jest.mock("posthog-node", () => ({ PostHog: jest.fn() }));

const canonicalQuestion = {
  id: "00000000-0000-0000-0000-000000000001", stem: "Question", domain_code: "D1", domain_id: "domain",
  answers: ["Correct", "Wrong 1", "Wrong 2", "Wrong 3"].map((text, index) => ({
    id: `answer-${index}`, choice_label: String.fromCharCode(65 + index), choice_text: text,
    is_correct: index === 0, explanation_text: `${text} explanation`,
  })),
};
const selection = { questions: [canonicalQuestion], domainDistribution: [] };
const request = (path: string, body?: unknown) => new Request(`http://localhost${path}`, body === undefined
  ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const params = (sessionId: string) => ({ params: Promise.resolve({ sessionId }) });

// Fluent, in-memory Supabase stub. All routes run without network or credentials.
function database() {
  const tables: Record<string, any[]> = {
    questions: [{ ...canonicalQuestion }], answers: canonicalQuestion.answers.map((answer) => ({ ...answer, question_id: canonicalQuestion.id })),
    explanations: [{ question_id: canonicalQuestion.id, explanation_text: "Question explanation" }],
  };
  let sequence = 0;
  const from = jest.fn((table: string) => {
    tables[table] ||= [];
    const filters: ((row: any) => boolean)[] = [];
    let single = false;
    let operation = "select";
    let payload: any;
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return chain; },
      in: (key: string, values: unknown[]) => { filters.push((row) => values.includes(row[key])); return chain; },
      lt: () => chain, is: () => chain, order: () => chain, limit: () => chain,
      single: () => { single = true; return chain; },
      insert: (data: any) => { operation = "insert"; payload = data; return chain; },
      upsert: (data: any) => { operation = "insert"; payload = data; return chain; },
      update: (data: any) => { operation = "update"; payload = data; return chain; },
      delete: () => { operation = "delete"; return chain; },
      then: (resolve: (value: any) => void) => {
        let rows = tables[table].filter((row) => filters.every((filter) => filter(row)));
        if (operation === "insert") {
          rows = (Array.isArray(payload) ? payload : [payload]).map((row) => ({ id: `row-${++sequence}`, ...row }));
          tables[table].push(...rows);
        } else if (operation === "update") {
          rows.forEach((row) => Object.assign(row, payload));
        } else if (operation === "delete") {
          // Session cleanup is not part of the answer-order regression.
          rows = [];
        }
        if (table.endsWith("_questions")) {
          const responsesTable = table === "diagnostic_questions" ? "diagnostic_responses" : "practice_responses";
          rows = rows.map((row) => ({ ...row, [responsesTable]: (tables[responsesTable] || []).filter((r) => r.question_id === row.id) }));
        }
        resolve({ data: single ? rows[0] || null : rows, error: null });
      },
    };
    return chain;
  });
  jest.mocked(createServerSupabaseClient).mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } } }) }, from,
  } as any);
  return tables;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(selectPmleQuestionsByBlueprint).mockResolvedValue(selection as any);
  jest.mocked(selectPracticeQuestionsByDomains).mockResolvedValue(selection as any);
  jest.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => jest.restoreAllMocks());

describe("new session snapshots", () => {
  it.each(["diagnostic", "alternative diagnostic", "practice"])("shuffles and relabels %s on each creation", async (kind) => {
    const tables = database();
    const create = kind === "diagnostic"
      ? () => createDiagnostic(request("/api/diagnostic", { action: "start", data: { numQuestions: 1 } }))
      : kind === "alternative diagnostic"
        ? () => createAlternativeDiagnostic(request("/api/diagnostic/session", { examKey: "pmle", numQuestions: 1 }))
        : () => createPractice(request("/api/practice/session", { examKey: "pmle", domainCodes: ["D1"] }));
    const table = kind === "practice" ? "practice_questions" : "diagnostic_questions";
    expect((await create()).status).toBe(200);
    const first = tables[table][0];
    expect(first.correct_label).toBe("D");
    expect(first.options).toEqual([
      { label: "A", text: "Wrong 1" }, { label: "B", text: "Wrong 2" },
      { label: "C", text: "Wrong 3" }, { label: "D", text: "Correct" },
    ]);
    jest.mocked(Math.random).mockReturnValue(0.999);
    expect((await create()).status).toBe(200);
    expect(tables[table][1].correct_label).toBe("A");
    expect(tables[table][0]).toEqual(first);
  });
});

describe("snapshot scoring and review", () => {
  it.each([
    ["diagnostic", true], ["diagnostic", false], ["practice", true], ["practice", false],
  ] as const)("keeps %s resume, scoring (%s) and review consistent for new and old snapshots", async (kind, isCorrect) => {
    for (const legacy of [false, true]) {
      const tables = database();
      const questionTable = kind === "diagnostic" ? "diagnostic_questions" : "practice_questions";
      const sessionTable = kind === "diagnostic" ? "diagnostics_sessions" : "practice_sessions";
      const storedOptions = legacy
        ? canonicalQuestion.answers.map((a) => ({ label: a.choice_label, text: a.choice_text }))
        : ["Wrong 1", "Wrong 2", "Wrong 3", "Correct"].map((text, i) => ({ label: String.fromCharCode(65 + i), text }));
      const correctLabel = legacy ? "A" : "D";
      tables[sessionTable] = [{ id: "session", user_id: "user", question_count: 1, completed_at: null,
        expires_at: "2099-01-01T00:00:00Z", exam_type: "Google ML Engineer", exam: "pmle" }];
      tables[questionTable] = [{ id: "snapshot", session_id: "session", stem: "Question", options: storedOptions,
        correct_label: correctLabel, canonical_question_id: canonicalQuestion.id, original_question_id: null, domain_code: "D1" }];
      const resume = kind === "diagnostic"
        ? await getDiagnostic(request("/api/diagnostic?sessionId=session"))
        : await getPractice(request("/api/practice/session/session"), params("session"));
      expect(resume.status).toBe(200);
      expect((await resume.json()).session.questions[0].options).toEqual(storedOptions);
      const selectedLabel = isCorrect ? correctLabel : (legacy ? "D" : "A");
      const answerBody = { questionId: "snapshot", selectedLabel };
      const answered = kind === "diagnostic"
        ? await createDiagnostic(request("/api/diagnostic", { action: "answer", sessionId: "session", data: answerBody }))
        : await answerPractice(request("/api/practice/session/session/answer", answerBody), params("session"));
      expect(answered.status).toBe(200);
      expect(await answered.json()).toMatchObject({ isCorrect });
      tables[sessionTable][0].completed_at = "2026-01-01T00:00:00Z";
      const summaryResponse = kind === "diagnostic"
        ? await diagnosticSummary(request("/api/diagnostic/summary/session"))
        : await practiceSummary(request("/api/practice/session/session/summary"), params("session"));
      expect(summaryResponse.status).toBe(200);
      const { summary } = await summaryResponse.json();
      expect(summary.score).toBe(isCorrect ? 100 : 0);
      expect(summary.questions[0]).toMatchObject({ options: storedOptions, userAnswer: selectedLabel,
        correctAnswer: correctLabel, isCorrect, explanation: "Question explanation" });
    }
  });
});

describe("standalone practice", () => {
  it.each(["current", "by ID"])("returns shuffled A/B/C/D options on the %s path", async (kind) => {
    const tables = database();
    tables.questions[0].status = "ACTIVE";
    tables.questions[0].review_status = "GOOD";
    const res = kind === "current"
      ? await currentQuestion(new NextRequest("http://localhost/api/questions/current"))
      : await questionById(new NextRequest(`http://localhost/api/questions/${canonicalQuestion.id}`));
    expect(res.status).toBe(200);
    expect((await res.json()).options).toEqual([
      { id: "answer-1", label: "A", text: "Wrong 1" }, { id: "answer-2", label: "B", text: "Wrong 2" },
      { id: "answer-3", label: "C", text: "Wrong 3" }, { id: "answer-0", label: "D", text: "Correct" },
    ]);
  });

  it.each(["A", "D"])("scores display label %s by ID and maps per-option explanations", async (label) => {
    const tables = database();
    const optionOrder = ["answer-1", "answer-2", "answer-3", "answer-0"];
    const res = await submitQuestion(request("/api/questions/submit", {
      questionId: canonicalQuestion.id, selectedOptionKey: label,
      selectedOptionId: label === "D" ? "answer-0" : "answer-1", optionOrder,
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ isCorrect: label === "D", correctOptionKey: "D", explanationsByOptionKey: {
      A: "Wrong 1 explanation", B: "Wrong 2 explanation", C: "Wrong 3 explanation", D: "Correct explanation",
    } });
    expect(tables.practice_question_attempts_v2[0].selected_label).toBe(label === "D" ? "A" : "B");
  });

  it("keeps legacy label-only submissions working", async () => {
    database();
    const res = await submitQuestion(request("/api/questions/submit", { questionId: canonicalQuestion.id, selectedOptionKey: "A" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ isCorrect: true, correctOptionKey: "A",
      explanationsByOptionKey: { A: "Correct explanation", B: "Wrong 1 explanation" } });
  });

  it.each([
    { selectedOptionId: "answer-0", optionOrder: ["answer-0", "answer-0", "answer-2", "answer-3"] },
    { selectedOptionId: "foreign", optionOrder: ["foreign", "answer-1", "answer-2", "answer-3"] },
    { selectedOptionId: "answer-1", optionOrder: ["answer-0", "answer-1", "answer-2", "answer-3"] },
    { selectedOptionId: "answer-0" },
  ])("rejects incomplete/foreign/duplicate/mismatched identity mappings", async (mapping) => {
    const tables = database();
    const res = await submitQuestion(request("/api/questions/submit", {
      questionId: canonicalQuestion.id, selectedOptionKey: "A", ...mapping,
    }));
    expect(res.status).toBe(400);
    expect(tables.practice_question_attempts_v2).toBeUndefined();
  });
});
