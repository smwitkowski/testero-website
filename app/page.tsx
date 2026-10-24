import Link from "next/link";
import { PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { CertificationPreview } from "@/components/certification-preview";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { pageMetadata } from "@/lib/seo";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";
import { PMLE_EXAM_GUIDE_URL } from "@/lib/constants/pmle-guide";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getDiagnosticAvailabilityMap } from "@/lib/certifications/availability";
import { FOUNDER_BIO } from "@/lib/content/founder";

export const metadata = { ...pageMetadata("PMLE practice for the June 2026 exam guide", "Every option explained and checked against current Google Cloud docs. Start with a free 5-question readiness check, no account needed.", "/"), title: { absolute: "PMLE practice for the June 2026 exam guide | Testero" } };
export const dynamic = "force-dynamic";

async function CertificationDirectory() {
  const availability = await getDiagnosticAvailabilityMap();
  const betaCerts = certifications.filter(cert => availability[cert.cert_id] === "beta");
  const comingCerts = certifications.filter(cert => cert.cert_id !== PMLE_CERT_ID && availability[cert.cert_id] === "coming-soon");
  return <section aria-labelledby="other-exams" className="grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
    <div className="space-y-5">
      <h2 id="other-exams" className="text-2xl font-semibold">Preparing for a different Google Cloud exam?</h2>
      <p className="leading-7 text-body">Our certification directory brings together official exam facts, guide sections and preparation links. Paid practice is available for PMLE only.</p>
      {betaCerts.length > 0 && <ul className="divide-y divide-border border-y border-border">{betaCerts.map(cert => <li key={cert.cert_id} className="flex flex-wrap items-center justify-between gap-3 py-4"><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href={`/diagnostic?cert=${encodeURIComponent(cert.cert_id)}`}>{cert.name} diagnostic →</Link><span className="rounded border border-primary px-2.5 py-1 text-xs font-semibold text-primary">Beta</span></li>)}</ul>}
      {comingCerts.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Diagnostics coming soon</h3><p className="text-sm leading-7 text-body">{comingCerts.map(cert => cert.name).join(" · ")}.</p></div>}
      <div className="flex flex-wrap gap-x-6 gap-y-3"><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href="/certifications">Explore all certifications →</Link><Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href="/tools">Free study tools →</Link></div>
    </div>
    <CertificationPreview availability={availability} />
  </section>;
}

