import type { PaidAccess } from "@/lib/billing/paid-access";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
export interface DashboardData {
  paidAccess: PaidAccess;
  diagnostic: DiagnosticResult | null;
  weakestDomains: DiagnosticResult["domainBreakdown"];
  domains: { domainCode: string; domainName: string }[];
  openPractice: { sessionId: string; domainName: string } | null;
  progress: Omit<DiagnosticResult, "sessionId" | "readiness" | "review">;
  practiceHistory: { sessionId: string; completedAt: string; totalQuestions: number; correctAnswers: number; score: number }[];
}
