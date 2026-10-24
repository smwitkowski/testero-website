import type { Metadata } from "next";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { requireUser } from "@/lib/auth/require-user";
import { CheckoutStatus } from "@/components/checkout-status";

export const metadata: Metadata = { title: "Checkout confirmation" };
export const dynamic = "force-dynamic";
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string | string[] }> }) {
  const query = await searchParams;
  const raw = query.session_id;
  const sessionId = typeof raw === "string" && /^cs_[A-Za-z0-9_]{1,240}$/.test(raw) ? raw : null;
  await requireUser(`/checkout/success${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`);
  return <div className="mx-auto max-w-2xl space-y-6"><h1 className="text-3xl font-semibold tracking-tight">Checkout confirmation</h1><p className="text-muted-foreground">PMLE Pass: {PMLE_PASS_PRICE_DISPLAY} one-time payment for 90 days of explanations, timed mock exams, fresh-first practice and weak-area drills. No subscription. No auto-renew.</p><CheckoutStatus sessionId={sessionId} /></div>;
}
