import { pageMetadata } from "@/lib/seo";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { DiagnosticStart } from "@/components/diagnostic-start";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { findOpenDiagnostic } from "@/lib/diagnostic/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const metadata = pageMetadata("Start your free PMLE diagnostic", "Answer 20 questions across six PMLE exam domains. See your readiness and study focus without an account.", "/diagnostic");
export const dynamic = "force-dynamic";
export default async function DiagnosticStartPage() {
  let resumeId: string | null = null;
  try { resumeId = await findOpenDiagnostic(createServiceSupabaseClient(), await diagnosticCredentials()); }
  catch { /* Resume is a convenience; starting fresh always works. */ }
  return <>
    <DiagnosticStart resumeId={resumeId} />
    <section aria-labelledby="diagnostic-coverage" className="mx-auto mt-10 max-w-[696px] space-y-4 border-t border-border pt-6">
      <h2 id="diagnostic-coverage" className="text-xl font-semibold">What the PMLE diagnostic covers</h2>
      <p className="leading-relaxed text-muted-foreground">This free 20-question diagnostic follows the six domains in Google&apos;s June 1, 2026 Professional Machine Learning Engineer exam guide. The guide assigns these approximate weights:</p>
      <ul className="list-disc space-y-2 pl-5 text-body">{PMLE_BLUEPRINT.map(domain => <li key={domain.domainCode}>{domain.displayName} (about {Math.round(domain.weight * 101)}%)</li>)}</ul>
      <p className="leading-relaxed text-muted-foreground">The published percentages total 101% because they are approximate. Your diagnostic samples across all six domains; it is not a full-length official exam. Scenarios ask you to compare approaches for building and operating AI and ML systems, rather than memorize a list of products.</p>
      <p className="leading-relaxed text-muted-foreground">No account is needed to see your overall readiness score, tier and domain breakdown. Use the report to choose a study focus, then check the official guide and documentation for gaps. A free account adds answer review and five practice questions per week; PMLE Pass adds explanations and unlimited practice. Results guide study, not predict a pass. Testero is independent and not affiliated with Google.</p>
      <a href="https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf" className="text-primary underline">Read the official PMLE exam guide</a>
    </section>
  </>;
}
