import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Create an account" };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <section className="space-y-6"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Create an account</h1><p className="max-w-xl leading-relaxed text-muted-foreground">Keep your diagnostic, review your answers, and get 5 free practice questions each week.</p><AuthForm mode="signup" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} /></section>;
}
