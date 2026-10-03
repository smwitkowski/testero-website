import { getExamReadinessTier } from "@/lib/readiness";
import type { DiagnosticResult } from "@/lib/diagnostic/types";

export interface ScoringItem {
  domain_code: string;
  domain_name: string;
  is_correct: boolean | null;
}

/** Anonymous results contain aggregates only, never questions or answer keys. */
export function computeResult(
  sessionId: string,
  items: readonly ScoringItem[],
): DiagnosticResult {
  const domains = new Map<string, DiagnosticResult["domainBreakdown"][number]>();
  let correctAnswers = 0;
  for (const item of items) {
    const domain = domains.get(item.domain_code) ?? {
      domainCode: item.domain_code,
      domainName: item.domain_name,
      total: 0,
      correct: 0,
      percentage: 0,
    };
    domain.total++;
    if (item.is_correct === true) {
      domain.correct++;
      correctAnswers++;
    }
    domains.set(item.domain_code, domain);
  }
  const totalQuestions = items.length;
  const score = totalQuestions === 0 ? 0 : Math.round((correctAnswers / totalQuestions) * 100);
  const domainBreakdown = [...domains.values()].map((domain) => ({
    ...domain,
    percentage: Math.round((domain.correct / domain.total) * 100),
  }));
  return {
    sessionId,
    score,
    totalQuestions,
    correctAnswers,
    readiness: getExamReadinessTier(score),
    domainBreakdown,
  };
}
