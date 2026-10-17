import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DomainScores, ScoreBar } from "@/components/readiness-report";
import { PMLE_BLUEPRINT, PMLE_BLUEPRINT_MAP } from "@/lib/constants/pmle-blueprint";
import { pageMetadata } from "@/lib/seo";
import { getFaqEntries } from "@/lib/content/loader";
import { isComingSoon } from "@/lib/content/exam";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";

export const metadata = { ...pageMetadata("Free PMLE Practice Test & Readiness Diagnostic", "Take a free 20-question PMLE diagnostic across the six June 2026 exam-guide domains. See your readiness and study focus, with no account needed.", "/"), title: { absolute: "Free PMLE Practice Test & Readiness Diagnostic | Testero" } };

const steps = [
  { title: "Take the diagnostic", cost: "Free", body: "20 scenario questions across the six exam domains. No account needed." },
  { title: "Review your report", cost: "Free", body: "An overall score, a readiness tier and a score for each domain." },
  { title: "Practice your weakest domain", cost: "Free or PMLE Pass", body: "Free accounts get 5 practice questions a week. PMLE Pass adds explanations and unlimited sessions." },
];
const sampleDomains = [
  { domainCode: "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES", total: 3, correct: 1, percentage: 33 },
  { domainCode: "SERVING_AND_SCALING_MODELS", total: 3, correct: 2, percentage: 67 },
  { domainCode: "COLLABORATING_TO_MANAGE_DATA_AND_MODELS", total: 4, correct: 3, percentage: 75 },
].map(domain => ({ ...domain, domainName: PMLE_BLUEPRINT_MAP[domain.domainCode].displayName }));

export default function HomePage() {
  const faqs = getFaqEntries().filter((entry) => !isComingSoon(entry.exam)).slice(0, 3);
  return <div className="space-y-12 sm:space-y-20">
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="space-y-5">
        <p className="text-sm font-medium text-muted-foreground">Google Cloud Professional Machine Learning Engineer (PMLE)</p>
        <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-[46px]">Find out where you stand on the PMLE exam.</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">A free 20-question diagnostic measures your readiness across all six exam domains and tells you which one to study first.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1"><Button asChild><Link href="/diagnostic">Start the free diagnostic</Link></Button><span className="text-sm text-muted-foreground">20 questions · about 20 minutes · no account needed</span></div>
      </div>
      <figure aria-label="Sample readiness report" className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-7">
        <figcaption className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">Sample readiness report</span><span>20 questions</span></figcaption>
        <div className="flex flex-wrap items-baseline gap-3"><span className="text-[52px] font-semibold leading-none">55</span><span className="text-muted-foreground">/ 100</span><span className="ml-auto rounded border border-input px-2 py-0.5 text-xs font-medium">Tier: Building</span></div>
        <ScoreBar score={55} />
        <div><DomainScores domains={sampleDomains} /><p className="pt-2 text-xs text-muted-foreground">3 of 6 domains shown. Sample data, not a user result.</p></div>
      </figure>
    </section>
    <section aria-labelledby="how-it-works" className="space-y-7">
      <h2 id="how-it-works" className="text-2xl font-semibold">How it works</h2>
      <ol className="grid gap-6 sm:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="space-y-2 border-t-2 border-foreground pt-4"><p className="text-sm font-medium text-muted-foreground">Step {index + 1} · {step.cost}</p><h3 className="text-lg font-semibold">{step.title}</h3><p className="leading-relaxed text-muted-foreground">{step.body}</p></li>)}</ol>
    </section>
    <section aria-labelledby="method" className="space-y-3 rounded-lg border border-border bg-card p-6 sm:p-9">
      <h2 id="method" className="text-2xl font-semibold">How questions are written</h2>
      <p className="max-w-3xl leading-relaxed text-muted-foreground">Our questions are mapped to objectives in Google&apos;s official PMLE exam guide. Use the official guide alongside your study practice.</p>
    </section>
    <section aria-labelledby="domains" className="space-y-5">
      <h2 id="domains" className="text-2xl font-semibold">What the diagnostic covers</h2>
      <ol className="grid border-t border-border sm:grid-cols-2 sm:gap-x-8">{PMLE_BLUEPRINT.map((domain, index) => <li key={domain.domainCode} className="flex gap-3.5 border-b border-border py-3.5"><span className="text-muted-foreground">{index + 1}</span><span>{domain.displayName}</span></li>)}</ol>
    </section>
    <div className="grid gap-8 lg:grid-cols-2"><RelatedPmleGuides home />
    <section aria-labelledby="questions" className="space-y-5 rounded-lg border border-border bg-card p-6 sm:p-9"><h2 id="questions" className="text-2xl font-semibold">Before you get started</h2><div className="divide-y divide-border">{faqs.map((faq) => <article key={faq.slug} className="space-y-2 py-5"><h3 className="text-lg font-semibold"><Link className="text-foreground underline hover:text-primary" href={faq.href}>{faq.title}</Link></h3><p className="leading-relaxed text-muted-foreground">{faq.description}</p></article>)}</div><Link className="text-sm font-medium text-primary underline" href="/faq">Read all exam FAQs</Link></section></div>
    <section aria-labelledby="pass" className="on-dark flex flex-wrap items-center justify-between gap-x-12 gap-y-6 rounded-lg bg-foreground p-6 text-card sm:p-9">
      <div className="min-w-0 flex-1 basis-96 space-y-2"><h2 id="pass" className="text-2xl font-semibold">PMLE Pass</h2><p className="leading-relaxed text-on-dark-secondary">Explanations for every option and unlimited 5-question practice sessions for 90 days. One-time payment, no auto-renewal, 7-day refund. A refund ends pass access.</p></div>
      <div className="flex flex-wrap items-center gap-6"><p className="text-4xl font-semibold">$39 one-time <span className="text-base font-normal text-on-dark-secondary">USD</span></p><Button asChild variant="outline" className="border-card bg-transparent text-card hover:bg-card/10"><Link href="/pricing">Compare plans</Link></Button></div>
    </section>
    <p className="border-t border-border pt-5 text-sm text-muted-foreground">Testero is independent and not affiliated with or endorsed by Google. Readiness results are study guidance, not a prediction of your exam result.</p>
  </div>;
}
