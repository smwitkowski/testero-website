"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePostHog } from "posthog-js/react";

export default function BillingSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    if (user && posthog) {
      posthog.capture("settings_billing_clicked", {
        user_id: user.id,
      });
    }
    // Redirect to the main billing page
    router.replace("/dashboard/billing");
  }, [router, user, posthog]);

  // Show loading state while redirecting
  return (
      <div className="flex items-center justify-center min-h-96">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to billing...</p>
      </div>
    </div>
  );
}
