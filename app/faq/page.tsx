import type { Metadata } from "next";
import Link from "next/link";
import catalog from "@/content/catalog.json";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "FAQ" };
export default function FaqPage() {
  return (
    <PhasePlaceholder phase={4} title="Frequently asked questions" description="The existing FAQ pages will return at their original URLs in Phase 4. These links open previews; the answers are not published here yet.">
      <ul className="divide-y divide-border border-y border-border">
        {catalog.faq.map((entry) => <li key={entry.slug} className="py-4"><Link href={entry.href} className="font-medium leading-relaxed text-primary hover:underline">{entry.title}</Link></li>)}
      </ul>
    </PhasePlaceholder>
  );
}
