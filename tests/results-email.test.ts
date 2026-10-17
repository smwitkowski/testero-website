import { beforeEach, expect, it, vi } from "vitest";
import { sendResultsEmail, resultsEmailText } from "@/lib/diagnostic/results-email";
import { getExamReadinessTier } from "@/lib/readiness";
import type { SupabaseClient } from "@supabase/supabase-js";
const result = { sessionId: "00000000-0000-4000-8000-000000000001", score: 50, correctAnswers: 10, totalQuestions: 20, readiness: getExamReadinessTier(50), domainBreakdown: [{ domainCode: "MONITORING_ML_SOLUTIONS", domainName: "Monitoring AI solutions", total: 3, correct: 1, percentage: 33 }], review: [{ explanation: "PAID SECRET" }] };
const rpc = vi.fn(); const eq = vi.fn(); const update = vi.fn();
const client = { rpc, from: vi.fn(() => ({ update })) } as unknown as SupabaseClient;
beforeEach(() => {
 vi.stubEnv("RESEND_API_KEY", "mock-key");
 rpc.mockResolvedValue({ data: { status: "claimed", id: "request-id", payload: "frozen original payload" }, error: null });
 eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }); update.mockReturnValue({ eq });
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "receipt" })));
});
it("sends frozen aggregate-only content with stable provider idempotency and records success", async () => {
 await sendResultsEmail(client, "a@example.com", result as never);
 expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "results-request-id" }), body: JSON.stringify({ from: "Testero <no-reply@testero.ai>", to: ["a@example.com"], subject: "Your PMLE results + 4-week study plan", text: "frozen original payload" }) }));
 expect(update).toHaveBeenCalledWith(expect.objectContaining({ sent_at: expect.any(String), lease_token: null }));
});
it.each(["sent", "busy", "limited", "expired"])("never sends for %s", async status => {
 rpc.mockResolvedValue({ data: { status }, error: null });
 if (status === "sent") await sendResultsEmail(client, "a@example.com", result as never);
 else await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow();
 expect(fetch).not.toHaveBeenCalled();
});
it("keeps lease on ambiguous failure and hides provider errors", async () => {
 vi.mocked(fetch).mockRejectedValue(new Error("sensitive provider response"));
 await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow("We couldn't send your email");
 expect(update).not.toHaveBeenCalled();
});
it("fails closed without configuration or after persistence failure", async () => {
 vi.stubEnv("RESEND_API_KEY", "");
 await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow();
 expect(rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
it("builds four weighted weeks without review or authorization tokens", () => {
 const text = resultsEmailText(result as never, Date.parse("2026-10-17T12:00:00Z"));
 expect(text).toContain("Week 4:"); expect(text).toContain("4 hours/week"); expect(text).toContain("16h total");
 expect(text).toContain("https://testero.ai/pricing"); expect(text).toContain("same browser");
 expect(text).not.toContain("PAID SECRET"); expect(text).not.toContain("token=");
});

it("retries the exact provider key after a successful send whose database acknowledgement fails", async () => {
 eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "db unavailable" } }) });
 await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow();
 await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow();
 const calls = vi.mocked(fetch).mock.calls;
 expect(calls).toHaveLength(2);
 expect(calls[0][1]?.body).toEqual(calls[1][1]?.body);
 expect(calls[0][1]?.headers).toEqual(calls[1][1]?.headers);
});
