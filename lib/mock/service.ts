import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { loadPaidExplanations, addPaidReview } from "@/lib/billing/explanations";
import { hasValidAnswers, type CanonicalAnswer } from "@/lib/diagnostic/pmle-selection";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { computeResult } from "@/lib/diagnostic/scoring";
import { mapReview, type QuestionReviewSource } from "@/lib/diagnostic/types";
import { createAnswerSnapshot } from "@/lib/questions/answer-order";
import { domainDisplayName } from "@/lib/constants/pmle-blueprint";
import { loadAnswerHistory } from "@/lib/practice/selection";
import { selectMockQuestions } from "@/lib/mock/selection";
import type { MockProgress, MockResults, MockAttempt } from "@/lib/mock/types";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => new DiagnosticError(503, "Mock exams are unavailable. Please try again.");
interface Session { id: string; user_id: string; question_count: number; created_at: string; deadline_at: string; completed_at: string | null; timed_out: boolean; allocation_notice: string | null; server_now: string; answered_count: number }
interface Item extends Omit<QuestionReviewSource, "selected_label" | "is_correct"> { question_id: string; selected_label: string | null; is_correct: boolean | null; answered_at: string | null }
export async function requireMockAccess(client: SupabaseClient, userId: string) {
  if (!UUID.test(userId)) throw new DiagnosticError(401, "Please sign in to continue");
  const access = await getPaidAccess(userId, client);
  if (access.unavailable) throw unavailable();
  if (!access.hasPaidAccess) throw new DiagnosticError(403, "PMLE Pass is required for timed mock exams.");
}
function rpcError(error: { code?: string } | null) {
  if (!error) return;
  if (error.code === "42501") throw new DiagnosticError(403, "PMLE Pass is required for timed mock exams.");
  if (error.code === "P0002") throw new DiagnosticError(404, "Mock exam not found");
  if (error.code === "22023") throw new DiagnosticError(409, "The answer could not be saved. Reload your saved mock exam.");
  throw unavailable();
}
export async function createMock(client: SupabaseClient, userId: string): Promise<string> {
  await requireMockAccess(client, userId);
  type BankRow = { id: string; stem: string; parent_question_id: string | null; answers: CanonicalAnswer[]; exam_domains: { code: string; name: string } };
  const bank: BankRow[] = [];
  // Page the live bank; an API row limit must not silently discard unseen questions.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("questions").select("id,stem,parent_question_id,answers(choice_label,choice_text,is_correct),exam_domains!inner(code,name)")
      .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD").is("parent_question_id", null)
      .order("id").range(offset, offset + 999);
    if (error || !Array.isArray(data)) throw unavailable();
    bank.push(...data as unknown as BankRow[]);
    if (data.length < 1000) break;
  }
  const history = await loadAnswerHistory(client, userId);
  const valid = bank.filter(row => row.parent_question_id === null && typeof row.stem === "string" && row.stem.trim() && row.exam_domains?.code && hasValidAnswers(row.answers) && new Set(row.answers.map(answer => answer.choice_text)).size === row.answers.length);
  const selected = selectMockQuestions(valid.map(row => ({ ...row, domain_code: row.exam_domains.code })), new Set(history.map(row => row.questionId)));
  // No exercise is possible with an empty bank; do not invent questions.
  if (!selected.questions.length) throw new DiagnosticError(503, "No mock questions are available yet.");
  const items = selected.questions.map(row => ({ question_id: row.id, domain_code: row.domain_code, domain_name: row.exam_domains.name, stem: row.stem,
    ...createAnswerSnapshot(row.answers.map(answer => ({ text: answer.choice_text, is_correct: answer.is_correct }))) }));
  const { data, error } = await client.rpc("create_mock_exam", { p_user_id: userId, p_items: items, p_allocation_notice: selected.allocationNotice });
  rpcError(error);
  if (typeof data !== "string" || !UUID.test(data)) throw unavailable();
  return data;
}
async function interact(client: SupabaseClient, userId: string, id: string, action: "read" | "answer" | "submit" | "results", itemId?: string, selectedLabel?: string): Promise<Session> {
  if (!UUID.test(id)) throw new DiagnosticError(404, "Mock exam not found");
  await requireMockAccess(client, userId);
  const { data, error } = await client.rpc("interact_mock_exam", { p_user_id: userId, p_session_id: id, p_action: action, p_item_id: itemId ?? null, p_selected_label: selectedLabel ?? null });
  rpcError(error);
  const session = data as Session | null;
  if (!session || session.id !== id || session.user_id !== userId || session.question_count !== 50
    || !Number.isFinite(Date.parse(session.created_at)) || !Number.isFinite(Date.parse(session.deadline_at)) || !Number.isFinite(Date.parse(session.server_now))
    || (session.completed_at !== null && !Number.isFinite(Date.parse(session.completed_at)))
    || typeof session.timed_out !== "boolean" || !Number.isInteger(session.answered_count) || session.answered_count < 0 || session.answered_count > 50) throw unavailable();
  return session;
}
async function readItems(client: SupabaseClient, id: string): Promise<Item[]> {
  const { data, error } = await client.from("mock_exam_items").select("id,question_id,ordinal,domain_code,domain_name,stem,options,correct_label,selected_label,is_correct,answered_at").eq("session_id", id).order("ordinal");
  if (error || !Array.isArray(data) || data.length !== 50) throw unavailable();
  const rows = data as Item[];
  if (new Set(rows.map(row => row.id)).size !== 50 || rows.some((row, index) => row.ordinal !== index + 1 || !Array.isArray(row.options) || row.options.length < 2
    || row.options.some(option => typeof option.label !== "string" || typeof option.text !== "string")
    || new Set(row.options.map(option => option.label)).size !== row.options.length
    || !row.options.some(option => option.label === row.correct_label)
    || (row.selected_label !== null && !row.options.some(option => option.label === row.selected_label)))) throw unavailable();
  return rows;
}
function progress(session: Session, rows: Item[]): MockProgress {
  return { sessionId: session.id, status: session.completed_at ? "completed" : "in_progress", startedAt: session.created_at, deadlineAt: session.deadline_at,
    serverNow: session.server_now, totalQuestions: session.question_count, answeredCount: rows.filter(row => row.answered_at !== null).length,
    allocationNotice: session.allocation_notice,
    // Never copy raw rows or option JSON. No feedback, keys or explanations before submit.
    questions: session.completed_at ? [] : rows.map(row => ({ id: row.id, ordinal: row.ordinal, domainCode: row.domain_code,
      domainName: domainDisplayName(row.domain_code, row.domain_name), stem: row.stem, selectedLabel: row.selected_label,
      options: row.options.map(option => ({ label: option.label, text: option.text })) })) };
}
export async function readMock(client: SupabaseClient, id: string, userId: string): Promise<MockProgress> {
  const session = await interact(client, userId, id, "read");
  const rows = await readItems(client, id);
  await requireMockAccess(client, userId);
  return progress(session, rows);
}
export async function answerMock(client: SupabaseClient, id: string, userId: string, itemId: string, selectedLabel: string): Promise<MockProgress> {
  if (!UUID.test(itemId) || !/^[A-Z]$/.test(selectedLabel)) throw new DiagnosticError(400, "Invalid mock answer");
  const session = await interact(client, userId, id, "answer", itemId, selectedLabel);
  const rows = await readItems(client, id);
  await requireMockAccess(client, userId);
  return progress(session, rows);
}
export async function submitMock(client: SupabaseClient, id: string, userId: string): Promise<MockProgress> {
  const session = await interact(client, userId, id, "submit");
  const rows = await readItems(client, id);
  await requireMockAccess(client, userId);
  return progress(session, rows);
}
export async function mockResults(client: SupabaseClient, id: string, userId: string): Promise<MockResults> {
  const session = await interact(client, userId, id, "results");
  if (!session.completed_at) throw new DiagnosticError(409, "Submit your mock exam to see results.");
  const rows = await readItems(client, id);
  if (rows.some(row => typeof row.is_correct !== "boolean" || row.is_correct !== (row.selected_label === row.correct_label))) throw unavailable();
  const explanations = await loadPaidExplanations(client, rows);
  await requireMockAccess(client, userId);
  return { ...computeResult(id, rows), completedAt: session.completed_at, timedOut: session.timed_out, allocationNotice: session.allocation_notice,
    review: rows.map(row => addPaidReview(mapReview({ ...row, selected_label: row.selected_label ?? "Unanswered", is_correct: row.is_correct! }), explanations.get(row.id))) };
}
export async function mockHistory(client: SupabaseClient, userId: string): Promise<MockAttempt[]> {
  await requireMockAccess(client, userId);
  const { data, error } = await client.from("mock_exam_sessions").select("id,created_at,deadline_at,completed_at,question_count").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error || !Array.isArray(data)) throw unavailable();
  const attempts: MockAttempt[] = [];
  // Interaction also closes expired attempts on the next authenticated visit.
  for (const row of data) {
    const session = await interact(client, userId, row.id, "read");
    const rows = session.completed_at ? await readItems(client, row.id) : [];
    attempts.push({ sessionId: session.id, startedAt: session.created_at, deadlineAt: session.deadline_at, completedAt: session.completed_at,
      score: session.completed_at ? computeResult(session.id, rows).score : null, totalQuestions: session.question_count });
  }
  await requireMockAccess(client, userId);
  return attempts;
}
