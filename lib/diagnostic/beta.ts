import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCertification } from "@/lib/certifications/data";

export const BETA_DIAGNOSTIC_CERT_IDS = ["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"] as const;
export type BetaDiagnosticCertId = typeof BETA_DIAGNOSTIC_CERT_IDS[number];
export function isBetaDiagnosticCertId(certId: string): certId is BetaDiagnosticCertId {
  return (BETA_DIAGNOSTIC_CERT_IDS as readonly string[]).includes(certId);
}

/** Fail closed: configuration alone never opens an undersupplied exam. */
export async function betaDiagnosticEnabled(client: SupabaseClient, certId: string): Promise<boolean> {
  if (!isBetaDiagnosticCertId(certId) || !(process.env.BETA_DIAGNOSTIC_CERTS ?? "").split(",").map(value => value.trim()).includes(certId)) return false;
  try {
    const { count, error } = await client.from("questions").select("id", { count: "exact", head: true })
      .eq("exam", certId).eq("status", "ACTIVE").eq("review_status", "GOOD")
      .eq("question_type", "single_select").is("parent_question_id", null);
    return !error && typeof count === "number" && count >= 20;
  } catch { return false; }
}

export function betaDiagnosticMetadata(certId: BetaDiagnosticCertId) {
  const cert = getCertification(certId)!;
  return { certId, name: cert.name, sections: cert.guides[0].sections.filter(section => section.included && (section.weight_percent ?? 0) > 0) };
}
