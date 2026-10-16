import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Sign in", description: "Sign in to your Testero account to review PMLE diagnostics and continue practice.", robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthScreen mode="login" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} />;
}
