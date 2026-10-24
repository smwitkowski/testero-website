"use client";

import Link from "next/link";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@/components/checkout-button";
import { useDiagnosticResource } from "@/components/diagnostic-resource";
import { trackResults } from "@/lib/analytics/client";
import type { DiagnosticResult } from "@/lib/diagnostic/types";

export function DiagnosticUnlockCard({ result, signedIn = false }: { result: DiagnosticResult; signedIn?: boolean }) {
  return <section aria-label="Unlock PMLE Pass" className="space-y-3 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 className="text-xl font-semibold">Get explanations for every question</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">Every option explained, timed mock exams, fresh-first practice and weak-area drills. {PMLE_PASS_PRICE_DISPLAY} one-time for 90 days. No auto-renew. 7-day refund.</p>
    {signedIn ? <CheckoutButton label={`Get PMLE Pass: ${PMLE_PASS_PRICE_DISPLAY}`} onCheckout={() => trackResults("unlock_cta_clicked", result)} /> : <Button asChild><Link href="/signup?next=%2Fpricing" onClick={() => trackResults("unlock_cta_clicked", result)}>Get PMLE Pass: {PMLE_PASS_PRICE_DISPLAY}</Link></Button>}
    {!signedIn && <p className="text-sm text-muted-foreground">Free account first, then checkout. Nothing is charged until checkout.</p>}
  </section>;
}

export function DiagnosticPassOption({ result }: { result: DiagnosticResult }) {
  return <Button asChild variant="outline"><Link href="/pricing" onClick={() => trackResults("unlock_cta_clicked", result)}>See PMLE Pass</Link></Button>;
}

export function SignedInDiagnosticUnlock({ result, compact = false }: { result: DiagnosticResult; compact?: boolean }) {
  const { data, error, reload } = useDiagnosticResource<{ signedIn: boolean; owned?: boolean }>("/api/billing/access");
  if (error) return <p role="status">Unable to check pass access. <button className="text-primary underline" onClick={reload}>Retry access check</button></p>;
  if (!data?.signedIn || data.owned) return null;
  return compact ? <DiagnosticPassOption result={result} /> : <DiagnosticUnlockCard result={result} signedIn />;
}
