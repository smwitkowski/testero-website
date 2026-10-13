import Link from "next/link";
import { isComingSoon, PMLE_EXAM } from "@/lib/content/exam";

export function ComingSoonTag({ exam }: { exam: string }) {
  if (!isComingSoon(exam)) return null;
  return <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Coming soon</span>;
}

export function ExamAvailabilityNotice({ exam }: { exam: string }) {
  if (!isComingSoon(exam)) return null;
  return <aside aria-label="Exam preparation availability" className="space-y-2 rounded-lg border border-border bg-card p-5 text-sm leading-relaxed">
    <p className="font-semibold">PMLE preparation is available today</p>
    <p>Testero covers the {PMLE_EXAM} exam today. Prep for {exam} is coming soon. It is not available on Testero yet.</p>
    <Link href="/diagnostic" className="inline-block py-1 font-medium text-primary underline hover:no-underline">Try the free PMLE diagnostic →</Link>
  </aside>;
}
