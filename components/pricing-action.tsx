"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckoutButton } from "@/components/checkout-button";
import { Button } from "@/components/ui/button";
import { accessDate } from "@/lib/billing/dates";

type Access = { signedIn: boolean; owned?: boolean; expiresAt?: string | null };
const PricingAccess = createContext<{ access: Access; error: boolean }>({ access: { signedIn: false }, error: false });
export function PricingAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>({ signedIn: false });
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing/access", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Billing unavailable");
        return response.json();
      })
      .then(data => { if (!controller.signal.aborted) setAccess(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);
  return <PricingAccess.Provider value={{ access, error }}>{children}</PricingAccess.Provider>;
}
export function PricingAction({ free = false }: { free?: boolean }) {
  const { access, error } = useContext(PricingAccess);
  if (free) return <Button variant="outline" asChild className="w-full"><Link href={access.signedIn ? "/dashboard" : "/diagnostic"}>{access.signedIn ? "Go to dashboard" : "Start the free diagnostic"}</Link></Button>;
  if (error) return <p role="status">Unable to check pass access. <Link className="underline" href="/account">Check your account</Link> or reload to try again.</p>;
  if (access.owned) return <div className="space-y-3"><p role="status" className="font-semibold">{access.expiresAt ? <>You have PMLE Pass until <time dateTime={access.expiresAt}>{accessDate(access.expiresAt)}</time>.</> : "Your active subscription already includes PMLE Pass features."}</p><Button asChild><Link href="/dashboard">Go to practice</Link></Button></div>;
  return access.signedIn ? <CheckoutButton /> : <Button asChild><Link href="/signup?next=/pricing">Create an account to get PMLE Pass</Link></Button>;
}
