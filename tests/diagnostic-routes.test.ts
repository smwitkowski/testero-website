import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as start } from "@/app/api/diagnostic/route";
import { GET as read } from "@/app/api/diagnostic/[sessionId]/route";
import { POST as answer } from "@/app/api/diagnostic/[sessionId]/answer/route";
import { GET as results } from "@/app/api/diagnostic/[sessionId]/results/route";
import { createDiagnostic, readDiagnostic, answerDiagnostic, diagnosticResults } from "@/lib/diagnostic/service";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const mocks = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  client: { marker: "mock-service-client" },
  getUser: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({
  get: (name: string) => name === "testero_anon" && mocks.cookie !== undefined ? { value: mocks.cookie } : undefined,
})) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => mocks.client) }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }));
vi.mock("@/lib/diagnostic/service", () => ({
  createDiagnostic: vi.fn(), readDiagnostic: vi.fn(), answerDiagnostic: vi.fn(), diagnosticResults: vi.fn(),
}));
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token = "a".repeat(64);
const context = { params: Promise.resolve({ sessionId }) };
function request(body: unknown = {}, origin: string | null = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/diagnostic", {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
}
function getRequest() { return new Request(`http://localhost:3000/api/diagnostic/${sessionId}`); }
beforeEach(() => {
  mocks.cookie = undefined;
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: null }, error: null });
  vi.mocked(createDiagnostic).mockReset().mockResolvedValue(sessionId);
  vi.mocked(readDiagnostic).mockReset().mockResolvedValue({ sessionId, status: "in_progress", totalQuestions: 20, answeredCount: 0, currentQuestion: null });
  vi.mocked(answerDiagnostic).mockReset().mockResolvedValue({ answeredCount: 1, totalQuestions: 20, completed: false });
  vi.mocked(diagnosticResults).mockReset().mockResolvedValue({ sessionId, score: 0, totalQuestions: 20, correctAnswers: 0, readiness: { id: "low", label: "Low", description: "Guidance" }, domainBreakdown: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe("strict diagnostic creation route", () => {
  it("sets an opaque protected cookie only after successful creation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await start(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ sessionId, href: `/diagnostic/${sessionId}` });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toMatch(/testero_anon=[a-f0-9]{64}/);
    expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i); expect(cookie).toMatch(/Path=\//i);
    expect(cookie).toMatch(/Max-Age=2592000/i);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(createDiagnostic).toHaveBeenCalledOnce();
    expect(vi.mocked(createDiagnostic).mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
  });
  it("does not require Secure on local development cookies", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await start(request())).headers.get("set-cookie")).not.toMatch(/; Secure/i);
  });
  it("reuses a valid anonymous cookie", async () => {
    mocks.cookie = token;
    const response = await start(request());
    expect(createDiagnostic).toHaveBeenCalledWith(mocks.client, token);
    expect(response.headers.get("set-cookie")).toContain(`testero_anon=${token}`);
  });
  it.each(["invalid", "A".repeat(64), "a".repeat(63)])("replaces an invalid cookie %# only after success", async (cookie) => {
    mocks.cookie = cookie;
    const response = await start(request());
    const used = vi.mocked(createDiagnostic).mock.calls[0][1];
    expect(used).not.toBe(cookie); expect(used).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("set-cookie")).toContain(`testero_anon=${used}`);
  });
  it.each([undefined, token, "invalid"])("preserves existing cookie on creation failure %#", async (previous) => {
    mocks.cookie = previous;
    vi.mocked(createDiagnostic).mockRejectedValue(new DiagnosticError(503, "Unavailable"));
    const response = await start(request());
    expect(response.status).toBe(503); expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.cookie).toBe(previous);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each([
    { userId: "victim" }, { anonymousToken: token }, { questionCount: 1 },
    { sessionId }, { exam: "other" }, [], null, "",
  ].map((body) => ({ body })))("rejects impersonation or extra body fields %# before clients", async ({ body }) => {
    const response = await start(request(body));
    expect(response.status).toBe(400); expect(createDiagnostic).not.toHaveBeenCalled();
    expect(createServiceSupabaseClient).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects malformed JSON", async () => {
    const response = await start(new Request("http://localhost:3000/api/diagnostic", { method: "POST", body: "{broken" }));
    expect(response.status).toBe(400); expect(createDiagnostic).not.toHaveBeenCalled();
  });
  it("rejects foreign origins before body/ownership processing", async () => {
    const response = await start(request({}, "https://evil.example"));
    expect(response.status).toBe(403); expect(createDiagnostic).not.toHaveBeenCalled();
    expect(createServiceSupabaseClient).not.toHaveBeenCalled();
  });
  it("accepts origin-less local requests with valid bodies", async () => {
    expect((await start(request({}, null))).status).toBe(201);
  });
});

