import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { diagnosticResults } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { diagnosticErrorResponse } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await context.params;
    const data = await diagnosticResults(createServiceSupabaseClient(), sessionId, await diagnosticCredentials());
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return diagnosticErrorResponse(error); }
}
