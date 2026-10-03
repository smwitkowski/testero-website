import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth/redirects";
import { requireUser } from "@/lib/auth/require-user";
export const metadata: Metadata = { title: "Choose a new password" };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  await requireUser("/reset-password");
  const params = await searchParams;
  return <section className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Choose a new password</h1><p className="max-w-xl leading-relaxed text-muted-foreground">Use a new password for your Testero account.</p><AuthForm mode="reset-password" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} /></section>;
}
