import "server-only";
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth/session";
import { DiagnosticError } from "@/lib/diagnostic/http";
import { z } from "zod";
export const noStore = { "Cache-Control": "private, no-store" };
export function billingJson(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: noStore }); }
export async function billingUser() {
  const user = await getVerifiedUser();
  if (!user) throw new DiagnosticError(401, "Please sign in to continue");
  return user;
}
export async function requireEmptyBody(request: Request) {
  if (!z.object({}).strict().safeParse(await request.json().catch(() => null)).success)
    throw new DiagnosticError(400, "Invalid billing request");
}
export function billingErrorResponse(error: unknown) {
  if (error instanceof DiagnosticError) return billingJson({ error: error.message }, error.status);
  console.error("Billing request failed");
  return billingJson({ error: "Billing is unavailable. Please try again." }, 503);
}
