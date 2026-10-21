import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as start } from "@/app/api/diagnostic/route";
import { POST as email } from "@/app/api/diagnostic/[sessionId]/email/route";
import { createDiagnosticStart, diagnosticResults } from "@/lib/diagnostic/service";
import { sendResultsEmail } from "@/lib/diagnostic/results-email";
import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { DiagnosticError } from "@/lib/diagnostic/http";
const mocks = vi.hoisted(() => ({ client: { marker: "client" }, credentials: vi.fn(), createClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: mocks.createClient }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: mocks.credentials }));
vi.mock("@/lib/diagnostic/service", () => ({ createDiagnosticStart: vi.fn(), diagnosticResults: vi.fn() }));
vi.mock("@/lib/diagnostic/results-email", () => ({ sendResultsEmail: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ scheduleFunnelEvent: vi.fn() }));
vi.mock("@/lib/certifications/rate-limit", () => ({ allowWaitlistRequest: () => true }));
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ sessionId }) };
function request(body: unknown) { return new Request("http://localhost:3000/api/diagnostic", { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => {
  mocks.createClient.mockReset().mockReturnValue(mocks.client);
  mocks.credentials.mockReset().mockResolvedValue({ userId: null, anonymousToken: null });
  vi.mocked(createDiagnosticStart).mockReset().mockResolvedValue({ sessionId, href: `/diagnostic/${sessionId}`, progress: { sessionId, certId: "data-engineer", status: "in_progress", totalQuestions: 5, answeredCount: 0, answeredQuestions: [], currentQuestion: null } });
  vi.mocked(diagnosticResults).mockReset().mockResolvedValue({ sessionId, certId: "data-engineer", totalQuestions: 5, correctAnswers: 3, score: 60, readiness: { id: "building", label: "Building", description: "Guidance" }, domainBreakdown: [] });
  vi.mocked(sendResultsEmail).mockReset().mockResolvedValue();
});
describe("beta start API", () => {
  it.each([5, 10])("passes %i with validated cert and emits cert-aware analytics after success", async count => {
    const response = await start(request({ certId: "data-engineer", questionCount: count }));
    expect(response.status).toBe(201);
    expect(createDiagnosticStart).toHaveBeenCalledWith(mocks.client, expect.any(String), undefined, null, expect.anything(), count, "data-engineer");
    expect(scheduleFunnelEvent).toHaveBeenCalledWith(expect.any(Request), "diagnostic_started", sessionId, { session_id: sessionId, length: count, cert_id: "data-engineer" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("defaults beta requests to five while preserving PMLE default twenty", async () => {
    await start(request({ certId: "data-engineer" }));
    expect(vi.mocked(createDiagnosticStart).mock.calls[0].slice(5)).toEqual([5, "data-engineer"]);
    await start(request({}));
    expect(vi.mocked(createDiagnosticStart).mock.calls[1].slice(5)).toEqual([20]);
  });
  it.each(["unknown", "cloud-developer", "GCP_PM_ML_ENG", ""])("returns 404 for unknown or out-of-scope cert %s before identity or client reads", async certId => {
    expect((await start(request({ certId, questionCount: 5 }))).status).toBe(404);
    expect(mocks.credentials).not.toHaveBeenCalled(); expect(mocks.createClient).not.toHaveBeenCalled(); expect(createDiagnosticStart).not.toHaveBeenCalled();
  });
  it("rejects beta twenty before identity or client reads", async () => {
    const response = await start(request({ certId: "data-engineer", questionCount: 20 }));
    expect(response.status).toBe(400); expect(mocks.credentials).not.toHaveBeenCalled(); expect(createDiagnosticStart).not.toHaveBeenCalled();
  });
  it("preserves the eligibility service's 404 without cookies or analytics", async () => {
    vi.mocked(createDiagnosticStart).mockRejectedValue(new DiagnosticError(404, "Diagnostic not found"));
    const response = await start(request({ certId: "data-engineer", questionCount: 5 }));
    expect(response.status).toBe(404); expect(response.headers.get("set-cookie")).toBeNull(); expect(scheduleFunnelEvent).not.toHaveBeenCalled();
  });
  it("still rejects client-supplied owner and exam fields", async () => {
    for (const extra of [{ exam: "data-engineer" }, { userId: "victim" }]) expect((await start(request({ certId: "data-engineer", ...extra }))).status).toBe(400);
    expect(createDiagnosticStart).not.toHaveBeenCalled();
  });
});
describe("beta results email API", () => {
  it("rejects owned beta results and never invokes email transport", async () => {
    const response = await email(request({ email: "reader@example.com", consent: true }), context);
    expect(response.status).toBe(404); expect(sendResultsEmail).not.toHaveBeenCalled();
    expect(diagnosticResults).toHaveBeenCalledWith(mocks.client, sessionId, { userId: null, anonymousToken: null });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("preserves ownership-first errors before cert denial", async () => {
    vi.mocked(diagnosticResults).mockRejectedValue(new DiagnosticError(404, "Diagnostic not found"));
    const response = await email(request({ email: "reader@example.com", consent: true }), context);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Diagnostic not found" }); expect(sendResultsEmail).not.toHaveBeenCalled();
  });
  it("continues sending for the persisted public PMLE slug", async () => {
    const result = { sessionId, certId: "machine-learning-engineer", totalQuestions: 5, correctAnswers: 3, score: 60, readiness: { id: "building" as const, label: "Building", description: "Guidance" }, domainBreakdown: [] };
    vi.mocked(diagnosticResults).mockResolvedValue(result);
    expect((await email(request({ email: "reader@example.com", consent: true }), context)).status).toBe(200);
    expect(sendResultsEmail).toHaveBeenCalledWith(mocks.client, "reader@example.com", result);
  });
});
