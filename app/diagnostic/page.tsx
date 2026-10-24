import { pageMetadata, SITE_ORIGIN } from "@/lib/seo";
import { CertWaitlistForm } from "@/components/cert-waitlist-form";
import { getDiagnosticAvailability } from "@/lib/certifications/availability";
import { PMLE_EXAM_GUIDE_URL } from "@/lib/constants/pmle-guide";
import { notFound } from "next/navigation";
import { PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getCertification } from "@/lib/certifications/data";
import { isBetaDiagnosticCertId } from "@/lib/diagnostic/beta";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { DiagnosticStart } from "@/components/diagnostic-start";

type Props = { searchParams: Promise<{ length?: string | string[]; cert?: string | string[]; start?: string | string[]; src?: string | string[] }> };
export async function generateMetadata({ searchParams }: Props) {
  const { cert: queryCert } = await searchParams;
  const requestedCert = typeof queryCert === "string" ? queryCert.toLowerCase() : queryCert;
  if (requestedCert === undefined || requestedCert === PMLE_CERT_ID) {
    return pageMetadata("Start your free PMLE diagnostic", "Choose 5, 10 or 20 PMLE questions. See your readiness and study focus without an account.", "/diagnostic");
  }
  const cert = typeof requestedCert === "string" && isBetaDiagnosticCertId(requestedCert) ? getCertification(requestedCert) : undefined;
  if (cert) {
    if (await getDiagnosticAvailability(cert.cert_id) === "coming-soon") {
      const metadata = pageMetadata(`${cert.name} diagnostic coming soon`, `Get notified when the free ${cert.name} diagnostic opens.`, "/diagnostic");
      const url = `${SITE_ORIGIN}/diagnostic?cert=${encodeURIComponent(cert.cert_id)}`;
      return { ...metadata, alternates: { canonical: url }, openGraph: { ...metadata.openGraph, url } };
    }
    const metadata = pageMetadata(`Free ${cert.name} beta diagnostic`, `Choose 5 or 10 questions for ${cert.name}. Get an early readiness tier without an account.`, "/diagnostic");
    const url = `${SITE_ORIGIN}/diagnostic?cert=${encodeURIComponent(cert.cert_id)}`;
    return { ...metadata, alternates: { canonical: url }, openGraph: { ...metadata.openGraph, url } };
  }
  const comingSoon = typeof requestedCert === "string" ? getCertification(requestedCert) : undefined;
  if (comingSoon) return pageMetadata(`${comingSoon.name} diagnostic coming soon`, `Get notified when the ${comingSoon.name} diagnostic opens.`, "/diagnostic");
  return pageMetadata("Diagnostic", "Certification readiness diagnostics.", "/diagnostic");
}
export const dynamic = "force-dynamic";
export default async function DiagnosticStartPage({ searchParams }: Props) {
  const query = await searchParams;
  if (Array.isArray(query.cert)) notFound();
  const certId = query.cert?.toLowerCase() ?? PMLE_CERT_ID;
  const beta = certId !== PMLE_CERT_ID;
  const cert = getCertification(certId);
  if (!cert) notFound();
  const availability = await getDiagnosticAvailability(certId);
  if (availability === "coming-soon") return <section className="mx-auto max-w-[696px] space-y-6">
    <p className="text-sm font-medium text-muted-foreground">Coming soon</p>
    <h1 className="text-3xl font-semibold">{cert.name} diagnostic is coming soon</h1>
    <p className="leading-relaxed text-muted-foreground">This diagnostic is not open yet. Get a launch notification when it is ready.</p>
    <CertWaitlistForm certId={certId} certName={cert.name} />
  </section>;
  const length = Number(query.length);
  const initialCount = length === 10 || (!beta && length === 20) ? length : 5;
  // Owner-scoped resume lookup runs in the client; it must not delay this entry page.
  const autoStart = query.start === "1";
  const paidLanding = query.src === "ad" && initialCount === 5;
  if (beta) return <DiagnosticStart key={certId} autoStart={autoStart} initialCount={initialCount} certId={certId} certName={cert.name} domainCount={cert.guides[0].sections.filter(section => section.included !== false).length} />;
  return <DiagnosticStart autoStart={autoStart} paidLanding={paidLanding} initialCount={initialCount}>
    <section aria-labelledby="diagnostic-coverage" className="mx-auto mt-10 max-w-[696px] space-y-4 border-t border-border pt-6">
      <h2 id="diagnostic-coverage" className="text-xl font-semibold">What the PMLE diagnostic covers</h2>
      <p className="leading-relaxed text-muted-foreground">Choose 5, 10 or 20 questions based on the six domains in Google&apos;s June 1, 2026 Professional Machine Learning Engineer exam guide. The guide assigns these approximate weights:</p>
      <table className="w-full border-collapse text-left text-sm sm:text-base">
        <caption className="sr-only">PMLE exam domains and approximate weights from the June 1, 2026 official exam guide</caption>
        <thead><tr className="border-b border-border"><th scope="col" className="py-3 pr-4 font-semibold">Domain</th><th scope="col" className="w-28 py-3 text-right font-semibold">Approx. weight</th></tr></thead>
        <tbody>{PMLE_BLUEPRINT.map(domain => <tr key={domain.domainCode} className="border-b border-border"><th scope="row" className="py-4 pr-4 font-normal leading-relaxed text-body">{domain.displayName}</th><td className="py-4 text-right align-top tabular-nums">{Math.round(domain.weight * 101)}%</td></tr>)}</tbody>
      </table>
      <p className="leading-relaxed text-muted-foreground">The published percentages total 101% because they are approximate. The 10- and 20-question diagnostics sample all six domains. The 5-question quick check samples the five highest-weight domains; it is not a full-length practice exam. Scenarios ask you to compare approaches for building and operating AI and ML systems, rather than memorize a list of products.</p>
      <p className="leading-relaxed text-muted-foreground">No account is needed to see your overall readiness score, tier and domain breakdown. Use the report to choose a study focus, then check the official guide and documentation for gaps. A free account adds answer review, practice with no monthly limit and progress tracking. PMLE Pass adds explanations, timed mock exams, fresh-first practice and weak-area drills. Results guide study, not predict a pass.</p>
      <a href={PMLE_EXAM_GUIDE_URL} className="text-primary underline">Read the official PMLE exam guide</a>
    </section>
  </DiagnosticStart>;
}
