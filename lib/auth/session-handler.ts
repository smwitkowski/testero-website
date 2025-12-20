import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
};

export type SessionResponse = {
  user: SessionUser | null;
};

/**
 * Gets the current authenticated user's session information
 * Returns null user on any error to fail gracefully
 */
export async function getCurrentSession(): Promise<SessionResponse> {
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null };
    }

    return {
      user: {
        id: user.id,
        email: user.email ?? "",
        email_confirmed_at: user.email_confirmed_at ?? null,
      },
    };
  } catch (error) {
    console.error("Session fetch error:", error);
    return { user: null };
  }
}
