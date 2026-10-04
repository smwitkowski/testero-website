import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/markdown-content";
import { getBlogEntry, getBlogEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

type PageProps = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return getBlogEntries().map((entry) => ({ slug: entry.slug })); }
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entry = getBlogEntry(slug);
  if (!entry) notFound();
  return pageMetadata(entry.title, entry.description, entry.href);
}
export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const entry = getBlogEntry(slug);
  if (!entry) notFound();
  return <article className="space-y-8">
    <Link href="/blog" className="text-sm font-medium text-primary hover:underline">← Back to blog</Link>
    <header className="space-y-3"><h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{entry.title}</h1>{entry.publishedAt && <p className="text-sm text-muted-foreground">Originally published <time dateTime={entry.publishedAt}>{entry.publishedAt}</time></p>}</header>
    {entry.editorialNotice && <aside aria-label="Editorial notice" className="rounded-lg border border-border bg-muted p-5 text-sm leading-relaxed"><p className="mb-2 font-semibold">Editorial notice</p><p>{entry.editorialNotice}</p></aside>}
    
    <MarkdownContent content={entry.body} />
    <section aria-label="Sources" className="space-y-3 border-t border-border pt-6"><h2 className="text-xl font-semibold">Sources and current guidance</h2><ul className="list-disc space-y-2 pl-6">{entry.citations.map((href) => <li key={href}><a href={href} className="break-words text-sm text-primary underline underline-offset-4" rel="noopener noreferrer">{href}</a></li>)}</ul></section>
    <footer className="space-y-3 border-t border-border pt-6"><p className="text-sm text-muted-foreground">Testero is independent and not affiliated with Google. Our diagnostic and practice cover PMLE only. A readiness score is a study signal, not an exam-outcome guarantee.</p><Link href="/diagnostic" className="inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Start free PMLE diagnostic</Link></footer>
  </article>;
}
