import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
export const AUTH_MESSAGES = {
  invalid: "Please check your details and try again.",
  credentials: "Unable to sign in. Check your details and try again.",
  signup: "Check your email for a confirmation link. If an account can be created, you will receive an email.",
  recovery: "Check your email for a reset link. If an account is eligible, you will receive an email.",
  unavailable: "Unable to complete this request. Please try again.",
  unauthenticated: "Please sign in to continue.",
  confirmation: "Unable to confirm this link. Please sign in or request a new link.",
} as const;
export function authResponse(body: { message: string; href?: string } | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
export class AuthRequestError extends Error { constructor(public status: number) { super("Invalid auth request"); } }
export async function authBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  try { requireSameOrigin(request); } catch (error) {
    throw new AuthRequestError(error instanceof DiagnosticError ? error.status : 403);
  }
  let json: unknown;
  try { json = await request.json(); } catch { throw new AuthRequestError(400); }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AuthRequestError(400);
  return parsed.data;
}
export function authErrorResponse(error: unknown) {
  if (error instanceof AuthRequestError) return authResponse({ error: AUTH_MESSAGES.invalid }, error.status);
  // Never log SDK messages: they can contain email addresses or tokens.
  return authResponse({ error: AUTH_MESSAGES.unavailable }, 503);
}
