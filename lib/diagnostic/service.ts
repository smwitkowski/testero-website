import type { ServerTiming } from "@/lib/server-timing";
import "server-only";
import { getPaidAccess } from "@/lib/billing/paid-access";
import { loadPaidExplanations, addPaidReview } from "@/lib/billing/explanations";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DIAGNOSTIC_NEW_SINCE, selectPmleQuestionsByBlueprint, hasValidAnswers } from "@/lib/diagnostic/pmle-selection";
import { createAnswerSnapshot } from "@/lib/questions/answer-order";
import { computeResult } from "@/lib/diagnostic/scoring";
import { hashAnonymousToken, ownsSession, type OwnerCredentials, type SessionOwner } from "@/lib/diagnostic/ownership";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { mapReview, type DiagnosticAnswerResponse, type DiagnosticProgress, type DiagnosticResult } from "@/lib/diagnostic/types";

export const DIAGNOSTIC_LENGTH = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface StudySession extends SessionOwner { id: string; question_count: number; expires_at: string; completed_at: string | null }
interface SessionItem {
  id: string; question_id?: string; ordinal: number; stem: string; options: { label: string; text: string }[];
  domain_code: string; domain_name: string; is_correct: boolean | null; answered_at: string | null;
  correct_label?: string; selected_label?: string | null;
}
const SESSION_FIELDS = "id,user_id,anonymous_owner_hash,question_count,expires_at,completed_at";
const ITEM_FIELDS = "id,ordinal,stem,options,domain_code,domain_name,is_correct,answered_at";
const unavailable = () => new DiagnosticError(503, "The diagnostic is unavailable. Please try again.");

/** Questions from this owner's earlier diagnostics. Freshness is best effort: errors mean "none seen". */
export async function seenDiagnosticQuestions(client: SupabaseClient, userId: string | null, ownerHash: string | null): Promise<Set<string>> {
  try {
    const sessions = client.from("study_sessions").select("id").eq("kind", "diagnostic");
    const { data, error } = await (userId ? sessions.eq("user_id", userId) : sessions.is("user_id", null).eq("anonymous_owner_hash", ownerHash!))
      .order("created_at", { ascending: false }).limit(50);
    if (error || !Array.isArray(data) || !data.length) return new Set();
    const { data: items, error: itemError } = await client.from("session_items").select("question_id").in("session_id", data.map(row => row.id));
    if (itemError || !Array.isArray(items)) return new Set();
    return new Set(items.flatMap(item => typeof item.question_id === "string" ? [item.question_id] : []));
  } catch { return new Set(); }
}

export async function createDiagnostic(client: SupabaseClient, token: string, now = Date.now(), userId: string | null = null, timing?: ServerTiming): Promise<string> {
  const ownerHash = timing ? await timing.measure("owner_hash", () => userId === null ? hashAnonymousToken(token) : null) : userId === null ? hashAnonymousToken(token) : null;
  if (userId === null ? !ownerHash : !UUID.test(userId)) throw new DiagnosticError(400, "Invalid diagnostic owner");
  const started = performance.now();
  const measure = <T>(name: string, task: () => Promise<T>) => timing ? timing.measure(name, task) : task();
  const preferences = measure("history", async () => ({ newSince: DIAGNOSTIC_NEW_SINCE, seenQuestionIds: await seenDiagnosticQuestions(client, userId, ownerHash) }));
  let selected;
  try { selected = await measure("selection", () => selectPmleQuestionsByBlueprint(client, DIAGNOSTIC_LENGTH, preferences, timing)); }
  catch { throw unavailable(); }
  if (selected.questions.length !== DIAGNOSTIC_LENGTH || new Set(selected.questions.map(q => q.id)).size !== DIAGNOSTIC_LENGTH) throw unavailable();
  const items = await measure("snapshot", async () => selected.questions.map(question => {
    if (!hasValidAnswers(question.answers) || !question.stem.trim()) throw unavailable();
    const snapshot = createAnswerSnapshot(question.answers.map(answer => ({ text: answer.choice_text, is_correct: answer.is_correct })));
    return { question_id: question.id, domain_code: question.domain_code, domain_name: question.domain_name, stem: question.stem, ...snapshot };
  }));
  const { data, error } = await measure("create_rpc", async () => client.rpc("create_study_session", {
    p_kind: "diagnostic", p_user_id: userId, p_anonymous_owner_hash: ownerHash,
    p_items: items, p_expires_at: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
  }));
  if (error || typeof data !== "string" || !UUID.test(data)) throw unavailable();
  if (process.env.NODE_ENV === "development") console.info(`[diagnostic-timing] create ${Math.round(performance.now() - started)}ms`);
  return data;
}

/** The owner's newest unexpired, unfinished diagnostic, so "Begin" can offer to resume it. */
export async function findOpenDiagnostic(client: SupabaseClient, credentials: OwnerCredentials, now = Date.now()): Promise<string | null> {
  const ownerHash = hashAnonymousToken(credentials.anonymousToken);
  if (credentials.userId ? !UUID.test(credentials.userId) : !ownerHash) return null;
  const base = client.from("study_sessions").select(SESSION_FIELDS).eq("kind", "diagnostic").is("completed_at", null).gt("expires_at", new Date(now).toISOString());
  const owned = credentials.userId ? base.eq("user_id", credentials.userId) : base.is("user_id", null).eq("anonymous_owner_hash", ownerHash!);
  const { data, error } = await owned.order("created_at", { ascending: false }).limit(1).maybeSingle();
  const session = data as StudySession | null;
  return !error && session && ownsSession(session, credentials) ? session.id : null;
}

