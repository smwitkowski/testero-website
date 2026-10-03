/** @jest-environment node */
import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GET as current } from "@/app/api/questions/current/route";
import { GET as byId } from "@/app/api/questions/[id]/route";
import { GET as list } from "@/app/api/questions/route";
import { POST as submit } from "@/app/api/questions/submit/route";
import { GET as summary } from "@/app/api/diagnostic/summary/[sessionId]/route";
jest.mock("@/lib/access/pmleEntitlements.server", () => ({ getPmleAccessLevelForRequest: jest.fn() }));
jest.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: jest.fn() }));
jest.mock("@/lib/analytics/server-analytics", () => ({ getServerPostHog: jest.fn(() => null) }));
const access = jest.mocked(getPmleAccessLevelForRequest);
beforeEach(() => jest.clearAllMocks());
const endpoints = [
  ["current", current, "GET"], ["by ID", byId, "GET"],
  ["list", list, "GET"], ["submit", submit, "POST"],
] as const;
describe.each(endpoints)("standalone %s boundary", (_name, handler, method) => {
  it.each([
    ["ANONYMOUS", false], ["ANONYMOUS", true], ["FREE", false], ["FREE", true],
  ] as const)("blocks %s (checkout cookie: %s) before question reads", async (accessLevel, cookie) => {
    access.mockResolvedValue({ accessLevel, user: accessLevel === "FREE" ? { id: "free" } as User : null });
    const req = new NextRequest("http://localhost/api/questions/current", {
      method, headers: cookie ? { cookie: "checkout_grace=signed-cookie" } : {},
      ...(method === "POST" ? { body: JSON.stringify({ questionId: "q", selectedOptionKey: "A" }) } : {}),
    });
    const res = await handler(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "PAYWALL" });
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });
});
it("returns anonymous score and domain breakdown with no question-level payload", async () => {
  access.mockResolvedValue({ accessLevel: "ANONYMOUS", user: null });
  const questions = [{ id: "secret-id", stem: "secret stem", options: [{ label: "A", text: "secret" }],
    correct_label: "A", canonical_question_id: "canonical", original_question_id: null,
    domain_code: "ARCHITECTING_LOW_CODE_ML_SOLUTIONS", domain_id: "domain", diagnostic_responses: [{ selected_label: "A", is_correct: true }] }];
  const from = jest.fn((table) => table === "diagnostics_sessions" ? {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({
      data: { id: "session", anonymous_session_id: "anon", user_id: null, completed_at: "2026-01-01", started_at: "2026-01-01", exam_type: "PMLE" }, error: null,
    }),
  } : { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: questions, error: null }) });
  jest.mocked(createServerSupabaseClient).mockReturnValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) }, from } as unknown as ReturnType<typeof createServerSupabaseClient>);
  const res = await summary(new Request("http://localhost/api/diagnostic/summary/session?anonymousSessionId=anon"));
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.summary.score).toBe(100);
  expect(data.domainBreakdown).toHaveLength(1);
  expect(data.domainBreakdown[0].percentage).toBe(100);
  expect(data.summary).not.toHaveProperty("questions");
  expect(JSON.stringify(data)).not.toMatch(/secret|canonical|correct_label|selected_label|explanation/);
  expect(from).not.toHaveBeenCalledWith("explanations");
});
