"use client";
import { useEffect } from "react";
import { trackSignupCompleted } from "@/lib/analytics/client";
/** Mounted by the verified dashboard only after a confirmed signup callback. */
export function SignupAnalytics({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `testero:signup-confirmed:${userId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { return; }
    trackSignupCompleted();
  }, [userId]);
  return null;
}
