import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ComingSoonTag } from "@/components/exam-availability";
import { getBlogEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("PMLE exam guides and study articles", "PMLE exam guides and practical study articles. Compare your preparation with current official exam guidance.", "/blog");
const PAGE_SIZE = 8;
export default async function BlogPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const entries = getBlogEntries();
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const visible = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return <section className="certification-content space-y-8">
    <header className="space-y-3"><p className="text-sm font-medium text-primary">Certification resources</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Testero blog</h1><p className="max-w-2xl leading-relaxed text-muted-foreground">PMLE exam guides and practical study articles. Compare your preparation with current official exam guidance.</p></header>
    <p className="text-sm text-muted-foreground">Page {page} of {pageCount} · {entries.length} articles</p>
    <ul className="grid gap-6 md:grid-cols-2">{visible.map((entry) => <li key={entry.slug} className="space-y-4 rounded-lg border border-border bg-card p-6 sm:p-8"><ComingSoonTag exam={entry.exam} /><h2 className="text-pretty text-xl font-semibold leading-snug"><Link href={entry.href} className="text-primary hover:underline">{entry.title}</Link></h2><p className="leading-relaxed text-muted-foreground">{entry.description}</p></li>)}</ul>
    {pageCount > 1 && <nav aria-label="Blog pagination" className="flex flex-wrap items-center gap-3">{page > 1 && <Button asChild variant="outline"><Link href={page === 2 ? "/blog" : `/blog?page=${page-1}`}>← Previous</Link></Button>}<span className="text-sm text-muted-foreground" aria-current="page">Page {page}</span>{page < pageCount && <Button asChild variant="outline"><Link href={`/blog?page=${page+1}`}>Next →</Link></Button>}</nav>}
    <p className="text-sm text-muted-foreground">Testero is independent and not affiliated with Google. Our diagnostic and practice cover PMLE only.</p>
    <Button asChild className="w-full whitespace-normal sm:w-auto"><Link href="/diagnostic">Start free PMLE diagnostic</Link></Button>
  </section>;
}
