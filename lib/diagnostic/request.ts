import "server-only";
import { cookies } from "next/headers";
import { getVerifiedUser } from "@/lib/auth/session";
import { ANONYMOUS_COOKIE, type OwnerCredentials } from "@/lib/diagnostic/ownership";

export async function diagnosticCredentials(): Promise<OwnerCredentials> {
  const cookieStore = await cookies();
  const user = await getVerifiedUser();
  return { userId: user?.id ?? null, anonymousToken: cookieStore.get(ANONYMOUS_COOKIE)?.value ?? null };
}
