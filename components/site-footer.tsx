import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border text-sm leading-relaxed text-muted-foreground">
      <div className="mx-auto max-w-[1120px] space-y-4 px-5 py-5 sm:px-8">
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3">
          <Link href="/terms" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">Terms</Link>
          <Link href="/privacy" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">Privacy</Link>
          <Link href="/faq" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">FAQ</Link>
          <Link href="/blog" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">Blog</Link>
          <Link href="/certifications" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">Certifications</Link>
          <Link href="/tools" className="inline-flex min-h-12 items-center hover:text-primary hover:underline">Free tools</Link>
          <a href="mailto:support@testero.ai" className="inline-flex min-h-12 items-center hover:text-primary hover:underline sm:ml-auto">support@testero.ai</a>
        </nav>
        <p>Independent exam preparation. Not affiliated with or endorsed by Google.</p>
      </div>
    </footer>
  );
}
