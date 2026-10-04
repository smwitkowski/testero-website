import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-3xl space-y-4 px-5 pb-8 text-sm leading-relaxed text-muted-foreground sm:px-8">
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-3">
        <Link href="/terms" className="hover:text-primary hover:underline">Terms</Link>
        <Link href="/privacy" className="hover:text-primary hover:underline">Privacy</Link>
        <Link href="/faq" className="hover:text-primary hover:underline">FAQ</Link>
        <Link href="/blog" className="hover:text-primary hover:underline">Blog</Link>
        <a href="mailto:support@testero.ai" className="hover:text-primary hover:underline">support@testero.ai</a>
      </nav>
      <p>Independent exam preparation. Not affiliated with or endorsed by Google.</p>
    </footer>
  );
}
