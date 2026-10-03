"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initializeAnalytics, trackPageview } from "@/lib/analytics/client";

function Pageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    initializeAnalytics();
    const query = searchParams.toString();
    trackPageview(`${pathname}${query ? `?${query}` : ""}`);
  }, [pathname, searchParams]);
  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return <>{children}<Suspense fallback={null}><Pageviews /></Suspense></>;
}
