import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { computeResult } from "@/lib/diagnostic/scoring";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { freePracticeQuota } from "@/lib/practice/service";
import type { DashboardData } from "@/lib/dashboard/types";

export async function loadDashboard(client: SupabaseClient, userId: string, now = Date.now()): Promise<DashboardData> {
  const unavailable = () => new DiagnosticError(503, "Your dashboard is unavailable. Please try again.");
  const { data: latest, error } = await client.from("study_sessions").select("id,question_count").eq("user_id", userId).eq("kind", "diagnostic").not("completed_at", "is", null).order("completed_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (error) throw unavailable();
  let diagnostic: DashboardData["diagnostic"] = null;
  if (latest) {
    const { data: rows, error: itemError } = await client.from("session_items").select("domain_code,domain_name,is_correct,answered_at").eq("session_id", latest.id).order("ordinal");
    if (itemError || !Array.isArray(rows) || rows.length !== latest.question_count || rows.some(row => !row.answered_at || typeof row.is_correct !== "boolean")) throw unavailable();
    diagnostic = computeResult(latest.id, rows);
  }
  const { data: pending, error: pendingError } = await client.from("study_sessions").select("id,domain_codes").eq("user_id", userId).eq("kind", "practice").is("completed_at", null).gt("expires_at", new Date(now).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (pendingError) throw unavailable();
  const domains = PMLE_BLUEPRINT.map(domain => ({ domainCode: domain.domainCode, domainName: domain.displayName }));
  const pendingCode = pending?.domain_codes?.[0];
  return {
    diagnostic,
    weakestDomains: diagnostic ? [...diagnostic.domainBreakdown].sort((a, b) => a.percentage - b.percentage || a.domainCode.localeCompare(b.domainCode)).slice(0, 2) : [],
    domains,
    openPractice: pending ? { sessionId: pending.id, domainName: domains.find(domain => domain.domainCode === pendingCode)?.domainName ?? "Your selected domain" } : null,
    quota: await freePracticeQuota(client, userId, new Date(now)),
  };
}
