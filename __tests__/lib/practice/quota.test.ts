import { checkAndIncrementQuota } from "@/lib/practice/quota";
import { SupabaseClient } from "@supabase/supabase-js";

describe("checkAndIncrementQuota", () => {
  let mockSupabase: SupabaseClient;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    mockRpc = jest.fn();
    mockSupabase = {
      rpc: mockRpc,
    } as unknown as SupabaseClient;
  });

  it("should allow if RPC returns allowed=true", async () => {
    mockRpc.mockResolvedValue({
      data: {
        allowed: true,
        sessions_started: 1,
        questions_served: 5,
        week_start: "2023-10-23",
      },
      error: null,
    });

    const result = await checkAndIncrementQuota(mockSupabase, "user1", "pmle", 5);

    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockRpc).toHaveBeenCalledWith("check_and_increment_practice_quota", {
      p_user_id: "user1",
      p_exam: "pmle",
      p_questions_count: 5,
      p_max_sessions: 1,
      p_max_questions: 5,
    });
  });

  it("should deny if RPC returns allowed=false", async () => {
    mockRpc.mockResolvedValue({
      data: {
        allowed: false,
        sessions_started: 1,
        questions_served: 5,
        week_start: "2023-10-23",
      },
      error: null,
    });

    const result = await checkAndIncrementQuota(mockSupabase, "user1", "pmle", 5);

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("FREE_QUOTA_EXCEEDED");
    expect(result.usage).toEqual({
      sessions_started: 1,
      questions_served: 5,
      week_start: "2023-10-23",
    });
  });

  it("should fail secure if RPC errors", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RPC error" },
    });

    const result = await checkAndIncrementQuota(mockSupabase, "user1", "pmle", 5);

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("FREE_QUOTA_EXCEEDED");
  });
});
