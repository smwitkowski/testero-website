"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnalyticsIdentity } from "@/components/analytics-identity";

const NavigationUser = createContext<string | null>(null);

export function useNavigationUser() { return useContext(NavigationUser); }

export function NavigationIdentity({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/navigation", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted) setUserId(typeof data?.userId === "string" ? data.userId : null); })
      .catch(() => { if (!controller.signal.aborted) setUserId(null); });
    return () => controller.abort();
  }, [pathname]);
  return <NavigationUser.Provider value={userId}>
    {userId && <AnalyticsIdentity userId={userId} />}
    {children}
  </NavigationUser.Provider>;
}

export function AccountNavigation() {
  const userId = useContext(NavigationUser);
  return <>
    <Link href={userId ? "/dashboard" : "/login"} className="inline-flex min-h-12 items-center rounded-md border border-input px-3.5 py-2 text-foreground hover:bg-muted">{userId ? "Dashboard" : "Sign in"}</Link>
    {userId && <Link href="/account" className="inline-flex min-h-12 items-center rounded-md px-3 py-2 hover:bg-muted hover:text-primary">Account</Link>}
  </>;
}
