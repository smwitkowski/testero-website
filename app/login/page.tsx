import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Sign in", description: "Sign in to your Testero account to review PMLE diagnostics and continue practice.", robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const passwordUpdated = params.message === "password-updated" || next === "/dashboard?message=password-updated";
  return <>{passwordUpdated && <p role="status" className="mx-auto mb-6 max-w-[916px] rounded-md border border-border bg-muted p-4">Password updated. Please sign in again with your new password.</p>}<AuthScreen mode="login" next={next} confirmationFailed={params.message === "confirmation-failed"} /></>;
}
