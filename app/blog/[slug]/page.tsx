import Link from "next/link";
import { ExamAvailabilityNotice } from "@/components/exam-availability";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getBlogEntry, getBlogEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";
import { articleStructuredData } from "@/lib/structured-data";
import { StructuredData } from "@/components/structured-data";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";
import { certificationForExam, certificationPath } from "@/lib/certifications/catalog";
import { isComingSoon } from "@/lib/content/exam";

type PageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return getBlogEntries().map((entry) => ({ slug: entry.slug })); }
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entry = getBlogEntry(slug);
  if (!entry) notFound();
  return pageMetadata(entry.title, entry.description, entry.href, entry);
}
export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getBlogEntry(slug);
  if (!entry) notFound();
  const cert = certificationForExam(entry.exam);
  const ctaHref = isComingSoon(entry.exam) ? cert ? certificationPath(cert.cert_id) : "/certifications" : "/diagnostic";
  const ctaLabel = isComingSoon(entry.exam) ? cert ? `Get notified about the ${cert.name} diagnostic` : "Choose a certification and get notified" : "Start free PMLE diagnostic";
  return <article className="certification-content space-y-8">
    <StructuredData value={articleStructuredData(entry, "Blog")} />
    <Link href="/blog" className="text-sm font-medium text-primary hover:underline">← Back to blog</Link>
    <header className="space-y-3"><h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{entry.title}</h1>{(entry.updatedAt ?? entry.publishedAt) && <p className="text-sm text-muted-foreground">{entry.updatedAt ? "Updated" : "Published"} <time dateTime={entry.updatedAt ?? entry.publishedAt}>{entry.updatedAt ?? entry.publishedAt}</time>{entry.republished && " (historical source)"}</p>}</header>
    <ExamAvailabilityNotice exam={entry.exam} />
    {entry.editorialNotice && <aside aria-label="Editorial notice" className="rounded-lg border border-border bg-muted p-5 text-sm leading-relaxed"><p className="mb-2 font-semibold">Editorial notice</p><p>{entry.editorialNotice}</p></aside>}
    
    <MarkdownContent content={entry.body} />
    <section aria-label="Sources" className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold">Sources and current guidance</h2><ul className="list-disc space-y-2 pl-6">{entry.citations.map((href) => <li key={href}><a href={href} className="break-words text-sm text-primary underline underline-offset-4" rel="noopener noreferrer">{href}</a></li>)}</ul></section>
    {entry.slug === "vertex-ai-agent-platform-name-mapping" && <aside className="rounded-lg border border-border bg-muted p-5 print:hidden"><Link className="font-semibold text-primary underline" href="/pmle/vertex-ai-agent-platform-cheat-sheet">Print the Vertex AI → Agent Platform cheat sheet</Link><p className="mt-2 text-sm text-body">Verified names, service purposes and the six June 2026 PMLE domain weights. No signup required.</p></aside>}
    <RelatedPmleGuides excludeHref={entry.href} exam={entry.exam} />
    <footer className="space-y-3 border-t border-border pt-6"><p className="text-sm text-muted-foreground">Our diagnostic and practice cover PMLE only. A readiness score is a study signal, not an exam-outcome guarantee.</p><Link href={ctaHref} className="inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">{ctaLabel}</Link></footer>
  </article>;
}
