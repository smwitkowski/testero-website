import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/question-reports/route";
import { submitQuestionReport } from "@/lib/question-reports/service";
vi.mock("@/lib/question-reports/service", () => ({ submitQuestionReport: vi.fn() }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: vi.fn(async () => ({ userId: null, anonymousToken: "cookie-only" })) }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: vi.fn(() => ({})) }));
const body = { sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "diagnostic", reason: "typo" };
function request(value: unknown, origin = "http://localhost") { return new Request("http://localhost/api/question-reports", { method: "POST", headers: { origin }, body: JSON.stringify(value) }); }
beforeEach(() => { vi.mocked(submitQuestionReport).mockReset().mockResolvedValue(undefined); });
it("returns only acknowledgement and no-store after a successful write", async () => {
 const response = await POST(request(body));
 expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
 expect(await response.json()).toEqual({ message: "Thanks, we review every report." });
 expect(submitQuestionReport).toHaveBeenCalledWith({}, { ...body, note: "", email: "" }, { userId: null, anonymousToken: "cookie-only" });
});
it("rejects foreign origins, impersonation and malformed requests before writes", async () => {
 expect((await POST(request(body,"https://evil.example"))).status).toBe(403);
 expect((await POST(request({ ...body,userId:"victim" }))).status).toBe(400);
 expect((await POST(new Request("http://localhost/api/question-reports",{ method:"POST",body:"broken" }))).status).toBe(400);
 expect(submitQuestionReport).not.toHaveBeenCalled();
});
it("never returns private failure detail", async () => {
 vi.mocked(submitQuestionReport).mockRejectedValue(new Error("private bank and PII"));
 const response = await POST(request(body)); expect(response.status).toBe(503);
 expect(await response.text()).not.toContain("private bank");
});
