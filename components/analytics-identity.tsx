"use client";
import { useEffect } from "react";
import { identifyAnalytics } from "@/lib/analytics/client";

export function AnalyticsIdentity({ userId }: { userId: string }) {
  useEffect(() => { identifyAnalytics(userId); }, [userId]);
  return null;
}
