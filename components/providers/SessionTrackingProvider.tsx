"use client";

import { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { useSessionTracking } from "@/lib/analytics/hooks/useSessionTracking";

export function SessionTrackingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Initialize session tracking with user ID if available
  useSessionTracking(user?.id);

  return <>{children}</>;
}
