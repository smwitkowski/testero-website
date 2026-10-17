import Link from "next/link";
import { certificationForExam } from "@/lib/certifications/catalog";
import { isComingSoon, PMLE_EXAM } from "@/lib/content/exam";

export function ComingSoonTag({ exam }: { exam: string }) {
  if (!isComingSoon(exam)) return null;
  return <span className="inline-flex rounded border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{certificationForExam(exam) || exam === "other Google Cloud certifications" ? "Diagnostic coming" : "Not on Testero yet"}</span>;
}

export function ExamAvailabilityNotice({ exam }: { exam: string }) {
  if (!isComingSoon(exam)) return null;
  return <aside aria-label="Exam preparation availability" className="space-y-2 rounded-lg border border-border bg-muted p-5 text-body text-sm leading-relaxed">
    <p className="font-semibold text-foreground">PMLE preparation is available today</p>
    <p>Testero covers the {PMLE_EXAM} exam today. {certificationForExam(exam) || exam === "other Google Cloud certifications" ? `Diagnostic coming for ${exam}.` : `Prep for ${exam} is not available on Testero yet.`}</p>
    <Link href="/diagnostic" className="inline-block py-1 font-medium text-primary underline hover:no-underline">Try the free PMLE diagnostic →</Link>
  </aside>;
}
