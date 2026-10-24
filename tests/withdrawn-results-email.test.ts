import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/diagnostic/[sessionId]/email/route";
import { sendResultsEmail } from "@/lib/diagnostic/results-email";
import { hashAnonymousToken } from "@/lib/diagnostic/ownership";
const token = "a".repeat(64);
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceSupabaseClient: () => database }));
vi.mock("@/lib/diagnostic/request", () => ({ diagnosticCredentials: () => ({ anonymousToken: "a".repeat(64), userId: null }) }));
vi.mock("@/lib/diagnostic/results-email", async original => ({ ...await original<typeof import("@/lib/diagnostic/results-email")>(), sendResultsEmail: vi.fn() }));
it("emails restored completed results through the real snapshot reader without resurrecting skipped content", async () => {
  const items = Array.from({ length: 20 }, (_, n) => ({ id: `item-${n}`, ordinal: n + 1, domain_code: "A", domain_name: "Domain A", stem: n ? "Live" : "Excluded private stem", options: [{ label: "A", text: "One" }, { label: "B", text: "Two" }],
    withdrawn_at: n ? null : "2026-10-24T10:00:00Z", answered_at: n ? "2026-10-24T11:00:00Z" : null, is_correct: n ? true : null,
    questions: { status: "ACTIVE", review_status: "GOOD" } }));
  database.from.mockImplementation((table: string) => {
    const query = { select: () => query, eq: () => query,
      maybeSingle: async () => ({ data: { id, user_id: null, anonymous_owner_hash: hashAnonymousToken(token), question_count: 20, expires_at: "2026-10-25T10:00:00Z", completed_at: "2026-10-24T11:00:00Z" }, error: null }),
      order: async () => ({ data: items, error: null }) };
    expect(["study_sessions", "session_items"]).toContain(table); return query;
  });
  const response = await POST(new Request(`https://testero.ai/api/diagnostic/${id}/email`, { method: "POST", headers: { origin: "https://testero.ai" }, body: JSON.stringify({ email: "local@example.test", consent: true }) }), { params: Promise.resolve({ sessionId: id }) });
  expect(response.status).toBe(200);
  expect(sendResultsEmail).toHaveBeenCalledWith(database, "local@example.test", expect.objectContaining({ totalQuestions: 19, correctAnswers: 19, score: 100, withdrawnCount: 1 }));
  expect(JSON.stringify(vi.mocked(sendResultsEmail).mock.calls)).not.toContain("Excluded private stem");
});
