import type { Metadata } from "next";
import Link from "next/link";
import { getVerifiedUser } from "@/lib/auth/session";
import { CheckoutButton } from "@/components/checkout-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "PMLE Pass pricing" };
export const dynamic = "force-dynamic";
export default async function PricingPage() {
  const user = await getVerifiedUser();
  return <div className="mx-auto max-w-2xl space-y-8">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">PMLE Pass</h1><p className="leading-relaxed text-muted-foreground">Explanations and focused practice for your PMLE preparation.</p></header>
    <Card>
      <CardHeader className="space-y-3"><h2 className="text-xl font-semibold">90 days of access</h2><p className="text-4xl font-semibold">$39 <span className="text-base font-normal text-muted-foreground">USD · one-time</span></p><p>No auto-renew. 7-day refund window. A refund ends pass access.</p></CardHeader>
      <CardContent className="space-y-6">
        <ul className="list-disc space-y-2 pl-5"><li>Question and per-option explanations after answering</li><li>Unlimited practice sessions, with 5 questions per session</li><li>Domain-targeted practice and saved readiness results</li></ul>
        {user ? <CheckoutButton /> : <Button asChild><Link href="/signup?next=/pricing">Create an account to get PMLE Pass</Link></Button>}
      </CardContent>
    </Card>
    <section className="space-y-3"><h2 className="text-xl font-semibold">Start for free</h2><p className="leading-relaxed text-muted-foreground">Take a free diagnostic. A free account includes question review, saved results, and 5 practice questions per week.</p><Button variant="outline" asChild><Link href="/diagnostic">Start free diagnostic</Link></Button></section>
  </div>;
}
