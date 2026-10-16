import { getVerifiedUser } from "@/lib/auth/session";
import { getPaidAccess } from "@/lib/billing/paid-access";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const user = await getVerifiedUser();
    if (!user) return Response.json({ signedIn: false }, { headers });
    const access = await getPaidAccess(user.id);
    if (access.unavailable) throw new Error("Billing unavailable");
    return Response.json({ signedIn: true, owned: access.hasPaidAccess,
      expiresAt: access.hasPaidAccess && access.pass ? access.pass.expires_at : null }, { headers });
  } catch {
    return Response.json({ error: "Billing is unavailable. Please try again." }, { status: 503, headers });
  }
}
