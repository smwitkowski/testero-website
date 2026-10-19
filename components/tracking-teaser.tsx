import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TrackingTeaser() {
  return <section aria-labelledby="tracking-heading" className="space-y-3 rounded-lg border border-border bg-card p-5 sm:p-7">
    <h2 id="tracking-heading" className="text-xl font-semibold">Progress tracking · PMLE Pass</h2>
    <p className="leading-relaxed text-muted-foreground">Unlock score tracking for each practice session with PMLE Pass. Your latest diagnostic report stays free.</p>
    <Button variant="outline" asChild><Link href="/pricing">Explore PMLE Pass</Link></Button>
  </section>;
}
