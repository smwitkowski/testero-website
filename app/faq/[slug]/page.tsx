import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalog from "@/content/catalog.json";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "FAQ preview" };
export default async function FaqArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = catalog.faq.find((item) => item.slug === slug);
  if (!entry) notFound();
  return <PhasePlaceholder phase={4} title={entry.title} description="This existing FAQ page will return at this URL in Phase 4. The answer is not available in this preview."
    links={[{ href: "/faq", label: "Back to FAQ" }]} />;
}
