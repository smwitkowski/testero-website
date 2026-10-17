import { NextResponse } from "next/server";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { questionReportBody } from "@/lib/question-reports/schema";
import { submitQuestionReport } from "@/lib/question-reports/service";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const text = await request.text();
    if (text.length > 12000) throw new DiagnosticError(400, "Invalid report");
    const parsed = questionReportBody.safeParse(JSON.parse(text));
    if (!parsed.success) throw new DiagnosticError(400, "Invalid report");
    await submitQuestionReport(createServiceSupabaseClient(), parsed.data, await diagnosticCredentials());
    return NextResponse.json({ message: "Thanks, we review every report." }, { headers });
  } catch (error) {
    const status = error instanceof DiagnosticError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return NextResponse.json({ error: error instanceof DiagnosticError ? error.message : status === 400 ? "Invalid report" : "Reporting is unavailable. Please try again." }, { status, headers });
  }
}
