import Link from "next/link";
import { ExamAvailabilityNotice } from "@/components/exam-availability";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getFaqEntry, getFaqEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";
import { articleStructuredData } from "@/lib/structured-data";
import { StructuredData } from "@/components/structured-data";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";

type PageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return getFaqEntries().map((entry) => ({ slug: entry.slug })); }
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entry = getFaqEntry(slug);
  if (!entry) notFound();
  return pageMetadata(entry.title, entry.description, entry.href, entry);
}
export default async function FaqArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getFaqEntry(slug);
  if (!entry) notFound();
  return <article className="certification-content space-y-8">
    <StructuredData value={articleStructuredData(entry, "FAQ")} />
    <Link href="/faq" className="text-sm font-medium text-primary hover:underline">← Back to FAQ</Link>
    <header className="space-y-3"><h1 className="text-pretty text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{entry.title}</h1>{(entry.updatedAt ?? entry.publishedAt) && <p className="text-sm text-muted-foreground">{entry.updatedAt ? "Updated" : entry.republished ? "Republished" : "Published"} <time dateTime={entry.updatedAt ?? entry.publishedAt}>{entry.updatedAt ?? entry.publishedAt}</time>{entry.republished && "; original publication date unavailable."}</p>}</header>
    {entry.updatedAt && <MarkdownContent content={entry.body} />}
    <ExamAvailabilityNotice exam={entry.exam} />
    {entry.editorialNotice && <aside aria-label="Editorial notice" className="rounded-lg border border-border bg-muted p-5 text-sm leading-relaxed"><p className="mb-2 font-semibold">Editorial notice</p><p>{entry.editorialNotice}</p></aside>}
    {!entry.updatedAt && <p className="rounded-lg border border-border bg-muted p-5 text-sm leading-relaxed">Historical certification answer. Exam fees, formats, registration providers, and program requirements can change. Check the linked sources and <a className="text-primary underline" href="https://cloud.google.com/learn/certification">current official Google Cloud guidance</a> before booking or choosing a course. No certification or preparation tool guarantees a job or salary increase.</p>}
    {!entry.updatedAt && <MarkdownContent content={entry.body} />}
    <section aria-label="Sources" className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold">Sources and current guidance</h2><ul className="list-disc space-y-2 pl-6">{entry.citations.map((href) => <li key={href}><a href={href} className="break-words text-sm text-primary underline underline-offset-4" rel="noopener noreferrer">{href}</a></li>)}</ul></section>
    <RelatedPmleGuides excludeHref={entry.href} exam={entry.exam} />
    <footer className="space-y-3 border-t border-border pt-6"><p className="text-sm text-muted-foreground">Our diagnostic and practice cover PMLE only. A readiness score is a study signal, not an exam-outcome guarantee.</p><Link href="/diagnostic" className="inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Start free PMLE diagnostic</Link></footer>
  </article>;
}
