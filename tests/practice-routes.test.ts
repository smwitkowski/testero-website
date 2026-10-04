import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as start } from "@/app/api/practice/route";
import { GET as read } from "@/app/api/practice/[id]/route";
import { POST as answer } from "@/app/api/practice/[id]/answer/route";
import { GET as summary } from "@/app/api/practice/[id]/summary/route";
import { createPractice, readPractice, answerPractice, practiceSummary, PracticeQuotaError } from "@/lib/practice/service";
import { getVerifiedUser } from "@/lib/auth/session";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

const mocks = vi.hoisted(() => ({ client: { marker: "service" } }));
vi.mock("@/lib/auth/session", () => ({ getVerifiedUser: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => mocks.client) }));
vi.mock("@/lib/practice/service", async original => ({ ...await original<typeof import("@/lib/practice/service")>(), createPractice: vi.fn(), readPractice: vi.fn(), answerPractice: vi.fn(), practiceSummary: vi.fn() }));
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const itemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const domainCode = PMLE_BLUEPRINT[0].domainCode;
const context = { params: Promise.resolve({ id }) };
function request(body: unknown, origin = "http://localhost:3000") { return new Request("http://localhost:3000/api/practice", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
function getRequest() { return new Request(`http://localhost:3000/api/practice/${id}`); }
beforeEach(() => {
  vi.mocked(getVerifiedUser).mockReset().mockResolvedValue({ id: userId, email_confirmed_at: "2026-10-03T12:00:00Z" } as never);
  vi.mocked(createPractice).mockReset().mockResolvedValue(id);
  vi.mocked(readPractice).mockReset().mockResolvedValue({ sessionId: id, status: "in_progress", totalQuestions: 5, answeredCount: 0, currentQuestion: null });
  vi.mocked(answerPractice).mockReset().mockResolvedValue({ answeredCount: 1, totalQuestions: 5, completed: false, feedback: { itemId, selectedLabel: "A", correctLabel: "A", isCorrect: true } });
  vi.mocked(practiceSummary).mockReset().mockResolvedValue({ sessionId: id, score: 80, totalQuestions: 5, correctAnswers: 4, readiness: { id: "strong", label: "Strong", description: "Guidance" }, domainBreakdown: [], review: [] });
});
const routes = ["start", "read", "answer", "summary"] as const;
function invoke(route: typeof routes[number]) { return route === "start" ? start(request({ domainCode })) : route === "read" ? read(getRequest(), context) : route === "answer" ? answer(request({ itemId, selectedLabel: "A" }), context) : summary(getRequest(), context); }

describe("practice route auth and privacy", () => {
  it.each(routes)("requires verified auth before creating service DB client: %s", async route => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    const response = await invoke(route);
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: "Please sign in to continue" });
    expect(createServiceSupabaseClient).not.toHaveBeenCalled(); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(createPractice).not.toHaveBeenCalled(); expect(readPractice).not.toHaveBeenCalled(); expect(answerPractice).not.toHaveBeenCalled(); expect(practiceSummary).not.toHaveBeenCalled();
  });
  it("checks auth before parsing any untrusted body", async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    const malformed = new Request("http://localhost:3000/api/practice", { method: "POST", body: "{broken" });
    expect((await start(malformed)).status).toBe(401); expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it.each(["start", "answer"] as const)("rejects cross-origin writes before auth/body/DB: %s", async route => {
    const response = route === "start" ? await start(request({ domainCode }, "https://evil.example")) : await answer(request({ itemId, selectedLabel: "A" }, "https://evil.example"), context);
    expect(response.status).toBe(403); expect(getVerifiedUser).not.toHaveBeenCalled(); expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it.each([{ domainCode, userId: "victim" }, { domainCode, paid: true }, { domainCode, questionCount: 10 }, { domainCode, anonymousToken: "secret" }, { domainCode: "unknown" }, {}, null, []])("rejects strict start body without any service DB client %#", async body => {
    expect((await start(request(body))).status).toBe(400); expect(createServiceSupabaseClient).not.toHaveBeenCalled(); expect(createPractice).not.toHaveBeenCalled();
  });
  it.each([{ itemId, selectedLabel: "A", userId: "victim" }, { itemId, selectedLabel: "A", isCorrect: true }, { itemId, selectedLabel: "A", explanation: "secret" }, { itemId: "bad", selectedLabel: "A" }, { itemId, selectedLabel: "a" }, { itemId, selectedLabel: "AB" }, { itemId }, null])("rejects strict answer body without any service DB client %#", async body => {
    expect((await answer(request(body), context)).status).toBe(400); expect(createServiceSupabaseClient).not.toHaveBeenCalled(); expect(answerPractice).not.toHaveBeenCalled();
  });
  it("creates practice only as the server-verified user", async () => {
    const response = await start(request({ domainCode })); expect(response.status).toBe(201);
    expect(createPractice).toHaveBeenCalledWith(mocks.client, userId, domainCode); expect(await response.json()).toEqual({ sessionId: id, href: `/practice/${id}` });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store"); expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("returns atomic exhaustion with the real upgrade CTA and no paid fallback", async () => {
    vi.mocked(createPractice).mockRejectedValue(new PracticeQuotaError());
    const response = await start(request({ domainCode })); expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "You have used your five free practice questions this week.", upgradeHref: "/pricing" });
    expect(createPractice).toHaveBeenCalledOnce(); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("passes verified identity to progress, answer and owned summary", async () => {
    const progress = await read(getRequest(), context); const result = await answer(request({ itemId, selectedLabel: "A" }), context); const completed = await summary(getRequest(), context);
    expect(readPractice).toHaveBeenCalledWith(mocks.client, id, userId);
    expect(answerPractice).toHaveBeenCalledWith(mocks.client, id, userId, itemId, "A"); expect(practiceSummary).toHaveBeenCalledWith(mocks.client, id, userId);
    expect(await result.json()).toEqual({ answeredCount: 1, totalQuestions: 5, completed: false, feedback: { itemId, selectedLabel: "A", correctLabel: "A", isCorrect: true } });
    for (const response of [progress, result, completed]) expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each([404, 409, 410])("preserves safe ownership/incomplete/expiry status %s", async status => { vi.mocked(practiceSummary).mockRejectedValue(new DiagnosticError(status, "Safe error")); const response = await summary(getRequest(), context); expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: "Safe error" }); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); });
  it.each(routes)("sanitizes unexpected SDK failures: %s", async route => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("secret service key / explanation");
    vi.mocked(createPractice).mockRejectedValue(error); vi.mocked(readPractice).mockRejectedValue(error); vi.mocked(answerPractice).mockRejectedValue(error); vi.mocked(practiceSummary).mockRejectedValue(error);
    const response = await invoke(route); expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: "Practice is unavailable. Please try again." }); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(log).toHaveBeenCalledWith("Practice request failed");
  });
});
