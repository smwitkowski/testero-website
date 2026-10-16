import Link from "next/link";
import { relatedPmleGuides } from "@/lib/content/related";

export function RelatedPmleGuides({ excludeHref, home = false }: { excludeHref?: string; home?: boolean }) {
  return <section aria-label={home ? "PMLE guides" : "Related PMLE guides"} className="space-y-4 border-t border-border pt-6">
    <h2 className="text-xl font-semibold">{home ? "PMLE guides" : "Related PMLE guides"}</h2>
    <ul className="list-disc space-y-3 pl-5">{relatedPmleGuides(excludeHref).map(entry => <li key={entry.href}><Link href={entry.href} className="text-primary underline">{entry.title}</Link></li>)}</ul>
  </section>;
}
