import { readWithdrawalSnapshot } from "@/lib/questions/session-snapshot";
import "server-only";
import { getPaidAccess } from "@/lib/billing/paid-access";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { computeResult } from "@/lib/diagnostic/scoring";
import { DiagnosticError } from "@/lib/diagnostic/http";
import type { DashboardData } from "@/lib/dashboard/types";
import { weakestFirst } from "@/lib/readiness";

export async function loadDashboard(client: SupabaseClient, userId: string, now = Date.now()): Promise<DashboardData> {
  const unavailable = () => new DiagnosticError(503, "Your dashboard is unavailable. Please try again.");
  const { data: latest, error } = await client.from("study_sessions").select("id,question_count").eq("user_id", userId).eq("kind", "diagnostic").eq("exam", "GCP_PM_ML_ENG").not("completed_at", "is", null).order("completed_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (error) throw unavailable();
  let diagnostic: DashboardData["diagnostic"] = null;
  if (latest) {
    const { data: rows, error: itemError } = await readWithdrawalSnapshot(marker => client.from("session_items").select(`domain_code,domain_name,is_correct,answered_at${marker ? ",withdrawn_at" : ""}`).eq("session_id", latest.id).order("ordinal"));
    if (itemError || !Array.isArray(rows) || rows.length !== latest.question_count) throw unavailable();
    const included = (rows as unknown as ProgressRow[]).filter(row => row.withdrawn_at == null);
    if (included.some(row => !row.answered_at || typeof row.is_correct !== "boolean")) throw unavailable();
    diagnostic = computeResult(latest.id, included);
    if (included.length < rows.length) diagnostic.withdrawnCount = rows.length - included.length;
  }
  const { data: pending, error: pendingError } = await client.from("study_sessions").select("id,domain_codes").eq("user_id", userId).eq("kind", "practice").is("completed_at", null).gt("expires_at", new Date(now).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (pendingError) throw unavailable();
  const domains = PMLE_BLUEPRINT.map(domain => ({ domainCode: domain.domainCode, domainName: domain.displayName }));
  const pendingCode = pending?.domain_codes?.[0];
  const tracking = await loadProgress(client, userId);
  return {
    paidAccess: await getPaidAccess(userId, client, now),
    diagnostic,
    weakestDomains: diagnostic ? weakestFirst(diagnostic.domainBreakdown).slice(0, 2) : [],
    domains,
    openPractice: pending ? { sessionId: pending.id, domainName: domains.find(domain => domain.domainCode === pendingCode)?.domainName ?? "Your selected domain" } : null,
    ...tracking,
  };
}

interface ProgressRow {
  withdrawn_at?: string | null;
  session_id: string;
  domain_code: string;
  domain_name: string;
  is_correct: boolean;
  answered_at: string;
  study_sessions: { kind: string; completed_at: string | null };
}

/** Account-owned answer aggregates are free. Never select question or explanation text. */
async function loadProgress(client: SupabaseClient, userId: string): Promise<Pick<DashboardData, "progress" | "practiceHistory">> {
  const rows: ProgressRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await readWithdrawalSnapshot(marker => client.from("session_items")
      .select(`session_id,domain_code,domain_name,is_correct,answered_at,study_sessions!inner(kind,completed_at)${marker ? ",withdrawn_at" : ""}`)
      .eq("study_sessions.user_id", userId).eq("study_sessions.exam", "GCP_PM_ML_ENG")
      .in("study_sessions.kind", ["diagnostic", "practice"]).not("answered_at", "is", null)
      .order("answered_at").order("id").range(offset, offset + pageSize - 1));
    if (error || !Array.isArray(data) || (data as unknown as ProgressRow[]).some(row => row.withdrawn_at == null && (!row.answered_at || typeof row.is_correct !== "boolean" || !row.study_sessions))) {
      throw new DiagnosticError(503, "Your dashboard is unavailable. Please try again.");
    }
    rows.push(...(data as unknown as ProgressRow[]).filter(row => row.withdrawn_at == null));
    if (data.length < pageSize) break;
  }
  const { sessionId: _sessionId, readiness: _readiness, ...progress } = computeResult("history", rows);
  void _sessionId; void _readiness;
  const sessions = new Map<string, { completedAt: string; rows: ProgressRow[] }>();
  for (const row of rows) {
    if (row.study_sessions.kind !== "practice" || !row.study_sessions.completed_at) continue;
    const session = sessions.get(row.session_id) ?? { completedAt: row.study_sessions.completed_at, rows: [] };
    session.rows.push(row); sessions.set(row.session_id, session);
  }
  const practiceHistory = [...sessions].map(([sessionId, session]) => {
    const { totalQuestions, correctAnswers, score } = computeResult(sessionId, session.rows);
    return { sessionId, completedAt: session.completedAt, totalQuestions, correctAnswers, score };
  }).sort((a, b) => b.completedAt.localeCompare(a.completedAt) || a.sessionId.localeCompare(b.sessionId)).slice(0, 10);
  return { progress, practiceHistory };
}
