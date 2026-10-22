import "server-only";
import { z } from "zod";
import { DEFAULT_CHATGPT_EXAM, getChatgptExam, getChatgptExams, type ChatgptExam } from "@/lib/chatgpt/exams";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

const CACHE_TTL_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Keep this literal policy filter aligned with scripts/chatgpt/select-free-set.mjs.
const POLICY_TERMS = /\b(?:prices?|pricing|checkout|upsell|upgrade|buy|purchase|USD)\b|\$\s*\d|\/pass(?:es)?(?:[/?#\s]|$)/i;
const safeText = z.string().refine(value => value.trim().length > 0 && !POLICY_TERMS.test(value));
const labels = ["A", "B", "C", "D"] as const;
function rowSchema(exam: ChatgptExam) {
  const domainCodes = new Set(exam.domains.map(domain => domain.domainCode));
  return z.object({
    id: z.string().regex(UUID), exam: z.literal(exam.id), question_type: z.literal("single_select"), status: z.literal("ACTIVE"),
    review_status: z.literal("GOOD"), parent_question_id: z.null(), stem: safeText,
    exam_domains: z.object({ code: z.string().refine(code => domainCodes.has(code)) }),
    answers: z.array(z.object({ choice_label: z.enum(labels), choice_text: safeText,
      is_correct: z.boolean(), explanation_text: safeText,
    })).length(4).refine(answers => new Set(answers.map(answer => answer.choice_label)).size === 4
      && answers.filter(answer => answer.is_correct).length === 1),
  });
}
export const CHATGPT_SELECTION_SIZE = getChatgptExam(DEFAULT_CHATGPT_EXAM)?.questionIds.length ?? 0;
export type ChatgptQuestion = {
  id: string; exam: string; domain: string; stem: string;
  options: { label: "A" | "B" | "C" | "D"; text: string; is_correct: boolean; explanation: string }[];
};
/** No exam argument means the default exam, not every enabled set. */
export function isAllowedQuestionId(id: string, exam: string = DEFAULT_CHATGPT_EXAM): boolean {
  return getChatgptExam(exam)?.questionIds.includes(id) ?? false;
}

/** Answer checking must never choose an answer key for an ambiguous ID. */
export function findQuestionExam(id: string): ChatgptExam | undefined {
  const matches = getChatgptExams().filter(exam => exam.questionIds.includes(id));
  return matches.length === 1 ? matches[0] : undefined;
}
type ExamState = {
  signature: string;
  cache?: { expiresAt: number; questions: readonly ChatgptQuestion[] };
  pending?: Promise<readonly ChatgptQuestion[] | null>;
};
const states = new Map<string, ExamState>();

async function readQuestions(exam: ChatgptExam, state: ExamState): Promise<readonly ChatgptQuestion[] | null> {
  const allowedIds = new Set(exam.questionIds);
  const schema = rowSchema(exam);
  const startedAt = Date.now();
  try {
    const { data, error } = await createServiceSupabaseClient().from("questions")
      .select("id,exam,status,review_status,question_type,parent_question_id,stem,exam_domains!inner(code),answers(choice_label,choice_text,is_correct,explanation_text)")
      .eq("exam", exam.id).eq("status", "ACTIVE").eq("review_status", "GOOD")
      .eq("question_type", "single_select")
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
      const parsed = schema.safeParse(row);
      if (!parsed.success || !allowedIds.has(parsed.data.id) || counts.get(parsed.data.id) !== 1) continue;
      const question = parsed.data;
      questions.push({ id: question.id, exam: exam.id, domain: question.exam_domains.code, stem: question.stem,
        options: labels.map(label => {
          const answer = question.answers.find(item => item.choice_label === label)!;
          return { label, text: answer.choice_text, is_correct: answer.is_correct, explanation: answer.explanation_text };
        }),
      });
    }
    // Preserve the selection's deterministic order, independent of database row order.
    const order = new Map([...allowedIds].map((id, index) => [id, index]));
    questions.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    state.cache = { expiresAt: startedAt + CACHE_TTL_MS, questions };
    return questions;
  } catch { return null; }
}

/** Eligibility can lag changes by at most the 30s instance-local TTL. No stale-on-error reads. */
export async function loadChatgptQuestions(exam: string = DEFAULT_CHATGPT_EXAM): Promise<readonly ChatgptQuestion[] | null> {
  const descriptor = getChatgptExam(exam);
  if (!descriptor) { states.delete(exam); return null; }
  const signature = JSON.stringify(descriptor);
  let state = states.get(exam);
  if (!state || state.signature !== signature) {
    state = { signature };
    states.set(exam, state);
  }
  if (state.cache && Date.now() < state.cache.expiresAt) return state.cache.questions;
  state.cache = undefined;
  const current = state;
  const pending = current.pending ?? (current.pending = readQuestions(descriptor, current)
    .finally(() => { current.pending = undefined; }));
  const questions = await pending;
  // Configuration can close an exam while its database read is still in flight.
  return JSON.stringify(getChatgptExam(exam)) === signature ? questions : null;
}
