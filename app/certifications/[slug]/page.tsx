import Link from "next/link";
import { notFound } from "next/navigation";
import { certifications, certificationPath, certificationSummaries, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getCertification, checkedDate, fact, label, variantFacts, notStated } from "@/lib/certifications/data";
import { certificationNotices } from "@/lib/certifications/notices";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { StructuredData } from "@/components/structured-data";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
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
  const related = certifications.filter(item => item.cert_id !== slug && item.level === cert.level).slice(0, 3);
  const notices = certificationNotices[slug] ?? [];
  const guides = [...getBlogEntries(), ...getFaqEntries()].filter(entry => entry.exam === cert.name);
  return <section className="space-y-10">
    <StructuredData value={certificationStructuredData(cert)} />
    <nav aria-label="Breadcrumb" className="text-sm text-primary"><Link href="/certifications" className="underline">Certifications</Link><span className="mx-2 text-muted-foreground">/</span><span className="text-body">{cert.name}</span></nav>
    <header className="max-w-3xl space-y-4"><p className="text-sm font-semibold uppercase tracking-wider text-primary">{cert.level} · {slug === PMLE_CERT_ID ? "Practice available" : "Diagnostic coming"}</p><h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{cert.name}</h1><p className="text-lg leading-relaxed text-body">{certificationSummaries[slug]}</p><p className="text-sm text-muted-foreground">Last checked <time dateTime={checked}>{checked}</time>. Facts are a snapshot of the linked official sources; check Google before booking.</p></header>
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="min-w-0 space-y-10">
      <section className="space-y-5" aria-labelledby="exam-facts"><h2 id="exam-facts" className="text-2xl font-semibold">Official exam facts</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Variants are separate routes to the credential, not interchangeable exam offers. Missing facts are not inferred from other exams or certification levels.</p>
        {cert.exam_variants.map(exam => <section key={exam.variant} className="rounded-lg border border-border bg-card p-5 sm:p-6"><h3 className="mb-4 text-xl font-semibold">{label(exam.variant)}</h3><dl className="divide-y divide-border">{variantFacts(exam).map(([name, value]) => <div key={name} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-5"><dt className="text-sm font-semibold">{name}</dt><dd className="text-sm leading-relaxed text-body">{value}</dd></div>)}</dl></section>)}
        <dl className="space-y-4 text-sm">{[["Recommended experience", cert.recommended_experience], ["Official exam code", cert.canonical_exam_code], ["Catalog name", cert.catalog_name], ["Registration status", cert.registration_status === "not_stated" ? null : label(cert.registration_status)], ["Retirement", cert.retirement]].map(([name, value]) => <div key={String(name)}><dt className="font-semibold">{String(name)}</dt><dd className="mt-1 leading-relaxed text-body">{fact(value)}</dd></div>)}</dl>
        {cert.assessment_components && <div className="space-y-2"><h3 className="font-semibold">Assessment components</h3><ul className="list-disc space-y-2 pl-5 text-body">{cert.assessment_components.map(value => <li key={value}>{value}</li>)}</ul></div>}
        {cert.lab_deadline && <p className="text-sm text-body">Required lab deadline: <time dateTime={cert.lab_deadline.date}>{cert.lab_deadline.date}</time>. <a className="text-primary underline" href={cert.lab_deadline.source_url}>Official lab guidance</a></p>}
      </section>
      <section className="space-y-6" aria-labelledby="guide-sections"><h2 id="guide-sections" className="text-2xl font-semibold">Exam guide sections</h2>
        {cert.guides.map((guide, i) => <section key={guide.url} className="space-y-4"><h3 className="text-lg font-semibold"><a href={guide.url} className="text-primary underline">{label(guide.variant)} guide {i + 1}</a></h3><p className="text-sm leading-relaxed text-muted-foreground">Version: {fact(guide.version)}. Effective date: {fact(guide.effective_date)}. As-of date: {fact(guide.as_of_date)}. Status in snapshot: {fact(guide.status)}.</p>
        <ul className="divide-y divide-border border-y border-border">{guide.sections.map(section => <li key={section.id} className="flex items-start justify-between gap-5 py-4"><span className="text-body">{section.number}. {section.title}{section.included === false && " (not included)"}</span><span className="shrink-0 text-sm font-semibold">{section.weight_percent === null ? notStated : `${section.weight_approximate ? "≈" : ""}${section.weight_percent}%`}</span></li>)}</ul><p className="text-sm text-muted-foreground">{guide.weight_note ?? "Weights are shown only where stated."}{guide.stated_weight_total_percent !== undefined && ` Stated total: ${guide.stated_weight_total_percent}%.`}</p>
        {!!guide.in_scope_tools?.length && <details className="text-sm"><summary className="cursor-pointer py-2 font-semibold">Named tools in this guide</summary><p className="py-3 leading-relaxed text-body">{guide.in_scope_tools.join(", ")}</p></details>}</section>)}
      </section>
      <section className="space-y-4" aria-labelledby="announcements"><h2 id="announcements" className="text-2xl font-semibold">Announcements and upcoming versions</h2>{notices.length ? <ul className="list-disc space-y-3 pl-5 text-body">{notices.map(notice => <li key={notice}>{notice}</li>)}</ul> : <p className="text-body">No announcement recorded in this snapshot. This does not establish that the exam will remain unchanged.</p>}
      {cert.upcoming_versions.map((version, i) => <dl key={i} className="space-y-3 rounded-lg border border-border p-5 text-sm">{Object.entries(version).filter(([key]) => key !== "announcement").map(([key, value]) => <div key={key}><dt className="font-semibold">{label(key)}</dt><dd className="mt-1 text-body">{typeof value === "string" && value.startsWith("https://") ? <a className="text-primary underline" href={value}>Official {label(key)}</a> : fact(value)}</dd></div>)}</dl>)}
      </section>
      <section className="space-y-4" aria-labelledby="sources"><h2 id="sources" className="text-2xl font-semibold">Official sources</h2><ul className="list-disc space-y-3 pl-5"><li><a className="text-primary underline" href={cert.cert_url}>Google&apos;s {cert.name} page</a></li>{cert.guides.map(guide => <li key={guide.url}><a className="text-primary underline" href={guide.url}>{label(guide.variant)} exam guide</a></li>)}{cert.sample_sources.map((source, i) => <li key={source.url}><a className="text-primary underline" href={source.url}>Official sample questions {i + 1}</a></li>)}</ul><p className="text-sm leading-relaxed text-muted-foreground">Not stated by Google means the field was not stated in the fetched sources, not that the fact does not exist elsewhere. All recommended-experience fields are absent from this data snapshot. Guide objectives are not reproduced here; use the official guide for the complete scope.</p></section>
    </div>
    <aside className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-6" aria-label="Diagnostic availability">
      {slug === PMLE_CERT_ID ? <><h2 className="text-xl font-semibold">Check your PMLE readiness</h2><p className="leading-relaxed text-body">Take the free 20-question diagnostic for a readiness score and domain breakdown.</p><Link href="/diagnostic" className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground hover:bg-primary-hover">Start PMLE diagnostic</Link></> : <><h2 className="text-xl font-semibold">Diagnostic coming</h2><p className="text-sm leading-relaxed text-body">{cert.name} practice is not available on Testero today. Request a diagnostic launch notification below.</p><CertWaitlistForm certId={slug} certName={cert.name} /><div className="space-y-3 border-t border-border pt-5 text-sm"><Link href="/certifications" className="block py-1 text-primary underline">Compare all certifications</Link><Link href="/diagnostic" className="block py-1 text-primary underline">Try the available PMLE diagnostic</Link></div></>}
    </aside></div>
    {!!guides.length && <section className="space-y-4 border-t border-border pt-8"><h2 className="text-2xl font-semibold">Related guides</h2><ul className="list-disc space-y-3 pl-5">{guides.map(entry => <li key={entry.href}><Link href={entry.href} className="text-primary underline">{entry.title}</Link></li>)}</ul></section>}
    <section className="space-y-4 border-t border-border pt-8"><h2 className="text-2xl font-semibold">Related certifications</h2><ul className="grid gap-4 sm:grid-cols-3">{related.map(item => <li key={item.cert_id}><Link href={certificationPath(item.cert_id)} className="inline-block py-2 font-semibold text-primary underline">{item.name}</Link><p className="text-sm text-muted-foreground">{certificationSummaries[item.cert_id]}</p></li>)}</ul><Link href="/certifications" className="inline-block py-2 text-primary underline">All certification levels →</Link></section>
    <p className="text-sm text-muted-foreground">Testero is independent and not affiliated with or endorsed by Google. A diagnostic is a study signal, not an exam-outcome guarantee.</p>
  </section>;
}
