import { ServerTiming } from "@/lib/server-timing";
import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createDiagnostic } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { ANONYMOUS_COOKIE, ANONYMOUS_COOKIE_MAX_AGE, createAnonymousToken, hashAnonymousToken } from "@/lib/diagnostic/ownership";
import { DiagnosticError, diagnosticErrorResponse, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const timing = new ServerTiming();
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => { throw new DiagnosticError(400, "Invalid request body"); });
    if (!z.object({}).strict().safeParse(body).success) throw new DiagnosticError(400, "Invalid request body");
    const cookieStore = await cookies();
    const previous = cookieStore.get(ANONYMOUS_COOKIE)?.value;
    const token = hashAnonymousToken(previous) ? previous! : createAnonymousToken();
    const credentials = await timing.measure("credentials", () => diagnosticCredentials());
    const sessionId = await createDiagnostic(createServiceSupabaseClient(), token, undefined, credentials.userId, timing);
    scheduleFunnelEvent(request, "diagnostic_started", sessionId, { session_id: sessionId });
    const response = NextResponse.json({ sessionId, href: `/diagnostic/${sessionId}` }, { status: 201 });
    response.cookies.set(ANONYMOUS_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ANONYMOUS_COOKIE_MAX_AGE });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Server-Timing", timing.header());
    return response;
  } catch (error) { const response = diagnosticErrorResponse(error); response.headers.set("Server-Timing", timing.header()); return response; }
}
