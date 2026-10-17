import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { PricingAction } from "@/components/pricing-action";
import { Button } from "@/components/ui/button";

export const metadata = pageMetadata("PMLE Pass pricing", "PMLE Pass: $39 one-time payment. 90 days of access to PMLE practice questions and explanations. No subscription. No auto-renew. 7-day refund window.", "/pricing");
export default function PricingPage() {
  return <div className="mx-auto max-w-[916px] space-y-10">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">Pricing</h1><p className="text-lg leading-relaxed text-muted-foreground">Start free. Buy PMLE Pass when you want full explanations and unlimited practice.</p></header>
    <div className="grid gap-6 md:grid-cols-2">
      <section aria-labelledby="free-plan" className="flex flex-col items-start gap-6 rounded-lg border border-border bg-card p-6 sm:p-8">
        <div className="space-y-3"><h2 id="free-plan" className="text-xl font-semibold">Free</h2><p className="text-4xl font-semibold">$0</p></div>
        <ul className="w-full divide-y divide-border text-body"><li className="py-3">20-question diagnostic, no account needed</li><li className="py-3">Overall score, readiness tier and domain scores</li><li className="py-3">Answer review with an account: your answer and the correct one</li><li className="py-3">5 practice questions per week with an account</li><li className="py-3">One full diagnostic explanation free; all explanations with PMLE Pass</li></ul>
        <Button variant="outline" asChild className="mt-auto"><Link href="/diagnostic">Start the free diagnostic</Link></Button>
      </section>
      <section aria-labelledby="paid-plan" className="on-dark flex flex-col items-start gap-6 rounded-lg bg-foreground p-6 text-card sm:p-8">
        <div className="space-y-3"><h2 id="paid-plan" className="text-xl font-semibold">PMLE Pass</h2><p className="text-sm text-on-dark-secondary">90 days of access to PMLE practice questions and explanations</p><p className="text-4xl font-semibold">$39 one-time payment <span className="text-base font-normal text-on-dark-secondary">USD</span></p></div>
        <ul className="list-disc space-y-3 pl-5 text-on-dark-secondary"><li>Everything in Free</li><li>Explanations for the question and every option after answering</li><li>Unlimited 5-question practice sessions from the current question bank</li><li>Practice by domain, including your weakest</li></ul>
        <dl className="space-y-4 text-sm"><div><dt className="font-semibold">No subscription. No auto-renew.</dt><dd className="text-on-dark-secondary">Access ends after 90 days. You are not charged again.</dd></div><div><dt className="font-semibold">7-day refund window</dt><dd className="text-on-dark-secondary">A refund ends pass access. Contact <a href="mailto:support@testero.ai" className="underline">support@testero.ai</a>.</dd></div><div><dt className="font-semibold">PMLE only</dt><dd className="text-on-dark-secondary">One exam, all six domains. Updated for the June 2026 exam guide.</dd></div></dl>
        <div className="mt-auto"><PricingAction /></div>
      </section>
    </div>
    <section aria-labelledby="pricing-questions" className="space-y-5"><h2 id="pricing-questions" className="text-2xl font-semibold">Questions</h2><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">{[
      ["Do I need PMLE Pass for the diagnostic?", "No. The diagnostic and its full report are free, with or without an account."],
      ["What happens after 90 days?", "Pass features end. Nothing renews and you are not charged again."],
      ["Is Testero affiliated with Google?", "No. Testero is independent and not affiliated with or endorsed by Google."],
      ["Does a high score mean I will pass?", "No. Readiness tiers are study guidance, not an official pass threshold."],
    ].map(([question, answer]) => <article key={question} className="space-y-2"><h3 className="font-semibold">{question}</h3><p className="leading-relaxed text-muted-foreground">{answer}</p></article>)}</div></section>
  </div>;
}
