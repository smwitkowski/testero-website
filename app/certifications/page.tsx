import Link from "next/link";
import { certifications, certificationPath, certificationSummaries, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { catalogCheckedDate } from "@/lib/certifications/data";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { StructuredData } from "@/components/structured-data";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Google Cloud certifications: exam facts and guides", "Compare all 15 Google Cloud certifications by level. Find sourced exam facts, guide sections and diagnostic availability.", "/certifications");
export default function CertificationsPage() {
  const checked = catalogCheckedDate().slice(0, 10);
  return <section className="space-y-12">
    <StructuredData value={certificationStructuredData()} />
    <header className="max-w-3xl space-y-5">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">Google Cloud certification directory</p>
      <h1 className="text-pretty text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Find the exam that fits your next step.</h1>
      <p className="text-lg leading-relaxed text-body">Compare official exam facts and guide sections across foundational, associate and professional credentials. PMLE practice is available now; other diagnostics are coming.</p>
      <p className="text-sm text-muted-foreground">Facts are from Google&apos;s official pages, last checked <time dateTime={checked}>{checked}</time>. Check Google before booking.</p>
    </header>
    <nav aria-label="Certification levels" className="flex flex-wrap gap-x-6 gap-y-3 border-y border-border py-4 text-sm font-semibold">{["foundational", "associate", "professional"].map(level => <a key={level} href={`#${level}`} className="py-2 text-primary underline">{level[0].toUpperCase() + level.slice(1)}</a>)}</nav>
    {["foundational", "associate", "professional"].map(level => <section key={level} id={level} className="scroll-mt-8 space-y-4">
      <div className="flex items-baseline justify-between gap-4"><h2 className="text-2xl font-semibold capitalize">{level}</h2><span className="text-sm text-muted-foreground">{certifications.filter(cert => cert.level === level).length} credentials</span></div>
      <ul className="divide-y divide-border border-y border-border">{certifications.filter(cert => cert.level === level).map(cert => <li key={cert.cert_id} className="grid gap-4 py-6 sm:grid-cols-[1fr_12rem] sm:gap-8">
        <div className="space-y-2"><h3 className="text-xl font-semibold"><Link className="text-primary hover:underline" href={certificationPath(cert.cert_id)}>{cert.name} →</Link></h3><p className="max-w-2xl leading-relaxed text-body">{certificationSummaries[cert.cert_id]}</p></div>
        <div className="space-y-2 sm:text-right"><p className={`text-sm font-semibold ${cert.cert_id === PMLE_CERT_ID ? "text-solid" : "text-muted-foreground"}`}>{cert.cert_id === PMLE_CERT_ID ? "Practice available" : "Diagnostic coming"}</p>{cert.cert_id === PMLE_CERT_ID && <Link href="/diagnostic" className="inline-flex min-h-12 items-center text-sm text-primary underline">Start PMLE diagnostic</Link>}</div>
      </li>)}</ul>
    </section>)}
    <p className="text-sm leading-relaxed text-muted-foreground">Check Google&apos;s linked certification pages before booking. Announcements and beta availability can change. No certification guarantees an exam result, job or salary.</p>
  </section>;
}
