import Link from "next/link";
import { certificationForExam, certificationPath } from "@/lib/certifications/catalog";
import { relatedPmleGuides } from "@/lib/content/related";

export function RelatedPmleGuides({ excludeHref, home = false, exam }: { excludeHref?: string; home?: boolean; exam?: string }) {
  const cert = exam ? certificationForExam(exam) : undefined;
  const google = cert || exam === "other Google Cloud certifications";
  return <section aria-label={home ? "PMLE guides" : "Related PMLE guides"} className="space-y-4 border-t border-border pt-6">
    <h2 className="text-xl font-semibold">{home ? "PMLE guides" : "Related PMLE guides"}</h2>
    <ul className="list-disc space-y-3 pl-5">{google && <li><Link href={cert ? certificationPath(cert.cert_id) : "/certifications"} className="text-primary underline">{cert ? `${cert.name}: exam facts and guide` : "Compare Google Cloud certifications"}</Link></li>}{relatedPmleGuides(excludeHref).map(entry => <li key={entry.href}><Link href={entry.href} className="text-primary underline">{entry.title}</Link></li>)}</ul>
  </section>;
}
