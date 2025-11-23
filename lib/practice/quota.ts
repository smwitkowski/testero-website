import { SupabaseClient } from "@supabase/supabase-js";

export interface QuotaUsage {
  sessions_started: number;
  questions_served: number;
  week_start?: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  usage?: QuotaUsage;
  error?: "FREE_QUOTA_EXCEEDED";
}

/**
 * Checks if a user has exceeded their weekly practice quota and increments it if not.
 * 
 * Quota: 1 session OR 5 questions per week per exam.
 * 
 * @param supabase Supabase client
 * @param userId User ID
 * @param examKey Exam key (e.g., "pmle")
 * @param questionCount Number of questions in the new session
 * @returns QuotaCheckResult
 */
export async function checkAndIncrementQuota(
  supabase: SupabaseClient,
  userId: string,
  examKey: string,
  questionCount: number
): Promise<QuotaCheckResult> {
  // Use RPC for atomic check and update
  const { data, error } = await supabase.rpc("check_and_increment_practice_quota", {
    p_user_id: userId,
    p_exam: examKey,
    p_questions_count: questionCount,
    p_max_sessions: 1,
    p_max_questions: 5
  });

  if (error) {
    console.error("Error checking quota via RPC:", error);
    // Fail secure if RPC fails
    return { allowed: false, error: "FREE_QUOTA_EXCEEDED" };
  }

  if (data && data.allowed === false) {
     return {
         allowed: false,
         error: "FREE_QUOTA_EXCEEDED",
         usage: {
             sessions_started: data.sessions_started,
             questions_served: data.questions_served,
             week_start: data.week_start
         }
     };
  }

  return { allowed: true };
}
