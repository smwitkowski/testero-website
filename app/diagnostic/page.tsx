import { pageMetadata } from "@/lib/seo";
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
  return <DiagnosticStart resumeId={resumeId} />;
}
