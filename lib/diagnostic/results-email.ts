import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { weakestFirst } from "@/lib/readiness";
import { toolCertifications } from "@/lib/tools/data";
import { buildStudyPlan, studyPlanText } from "@/lib/tools/study-plan";

export function resultsEmailText(result: DiagnosticResult, now = Date.now()) {
  const cert = toolCertifications().find(cert => cert.cert_id === "machine-learning-engineer")!;
  const today = new Date(now).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + 28 * 86_400_000).toISOString().slice(0, 10);
  // Registry sections and canonical blueprint use official guide order.
  const weightedCert = { ...cert, guide: { ...cert.guide, sections: cert.guide.sections.map((section, index) => {
    const domain = result.domainBreakdown.find(domain => domain.domainCode === PMLE_BLUEPRINT[index]?.domainCode);
    const deficit = domain && domain.total > 0 ? 1 - domain.correct / domain.total : 0;
    return { ...section, weight_percent: (section.weight_percent ?? 1) * (1 + deficit) };
  }) } };
  const plan = buildStudyPlan(weightedCert, end, 4, today);
  const domains = weakestFirst(result.domainBreakdown);
  return ["Your PMLE diagnostic results", `${result.correctAnswers}/${result.totalQuestions} correct (${result.score}%). Study guidance: ${result.readiness.label}.`,
    "Small diagnostic samples are study signals, not an exam-readiness prediction.",
    "\nScores by domain:", ...result.domainBreakdown.map(d => `${d.domainName}: ${d.correct}/${d.total} (${d.percentage}%)`),
    "\nWeakest sampled domains:", ...domains.slice(0, 2).map(d => d.domainName),
    "\nYour 4-week plan assumes 4 hours/week (16 hours total). Time uses official section weight × (1 + sampled error rate), so weaker sampled domains receive more time. Unsampled domains retain their official weight.",
    studyPlanText(plan).replace(`Time allocated in proportion to official section weights (total ${plan.totalWeight}%).`, "Time allocated by official section weight adjusted for your diagnostic error rate."),
    `\nView results: https://testero.ai/diagnostic/${result.sessionId}/results`,
    "Open results in the same browser used for your diagnostic, or sign in to the account that owns it. This link does not grant access on its own.",
    "PMLE Pass pricing: https://testero.ai/pricing",
    "You requested one email with your results; no newsletter and no reminders."].join("\n");
}

const unavailable = () => new DiagnosticError(503, "We couldn't send your email. Please try again.");
export async function sendResultsEmail(client: SupabaseClient, email: string, result: DiagnosticResult) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw unavailable();
  const lease = randomUUID();
  const { data, error } = await client.rpc("claim_results_email", {
    p_session_id: result.sessionId, p_email: email, p_payload: resultsEmailText(result), p_lease: lease,
  });
  if (error || !data) throw unavailable();
  if (data.status === "sent") return;
  if (data.status === "limited") throw new DiagnosticError(429, "Too many email requests. Please try again tomorrow.");
  if (data.status === "busy") throw new DiagnosticError(409, "Your email is being sent. Please try again in a minute.");
  if (data.status === "expired") throw new DiagnosticError(409, "This email request has expired. Your results are still available here.");
  if (data.status !== "claimed" || typeof data.id !== "string" || typeof data.payload !== "string") throw unavailable();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `results-${data.id}` },
      body: JSON.stringify({ from: "Testero <no-reply@testero.ai>", to: [email], subject: "Your PMLE results + 4-week study plan", text: data.payload }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw unavailable();
    const receipt = await response.json();
    if (typeof receipt.id !== "string" || !receipt.id) throw unavailable();
    const { error: saved } = await client.from("results_email_requests").update({ sent_at: new Date().toISOString(), lease_token: null, lease_until: null }).eq("id", data.id).eq("lease_token", lease);
    if (saved) throw unavailable();
  } catch {
    // Keep the lease after ambiguous transport failures; retries reuse the frozen payload/key.
    throw unavailable();
  }
}
