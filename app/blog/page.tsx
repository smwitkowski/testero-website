import type { Metadata } from "next";
import Link from "next/link";
import catalog from "@/content/catalog.json";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Blog" };
export default function BlogPage() {
  return (
    <PhasePlaceholder phase={4} title="Testero blog" description="The existing articles will return at their original URLs in Phase 4. These links open article previews, not the full articles.">
      <ul className="divide-y divide-border border-y border-border">
        {catalog.blog.map((article) => <li key={article.slug} className="py-4"><Link href={article.href} className="font-medium leading-relaxed text-primary hover:underline">{article.title}</Link></li>)}
      </ul>
    </PhasePlaceholder>
  );
}
