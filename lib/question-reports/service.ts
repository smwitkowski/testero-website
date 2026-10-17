import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessSession, hashAnonymousToken, type OwnerCredentials } from "@/lib/diagnostic/ownership";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { questionReportBody, type QuestionReportInput } from "./schema";
export async function submitQuestionReport(client: SupabaseClient, input: QuestionReportInput, credentials: OwnerCredentials) {
  const parsed = questionReportBody.safeParse(input);
  if (!parsed.success) throw new DiagnosticError(400, "Invalid report");
  const body = parsed.data;
  const { data: session, error } = await client.from("study_sessions").select("user_id,anonymous_owner_hash,expires_at,completed_at").eq("id", body.sessionId).eq("kind", body.kind).maybeSingle();
  if (error) throw new DiagnosticError(503, "Reporting is unavailable. Please try again.");
  if (!session || !canAccessSession(session, credentials)) throw new DiagnosticError(404, "Question not found");
  const { error: reportError } = await client.rpc("submit_question_report", {
    p_session_id: body.sessionId, p_item_id: body.itemId, p_kind: body.kind,
    p_user_id: credentials.userId, p_anonymous_owner_hash: hashAnonymousToken(credentials.anonymousToken),
    p_reason: body.reason, p_note: body.note, p_email: body.email,
  });
  if (reportError?.code === "42501") throw new DiagnosticError(404, "Question not found");
  if (reportError?.code === "P0001") throw new DiagnosticError(429, "Too many reports. Please try again later.");
  if (reportError) throw new DiagnosticError(503, "Reporting is unavailable. Please try again.");
}
