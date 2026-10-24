import Link from "next/link";
import { connection } from "next/server";
import { getPmleInventory } from "@/lib/pmle/inventory";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { pageMetadata } from "@/lib/seo";
import { PricingAction, PricingAccessProvider } from "@/components/pricing-action";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export const metadata = pageMetadata("PMLE Pass pricing", `PMLE Pass: ${PMLE_PASS_PRICE_DISPLAY} one-time payment. 90 days of explanations, timed mock exams, fresh-first practice and weak-area drills. No auto-renew. 7-day refund window.`, "/pricing");
export default async function PricingPage() {
  await connection();
  const inventory = await getPmleInventory();
  const freeFeatures = [
    "Diagnostic of 5, 10 or 20 questions, no account needed",
    "Practice with no monthly limit, with a free account",
    "Right/wrong and the correct answer after each question",
    "Progress tracking: per-domain history and practice stats",
    "Saved diagnostic report and answer review",
    "One full diagnostic explanation free; all explanations with PMLE Pass",
  ];
  const passFeatures = [
    "Everything in Free",
    "Explanations for the question and every option after answering",
    "Timed mock exams: 50 questions, 120 minutes, scores by domain and full review",
    "Fresh-first practice: unanswered questions first, then repeats when needed",
    "Weak-area drills: practice your lowest-scoring areas, with a diagnostic focus fallback when history is limited",
    "Pass-only question variants: the same decision in a new context",
  ];
  return <div className="mx-auto max-w-[916px] space-y-10">
    <header className="space-y-3"><h1 className="text-3xl font-semibold tracking-tight">Pricing</h1><p className="text-lg leading-relaxed text-muted-foreground">Practice and track your progress free. Add PMLE Pass for explanations, timed mock exams, fresh-first practice and weak-area drills.</p>
      {inventory && <p className="leading-relaxed text-body">Unlimited practice from {inventory.count} questions, updated weekly. Original PMLE questions across {inventory.domainCount === 6 ? "all six domains" : `${inventory.domainCount} domains`}; practice can repeat questions.</p>}
    </header>
    <PricingAccessProvider><div className="grid gap-6 md:grid-cols-2">
      <Card className="order-2 md:order-1" variant="subtle" role="region" aria-labelledby="free-plan">
        <CardHeader><CardTitle id="free-plan">Free</CardTitle><p className="text-4xl font-semibold">$0</p></CardHeader>
        <CardContent><ul className="space-y-3 text-body">{freeFeatures.map(feature => <li key={feature} className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>{feature}</span></li>)}</ul></CardContent>
        <CardFooter><PricingAction free /></CardFooter>
      </Card>
      <Card className="order-1 md:order-2" variant="featured" role="region" aria-labelledby="paid-plan">
        <CardHeader><CardTitle id="paid-plan">PMLE Pass</CardTitle><p className="py-2"><span className="inline-flex items-baseline gap-2 whitespace-nowrap"><span className="text-5xl font-semibold tracking-tight sm:text-6xl">{PMLE_PASS_PRICE_DISPLAY}</span><span className="text-sm text-muted-foreground">USD</span></span></p><p className="text-sm font-semibold uppercase tracking-wide text-primary">One-time payment</p><p className="text-sm text-muted-foreground">90 days of PMLE Pass features</p></CardHeader>
        <CardContent className="space-y-6"><ul className="space-y-3 text-body">{passFeatures.map(feature => <li key={feature} className="flex items-start gap-2"><span aria-hidden="true" className="shrink-0 text-primary">✓</span><span>{feature}</span></li>)}</ul>
        <dl className="space-y-4 text-sm"><div><dt className="font-semibold">No subscription. No auto-renew.</dt><dd className="text-muted-foreground">Access ends after 90 days. You are not charged again.</dd></div><div><dt className="font-semibold">7-day refund window</dt><dd className="text-muted-foreground">A refund ends pass access. Contact <a href="mailto:support@testero.ai" className="underline">support@testero.ai</a>. <Link href="/terms" className="underline">Service and refund terms</Link>.</dd></div><div><dt className="font-semibold">PMLE only</dt><dd className="text-muted-foreground">One exam, all six domains. Updated for the June 2026 exam guide.</dd></div></dl></CardContent>
        <CardFooter className="[&>button]:w-full [&>a]:w-full [&>div]:w-full"><PricingAction /></CardFooter>
      </Card>
    </div></PricingAccessProvider>
    <section aria-labelledby="pricing-questions" className="space-y-5"><h2 id="pricing-questions" className="text-2xl font-semibold">Questions</h2><div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">{[
      ["Do I need PMLE Pass for the diagnostic?", "No. The diagnostic and its score report are free, with or without an account. One diagnostic explanation is free; all other explanations need PMLE Pass."],
      ["What's free?", "A confirmed free account gets practice with no monthly limit, right/wrong and the correct answer, plus progress tracking by domain. Sessions can repeat questions. Explanations beyond the free samples need PMLE Pass."],
      ["What does PMLE Pass add?", "Explanations for every option, 50-question timed mock exams, fresh-first practice and weak-area drills. Fresh-first uses unanswered questions before repeats. With limited history, drills use your diagnostic study focus."],
      ["What happens after 90 days?", "Pass features end. Nothing renews and you are not charged again. Free practice and progress tracking remain available."],
      ["Is Testero affiliated with Google?", "No. Testero is independent and not affiliated with or endorsed by Google."],
      ["Does a high score mean I will pass?", "No. Readiness tiers and mock scores are study guidance, not an official pass threshold or prediction."],
    ].map(([question, answer]) => <article key={question} className="space-y-2"><h3 className="font-semibold">{question}</h3><p className="leading-relaxed text-muted-foreground">{answer}</p></article>)}</div></section>
  </div>;
}
