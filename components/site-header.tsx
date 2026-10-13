import Link from "next/link";
import { SiteChrome } from "@/components/site-chrome";
import { SiteLogo } from "@/components/site-logo";
import { AnalyticsIdentity } from "@/components/analytics-identity";
import { verifiedNavigationUserId } from "@/lib/auth/navigation";

export async function SiteHeader() {
  const userId = await verifiedNavigationUserId();
  const signedIn = !!userId;
  return (
    <>
      {userId && <AnalyticsIdentity userId={userId} />}
      <SiteChrome><header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
        <SiteLogo />
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-body sm:gap-x-7 sm:text-base">
          <Link href="/diagnostic" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Diagnostic</Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Pricing</Link>
          <Link href="/faq" className="inline-flex min-h-12 items-center py-2 hover:text-primary">FAQ</Link>
          <Link href="/blog" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Blog</Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="inline-flex min-h-12 items-center rounded-md border border-input px-3.5 py-2 text-foreground hover:bg-muted">{signedIn ? "Dashboard" : "Sign in"}</Link>
          {signedIn && <Link href="/account" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Account</Link>}
        </nav>
      </div>
    </header></SiteChrome>
    </>
  );
}
