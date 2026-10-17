import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DashboardPanel, DashboardLoadError } from "@/components/dashboard-panel";
import { SignupAnalytics } from "@/components/signup-analytics";
import { requireUser } from "@/lib/auth/require-user";
import { claimAnonymousDiagnostics } from "@/lib/auth/claim";
import { ANONYMOUS_COOKIE } from "@/lib/diagnostic/ownership";
import { loadDashboard } from "@/lib/dashboard/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ signup?: string; domain?: string; message?: string }> }) {
  const query = await searchParams;
  const passwordUpdated = query.message === "password-updated";
  const user = await requireUser(passwordUpdated ? "/dashboard?message=password-updated" : "/dashboard");
  const confirmedSignup = query.signup === "confirmed";
  let data;
  try {
    const client = createServiceSupabaseClient();
    const token = (await cookies()).get(ANONYMOUS_COOKIE)?.value;
    await claimAnonymousDiagnostics(client, user.id, token);
    data = await loadDashboard(client, user.id);
  } catch {
    // A failed load is not an empty dashboard. Retry repeats the idempotent claim.
  }
  if (!data && !passwordUpdated) return <DashboardLoadError />;
  return <>{passwordUpdated && <p role="status" className="mb-6 rounded-md border border-border bg-muted p-4">Password updated.</p>}{confirmedSignup && <SignupAnalytics userId={user.id} />}{data ? <DashboardPanel data={data} requestedDomain={query.domain} /> : <DashboardLoadError />}</>;
}
