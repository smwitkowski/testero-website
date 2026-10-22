import "server-only";
import { z } from "zod";
import freeSet from "@/lib/chatgpt/free-set.json";
import freeSets from "@/lib/chatgpt/free-sets.json";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getCertification } from "@/lib/certifications/data";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

export const DEFAULT_CHATGPT_EXAM = "GCP_PM_ML_ENG";
export type ChatgptExam = {
  readonly id: string;
  readonly certId: string;
  readonly domains: readonly { readonly domainCode: string; readonly displayName: string; readonly weight: number }[];
  readonly questionIds: readonly string[];
  readonly weightNote?: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const idsSchema = z.array(z.string().regex(UUID)).min(1)
  .refine(ids => new Set(ids).size === ids.length);
const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const tokenSchema = z.string().max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sourceSchema = z.object({
  kind: z.literal("local-export"),
  upstream: z.literal("read-only-database-content-export"),
  exported_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).refine(value => {
    const date = new Date(value);
    return Number.isFinite(date.valueOf()) && date.toISOString() === value;
  }),
  export_sha256: hashSchema,
  blueprint_sha256: hashSchema.optional(),
  selection: tokenSchema,
}).strict();
const pmleSetSchema = z.object({ version: z.literal(1),
  source: sourceSchema.extend({ blueprint_sha256: hashSchema }),
  question_ids: idsSchema.refine(ids => ids.length === 40),
}).strict();
const additionalSetSchema = z.object({ version: z.literal(1), source: sourceSchema, question_ids: idsSchema }).strict();
const setsSchema = z.record(tokenSchema, additionalSetSchema);

function descriptor(id: string, questionIds: readonly string[]): ChatgptExam | undefined {
  const certId = id === DEFAULT_CHATGPT_EXAM ? PMLE_CERT_ID : id;
  if (certId === PMLE_CERT_ID && id !== DEFAULT_CHATGPT_EXAM) return;
  if (certifications.filter(cert => cert.cert_id === certId).length !== 1) return;
  const cert = getCertification(certId);
  if (!cert || cert.cert_id !== certId) return;
  const guides = cert.guides.filter(guide => guide.variant === "standard");
  if (guides.length !== 1) return;
  const guide = guides[0];
  const sections = guide.sections.filter(section => section.included);
  if (!sections.length || sections.some(section => !section.title.trim()
    || !/^[1-9]\d*$/.test(section.number)
    || section.id !== `${certId}:standard:${section.number}`
    || typeof section.weight_percent !== "number" || !Number.isFinite(section.weight_percent)
    || section.weight_percent < 0)) return;
  const total = sections.reduce((sum, section) => sum + section.weight_percent!, 0);
  if (!Number.isFinite(total) || total <= 0) return;
  const domains = sections.map(section => {
    const legacy = id === DEFAULT_CHATGPT_EXAM ? PMLE_BLUEPRINT[Number(section.number) - 1] : undefined;
    return { domainCode: legacy?.domainCode ?? section.id, displayName: section.title,
      weight: section.weight_percent! / total };
  });
  if (new Set(domains.map(domain => domain.domainCode)).size !== domains.length) return;
  // PMLE's six historical DB codes must still map exactly to the reviewed guide.
  if (id === DEFAULT_CHATGPT_EXAM && (sections.length !== PMLE_BLUEPRINT.length
    || sections.some(section => !PMLE_BLUEPRINT[Number(section.number) - 1]))) return;
  const weightNote = total !== 100
    ? `Official approximate weights total ${total}%; sampling weights are normalized to sum to one.`
    : guide.weight_note || undefined;
  return Object.freeze({ id, certId, domains: Object.freeze(domains.map(domain => Object.freeze(domain))),
    questionIds: Object.freeze([...questionIds]), ...(weightNote ? { weightNote } : {}) });
}

/** Invalid public manifests or enabled entries close the whole allowlist; never substitute a default. */
export function getChatgptExams(): readonly ChatgptExam[] {
  try {
    const ids = (process.env.CHATGPT_EXAMS ?? DEFAULT_CHATGPT_EXAM).split(",").map(id => id.trim());
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return [];
    // All committed manifests are public IDs-only artifacts, even when disabled.
    const sets = setsSchema.safeParse(freeSets);
    const pmle = pmleSetSchema.safeParse(freeSet);
    if (!sets.success || !pmle.success) return [];
    const exams: ChatgptExam[] = [];
    for (const id of ids) {
      const selection = id === DEFAULT_CHATGPT_EXAM ? pmle.data
        : Object.hasOwn(sets.data, id) ? sets.data[id] : undefined;
      if (!selection) return [];
      const exam = descriptor(id, selection.question_ids);
      if (!exam) return [];
      exams.push(exam);
    }
    // A question must have one enabled answer-checking owner, even across exams.
    const allIds = exams.flatMap(exam => exam.questionIds);
    if (new Set(allIds).size !== allIds.length) return [];
    return Object.freeze(exams);
  } catch { return []; }
}

export function getChatgptExam(id: string): ChatgptExam | undefined {
  return getChatgptExams().find(exam => exam.id === id);
}
