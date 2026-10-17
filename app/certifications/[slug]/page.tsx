import Link from "next/link";
import { notFound } from "next/navigation";
import { certifications, certificationPath, certificationSummaries, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getCertification, checkedDate, fact, label, variantFacts, examSummary, skillsRenewalSummary, guideLabel } from "@/lib/certifications/data";
import { certificationNotices } from "@/lib/certifications/notices";
import { certificationEditorial } from "@/lib/certifications/editorial";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { StructuredData } from "@/components/structured-data";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
import { AgenticArchitectExplainer } from "@/components/agentic-architect-explainer";
import { getBlogEntries, getFaqEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return certifications.map(cert => ({ slug: cert.cert_id })); }
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const cert = getCertification(slug);
  if (!cert) notFound();
  return pageMetadata(`${cert.name}: exam facts and guide`, certificationSummaries[slug], certificationPath(slug));
}
export default async function CertificationPage({ params }: Props) {
  const { slug } = await params;
  const cert = getCertification(slug);
  if (!cert) notFound();
  const checked = checkedDate(cert).slice(0, 10);
  const primary = cert.exam_variants.find(exam => exam.variant === "standard" || exam.variant === "ga") ?? cert.exam_variants[0];
  const related = certifications.filter(item => item.cert_id !== slug && item.level === cert.level).slice(0, 3);
  const notices = certificationNotices[slug] ?? [];
  const displayGuideLabel = (variant: string) => slug === "agentic-architect" ? "Current linked exam guide" : guideLabel(variant);
  const guides = [...getBlogEntries(), ...getFaqEntries()].filter(entry => entry.exam === cert.name);
  const editorial = certificationEditorial[slug];
  return <section className="space-y-8 sm:space-y-10">
    <StructuredData value={certificationStructuredData(cert)} />
    <nav aria-label="Breadcrumb" className="text-sm text-primary"><Link href="/certifications" className="underline">Certifications</Link><span className="mx-2 text-muted-foreground">/</span><span className="text-body">{cert.name}</span></nav>
    <header className="max-w-3xl space-y-4"><h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{cert.name}</h1><p className="text-sm font-medium text-primary">{label(cert.level)} · {slug === PMLE_CERT_ID ? "Practice available" : "Diagnostic coming"}{primary.variant === "beta" && " · Beta exam facts"}{primary.variant === "ga" && " · Upcoming GA exam facts"}</p><p className="text-lg leading-relaxed text-body">{certificationSummaries[slug]}</p>{slug === PMLE_CERT_ID && <p className="text-sm text-muted-foreground"><a className="text-primary underline" href={cert.cert_url}>Official Google PMLE certification page</a>. Updated <time dateTime={checked}>October 17, 2026</time>.</p>}</header>
    <ul aria-label="Exam summary" className="flex flex-wrap gap-x-4 gap-y-2 border-y border-border py-4 text-sm font-medium text-body">{examSummary(primary).map((item, i) => <li key={item} className="flex items-center gap-4">{i > 0 && <span aria-hidden="true" className="text-muted-foreground">·</span>}{item}</li>)}</ul>
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="space-y-4 rounded-lg border border-border bg-card p-5 sm:p-6 lg:col-start-2 lg:row-start-1" aria-label="Diagnostic availability">
        {slug === PMLE_CERT_ID ? <><h2 className="text-xl font-semibold">Check your PMLE readiness</h2><p className="leading-relaxed text-body">Take the free 20-question diagnostic for a readiness score and domain breakdown.</p><Link href="/diagnostic" className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Start PMLE diagnostic</Link></> : <><CertWaitlistForm certId={slug} certName={cert.name} /><div className="space-y-2 border-t border-border pt-4 text-sm"><Link href="/certifications" className="block py-1 text-primary underline">Compare all certifications</Link><Link href="/diagnostic" className="block py-1 text-primary underline">Try the available PMLE diagnostic</Link></div></>}
      </aside>
      <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-1">
        <section className="space-y-4" aria-labelledby="exam-audience"><h2 id="exam-audience" className="text-2xl font-semibold">Who this exam is for</h2><p className="max-w-prose leading-7 text-body">{editorial.audience}</p>
          {cert.recommended_experience && <p className="max-w-prose text-sm leading-relaxed text-body"><strong>Google recommends:</strong> {cert.recommended_experience}{cert.recommended_experience_source && <> <a className="text-primary underline" href={cert.recommended_experience_source.url}>Source</a> (checked {cert.recommended_experience_source.retrieved_at.slice(0, 10)}).</>}</p>}
        </section>
        {slug === "agentic-architect" && <AgenticArchitectExplainer />}
        <section className="space-y-5" aria-labelledby="preparation"><h2 id="preparation" className="text-2xl font-semibold">How to prepare</h2><ol className="list-decimal space-y-4 pl-5 leading-7 text-body">{editorial.steps.map(step => <li key={step}>{step}</li>)}</ol><ul className="flex flex-wrap gap-x-6 gap-y-3 text-sm">{cert.guides.filter(guide => guide.variant === primary.variant).map(guide => <li key={guide.url}><a className="text-primary underline" href={guide.url}>{displayGuideLabel(guide.variant)}</a></li>)}{cert.sample_sources.slice(0, 1).map(source => <li key={source.url}><a className="text-primary underline" href={source.url}>Official sample questions</a></li>)}<li><a className="text-primary underline" href="https://www.cloudskillsboost.google/">Google Cloud Skills Boost</a></li>{slug === PMLE_CERT_ID && <li><Link className="text-primary underline" href="/diagnostic">Free PMLE diagnostic</Link></li>}{slug === PMLE_CERT_ID && <li><Link className="text-primary underline" href="/pmle/sample-questions">Free PMLE sample questions</Link></li>}</ul></section>
        <section className="space-y-6" aria-labelledby="exam-facts"><h2 id="exam-facts" className="text-2xl font-semibold">Exam details</h2>
          {slug === PMLE_CERT_ID && <><p className="text-sm leading-relaxed text-body">There are no prerequisites. Google does not publish a PMLE passing score. Delivery is online-proctored remotely or onsite-proctored at a testing center.</p><p className="text-sm leading-relaxed text-body">Renew within the renewal eligibility period; see <a className="text-primary underline" href="https://support.google.com/cloud-certification/answer/9907853">Google’s Renewal FAQs</a>. The certification page does not state a validity duration.</p></>}
          {cert.exam_variants.map(exam => {
            const renewal = skillsRenewalSummary(exam);
            return renewal ? <p key={exam.variant} className="text-sm leading-relaxed text-body">{renewal}</p> : <section key={exam.variant} className="space-y-3"><h3 className="text-lg font-semibold">{exam.variant === "standard" ? "Standard exam" : exam.variant === "ga" ? "GA exam (upcoming)" : `${label(exam.variant)} exam`}</h3><dl className="divide-y divide-border border-y border-border">{variantFacts(exam).map(([name, value]) => <div key={name} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-5"><dt className="text-sm font-semibold">{name}</dt><dd className="text-sm leading-relaxed text-body">{value}</dd></div>)}</dl></section>;
          })}
          {cert.canonical_exam_code && <p className="text-sm text-body">Official exam code: {cert.canonical_exam_code}</p>}
          {cert.retirement && <p className="text-sm text-body">Retirement: {fact(cert.retirement)}</p>}
          {cert.assessment_components && <div className="space-y-2"><h3 className="font-semibold">Assessment components</h3><ul className="list-disc space-y-2 pl-5 text-body">{cert.assessment_components.map(value => <li key={value}>{value}</li>)}</ul></div>}
          {cert.lab_deadline && <p className="text-sm text-body">{cert.lab_deadline.variant === "beta" ? "Beta required lab deadline" : "Required lab deadline"}: <time dateTime={cert.lab_deadline.date}>{cert.lab_deadline.date}</time>. <a className="text-primary underline" href={cert.lab_deadline.source_url}>Official lab guidance</a></p>}
        </section>
        <section className="space-y-6" aria-labelledby="guide-sections"><h2 id="guide-sections" className="text-2xl font-semibold">Exam guide sections</h2>
          {cert.guides.map(guide => <section key={guide.url} className="space-y-3"><h3 className="text-lg font-semibold"><a href={guide.url} className="text-primary underline">{displayGuideLabel(guide.variant)}</a></h3>
            {(guide.effective_date || guide.as_of_date) && <p className="text-sm text-muted-foreground">{guide.effective_date ? `Effective ${guide.effective_date}` : `Guide as of ${guide.as_of_date}`}</p>}
            <ul className="divide-y divide-border border-y border-border">{guide.sections.map(section => <li key={section.id} className="flex items-start justify-between gap-5 py-3"><span className="text-body">{section.number}. {section.title}{section.included === false && " (not included)"}</span>{section.weight_percent !== null && <span className="shrink-0 text-sm font-semibold">{section.weight_approximate ? "~" : ""}{section.weight_percent}%</span>}</li>)}</ul>
          </section>)}
        </section>
        {notices.length > 0 && <section className="space-y-4" aria-labelledby="announcements"><h2 id="announcements" className="text-2xl font-semibold">Announcements and upcoming versions</h2><ul className="list-disc space-y-3 pl-5 text-body">{notices.map(notice => <li key={notice}>{notice}</li>)}</ul>

        </section>}
        <section className="space-y-4" aria-labelledby="sources"><h2 id="sources" className="text-2xl font-semibold">Official sources</h2><p className="text-sm leading-relaxed text-muted-foreground">Facts are from Google&apos;s official pages, last checked <time dateTime={checked}>{checked}</time>. Check Google before booking.</p><ul className="list-disc space-y-3 pl-5"><li><a className="text-primary underline" href={cert.cert_url}>Google&apos;s {cert.name} page</a></li>{cert.guides.map(guide => <li key={guide.url}><a className="text-primary underline" href={guide.url}>{displayGuideLabel(guide.variant)}</a></li>)}{cert.sample_sources.map((source, i) => <li key={source.url}><a className="text-primary underline" href={source.url}>Official sample questions{cert.sample_sources.length > 1 ? ` ${i + 1}` : ""}</a></li>)}{cert.sources.filter(source => source.role === "certification_faq").map(source => <li key={source.url}><a className="text-primary underline" href={source.url}>Official certification FAQ</a> · retrieved {source.retrieved_at.slice(0, 10)}</li>)}</ul></section>
      </div>
    </div>
    {!!guides.length && <section className="space-y-4 border-t border-border pt-8"><h2 className="text-2xl font-semibold">Related guides</h2><ul className="list-disc space-y-3 pl-5">{guides.map(entry => <li key={entry.href}><Link href={entry.href} className="text-primary underline">{entry.title}</Link></li>)}</ul></section>}
    <section className="space-y-4 border-t border-border pt-8"><h2 className="text-2xl font-semibold">Related certifications</h2><ul className="grid gap-4 sm:grid-cols-3">{related.map(item => <li key={item.cert_id}><Link href={certificationPath(item.cert_id)} className="inline-block py-2 font-semibold text-primary underline">{item.name}</Link><p className="text-sm text-muted-foreground">{certificationSummaries[item.cert_id]}</p></li>)}</ul><Link href="/certifications" className="inline-block py-2 text-primary underline">All certification levels →</Link></section>
    <p className="text-sm text-muted-foreground">Testero is independent and not affiliated with or endorsed by Google. A diagnostic is a study signal, not an exam-outcome guarantee.</p>
  </section>;
}
