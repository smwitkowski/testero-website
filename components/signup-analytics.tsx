"use client";
import { useEffect } from "react";
import { identifyAnalytics, trackSignupCompleted } from "@/lib/analytics/client";
/** Mounted for a verified user after a confirmed signup callback. */
export function SignupAnalytics({ userId }: { userId: string }) {
  useEffect(() => {
    identifyAnalytics(userId);
    const key = `testero:signup-confirmed:${userId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { return; }
    trackSignupCompleted();
  }, [userId]);
  return null;
}
