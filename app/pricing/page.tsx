import { pageMetadata } from "@/lib/seo";
import { PricingAction, PricingAccessProvider } from "@/components/pricing-action";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export const metadata = pageMetadata("PMLE Pass pricing", "PMLE Pass: $39 one-time payment. 90 days of access to PMLE practice questions and explanations. No subscription. No auto-renew. 7-day refund window.", "/pricing");
export default function PricingPage() {
  return <div className="mx-auto max-w-[916px] space-y-10">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">Pricing</h1><p className="text-lg leading-relaxed text-muted-foreground">Start free. Buy PMLE Pass when you want full explanations and unlimited practice.</p></header>
    <PricingAccessProvider><div className="grid gap-6 md:grid-cols-2">
      <Card className="order-2 md:order-1" variant="subtle" role="region" aria-labelledby="free-plan">
        <CardHeader><CardTitle id="free-plan">Free</CardTitle><p className="text-4xl font-semibold">$0</p></CardHeader>
        <CardContent><ul className="space-y-3 text-body"><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Free · 5, 10 or 20 questions, no account needed</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Overall score, readiness tier and domain scores</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Answer review with an account: your answer and the correct one</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>5 practice questions per week with an account</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>One full diagnostic explanation free; all explanations with PMLE Pass</span></li></ul></CardContent>
        <CardFooter><PricingAction free /></CardFooter>
      </Card>
      <Card className="order-1 md:order-2" variant="featured" role="region" aria-labelledby="paid-plan">
        <CardHeader><CardTitle id="paid-plan">PMLE Pass</CardTitle><p className="py-2"><span className="inline-flex items-baseline gap-2 whitespace-nowrap"><span className="text-6xl font-semibold tracking-tight">$39</span><span className="text-sm text-muted-foreground">USD</span></span></p><p className="text-sm font-semibold uppercase tracking-wide text-primary">One-time payment</p><p className="text-sm text-muted-foreground">90 days of access to PMLE practice questions and explanations</p></CardHeader>
        <CardContent className="space-y-6"><ul className="space-y-3 text-body"><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Everything in Free</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Explanations for the question and every option after answering</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Unlimited 5-question practice sessions from the current question bank</span></li><li className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>Practice by domain, including your weakest</span></li></ul>
        <dl className="space-y-4 text-sm"><div><dt className="font-semibold">No subscription. No auto-renew.</dt><dd className="text-muted-foreground">Access ends after 90 days. You are not charged again.</dd></div><div><dt className="font-semibold">7-day refund window</dt><dd className="text-muted-foreground">A refund ends pass access. Contact <a href="mailto:support@testero.ai" className="underline">support@testero.ai</a>.</dd></div><div><dt className="font-semibold">PMLE only</dt><dd className="text-muted-foreground">One exam, all six domains. Updated for the June 2026 exam guide.</dd></div></dl></CardContent>
        <CardFooter className="[&>button]:w-full [&>a]:w-full [&>div]:w-full"><PricingAction /></CardFooter>
      </Card>
    </div></PricingAccessProvider>
    <section aria-labelledby="pricing-questions" className="space-y-5"><h2 id="pricing-questions" className="text-2xl font-semibold">Questions</h2><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">{[
      ["Do I need PMLE Pass for the diagnostic?", "No. The diagnostic and its full report are free, with or without an account."],
      ["What happens after 90 days?", "Pass features end. Nothing renews and you are not charged again."],
      ["Is Testero affiliated with Google?", "No. Testero is independent and not affiliated with or endorsed by Google."],
      ["Does a high score mean I will pass?", "No. Readiness tiers are study guidance, not an official pass threshold."],
    ].map(([question, answer]) => <article key={question} className="space-y-2"><h3 className="font-semibold">{question}</h3><p className="leading-relaxed text-muted-foreground">{answer}</p></article>)}</div></section>
  </div>;
}
