import "server-only";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth/session";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { PracticeQuotaError } from "@/lib/practice/service";
export async function practiceUser() {
  const user = await getVerifiedUser();
  if (!user) throw new DiagnosticError(401, "Please sign in to continue");
  return user;
}
export function practiceErrorResponse(error: unknown) {
  if (error instanceof PracticeQuotaError) return NextResponse.json({ error: error.message, upgradeHref: "/pricing" }, { status: 429, headers: { "Cache-Control": "private, no-store" } });
  const headers = { "Cache-Control": "private, no-store" };
  if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
  console.error("Practice request failed");
  return NextResponse.json({ error: "Practice is unavailable. Please try again." }, { status: 500, headers });
}
