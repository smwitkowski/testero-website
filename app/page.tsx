import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CertificationPreview } from "@/components/certification-preview";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { pageMetadata } from "@/lib/seo";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";

export const metadata = { ...pageMetadata("Google Cloud certification readiness | Free PMLE diagnostic", "Find your next Google Cloud certification and check your PMLE readiness with a free diagnostic. Other certification diagnostics are coming soon.", "/"), title: { absolute: "Google Cloud Certification Readiness | Testero" } };

const steps = [
  { title: "Answer real-world scenarios", label: "Check", body: "Start with a free PMLE diagnostic. Choose 5, 10 or 20 questions; the full check spans all six exam domains. No account is needed, so you can see the report before deciding whether to sign up." },
  { title: "Turn a score into a study focus", label: "Understand", body: "Read your overall score, readiness tier and domain breakdown together. Look at the number of questions behind each domain score. A small sample is a starting signal, not proof that you have mastered a topic." },
  { title: "Work on the gaps", label: "Practice", body: "Use the official guide to review your weakest areas, then practice. Free accounts get 5 practice questions a week. The PMLE Pass adds explanations and unlimited 5-question practice sessions for 90 days." },
];
export default function HomePage() {
  return <div className="space-y-14 sm:space-y-20">
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className="space-y-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Google Cloud certification readiness</p>
        <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">Your next certification.<br />Know where you stand.</h1>
        <p className="text-lg leading-relaxed text-body">Find the Google Cloud exam that fits your work. Then turn practice into a clearer plan: what you know, where you need work, and what to study next.</p>
        <p className="leading-relaxed text-body"><strong>PMLE is live today.</strong> Take a free readiness diagnostic for the Professional Machine Learning Engineer exam. Cloud Engineer, Cloud Architect and Data Engineer diagnostics are coming soon.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button asChild><Link href="/diagnostic">Check my PMLE readiness</Link></Button><Button asChild variant="outline"><Link href="/certifications">Explore all certifications</Link></Button></div>
        <p className="text-sm text-muted-foreground">Free · 5, 10 or 20 questions · no account needed</p>
      </div>
      <CertificationPreview />
    </section>
    <section aria-labelledby="how-it-works" className="space-y-8">
      <div className="space-y-2"><p className="text-sm font-medium text-primary">From a first check to focused practice</p><h2 id="how-it-works" className="text-2xl font-semibold">How it works</h2></div>
      <ol className="ml-4 grid gap-0 sm:ml-0 sm:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="relative border-l border-border pb-8 pl-7 last:pb-0 sm:border-l-0 sm:border-t sm:pb-0 sm:pl-0 sm:pr-8 sm:pt-7"><span className="absolute -left-4 top-0 flex size-8 items-center justify-center rounded-full border border-primary bg-background text-sm font-semibold text-primary sm:-top-4 sm:left-0">{index + 1}</span><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{step.label}</p><h3 className="mb-3 text-lg font-semibold">{step.title}</h3><p className="leading-7 text-body">{step.body}</p></li>)}</ol>
    </section>
    <section className="grid gap-8 border-y border-border py-9 lg:grid-cols-[1fr_1.3fr]" aria-labelledby="report">
      <div className="space-y-4"><h2 id="report" className="text-2xl font-semibold">A readiness report is a starting point, not a verdict.</h2><p className="leading-7 text-body">A total score can hide an uneven preparation. You may be comfortable training models but less familiar with serving, monitoring or pipeline decisions. The domain breakdown helps you choose a more specific next step than “study more.”</p></div>
      <div className="space-y-5 leading-7 text-body"><p>For your first check, answer without looking up the options. Afterwards, compare your weaker domains with the objectives in <a className="text-primary underline" href="https://cloud.google.com/learn/certification/guides/machine-learning-engineer">Google’s official PMLE exam guide</a>. Pick one objective, read the relevant documentation, and try the workflow in a lab or your own project.</p><p>A short check offers a quick signal; the 20-question diagnostic gives a broader view. Neither reproduces the certification exam or predicts its result. Use your report alongside hands-on experience and the official sample questions, rather than as the only reason to book an exam.</p></div>
    </section>
    <section aria-labelledby="domains" className="space-y-5">
      <h2 id="domains" className="text-2xl font-semibold">Study the whole ML lifecycle</h2>
      <p className="max-w-3xl leading-7 text-body">The PMLE diagnostic maps questions to the six domains in the June 2026 exam guide. Preparation goes beyond training a model: it includes choosing a solution, managing data, deploying it, and keeping it useful in production. Use these domains as a checklist for your study plan.</p>
      <ol className="grid border-t border-border sm:grid-cols-2 sm:gap-x-8">{PMLE_BLUEPRINT.map((domain, index) => <li key={domain.domainCode} className="flex gap-3.5 border-b border-border py-4"><span className="text-muted-foreground">{index + 1}</span><span>{domain.displayName}</span></li>)}</ol>
    </section>
    <section aria-labelledby="method" className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4"><h2 id="method" className="text-2xl font-semibold">Practice decisions, not just product names</h2><p className="leading-7 text-body">Testero’s questions use scenarios mapped to official exam-guide objectives. Consider the requirements in each scenario, choose an approach, and explain to yourself why the alternatives do not fit. Recognizing a service name is different from knowing when to use it.</p><p className="leading-7 text-body">Start with our <Link className="text-primary underline" href="/pmle/sample-questions">free sample questions and explanations</Link> to see the format before taking a diagnostic. These are independent practice questions, not actual Google exam questions.</p></div>
      <div className="space-y-4 rounded-lg border border-border bg-card p-6 sm:p-8"><h3 className="text-xl font-semibold">Preparing for a different Google Cloud exam?</h3><p className="leading-7 text-body">Our certification directory brings together official exam facts, guide sections and preparation links. The free tools can help you compare credentials and build a study plan without needing a Testero question bank.</p><p className="leading-7 text-body">Only PMLE has a diagnostic and paid practice today. On other certification pages, you can ask to be notified when that diagnostic is ready. We do not promise a launch date.</p><Link className="inline-block font-semibold text-primary underline" href="/tools">Explore the free study tools →</Link></div>
    </section>
    <section aria-labelledby="pass" className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-border bg-card p-6 sm:p-9"><div className="max-w-2xl space-y-3"><h2 id="pass" className="text-2xl font-semibold">Go deeper with the PMLE Pass</h2><p className="leading-7 text-body">$39 USD one-time for 90 days. Get explanations for every option and unlimited 5-question practice sessions. No auto-renewal; 7-day refund. A refund ends pass access. Start free and decide after you see your study focus.</p></div><Button asChild variant="outline"><Link href="/pricing">Compare free and paid</Link></Button></section>
    <RelatedPmleGuides home />
    <p className="border-t border-border pt-5 text-sm text-muted-foreground">Readiness results are study guidance, not a prediction of your exam result.</p>
  </div>;
}
