import { noIndexMetadata } from "@/lib/seo";
import { AuthScreen } from "@/components/auth-screen";
import { safeNext } from "@/lib/auth/redirects";
export const metadata = noIndexMetadata("Create an account", "Create a free Testero account to review your PMLE answers, practice with no monthly limit and track your progress.");
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; message?: string }> }) {
  const params = await searchParams;
  return <AuthScreen mode="signup" next={safeNext(params.next)} confirmationFailed={params.message === "confirmation-failed"} />;
}
