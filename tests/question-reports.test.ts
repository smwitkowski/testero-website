import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitQuestionReport } from "@/lib/question-reports/service";
import { questionReportBody } from "@/lib/question-reports/schema";
import { hashAnonymousToken } from "@/lib/diagnostic/ownership";
const token = "a".repeat(64);
const input = { sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "diagnostic" as const, reason: "typo" as const, note: "", email: "" };
const owner = { user_id: null, anonymous_owner_hash: hashAnonymousToken(token), completed_at: null, expires_at: "2099-01-01" };
let session: unknown;
const rpc = vi.fn();
const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: session, error: null })) };
const client = { from: vi.fn(() => query), rpc } as unknown as SupabaseClient;
beforeEach(() => { session = owner; rpc.mockReset().mockResolvedValue({ error: null }); });
it("accepts only bounded report fields and known reasons", () => {
  expect(questionReportBody.safeParse(input).success).toBe(true);
  for (const extra of [{ reason: "fake" }, { email: "bad" }, { note: "a".repeat(2001) }, { questionId: input.itemId }, { userId: input.sessionId }]) expect(questionReportBody.safeParse({ ...input, ...extra }).success).toBe(false);
});
it("rejects missing, foreign, malformed-owner and expired sessions before report writes", async () => {
  for (const value of [null, { ...owner, anonymous_owner_hash: "b".repeat(64) }, { ...owner, user_id: input.sessionId }, { ...owner, expires_at: "2000-01-01" }]) {
    session = value;
    await expect(submitQuestionReport(client, input, { userId: null, anonymousToken: token })).rejects.toMatchObject({ status: 404 });
  }
  expect(rpc).not.toHaveBeenCalled();
});
it("passes verified credentials and item identity to the atomic membership/rate-limit RPC", async () => {
  await submitQuestionReport(client, input, { userId: null, anonymousToken: token });
  expect(rpc).toHaveBeenCalledWith("submit_question_report", { p_session_id: input.sessionId, p_item_id: input.itemId, p_kind: "diagnostic", p_user_id: null, p_anonymous_owner_hash: hashAnonymousToken(token), p_reason: "typo", p_note: "", p_email: "" });
});
it.each([["42501",404],["P0001",429],["unknown",503]])("sanitizes RPC %s failures", async (code,status) => {
  rpc.mockResolvedValue({ error: { code, message: "private bank details" } });
  await expect(submitQuestionReport(client,input,{ userId:null,anonymousToken:token })).rejects.toMatchObject({ status });
});
