"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/checkout-button";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { trackResults } from "@/lib/analytics/client";
import type { DiagnosticResult } from "@/lib/diagnostic/types";

export function DiagnosticUnlockCard({ result, signedIn = false }: { result: DiagnosticResult; signedIn?: boolean }) {
  return <section aria-label="Unlock PMLE Pass" className="space-y-3 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 className="text-xl font-semibold">See why each option is right or wrong</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">Explanations for every question + progress tracking + unlimited practice · $39 one-time, 90 days · no auto-renew.</p>
    {signedIn ? <CheckoutButton onCheckout={() => trackResults("unlock_cta_clicked", result)} /> : <Button asChild><Link href="/signup?next=%2Fpricing" onClick={() => trackResults("unlock_cta_clicked", result)}>Unlock PMLE Pass: $39</Link></Button>}
    {!signedIn && <p className="text-sm text-muted-foreground">Create an account, then continue to checkout for PMLE Pass.</p>}
  </section>;
}

export function DiagnosticPassOption({ result }: { result: DiagnosticResult }) {
  return <Button asChild variant="outline"><Link href={result.review ? "/pricing" : "/signup?next=%2Fpricing"} onClick={() => trackResults("unlock_cta_clicked", result)}>PMLE Pass · $39 / 90 days</Link></Button>;
}

export function SignedInDiagnosticUnlock({ result, compact = false }: { result: DiagnosticResult; compact?: boolean }) {
  const { data, error, reload } = useDiagnosticResource<{ signedIn: boolean; owned?: boolean }>("/api/billing/access");
  if (error) return <p role="status">Unable to check pass access. <button className="text-primary underline" onClick={reload}>Retry access check</button></p>;
  if (!data?.signedIn || data.owned) return null;
  return compact ? <DiagnosticPassOption result={result} /> : <DiagnosticUnlockCard result={result} signedIn />;
}
