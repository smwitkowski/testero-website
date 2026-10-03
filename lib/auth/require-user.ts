import "server-only";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/redirects";
export async function requireUser(nextPath: string) {
  const user = await getVerifiedUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(nextPath))}`);
  return user;
}