describe("server-verified request credentials", () => {
  it("gets identity from getUser and token from cookie only", async () => {
    mocks.cookie = token;
    mocks.getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
    expect(await diagnosticCredentials()).toEqual({ userId: "verified-user", anonymousToken: token });
    expect(mocks.getUser).toHaveBeenCalledOnce();
  });
  it("never grants a user identity when getUser has no verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { message: "no session" } });
    expect(await diagnosticCredentials()).toEqual({ userId: null, anonymousToken: null });
  });
});

describe("diagnostic progress, answer, and aggregate result routes", () => {
  it("uses server credentials and no-store progress", async () => {
    mocks.cookie = token;
    const response = await read(getRequest(), context);
    expect(response.status).toBe(200);
    expect(readDiagnostic).toHaveBeenCalledWith(mocks.client, sessionId, { userId: null, anonymousToken: token });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ sessionId, answeredCount: 0 });
  });
  it("returns only service progress after answering, never changes anonymous cookie", async () => {
    mocks.cookie = token;
    const response = await answer(request({ itemId, selectedLabel: "B" }), context);
    expect(response.status).toBe(200);
    expect(answerDiagnostic).toHaveBeenCalledWith(mocks.client, sessionId, { userId: null, anonymousToken: token }, itemId, "B");
    expect(await response.json()).toEqual({ answeredCount: 1, totalQuestions: 20, completed: false });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it.each([
    { itemId, selectedLabel: "A", userId: "victim" }, { itemId, selectedLabel: "A", anonymousToken: token },
    { itemId, selectedLabel: "A", is_correct: true }, { itemId, selectedLabel: "a" },
    { itemId: "bad", selectedLabel: "A" }, { itemId, selectedLabel: "AB" },
    { itemId }, null,
  ].map((body) => ({ body })))("rejects invalid/impersonating answer bodies %#", async ({ body }) => {
    const response = await answer(request(body), context);
    expect(response.status).toBe(400); expect(answerDiagnostic).not.toHaveBeenCalled();
    expect(createServiceSupabaseClient).not.toHaveBeenCalled(); expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it("rejects foreign answer origins", async () => {
    expect((await answer(request({ itemId, selectedLabel: "A" }, "https://evil.example"), context)).status).toBe(403);
    expect(answerDiagnostic).not.toHaveBeenCalled();
  });
  it("returns aggregate results with server credentials and no caching", async () => {
    mocks.cookie = token;
    const response = await results(getRequest(), context);
    expect(response.status).toBe(200);
    expect(diagnosticResults).toHaveBeenCalledWith(mocks.client, sessionId, { userId: null, anonymousToken: token });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toMatchObject({ sessionId, score: 0, domainBreakdown: [] });
  });
  it.each([404, 409, 410])("preserves safe service status %s without caching", async (status) => {
    vi.mocked(diagnosticResults).mockRejectedValue(new DiagnosticError(status, "Safe public error"));
    const response = await results(getRequest(), context);
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: "Safe public error" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each(["start", "read", "answer", "results"])("sanitizes untyped API500 body for %s", async (route) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("SUPABASE_SERVICE_ROLE_KEY=secret leaked body answer A");
    vi.mocked(createDiagnostic).mockRejectedValue(error);
    vi.mocked(readDiagnostic).mockRejectedValue(error);
    vi.mocked(answerDiagnostic).mockRejectedValue(error);
    vi.mocked(diagnosticResults).mockRejectedValue(error);
    const response = route === "start" ? await start(request()) : route === "read" ? await read(getRequest(), context)
      : route === "answer" ? await answer(request({ itemId, selectedLabel: "A" }), context) : await results(getRequest(), context);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "The diagnostic is unavailable. Please try again." });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
