import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { hasValidAnswers, type CanonicalAnswer } from "@/lib/diagnostic/pmle-selection";
import { createAnswerSnapshot, shuffleArray } from "@/lib/questions/answer-order";
import { ownsSession } from "@/lib/diagnostic/ownership";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { computeResult } from "@/lib/diagnostic/scoring";
import { mapReview, type QuestionReviewSource } from "@/lib/diagnostic/types";
import type { PracticeProgress, PracticeAnswerResponse, PracticeSummary } from "@/lib/practice/types";

export const FREE_PRACTICE_LENGTH = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new DiagnosticError(503, "Practice is unavailable. Please try again.");
export class PracticeQuotaError extends DiagnosticError {
  constructor() { super(429, "You have used your five free practice questions this week."); }
}
interface Session { id: string; user_id: string | null; anonymous_owner_hash: string | null; question_count: number; completed_at: string | null; expires_at: string }
interface Item extends Omit<QuestionReviewSource, "selected_label" | "is_correct"> { selected_label: string | null; is_correct: boolean | null; answered_at: string | null }
interface Question { id: string; stem: string; answers: CanonicalAnswer[]; exam_domains: { code: string; name: string } }
const ITEM_FIELDS = "id,ordinal,stem,options,domain_code,domain_name,selected_label,correct_label,is_correct,answered_at";
function validAnsweredItem(row: Pick<Item, "options" | "selected_label" | "correct_label" | "is_correct">): boolean {
  if (!Array.isArray(row.options) || row.options.length < 2 || row.options.some(option => !option || typeof option.label !== "string" || !option.label.trim() || typeof option.text !== "string" || !option.text.trim())) return false;
  const labels = row.options.map(option => option.label);
  return new Set(labels).size === labels.length && typeof row.selected_label === "string" && typeof row.correct_label === "string"
    && labels.includes(row.selected_label) && labels.includes(row.correct_label) && typeof row.is_correct === "boolean"
    && row.is_correct === (row.selected_label === row.correct_label);
}
export function utcWeekStart(now = new Date()): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export async function freePracticeQuota(client: SupabaseClient, userId: string, now = new Date()) {
  const weekStart = utcWeekStart(now);
  const { data, error } = await client.from("free_practice_quota").select("questions_used").eq("user_id", userId).eq("week_start", weekStart).maybeSingle();
  const used = data?.questions_used ?? 0;
  if (error || !Number.isInteger(used) || used < 0 || used > 5) throw unavailable();
  return { remaining: 5 - used, weekStart };
}
export async function createPractice(client: SupabaseClient, userId: string, domainCode: string, now = Date.now()): Promise<string> {
  if (!UUID.test(userId)) throw new DiagnosticError(401, "Please sign in to continue");
  if (!PMLE_BLUEPRINT.some(domain => domain.domainCode === domainCode)) throw new DiagnosticError(400, "Choose a valid practice domain");
  if ((await freePracticeQuota(client, userId, new Date(now))).remaining < FREE_PRACTICE_LENGTH) throw new PracticeQuotaError();
  const { data, error } = await client.from("questions")
    .select("id,stem,answers(choice_label,choice_text,is_correct),exam_domains!inner(code,name)")
    .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD").eq("exam_domains.code", domainCode);
  if (error || !Array.isArray(data)) throw unavailable();
  const valid = (data as unknown as Question[]).filter(question => question.exam_domains?.code === domainCode && typeof question.stem === "string" && question.stem.trim() && hasValidAnswers(question.answers));
  const questions = shuffleArray(valid).slice(0, FREE_PRACTICE_LENGTH);
  if (questions.length !== FREE_PRACTICE_LENGTH || new Set(questions.map(q => q.id)).size !== FREE_PRACTICE_LENGTH) throw unavailable();
  const items = questions.map(question => ({
    question_id: question.id, domain_code: domainCode, domain_name: question.exam_domains.name,
    stem: question.stem, ...createAnswerSnapshot(question.answers.map(answer => ({ text: answer.choice_text, is_correct: answer.is_correct }))),
  }));
  const { data: id, error: createError } = await client.rpc("create_free_practice_session", {
    p_user_id: userId, p_items: items, p_expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (createError?.code === "P0001" && createError.message === "Free practice quota exceeded") throw new PracticeQuotaError();
  if (createError || typeof id !== "string" || !UUID.test(id)) throw unavailable();
  return id;
}
async function ownedPractice(client: SupabaseClient, id: string, userId: string, now: number): Promise<Session> {
  if (!UUID.test(id)) throw new DiagnosticError(404, "Practice not found");
  const { data, error } = await client.from("study_sessions").select("id,user_id,anonymous_owner_hash,question_count,completed_at,expires_at").eq("id", id).eq("kind", "practice").maybeSingle();
  if (error) throw unavailable();
  const session = data as Session | null;
  if (!session || !ownsSession(session, { userId, anonymousToken: null })) throw new DiagnosticError(404, "Practice not found");
  if (!session.completed_at && !(Date.parse(session.expires_at) > now)) throw new DiagnosticError(410, "This practice session has expired.");
  return session;
}
async function items(client: SupabaseClient, id: string): Promise<Item[]> {
  const { data, error } = await client.from("session_items").select(ITEM_FIELDS).eq("session_id", id).order("ordinal");
  if (error || !Array.isArray(data)) throw unavailable();
  return data as Item[];
}
export async function readPractice(client: SupabaseClient, id: string, userId: string, now = Date.now()): Promise<PracticeProgress> {
  const session = await ownedPractice(client, id, userId, now);
  const rows = await items(client, id);
  if (rows.length !== session.question_count) throw unavailable();
  const answeredCount = rows.filter(row => row.answered_at !== null).length;
  const completed = !!session.completed_at || answeredCount === session.question_count;
  const current = completed ? null : rows.find(row => row.answered_at === null);
  if (!completed && !current) throw unavailable();
  return { sessionId: id, status: completed ? "completed" : "in_progress", totalQuestions: session.question_count, answeredCount,
    currentQuestion: current ? { id: current.id, ordinal: current.ordinal, stem: current.stem, options: current.options.map(option => ({ label: option.label, text: option.text })) } : null };
}
export async function answerPractice(client: SupabaseClient, id: string, userId: string, itemId: string, selectedLabel: string, now = Date.now()): Promise<PracticeAnswerResponse> {
  const session = await ownedPractice(client, id, userId, now);
  const { data, error } = await client.rpc("answer_study_item", { p_session_id: id, p_item_id: itemId, p_selected_label: selectedLabel, p_user_id: userId, p_anonymous_owner_hash: null });
  if (error) {
    if (error.code === "42501") throw new DiagnosticError(404, "Practice not found");
    if (error.code === "22023") throw new DiagnosticError(error.message === "Session expired" ? 410 : 409, "The answer could not be saved. Reload your saved progress.");
    throw unavailable();
  }
  const progress = data as { answeredCount: number; totalQuestions: number; completed: boolean } | null;
  if (!progress || !Number.isInteger(progress.answeredCount) || progress.answeredCount < 1 || progress.answeredCount > session.question_count || progress.totalQuestions !== session.question_count || progress.completed !== (progress.answeredCount === session.question_count)) throw unavailable();
  const { data: raw, error: feedbackError } = await client.from("session_items").select("id,options,selected_label,correct_label,is_correct,answered_at").eq("session_id", id).eq("id", itemId).maybeSingle();
  const row = raw as Pick<Item, "id" | "options" | "selected_label" | "correct_label" | "is_correct" | "answered_at"> | null;
  if (feedbackError || !row || row.id !== itemId || !row.answered_at || row.selected_label !== selectedLabel || typeof row.is_correct !== "boolean" || !validAnsweredItem(row)) throw unavailable();
  return { answeredCount: progress.answeredCount, totalQuestions: progress.totalQuestions, completed: progress.completed,
    feedback: { itemId: row.id, selectedLabel, correctLabel: row.correct_label, isCorrect: row.is_correct } };
}
export async function practiceSummary(client: SupabaseClient, id: string, userId: string, now = Date.now()): Promise<PracticeSummary> {
  const session = await ownedPractice(client, id, userId, now);
  if (!session.completed_at) throw new DiagnosticError(409, "Finish practice to see your summary");
  const rows = await items(client, id);
  if (rows.length !== session.question_count || rows.some(row => !row.answered_at || !validAnsweredItem(row))) throw unavailable();
  return { ...computeResult(id, rows), review: rows.map(row => mapReview(row as QuestionReviewSource)) };
}