async function ownedSession(client: SupabaseClient, id: string, credentials: OwnerCredentials, now: number): Promise<StudySession> {
  if (!UUID.test(id)) throw new DiagnosticError(404, "Diagnostic not found");
  const { data, error } = await client.from("study_sessions").select(SESSION_FIELDS).eq("id", id).eq("kind", "diagnostic").maybeSingle();
  if (error) throw unavailable();
  const session = data as StudySession | null;
  if (!session || !ownsSession(session, credentials)) throw new DiagnosticError(404, "Diagnostic not found");
  if (!session.completed_at && !(Date.parse(session.expires_at) > now)) throw new DiagnosticError(410, "This diagnostic has expired. Start a new diagnostic.");
  return session;
}
async function sessionItems(client: SupabaseClient, id: string, includeReview = false): Promise<SessionItem[]> {
  const query = client.from("session_items");
  const { data, error } = includeReview
    ? await query.select("id,question_id,ordinal,stem,options,domain_code,domain_name,is_correct,answered_at,correct_label,selected_label").eq("session_id", id).order("ordinal")
    : await query.select(ITEM_FIELDS).eq("session_id", id).order("ordinal");
  if (error || !Array.isArray(data)) throw unavailable();
  return data as SessionItem[];
}

export async function readDiagnostic(client: SupabaseClient, id: string, credentials: OwnerCredentials, now = Date.now()): Promise<DiagnosticProgress> {
  const session = await ownedSession(client, id, credentials, now);
  const items = await sessionItems(client, id);
  return diagnosticProgress(session, items);
}

function diagnosticProgress(session: StudySession, items: SessionItem[]): DiagnosticProgress {
  if (items.length !== session.question_count) throw unavailable();
  const answeredCount = items.filter(item => item.answered_at !== null).length;
  const completed = !!session.completed_at || answeredCount === session.question_count;
  const current = completed ? null : items.find(item => item.answered_at === null);
  if (!completed && !current) throw unavailable();
  return {
    sessionId: session.id, status: completed ? "completed" : "in_progress",
    totalQuestions: session.question_count, answeredCount,
    currentQuestion: current ? { id: current.id, ordinal: current.ordinal, domainCode: current.domain_code, stem: current.stem, options: current.options.map(option => ({ label: option.label, text: option.text })) } : null,
  };
}

export async function answerDiagnostic(client: SupabaseClient, id: string, credentials: OwnerCredentials, itemId: string, selectedLabel: string, now = Date.now(), timing?: ServerTiming): Promise<DiagnosticAnswerResponse> {
  const measure = <T>(name: string, task: () => Promise<T>) => timing ? timing.measure(name, task) : task();
  const session = await measure("ownership", () => ownedSession(client, id, credentials, now));
  const { data, error } = await measure("answer_rpc", async () => client.rpc("answer_study_item", {
    p_session_id: session.id, p_item_id: itemId, p_selected_label: selectedLabel,
    p_user_id: session.user_id, p_anonymous_owner_hash: session.anonymous_owner_hash,
  }));
  if (error) {
    if (error.code === "42501") throw new DiagnosticError(404, "Diagnostic not found");
    if (error.code === "22023") {
      if (error.message === "Session expired") throw new DiagnosticError(410, "This diagnostic has expired. Start a new diagnostic.");
      throw new DiagnosticError(409, "The answer could not be saved. Reload your saved progress and try again.");
    }
    throw unavailable();
  }
  const result = data as DiagnosticAnswerResponse | null;
  if (!result || !Number.isInteger(result.answeredCount) || result.answeredCount < 0 || result.answeredCount > session.question_count || result.totalQuestions !== session.question_count || typeof result.completed !== "boolean" || result.completed !== (result.answeredCount === session.question_count)) throw unavailable();
  // Whitelist fields even if the RPC changes: correctness must never cross this boundary.
  const progress = diagnosticProgress(session, await measure("progress_read", () => sessionItems(client, id)));
  if (progress.answeredCount < result.answeredCount) throw unavailable();
  return { answeredCount: progress.answeredCount, totalQuestions: progress.totalQuestions, completed: progress.status === "completed", progress };
}

export async function diagnosticResults(client: SupabaseClient, id: string, credentials: OwnerCredentials, now = Date.now()): Promise<DiagnosticResult> {
  const session = await ownedSession(client, id, credentials, now);
  if (!session.completed_at) throw new DiagnosticError(409, "Finish the diagnostic to see your results");
  const includeReview = session.user_id !== null && session.user_id === credentials.userId;
  const items = await sessionItems(client, id, includeReview);
  if (items.length !== session.question_count || items.some(item => !item.answered_at || typeof item.is_correct !== "boolean")) throw unavailable();
  const result = computeResult(session.id, items);
  if (includeReview) {
    const access = await getPaidAccess(session.user_id!, client, now);
    const explanations = access.hasPaidAccess ? await loadPaidExplanations(client, items) : null;
    result.review = items.map(item => {
      if (typeof item.selected_label !== "string" || typeof item.correct_label !== "string" ||
          !item.options.some(option => option.label === item.selected_label) ||
          !item.options.some(option => option.label === item.correct_label)) throw unavailable();
      return addPaidReview(mapReview({ ...item, selected_label: item.selected_label, correct_label: item.correct_label, is_correct: item.is_correct! }), explanations?.get(item.id));
    });
  }
  return result;
}
