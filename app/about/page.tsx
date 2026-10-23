import Link from "next/link";
import { FOUNDER_BIO } from "@/lib/content/founder";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata("About Testero", "Meet the independent developer behind Testero and learn how its PMLE practice questions are made.", "/about");

export default function AboutPage() {
  return <section className="max-w-3xl space-y-6">
    <p className="text-sm font-semibold uppercase tracking-wide text-primary">About Testero</p>
    <h1 className="text-4xl font-semibold tracking-tight">Who builds this</h1>
    <p className="text-lg leading-8 text-body">{FOUNDER_BIO}</p>
    <p className="text-sm text-muted-foreground">Independent study tool. Not affiliated with Google.</p>
    <Link className="inline-flex min-h-11 items-center font-semibold text-primary underline" href="/diagnostic?start=1&length=5">Start a free 5-question readiness check →</Link>
  </section>;
}
