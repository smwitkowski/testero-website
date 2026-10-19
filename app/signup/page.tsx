import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/auth/redirects";
export const metadata: Metadata = { title: "Create an account", description: "Create a free Testero account to review your PMLE answers and practice 60 questions per month.", robots: { index: false, follow: false } };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthScreen mode="signup" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} />;
}
