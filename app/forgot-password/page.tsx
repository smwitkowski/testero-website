import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Reset your password" };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <section className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reset your password</h1><p className="max-w-xl leading-relaxed text-muted-foreground">Request a link to choose a new password.</p><AuthForm mode="forgot-password" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} /></section>;
}
