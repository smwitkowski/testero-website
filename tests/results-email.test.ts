import { beforeEach, expect, it, vi } from "vitest";
import { sendResultsEmail, resultsEmailText, resultsEmailHtml, resultsEmailPlan } from "@/lib/diagnostic/results-email";
import { getExamReadinessTier } from "@/lib/readiness";
import type { SupabaseClient } from "@supabase/supabase-js";
const result = { sessionId: "00000000-0000-4000-8000-000000000001", score: 50, correctAnswers: 10, totalQuestions: 20, readiness: getExamReadinessTier(50), domainBreakdown: [{ domainCode: "MONITORING_ML_SOLUTIONS", domainName: "Monitoring AI solutions", total: 3, correct: 1, percentage: 33 }], review: [{ explanation: "PAID SECRET" }] };
const rpc = vi.fn(); const eq = vi.fn(); const update = vi.fn();
const client = { rpc, from: vi.fn(() => ({ update })) } as unknown as SupabaseClient;
beforeEach(() => {
 vi.stubEnv("RESEND_API_KEY", "mock-key");
 rpc.mockResolvedValue({ data: { status: "claimed", id: "request-id", payload: "frozen original payload" }, error: null });
 eq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }); update.mockReturnValue({ eq });
 vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ id: "receipt" })));
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
 expect(text).toContain("Plan ends: 2026-11-14"); expect(text).not.toContain("Exam:"); expect(text).toContain("Week 4:"); expect(text).toContain("4 hours/week"); expect(text).toContain("16h total");
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

it("gives a weaker sampled domain numerically more study time", () => {
 const make = (correct: number) => resultsEmailText({ ...result, domainBreakdown: [{ domainCode: "MONITORING_ML_SOLUTIONS", domainName: "Monitoring AI solutions", correct, total: 4, percentage: correct * 25 }] } as never, Date.parse("2026-10-17T12:00:00Z"));
 const monitoringMinutes = (text: string) => [...text.matchAll(/- Monitoring AI solutions: (?:(\d+)h)?(?: )?(?:(\d+)(?:m|min))?/g)].reduce((sum, match) => sum + Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0), 0);
 expect(monitoringMinutes(make(0))).toBeGreaterThan(monitoringMinutes(make(4)));
});

it("freezes HTML and text before sending and reuses both on retry", async () => {
 rpc.mockImplementation(async (_name, args) => ({ data: { status: "claimed", id: "request-id", payload: args.p_payload }, error: null }));
 await sendResultsEmail(client, "a@example.com", result as never);
 const frozen = rpc.mock.calls[0][1].p_payload as string;
 const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
 expect(body.text).toContain("Your PMLE diagnostic results");
 expect(body.html).toContain("<!doctype html>");
 expect(body.html).not.toContain("PAID SECRET");
 rpc.mockResolvedValue({ data: { status: "claimed", id: "request-id", payload: frozen }, error: null });
 await sendResultsEmail(client, "a@example.com", { ...result, score: 99 } as never);
 expect(vi.mocked(fetch).mock.calls[1][1]?.body).toBe(vi.mocked(fetch).mock.calls[0][1]?.body);
});
it("escapes dynamic HTML without including review data or access tokens", () => {
 const html = resultsEmailHtml({ ...result, domainBreakdown: [{ ...result.domainBreakdown[0], domainName: '<img src=x onerror="alert(1)">' }] } as never);
 expect(html).toContain("&lt;img");
 expect(html).not.toContain('<img src=x');
 expect(html).not.toContain("PAID SECRET");
 expect(html).not.toContain("token=");
 expect(html).toContain("same browser");
 expect(html).toContain(`https://testero.ai/diagnostic/${result.sessionId}/results`);
});
it.each([0, 1, 2, 3, 4])("allocates whole quarter-hours without changing the 16-hour budget (%s/4 correct)", correct => {
 const plan = resultsEmailPlan({ ...result, domainBreakdown: [{ ...result.domainBreakdown[0], total: 4, correct }] } as never);
 expect(plan.weeks).toHaveLength(4);
 expect(plan.totalMinutes).toBe(960);
 expect(plan.sections.reduce((sum, section) => sum + section.minutes, 0)).toBe(960);
 for (const week of plan.weeks) {
  expect(week.minutes).toBe(240);
  expect(week.tasks.reduce((sum, task) => sum + task.minutes, 0)).toBe(240);
  for (const task of week.tasks) { expect(task.minutes).toBeGreaterThan(0); expect(task.minutes % 15).toBe(0); }
 }
});
it("fails closed on malformed multipart payload without contacting the provider", async () => {
 rpc.mockResolvedValue({ data: { status: "claimed", id: "request-id", payload: 'testero-results-multipart-v1\n{}' }, error: null });
 await expect(sendResultsEmail(client, "a@example.com", result as never)).rejects.toThrow("We couldn't send your email");
 expect(fetch).not.toHaveBeenCalled();
});

it.each([resultsEmailText, resultsEmailHtml])("omits quick-check domain scores and weak-domain advice from email", render => {
 const quick = { ...result, correctAnswers: 2, totalQuestions: 5, score: 40, readiness: getExamReadinessTier(40), domainBreakdown: [{ ...result.domainBreakdown[0], domainName: "Weakest sampled sentinel", total: 1, correct: 0, percentage: 0 }] };
 const body = render(quick as never);
 expect(body).toContain("2/5 correct (40%)");
 expect(body).toContain("Study guidance: Building");
 expect(body).not.toContain("Scores by domain");
 expect(body).not.toContain("Weakest sampled");
 expect(body).not.toContain("sampled error rate");
 expect(body).toContain("https://testero.ai/diagnostic?length=20");
 expect(body).toContain("per-domain breakdown");
 expect(body).toContain("official section weight");
});
it.each([10, 20])("retains domain scores and weak-domain advice in %s-question emails", totalQuestions => {
 for (const render of [resultsEmailText, resultsEmailHtml]) {
  const body = render({ ...result, totalQuestions } as never);
  expect(body).toContain("Scores by domain");
  expect(body).toContain("Weakest sampled domains");
  expect(body).toContain("Monitoring AI solutions");
  expect(body).toContain("33%");
 }
});
it("does not bias the quick-check study plan toward a one-question domain score", () => {
 const quick = { ...result, totalQuestions: 5 };
 const make = (correct: number) => resultsEmailPlan({ ...quick, domainBreakdown: [{ ...result.domainBreakdown[0], correct, total: 1, percentage: correct * 100 }] } as never, Date.parse("2026-10-17T12:00:00Z"));
 expect(make(0)).toEqual(make(1));
});
