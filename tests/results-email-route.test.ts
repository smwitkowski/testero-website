import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/diagnostic/[sessionId]/email/route";
import { diagnosticResults } from "@/lib/diagnostic/service";
import { sendResultsEmail } from "@/lib/diagnostic/results-email";
import { DiagnosticError } from "@/lib/diagnostic/http";
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({})) }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: vi.fn(() => ({ anonymousToken: "cookie", userId: null })) }));
vi.mock("@/lib/diagnostic/service", () => ({ diagnosticResults: vi.fn() }));
vi.mock("@/lib/diagnostic/results-email", () => ({ sendResultsEmail: vi.fn() }));
const context = { params: Promise.resolve({ sessionId: "session-id" }) };
const req = (data: unknown) => new Request("https://testero.ai/api/diagnostic/session-id/email", { method: "POST", headers: { origin: "https://testero.ai" }, body: JSON.stringify(data) });
beforeEach(() => { vi.mocked(diagnosticResults).mockResolvedValue({ score: 50 } as never); });
it("normalizes recipient and authorizes with server credentials before sending", async () => {
 const response = await POST(req({ email: " Person@Example.com ", consent: true }), context);
 expect(response.status).toBe(200);
 expect(diagnosticResults).toHaveBeenCalledWith({}, "session-id", { anonymousToken: "cookie", userId: null });
 expect(sendResultsEmail).toHaveBeenCalledWith({}, "person@example.com", { score: 50 });
});
it.each([404,409])("refuses unauthorized or incomplete results (%s)", async status => {
 vi.mocked(diagnosticResults).mockRejectedValue(new DiagnosticError(status, "No access"));
 expect((await POST(req({ email: "a@example.com", consent: true }), context)).status).toBe(status);
 expect(sendResultsEmail).not.toHaveBeenCalled();
});
it("honeypot never reads results or sends", async () => {
 expect((await POST(req({ email: "a@example.com", consent: true, website: "spam" }), context)).status).toBe(200);
 expect(diagnosticResults).not.toHaveBeenCalled(); expect(sendResultsEmail).not.toHaveBeenCalled();
});
it("requires explicit consent", async () => {
 expect((await POST(req({ email: "a@example.com" }), context)).status).toBe(400);
 expect(sendResultsEmail).not.toHaveBeenCalled();
});
