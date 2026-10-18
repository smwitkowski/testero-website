"use client";

import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { AccountNavigation, useNavigationUser } from "@/components/account-navigation";
import { Button, buttonVariants } from "@/components/ui/button";

const links = [["/diagnostic", "Diagnostic"], ["/pricing", "Pricing"], ["/faq", "FAQ"], ["/blog", "Blog"], ["/certifications", "Certifications"]];

export function SiteNavigation() {
  const pathname = usePathname();
  const userId = useNavigationUser();
  const disclosure = useRef<HTMLDetailsElement>(null);
  function close() { if (disclosure.current) disclosure.current.open = false; }
  const navigationLinks = links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className="inline-flex min-h-12 items-center rounded-md px-3 hover:bg-muted hover:text-primary aria-[current=page]:text-primary">{label}</Link>);
  return <>
    <nav aria-label="Main navigation" className="hidden items-center gap-1 whitespace-nowrap text-sm font-medium text-body lg:flex">
      {navigationLinks}<AccountNavigation />
    </nav>
    <div className="flex items-center gap-2 lg:hidden">
      <Button asChild size="sm"><Link href={userId ? "/dashboard" : "/diagnostic"}>{userId ? "Dashboard" : "Start free"}</Link></Button>
      <details ref={disclosure} className="group" onKeyDown={event => {
        if (event.key === "Escape") { close(); disclosure.current?.querySelector("summary")?.focus(); }
      }}>
        <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Menu">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
        </summary>
        <nav aria-label="Mobile navigation" onClick={event => { if ((event.target as HTMLElement).closest("a")) close(); }} className="absolute inset-x-0 top-full grid gap-1 border-b border-border bg-card px-5 py-4 text-base font-medium text-body shadow-md">
          {navigationLinks}<AccountNavigation />
        </nav>
      </details>
    </div>
  </>;
}
