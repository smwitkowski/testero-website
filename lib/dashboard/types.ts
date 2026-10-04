import type { PaidAccess } from "@/lib/billing/paid-access";
import type { DiagnosticResult } from "@/lib/diagnostic/types";
export interface DashboardData {
  paidAccess: PaidAccess;
  diagnostic: DiagnosticResult | null;
  weakestDomains: DiagnosticResult["domainBreakdown"];
  domains: { domainCode: string; domainName: string }[];
  openPractice: { sessionId: string; domainName: string } | null;
  quota: { remaining: number; weekStart: string };
}
