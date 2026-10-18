import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <section className="mx-auto max-w-[760px] space-y-6 rounded-lg border border-border bg-card p-5 sm:p-8">
    <p className="text-sm font-medium text-muted-foreground">404</p>
    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Page not found</h1>
    <p className="leading-relaxed text-muted-foreground">This page may have moved, or the link may be incorrect.</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button asChild><Link href="/">Go home</Link></Button>
      <Button variant="outline" asChild><Link href="/diagnostic">Start the free diagnostic</Link></Button>
    </div>
  </section>;
}
