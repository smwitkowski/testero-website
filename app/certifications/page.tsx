import Link from "next/link";
import { certifications, certificationPath, certificationSummaries, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { catalogCheckedDate } from "@/lib/certifications/data";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { StructuredData } from "@/components/structured-data";
import { Button } from "@/components/ui/button";
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
    <p className="leading-7 text-body">Not sure where to start? <Link href="/tools" className="text-primary underline">Use the free certification picker, study planner and guide tracker</Link>.</p>
    <section aria-labelledby="available-now" className="space-y-4 rounded-lg border border-primary bg-card p-5 sm:p-7">
      <h2 id="available-now" className="text-xl font-semibold">Available now: Professional Machine Learning Engineer</h2>
      <p className="text-body">Get your readiness score and a domain breakdown. No account needed.</p>
      <Button asChild><Link href="/diagnostic">Start the free PMLE diagnostic →</Link></Button>
    </section>
    <div className="space-y-0">
    {["foundational", "associate", "professional"].map(level => <details key={level} id={level} open={level === "professional"} className="group border-t border-border">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><h2 className="text-2xl font-semibold capitalize">{level}</h2><span className="flex items-center gap-4 text-sm text-muted-foreground">{certifications.filter(cert => cert.level === level).length} credentials <span aria-hidden="true" className="text-xl group-open:rotate-180">⌄</span></span></summary>
      <ul className="divide-y divide-border border-y border-border">{certifications.filter(cert => cert.level === level).sort((a, b) => Number(b.cert_id === PMLE_CERT_ID) - Number(a.cert_id === PMLE_CERT_ID)).map(cert => <li key={cert.cert_id} className="grid gap-4 py-6 sm:grid-cols-[1fr_12rem] sm:gap-8">
        <div className="space-y-2"><h3 className="text-xl font-semibold"><Link className="text-primary hover:underline" href={certificationPath(cert.cert_id)}>{cert.name} →</Link></h3><p className="max-w-2xl leading-relaxed text-body">{certificationSummaries[cert.cert_id]}</p></div>
        <div className="space-y-2 sm:text-right"><p className={`text-sm font-semibold ${cert.cert_id === PMLE_CERT_ID ? "text-solid" : "text-muted-foreground"}`}>{cert.cert_id === PMLE_CERT_ID ? "Practice available" : "Diagnostic coming"}</p>{cert.cert_id === PMLE_CERT_ID && <Link href="/diagnostic" className="inline-flex min-h-12 items-center text-sm text-primary underline">Start PMLE diagnostic</Link>}</div>
      </li>)}</ul>
    </details>)}
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Check Google&apos;s linked certification pages before booking. Announcements and beta availability can change. No certification guarantees an exam result, job or salary.</p>
  </section>;
}
