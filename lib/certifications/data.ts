import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { certifications } from "./catalog";

export interface ExamVariant {
  variant: string; duration_minutes: number | null; duration_stated: string | null;
  question_count: { min: number; max: number; approximate: boolean } | null;
  question_types: string[] | null; format_stated: string | null;
  languages: string[] | null; languages_stated: string | null;
  price_usd: number | null; price_stated: string | null; validity_stated: string | null;
  delivery_stated: string | null; case_studies_per_exam: unknown; case_studies_stated: string | null;
  case_study_names: string[] | null; guide_urls: string[];
}
export interface ExamGuide {
  url: string; variant: string; version: string | null; effective_date: string | null;
  as_of_date: string | null; status?: string; weight_note?: string;
  stated_weight_total_percent?: number;
  in_scope_tools?: string[];
  sections: { id: string; number: string; title: string; weight_percent: number | null; weight_approximate: boolean; included: boolean }[];
}
export interface Certification {
  cert_id: string; name: string; catalog_name: string; level: string; cert_url: string;
  status: string; registration_status: string; canonical_exam_code: string | null;
  retirement: Record<string, unknown> | string | null; announcements: string[];
  upcoming_versions: Record<string, unknown>[]; exam_variants: ExamVariant[]; guides: ExamGuide[];
  sources: { url: string; retrieved_at: string; role: string }[];
  sample_sources: { url: string; availability: string }[];
  missing_fields: string[]; not_stated_notes: string[];
  assessment_components?: string[]; lab_deadline?: { date: string; source_url: string };
  recommended_experience?: string;
}
export function getCertification(certId: string): Certification | undefined {
  const entry = certifications.find(cert => cert.cert_id === certId);
  if (!entry) return;
  return JSON.parse(readFileSync(path.join(process.cwd(), "content-pipeline/certs", entry.file), "utf8")) as Certification;
}
export function checkedDate(cert: Certification) {
  return cert.sources.filter(source => source.role === "certification").map(source => source.retrieved_at).sort().at(-1)!;
}
export function catalogCheckedDate() {
  return certifications.map(cert => checkedDate(getCertification(cert.cert_id)!)).sort().at(-1)!;
}
export const notStated = "Not stated by Google";
export function fact(value: unknown): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return notStated;
  if (Array.isArray(value)) return value.map(fact).join(", ");
  if (typeof value === "object") return Object.entries(value).map(([key, item]) => `${label(key)}: ${fact(item)}`).join("; ");
  return String(value);
}
export const label = (value: string) => value.replaceAll("_", " ").replace(/^./, char => char.toUpperCase());
export function variantFacts(exam: ExamVariant) {
  const count = exam.question_count;
  return [
    ["Duration", exam.duration_stated ?? (exam.duration_minutes === null ? null : `${exam.duration_minutes} minutes`)],
    ["Question count", count ? `${count.approximate ? "Approximately " : ""}${count.min === count.max ? count.min : `${count.min}–${count.max}`}` : null],
    ["Question types", exam.question_types?.map(label)], ["Format", exam.format_stated],
    ["Languages", exam.languages_stated ?? exam.languages], ["Price (USD)", exam.price_stated ?? (exam.price_usd === null ? null : `$${exam.price_usd}`)],
    ["Delivery", exam.delivery_stated], ["Validity", exam.validity_stated],
    ["Case studies per exam", exam.case_studies_stated ?? exam.case_studies_per_exam], ["Case study names", exam.case_study_names],
  ].map(([name, value]) => [String(name), fact(value)]);
}
