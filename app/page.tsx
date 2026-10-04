import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getFaqEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Know where to focus your PMLE study", "Take a free PMLE diagnostic, find your weakest exam domains, and practice with a free account or PMLE Pass.", "/");

const steps = [
  { title: "Take the diagnostic", body: "Answer 20 questions across the six PMLE exam domains. No account required." },
  { title: "Find your focus", body: "See your score, readiness tier, and domain breakdown. Use your weakest domains to choose what to study next." },
  { title: "Practice with a purpose", body: "Create a free account to save results and practice 5 questions per week. Pick a domain or follow your weakest areas." },
];

export default function HomePage() {
  const faqs = getFaqEntries().slice(0, 3);
  return <div className="mx-auto max-w-4xl space-y-14">
    <header className="max-w-3xl space-y-6 border-b border-border pb-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">PMLE preparation · Google Cloud</p>
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Know where to focus your PMLE study.</h1>
      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">Start with what you know. Find the domains that need attention. Build your next study session around them.</p>
      <Button asChild><Link href="/diagnostic">Start free diagnostic</Link></Button>
      <p className="text-sm text-muted-foreground">20 questions. No account required. Study guidance, not a prediction of your exam result.</p>
    </header>
    <section aria-labelledby="how-it-works" className="space-y-6">
      <h2 id="how-it-works" className="text-2xl font-semibold">A clear next step, not another question bank to scroll.</h2>
      <ol className="grid gap-6 sm:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="space-y-3 border-t-2 border-primary pt-4"><p className="text-sm font-semibold text-primary">Step {index + 1}</p><h3 className="text-lg font-semibold">{step.title}</h3><p className="leading-relaxed text-muted-foreground">{step.body}</p></li>)}</ol>
    </section>
    <section aria-labelledby="pass" className="grid gap-6 rounded-lg border border-border bg-card p-6 sm:grid-cols-[1fr_auto] sm:p-8">
      <div className="space-y-3"><h2 id="pass" className="text-2xl font-semibold">Go deeper with PMLE Pass.</h2><p className="leading-relaxed text-muted-foreground">Get question and per-option explanations after answering, plus unlimited 5-question practice sessions for 90 days.</p><p className="text-sm text-muted-foreground">One-time payment. No auto-renew. 7-day refund window. A refund ends pass access.</p></div>
      <div className="space-y-4"><p className="text-3xl font-semibold">$39 <span className="text-sm font-normal">USD</span></p><Button variant="outline" asChild><Link href="/pricing">Explore PMLE Pass</Link></Button></div>
    </section>
    <section aria-labelledby="questions" className="space-y-5"><h2 id="questions" className="text-2xl font-semibold">Before you get started</h2><div className="divide-y divide-border">{faqs.map((faq) => <article key={faq.slug} className="space-y-2 py-5"><h3 className="text-lg font-semibold"><Link className="underline" href={faq.href}>{faq.title}</Link></h3><p className="leading-relaxed text-muted-foreground">{faq.description}</p></article>)}</div><Link className="font-medium text-primary underline" href="/faq">Read all exam FAQs</Link></section>
    <p className="border-t border-border pt-6 text-sm leading-relaxed text-muted-foreground">Testero is independent, not affiliated with Google. Google Cloud and its certification names are trademarks of their respective owners. Use the official exam guide alongside your study practice.</p>
  </div>;
}
