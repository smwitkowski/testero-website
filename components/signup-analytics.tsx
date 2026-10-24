"use client";
import { useEffect } from "react";
import { identifyAnalytics } from "@/lib/analytics/client";
/** Mounted for a verified user after a confirmed signup callback. signup_completed itself is sent by the server. */
export function SignupAnalytics({ userId }: { userId: string }) {
  useEffect(() => { identifyAnalytics(userId); }, [userId]);
  return null;
}
