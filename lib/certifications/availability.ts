import "server-only";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { betaDiagnosticEnabled, isBetaDiagnosticCertId } from "@/lib/diagnostic/beta";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export type DiagnosticAvailability = "available" | "beta" | "coming-soon";
export type DiagnosticAvailabilityMap = Record<string, DiagnosticAvailability>;

/** Use the diagnostic's allowlist and approved live-bank gate, never a marketing override. */
export async function getDiagnosticAvailability(certId: string): Promise<DiagnosticAvailability> {
  if (certId === PMLE_CERT_ID) return "available";
  if (!isBetaDiagnosticCertId(certId)) return "coming-soon";
  try {
    return await betaDiagnosticEnabled(createServiceSupabaseClient(), certId) ? "beta" : "coming-soon";
  } catch {
    // Missing service configuration or an unavailable bank must not advertise a beta.
    return "coming-soon";
  }
}

export async function getDiagnosticAvailabilityMap(): Promise<DiagnosticAvailabilityMap> {
  const entries = await Promise.all(certifications.map(async cert => [cert.cert_id, await getDiagnosticAvailability(cert.cert_id)] as const));
  return Object.fromEntries(entries);
}
