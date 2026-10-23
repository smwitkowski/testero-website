import { ServerTiming } from "@/lib/server-timing";
import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { getCertification } from "@/lib/certifications/data";
import { isBetaDiagnosticCertId } from "@/lib/diagnostic/beta";
import { createDiagnosticStart, findOpenDiagnostic } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { ANONYMOUS_COOKIE, ANONYMOUS_COOKIE_MAX_AGE, createAnonymousToken, hashAnonymousToken } from "@/lib/diagnostic/ownership";
import { DiagnosticError, diagnosticErrorResponse, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";

/** Fresh owner-scoped resume lookup, including when Next restores a cached start page. */
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const certId = (query.get("cert") ?? PMLE_CERT_ID).toLowerCase();
    if (query.getAll("cert").length > 1 || !getCertification(certId)) throw new DiagnosticError(404, "Diagnostic not found");
    const resumeId = await findOpenDiagnostic(createServiceSupabaseClient(), await diagnosticCredentials(), undefined, certId);
    return NextResponse.json({ resumeId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diagnosticErrorResponse(error); }
}

export async function POST(request: Request) {
  const timing = new ServerTiming();
  try {
    requireSameOrigin(request);
    const body = await request.json().catch(() => { throw new DiagnosticError(400, "Invalid request body"); });
    const parsed = z.object({ questionCount: z.union([z.literal(5), z.literal(10), z.literal(20)]).optional(), certId: z.string().max(100).optional() }).strict().safeParse(body);
    if (!parsed.success) throw new DiagnosticError(400, "Invalid request body");
    const certId = parsed.data.certId ?? PMLE_CERT_ID;
    if (certId !== PMLE_CERT_ID && !isBetaDiagnosticCertId(certId)) throw new DiagnosticError(404, "Diagnostic not found");
    const questionCount = parsed.data.questionCount ?? (certId === PMLE_CERT_ID ? 20 : 5);
    if (certId !== PMLE_CERT_ID && questionCount === 20) throw new DiagnosticError(400, "Invalid diagnostic length");
    const cookieStore = await cookies();
    const previous = cookieStore.get(ANONYMOUS_COOKIE)?.value;
    const token = hashAnonymousToken(previous) ? previous! : createAnonymousToken();
    const credentials = await timing.measure("credentials", () => diagnosticCredentials());
    const client = createServiceSupabaseClient();
    const result = certId === PMLE_CERT_ID
      ? await createDiagnosticStart(client, token, undefined, credentials.userId, timing, questionCount)
      : await createDiagnosticStart(client, token, undefined, credentials.userId, timing, questionCount, certId);
    const { sessionId } = result;
    scheduleFunnelEvent(request, "diagnostic_started", sessionId, { session_id: sessionId, length: questionCount, cert_id: certId });
    const response = NextResponse.json(result, { status: 201 });
    response.cookies.set(ANONYMOUS_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: ANONYMOUS_COOKIE_MAX_AGE });
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Server-Timing", timing.header());
    return response;
  } catch (error) { const response = diagnosticErrorResponse(error); response.headers.set("Server-Timing", timing.header()); return response; }
}
