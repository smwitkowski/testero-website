import type { ReactNode } from "react";
import Link from "next/link";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl } from "@/lib/seo";
import { tools } from "@/lib/tools/pages";
export function ToolPage({ slug, children, copy }: { slug: string; children: ReactNode; copy: ReactNode }) {
  const tool = tools.find(tool => tool.slug === slug);
  const title = tool?.title ?? "Free Google Cloud certification tools";
  return <section className="certification-tool space-y-10">
    <StructuredData value={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "Free tools", item: canonicalUrl("/tools") },
      ...(tool ? [{ "@type": "ListItem", position: 3, name: tool.label, item: canonicalUrl(`/tools/${tool.slug}`) }] : []),
    ] }} />
    <header className="max-w-3xl space-y-4 print:hidden"><nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-primary"><Link href="/certifications" className="underline">Certifications</Link><span aria-hidden="true">/</span><Link href="/tools" className="underline">Free tools</Link>{tool && <><span aria-hidden="true">/</span><span className="text-body">{tool.label}</span></>}</nav><h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1><p className="text-lg leading-relaxed text-body">{tool?.summary ?? "Choose a credential, make a realistic time budget and keep track of official guide changes. No account or question bank required."}</p></header>
    {children}
    <section className="max-w-3xl space-y-4 text-body print:hidden">{copy}</section>
    {tool && <nav aria-label="More free tools" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-5 print:hidden">{tools.filter(item => item.slug !== slug).map(item => <Link key={item.slug} href={`/tools/${item.slug}`} className="inline-block py-2 text-primary underline">{item.label} →</Link>)}</nav>}
    <p className="text-sm leading-relaxed text-muted-foreground">Testero is independent and not affiliated with or endorsed by Google. These tools do not predict an exam outcome.</p>
  </section>;
}
