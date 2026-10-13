import Link from "next/link";
import { AnalyticsIdentity } from "@/components/analytics-identity";
import { verifiedNavigationUserId } from "@/lib/auth/navigation";

export async function SiteHeader() {
  const userId = await verifiedNavigationUserId();
  const signedIn = !!userId;
  return (
    <header className="border-b border-border bg-card">
      {userId && <AnalyticsIdentity userId={userId} />}
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-semibold" aria-label="Testero home">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="4" className="fill-foreground" /><path d="M6 15V11M11 15V7M16 15V9" className="stroke-card" strokeWidth="2" strokeLinecap="round" /></svg>
          Testero
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-body sm:gap-x-7 sm:text-base">
          <Link href="/diagnostic" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Diagnostic</Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Pricing</Link>
          <Link href="/faq" className="inline-flex min-h-12 items-center py-2 hover:text-primary">FAQ</Link>
          <Link href="/blog" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Blog</Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex min-h-12 items-center rounded-md border border-input px-3.5 py-2 text-foreground hover:bg-muted">{signedIn ? "Dashboard" : "Sign in"}</Link>
          {signedIn && <Link href="/account" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Account</Link>}
        </nav>
      </div>
    </header>
  );
}
