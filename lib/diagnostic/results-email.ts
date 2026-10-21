import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { weakestFirst } from "@/lib/readiness";
import { toolCertifications } from "@/lib/tools/data";
import { buildStudyPlan, studyPlanText, studyTime } from "@/lib/tools/study-plan";

function requirePmleResult(result: DiagnosticResult) {
  if (result.certId && result.certId !== PMLE_CERT_ID) throw new DiagnosticError(404, "Results email is not available for this diagnostic");
}

export function resultsEmailPlan(result: DiagnosticResult, now = Date.now()) {
  requirePmleResult(result);
  const cert = toolCertifications().find(cert => cert.cert_id === "machine-learning-engineer")!;
  const today = new Date(now).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + 28 * 86_400_000).toISOString().slice(0, 10);
  // Registry sections and canonical blueprint use official guide order.
  const weightedCert = { ...cert, guide: { ...cert.guide, sections: cert.guide.sections.map((section, index) => {
    const domain = result.domainBreakdown.find(domain => domain.domainCode === PMLE_BLUEPRINT[index]?.domainCode);
    const deficit = result.totalQuestions >= 10 && domain && domain.total > 0 ? 1 - domain.correct / domain.total : 0;
    return { ...section, weight_percent: (section.weight_percent ?? 1) * (1 + deficit) };
  }) } };
  const plan = buildStudyPlan(weightedCert, end, 4, today);
  // Allocate whole quarter-hours before splitting sections into weekly budgets.
  const weights = plan.sections.map(section => section.weight_percent ?? 1);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const exact = weights.map(weight => 64 * weight / sum);
  const units = exact.map(Math.floor);
  const order = exact.map((value, index) => ({ index, fraction: value - units[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const remainder = 64 - units.reduce((total, value) => total + value, 0);
  for (let index = 0; index < remainder; index++) units[order[index].index]++;
  const remaining = units.map(value => value * 15);
  let sectionIndex = 0;
  const weeks = plan.weeks.map(week => {
    let budget = 240;
    const tasks: typeof week.tasks = [];
    while (budget > 0 && sectionIndex < plan.sections.length) {
      const minutes = Math.min(budget, remaining[sectionIndex]);
      const section = plan.sections[sectionIndex];
      if (minutes > 0) tasks.push({ sectionId: section.id, title: section.title, minutes });
      budget -= minutes;
      remaining[sectionIndex] -= minutes;
      if (remaining[sectionIndex] === 0) sectionIndex++;
    }
    return { ...week, minutes: 240, tasks };
  });
  return { ...plan, totalMinutes: 960, weeks, sections: plan.sections.map((section, index) => ({ ...section, minutes: units[index] * 15 })) };
}

export function resultsEmailText(result: DiagnosticResult, now = Date.now()) {
  const plan = resultsEmailPlan(result, now);
  const tierOnly = result.totalQuestions < 10;
  const domains = weakestFirst(result.domainBreakdown);
  return ["Your PMLE diagnostic results", `${result.correctAnswers}/${result.totalQuestions} correct (${result.score}%). Study guidance: ${result.readiness.label}.`,
    "Small diagnostic samples are study signals, not an exam-readiness prediction.",
    ...(tierOnly ? ["\nFor a per-domain breakdown, take the 20-question diagnostic: https://testero.ai/diagnostic?length=20"] : [
      "\nScores by domain:", ...result.domainBreakdown.map(d => `${d.domainName}: ${d.correct}/${d.total} (${d.percentage}%)`),
      "\nWeakest sampled domains:", ...domains.slice(0, 2).map(d => `- ${d.domainName}`),
    ]),
    tierOnly ? "\nYour 4-week plan assumes 4 hours/week (16 hours total). Time uses official section weights, not quick-check domain scores." : "\nYour 4-week plan assumes 4 hours/week (16 hours total). Time uses official section weight × (1 + sampled error rate), so weaker sampled domains receive more time. Unsampled domains retain their official weight.",
    studyPlanText(plan).replace(`Exam: ${plan.examDate}`, `Plan ends: ${plan.examDate}`).replace(`Time allocated in proportion to official section weights (total ${plan.totalWeight}%).`, tierOnly ? "Time allocated by official section weight." : "Time allocated by official section weight adjusted for your diagnostic error rate."),
    `\nView results: https://testero.ai/diagnostic/${encodeURIComponent(result.sessionId)}/results`,
    "Open results in the same browser used for your diagnostic, or sign in to the account that owns it. This link does not grant access on its own.",
    "PMLE Pass pricing: https://testero.ai/pricing",
    "You requested one email with your results; no newsletter and no reminders."].join("\n");
}


const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export function resultsEmailHtml(result: DiagnosticResult, now = Date.now()) {
  const plan = resultsEmailPlan(result, now);
  const e = escapeHtml;
  const tierOnly = result.totalQuestions < 10;
  const url = `https://testero.ai/diagnostic/${encodeURIComponent(result.sessionId)}/results`;
  const cell = 'padding:10px 8px;border-bottom:1px solid #E4E7EC;text-align:left;vertical-align:top';
  const scores = result.domainBreakdown.map(domain => `<tr><th scope="row" style="${cell};font-weight:400">${e(domain.domainName)}</th><td style="${cell}">${e(domain.correct)}/${e(domain.total)}</td><td style="${cell}">${e(domain.percentage)}%</td></tr>`).join("");
  const weeks = plan.weeks.map(week => `<tr><td style="padding:16px 0;border-bottom:1px solid #E4E7EC"><h3 style="margin:0 0 4px;font-size:15px">Week ${e(week.number)} · ${e(studyTime(week.minutes))}</h3><p style="margin:0 0 8px;font-size:12px;color:#475467">${e(week.start)} – ${e(week.end)}</p><ul style="margin:0;padding-left:20px;font-size:14px">${week.tasks.map(task => `<li style="margin:4px 0">${e(task.title)}: <strong>${e(studyTime(task.minutes))}</strong></li>`).join("")}</ul></td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your PMLE diagnostic results</title></head>
<body style="margin:0;padding:24px;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#101828;line-height:1.5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:8px"><tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font-size:22px">Your PMLE diagnostic results</h1>
<p style="color:#344054">${e(result.correctAnswers)}/${e(result.totalQuestions)} correct (${e(result.score)}%). Study guidance: ${e(result.readiness.label)}.</p>
<p style="font-size:14px;color:#475467">Small diagnostic samples are study signals, not an exam-readiness prediction.</p>
${tierOnly ? '<p style="font-size:16px;font-weight:600"><a href="https://testero.ai/diagnostic?length=20" style="color:#1F4CB5">Take the 20-question diagnostic for a per-domain breakdown →</a></p>' : `<h2 style="font-size:18px">Scores by domain</h2><table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px"><thead><tr><th scope="col" style="${cell}">Domain</th><th scope="col" style="${cell}">Correct</th><th scope="col" style="${cell}">Score</th></tr></thead><tbody>${scores}</tbody></table>
<h2 style="font-size:18px">Weakest sampled domains</h2><ul style="margin:0;padding-left:20px;font-size:14px">${weakestFirst(result.domainBreakdown).slice(0, 2).map(domain => `<li style="margin:4px 0">${e(domain.domainName)}</li>`).join("")}</ul>`}
<h2 style="font-size:18px">Your 4-week study plan</h2><p style="font-size:14px;color:#475467">4 hours/week (16 hours total), in 15-minute blocks. Plan ends: ${e(plan.examDate)}. ${tierOnly ? "Time uses official section weights, not quick-check domain scores." : "Time uses official section weight × (1 + sampled error rate), so weaker sampled domains receive more time. Unsampled domains retain their official weight."}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tbody>${weeks}</tbody></table>
<p style="font-size:14px">Official ${e(plan.guideVariant)} exam guide: <a href="${e(plan.guideUrl)}" style="color:#1F4CB5">${e(plan.certName)}</a></p>
<p style="font-size:14px;color:#475467">Use official docs and hands-on practice for each section; revisit weak areas. This schedule is not an exam-readiness prediction.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#1F4CB5;border-radius:6px"><a href="${e(url)}" style="display:inline-block;padding:12px 20px;color:#FFFFFF;font-weight:600;text-decoration:none">View your results</a></td></tr></table>
<p style="font-size:14px;color:#475467">Open results in the same browser used for your diagnostic, or sign in to the account that owns it. This link does not grant access on its own.</p>
<p style="font-size:14px"><a href="https://testero.ai/pricing" style="color:#1F4CB5">PMLE Pass pricing</a></p>
<p style="font-size:14px;color:#475467">You requested one email with your results; no newsletter and no reminders.</p>
<p style="font-size:12px;color:#475467">Testero is independent and not affiliated with or endorsed by Google.</p>
</td></tr></table></td></tr></table></body></html>`;
}

const MULTIPART_PREFIX = "testero-results-multipart-v1\n";
function frozenParts(payload: string): { text: string; html?: string } {
  // Historical plain-text requests must retain their exact provider body on retry.
  if (!payload.startsWith(MULTIPART_PREFIX)) return { text: payload };
  const value: unknown = JSON.parse(payload.slice(MULTIPART_PREFIX.length));
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("text" in value) || typeof value.text !== "string" || !("html" in value) || typeof value.html !== "string") throw unavailable();
  return { text: value.text, html: value.html };
}

const unavailable = () => new DiagnosticError(503, "We couldn't send your email. Please try again.");
export async function sendResultsEmail(client: SupabaseClient, email: string, result: DiagnosticResult) {
  requirePmleResult(result);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw unavailable();
  const lease = randomUUID();
  const now = Date.now();
  const payload = MULTIPART_PREFIX + JSON.stringify({ version: 1, text: resultsEmailText(result, now), html: resultsEmailHtml(result, now) });
  const { data, error } = await client.rpc("claim_results_email", {
    p_session_id: result.sessionId, p_email: email, p_payload: payload, p_lease: lease,
  });
  if (error || !data) throw unavailable();
  if (data.status === "sent") return;
  if (data.status === "limited") throw new DiagnosticError(429, "Too many email requests. Please try again tomorrow.");
  if (data.status === "busy") throw new DiagnosticError(409, "Your email is being sent. Please try again in a minute.");
  if (data.status === "expired") throw new DiagnosticError(409, "This email request has expired. Your results are still available here.");
  if (data.status !== "claimed" || typeof data.id !== "string" || typeof data.payload !== "string") throw unavailable();
  try {
    const parts = frozenParts(data.payload);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `results-${data.id}` },
      body: JSON.stringify({ from: "Testero <no-reply@testero.ai>", to: [email], subject: "Your PMLE results + 4-week study plan", ...parts }),
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
