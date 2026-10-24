import type { ServerTiming } from "@/lib/server-timing";
import "server-only";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { loadPaidExplanations, addPaidReview } from "@/lib/billing/explanations";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { hasValidAnswers, type CanonicalAnswer } from "@/lib/diagnostic/pmle-selection";
import { createAnswerSnapshot, shuffleArray } from "@/lib/questions/answer-order";
import { freshFirst, loadAnswerHistory, selectWeakArea } from "@/lib/practice/selection";
import { ownsSession } from "@/lib/diagnostic/ownership";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { computeResult } from "@/lib/diagnostic/scoring";
import { mapReview, type QuestionReviewSource } from "@/lib/diagnostic/types";
import type { PracticeProgress, PracticeAnswerResponse, PracticeSummary, PracticeStartResponse } from "@/lib/practice/types";

export const PRACTICE_SESSION_LENGTH = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new DiagnosticError(503, "Practice is unavailable. Please try again.");
interface Session { id: string; user_id: string | null; anonymous_owner_hash: string | null; question_count: number; completed_at: string | null; expires_at: string }
interface Item extends Omit<QuestionReviewSource, "selected_label" | "is_correct"> { question_id?: string; selected_label: string | null; is_correct: boolean | null; answered_at: string | null; questions?: { parent_question_id: string | null } | null }
interface Question { id: string; parent_question_id: string | null; stem: string; answers: CanonicalAnswer[]; exam_domains: { code: string; name: string } }
const ITEM_FIELDS = "id,question_id,ordinal,stem,options,domain_code,domain_name,selected_label,correct_label,is_correct,answered_at,questions(parent_question_id)";
function validAnsweredItem(row: Pick<Item, "options" | "selected_label" | "correct_label" | "is_correct">): boolean {
  if (!Array.isArray(row.options) || row.options.length < 2 || row.options.some(option => !option || typeof option.label !== "string" || !option.label.trim() || typeof option.text !== "string" || !option.text.trim())) return false;
  const labels = row.options.map(option => option.label);
  return new Set(labels).size === labels.length && typeof row.selected_label === "string" && typeof row.correct_label === "string"
    && labels.includes(row.selected_label) && labels.includes(row.correct_label) && typeof row.is_correct === "boolean"
    && row.is_correct === (row.selected_label === row.correct_label);
}
export interface PracticeStartOptions { domainCode?: string; mode?: "domain" | "weak" }
export async function createPractice(client: SupabaseClient, userId: string, domainCode: string, now = Date.now()): Promise<string> {
  return (await startPractice(client, userId, { domainCode }, now)).sessionId;
}
export async function startPractice(client: SupabaseClient, userId: string, options: PracticeStartOptions, now = Date.now()): Promise<PracticeStartResponse> {
  if (!UUID.test(userId)) throw new DiagnosticError(401, "Please sign in to continue");
  const mode = options.mode ?? "domain";
  if (mode !== "domain" && mode !== "weak") throw new DiagnosticError(400, "Choose a valid practice mode");
  if (mode === "domain" && !PMLE_BLUEPRINT.some(domain => domain.domainCode === options.domainCode)) throw new DiagnosticError(400, "Choose a valid practice domain");
  const paidAccess = await getPaidAccess(userId, client, now);
  if (mode === "weak" && !paidAccess.hasPaidAccess) throw new DiagnosticError(403, "PMLE Pass is required for weak-area drills");
  const history = paidAccess.hasPaidAccess ? await loadAnswerHistory(client, userId) : [];
  const selection = mode === "weak" ? selectWeakArea(history) : undefined;
  const domainCode = selection?.domainCode ?? options.domainCode!;
  const length = PRACTICE_SESSION_LENGTH;
  const bank: Question[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    let query = client.from("questions")
      .select("id,parent_question_id,stem,answers(choice_label,choice_text,is_correct),exam_domains!inner(code,name)")
      .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD").eq("exam_domains.code", domainCode)
      .order("id").range(offset, offset + pageSize - 1);
    if (!paidAccess.hasPaidAccess) query = query.is("parent_question_id", null);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) throw unavailable();
    bank.push(...data as unknown as Question[]);
    if (data.length < pageSize) break;
  }
  const byId = new Map(bank.map(question => [question.id, question]));
  // A family has an original parent. Never mix levels of a malformed nested family.
  if (bank.some(question => question.parent_question_id && byId.get(question.parent_question_id)?.parent_question_id)) throw unavailable();
  const valid = bank.filter(question => question.exam_domains?.code === domainCode && typeof question.stem === "string" && question.stem.trim() && hasValidAnswers(question.answers));
  const families = new Set<string>();
  const ordered = paidAccess.hasPaidAccess ? freshFirst(valid, new Set(history.map(row => row.questionId))) : shuffleArray(valid);
  const questions = ordered.filter(question => {
    if (!paidAccess.hasPaidAccess && question.parent_question_id !== null) return false;
    const family = question.parent_question_id ?? question.id;
    if (families.has(family)) return false;
    families.add(family);
    return true;
  }).slice(0, length);
  if (questions.length !== length || new Set(questions.map(q => q.id)).size !== length) throw unavailable();
  const items = questions.map(question => ({
    question_id: question.id, domain_code: domainCode, domain_name: question.exam_domains.name,
    stem: question.stem, ...createAnswerSnapshot(question.answers.map(answer => ({ text: answer.choice_text, is_correct: answer.is_correct }))),
  }));
  // History and bank reads may be slow. Never turn a stale paid decision into personalized practice.
  if (paidAccess.hasPaidAccess && !(await getPaidAccess(userId, client)).hasPaidAccess) {
    throw new DiagnosticError(403, "PMLE Pass access changed. Start practice again.");
  }
  const args = { p_user_id: userId, p_items: items, p_expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString() };
  const { data: id, error: createError } = paidAccess.hasPaidAccess
    ? await client.rpc("create_pass_practice_session", args)
    : await client.rpc("create_free_practice_session", args);
  if (createError?.code === "42501") throw new DiagnosticError(403, "PMLE Pass access changed. Start practice again.");
  if (createError || typeof id !== "string" || !UUID.test(id)) throw unavailable();
  if (paidAccess.hasPaidAccess && !(await getPaidAccess(userId, client)).hasPaidAccess) {
    throw new DiagnosticError(403, "PMLE Pass access changed. Start practice again.");
  }
  return { sessionId: id, href: `/practice/${id}`, ...(selection ? { selection } : {}) };
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
  // session_items.question_id is a to-one FK; the untyped client infers joins as arrays.
  return data as unknown as Item[];
}
export async function readPractice(client: SupabaseClient, id: string, userId: string, now = Date.now()): Promise<PracticeProgress> {
  const session = await ownedPractice(client, id, userId, now);
  const rows = await items(client, id);
  return practiceProgress(session, rows);
}
function practiceProgress(session: Session, rows: Item[]): PracticeProgress {
  if (rows.length !== session.question_count) throw unavailable();
  const answeredCount = rows.filter(row => row.answered_at !== null).length;
  const completed = !!session.completed_at || answeredCount === session.question_count;
  const current = completed ? null : rows.find(row => row.answered_at === null);
  if (!completed && !current) throw unavailable();
  return { sessionId: session.id, status: completed ? "completed" : "in_progress", totalQuestions: session.question_count, answeredCount,
    currentQuestion: current ? { id: current.id, ordinal: current.ordinal, domainCode: current.domain_code, stem: current.stem, ...(current.questions?.parent_question_id ? { isVariant: true } : {}), options: current.options.map(option => ({ label: option.label, text: option.text })) } : null };
}
export async function answerPractice(client: SupabaseClient, id: string, userId: string, itemId: string, selectedLabel: string, now = Date.now(), timing?: ServerTiming): Promise<PracticeAnswerResponse> {
  const measure = <T>(name: string, task: () => Promise<T>) => timing ? timing.measure(name, task) : task();
  const session = await measure("ownership", () => ownedPractice(client, id, userId, now));
  const { data, error } = await measure("answer_rpc", async () => client.rpc("answer_study_item", { p_session_id: id, p_item_id: itemId, p_selected_label: selectedLabel, p_user_id: userId, p_anonymous_owner_hash: null }));
  if (error) {
    if (error.code === "42501") throw new DiagnosticError(404, "Practice not found");
    if (error.code === "22023") throw new DiagnosticError(error.message === "Session expired" ? 410 : 409, "The answer could not be saved. Reload your saved progress.");
    throw unavailable();
  }
  const progress = data as { answeredCount: number; totalQuestions: number; completed: boolean } | null;
  if (!progress || !Number.isInteger(progress.answeredCount) || progress.answeredCount < 1 || progress.answeredCount > session.question_count || progress.totalQuestions !== session.question_count || progress.completed !== (progress.answeredCount === session.question_count)) throw unavailable();
  // Both reads start only after the answer commit; paid access remains fresh on retries.
  const [rows, access] = await Promise.all([
    measure("progress_read", () => items(client, id)),
    measure("paid_access", () => getPaidAccess(userId, client, now)),
  ]);
  const row = rows.find(item => item.id === itemId);
  if (!row || !row.answered_at || row.selected_label !== selectedLabel || typeof row.is_correct !== "boolean" || !validAnsweredItem(row)) throw unavailable();
  const updated = practiceProgress(session, rows);
  if (updated.answeredCount < progress.answeredCount) throw unavailable();
  // A refund must redact retries immediately.
  const explanations = access.hasPaidAccess ? await loadPaidExplanations(client, [row]) : null;
  return { answeredCount: updated.answeredCount, totalQuestions: updated.totalQuestions, completed: updated.status === "completed", progress: updated,
    feedback: { itemId: row.id, selectedLabel, correctLabel: row.correct_label, isCorrect: row.is_correct, ...explanations?.get(row.id) } };
}
export async function practiceSummary(client: SupabaseClient, id: string, userId: string, now = Date.now()): Promise<PracticeSummary> {
  const session = await ownedPractice(client, id, userId, now);
  if (!session.completed_at) throw new DiagnosticError(409, "Finish practice to see your summary");
  const rows = await items(client, id);
  if (rows.length !== session.question_count || rows.some(row => !row.answered_at || !validAnsweredItem(row))) throw unavailable();
  const access = await getPaidAccess(userId, client, now);
  const explanations = access.hasPaidAccess ? await loadPaidExplanations(client, rows) : null;
  return { ...computeResult(id, rows),
    review: rows.map(row => addPaidReview(mapReview(row as QuestionReviewSource), explanations?.get(row.id))) };
}
