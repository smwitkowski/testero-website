import Image from "next/image";
import Link from "next/link";
import { hasVerifiedNavigationSession } from "@/lib/auth/navigation";

export async function SiteHeader() {
  const signedIn = await hasVerifiedNavigationSession();
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold" aria-label="Testero home">
          <Image src="/logo.svg" alt="" width={32} height={30} priority />Testero
        </Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
          <Link href="/diagnostic" className="py-2 hover:text-primary">Diagnostic</Link>
          <Link href="/pricing" className="py-2 hover:text-primary">Pricing</Link>
          <Link href="/faq" className="py-2 hover:text-primary">FAQ</Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="py-2 text-primary hover:underline">{signedIn ? "Dashboard" : "Sign in"}</Link>
        </nav>
      </div>
    </header>
  );
}
