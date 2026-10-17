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
  assessment_components?: string[]; lab_deadline?: { date: string; source_url: string; variant?: string };
  recommended_experience?: string;
  recommended_experience_source?: { url: string; retrieved_at: string };
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
export function deliveryLabel(value: string | null) {
  if (value && /online.proctored/i.test(value) && /onsite.proctored|testing center/i.test(value)) return "Online proctored or at a test center";
  return value;
}
export function guideLabel(variant: string) {
  if (variant === "standard") return "Exam guide";
  if (variant === "renewal") return "Renewal exam guide";
  return `${label(variant)} exam guide`;
}
export function questionCount(exam: ExamVariant) {
  const count = exam.question_count;
  return count ? `${count.approximate ? "~" : ""}${count.min === count.max ? count.min : `${count.min}–${count.max}`}` : null;
}
export function examSummary(exam: ExamVariant) {
  return [
    exam.duration_minutes === null ? `Duration: ${notStated}` : `${exam.duration_minutes / 60} ${exam.duration_minutes === 60 ? "hour" : "hours"}`,
    questionCount(exam) ? `${questionCount(exam)} questions` : `Questions: ${notStated}`,
    exam.price_usd === null ? `Price: ${notStated}` : `$${exam.price_usd}${/tax/i.test(exam.price_stated ?? "") ? " + tax" : ""}`,
    exam.languages_stated || exam.languages?.length ? fact(exam.languages_stated ?? exam.languages) : `Languages: ${notStated}`,
    exam.validity_stated ? `Valid for ${exam.validity_stated}` : null,
  ].filter((value): value is string => value !== null);
}
export function skillsRenewalSummary(exam: ExamVariant) {
  if (exam.variant !== "skills_renewal" || !exam.format_stated || exam.duration_minutes !== null || exam.question_count !== null) return null;
  return `Skills renewal: complete designated courses or skill badges${exam.validity_stated ? `; renews for ${exam.validity_stated}` : ""}.`;
}
export function variantFacts(exam: ExamVariant) {
  const core = new Set(["Duration", "Question count", "Languages", "Price (USD)"]);
  const hasCaseStudies = !!(exam.case_studies_per_exam || exam.case_studies_stated || exam.case_study_names?.length);
  const rows: [string, unknown][] = [
    ["Duration", exam.duration_stated ?? (exam.duration_minutes === null ? null : `${exam.duration_minutes} minutes`)],
    ["Question count", questionCount(exam)],
    ["Question types", exam.question_types?.map(label)],
    ...(!exam.question_types?.length ? [["Format", exam.format_stated] as [string, unknown]] : []),
    ["Languages", exam.languages_stated ?? exam.languages],
    ["Price (USD)", exam.price_stated ?? (exam.price_usd === null ? null : `$${exam.price_usd}`)],
    ["Delivery", deliveryLabel(exam.delivery_stated)], ["Validity", exam.validity_stated],
    ...(hasCaseStudies ? [["Case studies per exam", exam.case_studies_per_exam ?? exam.case_studies_stated], ["Case study format", exam.case_studies_per_exam ? exam.case_studies_stated : null], ["Case study names", exam.case_study_names]] as [string, unknown][] : []),
  ];
  return rows.map(([name, value]) => [name, fact(value)]).filter(([name, value]) => value !== notStated || core.has(name));
}