const steps = [
  { title: "Answer real-world scenarios", label: "Check", body: "Start with a free PMLE diagnostic. Choose 5, 10 or 20 questions; the full check spans all six exam domains. No account is needed, so you can see the report before deciding whether to sign up." },
  { title: "Turn a score into a study focus", label: "Understand", body: "Read your overall score, readiness tier and domain breakdown together. Look at the number of questions behind each domain score. A small sample is a starting signal, not proof that you have mastered a topic." },
  { title: "Work on the gaps", label: "Practice", body: "Use the official guide to review your weakest areas, then practice. Free accounts get practice with no monthly limit and progress tracking. PMLE Pass adds explanations, timed mock exams, fresh-first practice and weak-area drills for 90 days." },
];
export default function HomePage() {
  return <div className="space-y-14 sm:space-y-20">
    <section className="max-w-4xl space-y-6 border-l-4 border-primary pl-5 sm:pl-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">Professional Machine Learning Engineer</p>
      <h1 className="text-pretty text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">PMLE practice for the June 2026 exam guide</h1>
      <p className="max-w-3xl text-lg leading-relaxed text-body">Every option explained and checked against current Google Cloud docs. Start with a free 5-question readiness check, no account needed.</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><Button asChild><Link href="/diagnostic?start=1&length=5">Start my free 5-question check →</Link></Button><Button asChild variant="outline"><Link href="/pmle/sample-questions">See sample questions</Link></Button></div>
      <p className="text-sm text-muted-foreground">Independent study tool. Not affiliated with Google.</p>
    </section>
    <section aria-labelledby="how-it-works" className="space-y-8">
      <div className="space-y-2"><p className="text-sm font-medium text-primary">From a first check to focused practice</p><h2 id="how-it-works" className="text-2xl font-semibold">How it works</h2></div>
      <ol className="ml-4 grid gap-0 sm:ml-0 sm:grid-cols-3">{steps.map((step, index) => <li key={step.title} className="relative border-l border-border pb-8 pl-7 last:pb-0 sm:border-l-0 sm:border-t sm:pb-0 sm:pl-0 sm:pr-8 sm:pt-7"><span className="absolute -left-4 top-0 flex size-8 items-center justify-center rounded-full border border-primary bg-background text-sm font-semibold text-primary sm:-top-4 sm:left-0">{index + 1}</span><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{step.label}</p><h3 className="mb-3 text-lg font-semibold">{step.title}</h3><p className="leading-7 text-body">{step.body}</p></li>)}</ol>
    </section>
    <section className="grid gap-8 border-y border-border py-9 lg:grid-cols-[1fr_1.3fr]" aria-labelledby="report">
      <div className="space-y-4"><h2 id="report" className="text-2xl font-semibold">Turn your readiness report into a focused study plan.</h2><p className="leading-7 text-body">A total score can hide an uneven preparation. You may be comfortable training models but less familiar with serving, monitoring or pipeline decisions. The domain breakdown helps you choose a more specific next step than “study more.”</p></div>
      <div className="space-y-5 leading-7 text-body"><p>For your first check, answer without looking up the options. Afterwards, compare your weaker domains with the objectives in <a className="text-primary underline" href={PMLE_EXAM_GUIDE_URL}>Google’s official PMLE exam guide</a>. Pick one objective, read the relevant documentation, and try the workflow in a lab or your own project.</p><p>Use the 5-question check to pick a topic for your next study session. Choose 20 questions to sample all six domains, then work through the official sample questions. Revisit the objectives you missed and practice those workflows hands-on.</p></div>
    </section>
    <section aria-labelledby="domains" className="space-y-5">
      <h2 id="domains" className="text-2xl font-semibold">Study the whole ML lifecycle</h2>
      <p className="max-w-3xl leading-7 text-body">The PMLE diagnostic maps questions to the six domains in the June 2026 exam guide. Preparation goes beyond training a model: it includes choosing a solution, managing data, deploying it, and keeping it useful in production. Use these domains as a checklist for your study plan.</p>
      <ol className="grid border-t border-border sm:grid-cols-2 sm:gap-x-8">{PMLE_BLUEPRINT.map((domain, index) => <li key={domain.domainCode} className="flex gap-3.5 border-b border-border py-4"><span className="text-muted-foreground">{index + 1}</span><span>{domain.displayName}</span></li>)}</ol>
    </section>
    <section aria-labelledby="method" className="max-w-3xl">
      <div className="space-y-4"><h2 id="method" className="text-2xl font-semibold">Practice decisions, not just product names</h2><p className="leading-7 text-body">Testero’s questions use scenarios mapped to official exam-guide objectives. Consider the requirements in each scenario, choose an approach, and explain to yourself why the alternatives do not fit. Recognizing a service name is different from knowing when to use it.</p><p className="leading-7 text-body">Start with our <Link className="text-primary underline" href="/pmle/sample-questions">free sample questions and explanations</Link> to see the format before taking a diagnostic. Use the explanations to understand why each option fits or does not fit the scenario.</p></div>
    </section>
    <section aria-labelledby="pass" className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-border bg-card p-6 sm:p-9"><div className="max-w-2xl space-y-3"><h2 id="pass" className="text-2xl font-semibold">Go deeper with the PMLE Pass</h2><p className="leading-7 text-body">{PMLE_PASS_PRICE_DISPLAY} USD one-time for 90 days. Get explanations for every option, timed mock exams, fresh-first practice and weak-area drills. Free practice and progress tracking stay free. No auto-renewal; 7-day refund. A refund ends pass access. Start free and decide after you see your study focus.</p></div><Button asChild variant="outline"><Link href="/pricing">Compare free and paid</Link></Button></section>
    <RelatedPmleGuides home />
    <section aria-labelledby="founder" className="max-w-3xl space-y-4 border-t border-border pt-8">
      <h2 id="founder" className="text-2xl font-semibold">Who builds this</h2>
      <p className="leading-7 text-body">{FOUNDER_BIO}</p>
      <Link href="/about" className="inline-flex min-h-11 items-center font-semibold text-primary underline">About Testero →</Link>
    </section>
    <Suspense fallback={<section className="space-y-4" aria-label="Certification directory"><h2 className="text-2xl font-semibold">Preparing for a different Google Cloud exam?</h2><Link className="text-primary underline" href="/certifications">Explore all certifications →</Link></section>}><CertificationDirectory /></Suspense>
  </div>;
}
