import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { answerDiagnostic } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { DiagnosticError, diagnosticErrorResponse, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
const answerBody = z.object({ itemId: z.uuid(), selectedLabel: z.string().regex(/^[A-Z]$/) }).strict();
export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    requireSameOrigin(request);
    const parsed = answerBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DiagnosticError(400, "Invalid answer request");
    const { sessionId } = await context.params;
    const data = await answerDiagnostic(createServiceSupabaseClient(), sessionId, await diagnosticCredentials(), parsed.data.itemId, parsed.data.selectedLabel);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diagnosticErrorResponse(error); }
}
