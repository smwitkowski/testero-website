import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">Know where to focus your PMLE study.</h1>
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">Take a free 20-question diagnostic for the Google Cloud Professional Machine Learning Engineer exam. See your score, readiness tier, and all six exam domains.</p>
      <Button asChild><Link href="/diagnostic">Explore the diagnostic</Link></Button>
      <p className="text-sm text-muted-foreground">No account required. Study guidance, not a prediction of your exam result.</p>
    </section>
  );
}
