import type { Metadata } from "next";
import { notFound } from "next/navigation";
import catalog from "@/content/catalog.json";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Blog article preview" };
export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = catalog.blog.find((entry) => entry.slug === slug);
  if (!article) notFound();
  return <PhasePlaceholder phase={4} title={article.title} description="This existing article will return at this URL in Phase 4. The article body is not available in this preview."
    links={[{ href: "/blog", label: "Back to blog" }]} />;
}
