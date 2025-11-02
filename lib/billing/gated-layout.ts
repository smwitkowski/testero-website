import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isBillingEnforcementActive } from "@/lib/billing/enforcement";
import { isSubscriber } from "@/lib/billing/is-subscriber";

type FeatureName = "diagnostic" | "practice";

/**
 * Creates a redirect URL for gated features
 */
function createGatedRedirectUrl(feature: FeatureName): string {
  return `/pricing?gated=1&feature=${feature}`;
}

/**
 * Checks if user should have access to gated content
 * Returns true if access is allowed, false if redirect should occur
 */
async function checkAccess(): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    return user ? await isSubscriber(user.id) : false;
  } catch (error) {
    // Handle any errors (auth failure, network issues, etc.)
    // Fail closed - redirect to pricing if check fails
    console.error("Error checking access:", error);
    return false;
  }
}

/**
 * Server-side layout gating for premium features
 * Redirects to pricing page if enforcement is active and user is not a subscriber
 */
export function createGatedLayout(feature: FeatureName) {
  return async function Layout({ children }: { children: React.ReactNode }) {
    // If enforcement is not active, allow all access
    if (!isBillingEnforcementActive()) {
      return children;
    }

    // Check user authentication and subscription status
    const allowed = await checkAccess();
    
    if (!allowed) {
      redirect(createGatedRedirectUrl(feature));
    }

    return children;
  };
}

