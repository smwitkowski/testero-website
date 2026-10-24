import "server-only";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth/session";
import { DiagnosticError } from "@/lib/diagnostic/http";
export const mockHeaders = { "Cache-Control": "private, no-store" };
export async function mockUser() {
  const user = await getVerifiedUser();
  if (!user) throw new DiagnosticError(401, "Please sign in to continue");
  return user;
}
export function mockErrorResponse(error: unknown) {
  if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message, ...(error.status === 403 ? { upgradeHref: "/pricing" } : {}) }, { status: error.status, headers: mockHeaders });
  console.error("Mock exam request failed");
  return NextResponse.json({ error: "Mock exams are unavailable. Please try again." }, { status: 500, headers: mockHeaders });
}
