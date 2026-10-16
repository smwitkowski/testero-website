import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Reset your password", description: "Request a secure password reset link for your Testero account.", robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <section className="mx-auto max-w-[480px] space-y-6 rounded-lg border border-border bg-card p-5 sm:p-8"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reset your password</h1><p className="max-w-xl leading-relaxed text-muted-foreground">Request a link to choose a new password.</p><AuthForm mode="forgot-password" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} /></section>;
}
