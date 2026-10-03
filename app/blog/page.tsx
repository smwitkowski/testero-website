import Link from "next/link";
import { getBlogEntries } from "@/lib/content/loader";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("Testero blog", "Edited historical certification articles and practical PMLE study guidance. Check official sources for current exam details.", "/blog");
export default function BlogPage() {
  const entries = getBlogEntries();
  return <section className="space-y-8">
    <header className="space-y-3"><p className="text-sm font-medium text-primary">Certification resources</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Testero blog</h1><p className="max-w-2xl leading-relaxed text-muted-foreground">Edited historical certification articles and practical PMLE study guidance. Check official sources for current exam details.</p></header>
    <ul className="divide-y divide-border border-y border-border">{entries.map((entry) => <li key={entry.slug} className="space-y-2 py-6"><h2 className="text-xl font-semibold"><Link href={entry.href} className="text-primary hover:underline">{entry.title}</Link></h2><p className="leading-relaxed text-muted-foreground">{entry.description}</p></li>)}</ul>
    <p className="text-sm text-muted-foreground">Testero is independent and not affiliated with Google. Our diagnostic and practice cover PMLE only.</p>
    <Link href="/diagnostic" className="inline-flex rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90">Start free PMLE diagnostic</Link>
  </section>;
}
