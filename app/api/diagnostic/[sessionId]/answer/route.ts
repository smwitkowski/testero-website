import { PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { ServerTiming } from "@/lib/server-timing";
import { scheduleFunnelEvent } from "@/lib/analytics/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { answerDiagnostic } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { DiagnosticError, diagnosticErrorResponse, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
const answerBody = z.object({ itemId: z.uuid(), selectedLabel: z.string().regex(/^[A-Z]$/) }).strict();
export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const timing = new ServerTiming();
  try {
    requireSameOrigin(request);
    const parsed = answerBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DiagnosticError(400, "Invalid answer request");
    const { sessionId } = await context.params;
    const credentials = await timing.measure("credentials", () => diagnosticCredentials());
    const data = await answerDiagnostic(createServiceSupabaseClient(), sessionId, credentials, parsed.data.itemId, parsed.data.selectedLabel, undefined, timing);
    if (data.completed) scheduleFunnelEvent(request, "diagnostic_completed", sessionId, { session_id: sessionId, cert_id: data.progress.certId ?? PMLE_CERT_ID }, undefined, credentials.userId);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store", "Server-Timing": timing.header() } });
  } catch (error) { const response = diagnosticErrorResponse(error); response.headers.set("Server-Timing", timing.header()); return response; }
}
