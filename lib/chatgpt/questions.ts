import "server-only";
import { z } from "zod";
import freeSet from "@/lib/chatgpt/free-set.json";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const CACHE_TTL_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Keep this literal policy filter aligned with scripts/chatgpt/select-free-set.mjs.
const POLICY_TERMS = /\b(?:prices?|pricing|checkout|upsell|upgrade|buy|purchase|USD)\b|\$\s*\d|\/pass(?:es)?(?:[/?#\s]|$)/i;
const safeText = z.string().refine(value => value.trim().length > 0 && !POLICY_TERMS.test(value));
const labels = ["A", "B", "C", "D"] as const;
const domainCodes = new Set(PMLE_BLUEPRINT.map(domain => domain.domainCode));
const rowSchema = z.object({
  id: z.string().regex(UUID), exam: z.literal("GCP_PM_ML_ENG"), status: z.literal("ACTIVE"),
  review_status: z.literal("GOOD"), parent_question_id: z.null(), stem: safeText,
  exam_domains: z.object({ code: z.string().refine(code => domainCodes.has(code)) }),
  answers: z.array(z.object({ choice_label: z.enum(labels), choice_text: safeText,
    is_correct: z.boolean(), explanation_text: safeText,
  })).length(4).refine(answers => new Set(answers.map(answer => answer.choice_label)).size === 4
    && answers.filter(answer => answer.is_correct).length === 1),
});
const selectionSchema = z.object({ version: z.literal(1), source: z.object({}).passthrough(),
  question_ids: z.array(z.string().regex(UUID)).length(40)
    .refine(ids => new Set(ids).size === ids.length),
}).strict();
const selection = selectionSchema.safeParse(freeSet);
const allowedIds = new Set(selection.success ? selection.data.question_ids : []);
export const CHATGPT_SELECTION_SIZE = allowedIds.size;
export type ChatgptQuestion = {
  id: string; domain: string; stem: string;
  options: { label: "A" | "B" | "C" | "D"; text: string; is_correct: boolean; explanation: string }[];
};
export function isAllowedQuestionId(id: string): boolean { return allowedIds.has(id); }
let cache: { expiresAt: number; questions: readonly ChatgptQuestion[] } | undefined;
let pending: Promise<readonly ChatgptQuestion[] | null> | undefined;

async function readQuestions(): Promise<readonly ChatgptQuestion[] | null> {
  const startedAt = Date.now();
  try {
    const { data, error } = await createServiceSupabaseClient().from("questions")
      .select("id,exam,status,review_status,parent_question_id,stem,exam_domains!inner(code),answers(choice_label,choice_text,is_correct,explanation_text)")
      .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD")
      .is("parent_question_id", null).in("id", [...allowedIds]);
    if (error || !Array.isArray(data)) return null;
    const questions: ChatgptQuestion[] = [];
    // An ambiguous duplicate ID must not decide which answer key is served.
    const counts = new Map<unknown, number>();
    for (const row of data) {
      const id = row && typeof row === "object" ? row.id : undefined;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const row of data) {
      const parsed = rowSchema.safeParse(row);
      if (!parsed.success || !allowedIds.has(parsed.data.id) || counts.get(parsed.data.id) !== 1) continue;
      const question = parsed.data;
      questions.push({ id: question.id, domain: question.exam_domains.code, stem: question.stem,
        options: labels.map(label => {
          const answer = question.answers.find(item => item.choice_label === label)!;
          return { label, text: answer.choice_text, is_correct: answer.is_correct, explanation: answer.explanation_text };
        }),
      });
    }
    // Preserve the selection's deterministic order, independent of database row order.
    const order = new Map([...allowedIds].map((id, index) => [id, index]));
    questions.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    cache = { expiresAt: startedAt + CACHE_TTL_MS, questions };
    return questions;
  } catch { return null; }
}

/** Eligibility can lag changes by at most the 30s instance-local TTL. No stale-on-error reads. */
export async function loadChatgptQuestions(): Promise<readonly ChatgptQuestion[] | null> {
  if (!allowedIds.size) return null;
  if (cache && Date.now() < cache.expiresAt) return cache.questions;
  cache = undefined;
  if (!pending) pending = readQuestions().finally(() => { pending = undefined; });
  return pending;
}
