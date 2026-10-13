import Link from "next/link";

export function SiteLogo() {
  return <Link href="/" className="flex shrink-0 items-center gap-2.5 text-lg font-semibold" aria-label="Testero home">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect x="1" y="1" width="20" height="20" rx="4" className="fill-foreground" /><path d="M6 15V11M11 15V7M16 15V9" className="stroke-card" strokeWidth="2" strokeLinecap="round" /></svg>
          Testero
        </Link>;
}
