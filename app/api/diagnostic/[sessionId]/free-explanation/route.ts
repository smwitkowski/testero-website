import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { diagnosticFreeExplanation } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { DiagnosticError, diagnosticErrorResponse } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    if (new URL(request.url).search) throw new DiagnosticError(400, "The preview question is selected automatically");
    const { sessionId } = await context.params;
    const data = await diagnosticFreeExplanation(createServiceSupabaseClient(), sessionId, await diagnosticCredentials());
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diagnosticErrorResponse(error); }
}
