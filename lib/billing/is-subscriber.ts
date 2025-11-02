import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Checks if a user has an active or valid trialing subscription
 * @param userId - The Supabase user ID
 * @returns true if user has active subscription or valid trialing subscription (trial_ends_at in future)
 */
export async function isSubscriber(userId: string): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("status, trial_ends_at")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    if (error || !data) return false;
    
    // Active subscription always allows access
    if (data.status === "active") return true;
    
    // Trialing subscription only allows access if trial_ends_at is in the future
    if (data.status === "trialing") {
      return !!data.trial_ends_at && new Date(data.trial_ends_at) > new Date();
    }
    
    return false;
  } catch (error) {
    // Handle any unexpected errors (network, database connection, etc.)
    console.error("Error checking subscription status:", error);
    return false;
  }
}

