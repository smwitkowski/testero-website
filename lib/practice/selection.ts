import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shuffleArray } from "@/lib/questions/answer-order";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { DiagnosticError } from "@/lib/diagnostic/http";

export interface AnswerHistory {
  questionId: string;
  domainCode: string;
  isCorrect: boolean | null;
  kind: "diagnostic" | "practice" | "mock";
  sessionId: string;
  answeredAt: string;
  completedAt: string | null;
}
import { restorePracticeSelection, WEAK_AREA_MIN_ANSWERS, type PracticeSelection } from "@/lib/practice/selection-label";
export { WEAK_AREA_MIN_ANSWERS, type PracticeSelection } from "@/lib/practice/selection-label";

/** Shuffle within each group, but never put an answered question ahead of an unseen one. */
export function freshFirst<T extends { id: string }>(questions: readonly T[], answeredIds: ReadonlySet<string>): T[] {
  const shuffled = shuffleArray(questions);
  return [...shuffled.filter(question => !answeredIds.has(question.id)), ...shuffled.filter(question => answeredIds.has(question.id))];
}

/** Read every page. Both joins bind history to the verified owner, not a supplied session ID. */
export async function loadAnswerHistory(client: SupabaseClient, userId: string): Promise<AnswerHistory[]> {
  const history: AnswerHistory[] = [];
  for (const mock of [false, true]) {
    const table = mock ? "mock_exam_items" : "session_items";
    const sessions = mock ? "mock_exam_sessions" : "study_sessions";
    const fields = `id,question_id,domain_code,is_correct,answered_at,session_id,${sessions}!inner(user_id,completed_at${mock ? "" : ",kind,exam"})`;
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      let query = client.from(table).select(fields).eq(`${sessions}.user_id`, userId).not("answered_at", "is", null).order("id").range(offset, offset + pageSize - 1);
      if (!mock) query = query.eq(`${sessions}.exam`, "GCP_PM_ML_ENG").in(`${sessions}.kind`, ["diagnostic", "practice"]);
      const { data, error } = await query;
      if (error || !Array.isArray(data)) throw new DiagnosticError(503, "Practice history is unavailable. Please try again.");
      for (const raw of data) {
        const row = raw as unknown as { question_id: string; domain_code: string; is_correct: boolean | null; answered_at: string; session_id: string; [key: string]: unknown };
        const owner = row[sessions] as { user_id: string; completed_at: string | null; kind?: string; exam?: string } | null;
        if (!owner || owner.user_id !== userId || (!mock && (owner.exam !== "GCP_PM_ML_ENG" || !["diagnostic", "practice"].includes(owner.kind ?? "")))
          || typeof row.question_id !== "string" || typeof row.domain_code !== "string" || typeof row.session_id !== "string"
          || typeof row.answered_at !== "string" || !Number.isFinite(Date.parse(row.answered_at)) || (row.is_correct !== null && typeof row.is_correct !== "boolean")) {
          throw new DiagnosticError(503, "Practice history is unavailable. Please try again.");
        }
        history.push({ questionId: row.question_id, domainCode: row.domain_code, isCorrect: row.is_correct, kind: mock ? "mock" : owner.kind as "diagnostic" | "practice", sessionId: row.session_id, answeredAt: row.answered_at, completedAt: owner.completed_at });
      }
      if (data.length < pageSize) break;
    }
  }
  return history;
}

/** Use domain scores only after five distinct questions; sparse history uses the latest diagnostic focus. */
export function selectWeakArea(history: readonly AnswerHistory[]): PracticeSelection {
  const stats = (rows: readonly AnswerHistory[]) => PMLE_BLUEPRINT.map(domain => {
    const answers = rows.filter(row => row.domainCode === domain.domainCode && typeof row.isCorrect === "boolean");
    return { domain, count: new Set(answers.map(row => row.questionId)).size, score: answers.length ? answers.filter(row => row.isCorrect).length / answers.length : 1 };
  });
  // Diagnostic and practice outcomes drive drills. Mock history is used for freshness, not weak-area claims.
  const practiceHistory = history.filter(row => row.kind !== "mock");
  const weak = stats(practiceHistory).filter(domain => domain.count >= WEAK_AREA_MIN_ANSWERS).sort((a, b) => a.score - b.score)[0];
  if (weak) return restorePracticeSelection({ reason: "history", domainCode: weak.domain.domainCode })!;
  const latest = practiceHistory.filter(row => row.kind === "diagnostic" && row.completedAt).sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0];
  const focus = latest ? stats(practiceHistory.filter(row => row.kind === "diagnostic" && row.sessionId === latest.sessionId)).filter(domain => domain.count > 0).sort((a, b) => a.score - b.score)[0] : undefined;
  if (focus) return restorePracticeSelection({ reason: "diagnostic_focus", domainCode: focus.domain.domainCode })!;
  return restorePracticeSelection({ reason: "general", domainCode: PMLE_BLUEPRINT[0].domainCode })!;
}
