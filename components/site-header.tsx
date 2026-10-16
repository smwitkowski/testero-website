import Link from "next/link";
import { SiteChrome } from "@/components/site-chrome";
import { SiteLogo } from "@/components/site-logo";
import { AccountNavigation, NavigationIdentity } from "@/components/account-navigation";

export function SiteHeader() {
  return (
    <NavigationIdentity>
      <SiteChrome><header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 sm:px-8">
        <SiteLogo />
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-body sm:gap-x-7 sm:text-base">
          <Link href="/diagnostic" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Diagnostic</Link>
          <Link href="/pricing" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Pricing</Link>
          <Link href="/faq" className="inline-flex min-h-12 items-center py-2 hover:text-primary">FAQ</Link>
          <Link href="/blog" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Blog</Link>
          <Link href="/certifications" className="inline-flex min-h-12 items-center py-2 hover:text-primary">Certifications</Link>
          <AccountNavigation />
        </nav>
      </div>
    </header></SiteChrome>
    </NavigationIdentity>
  );
}
