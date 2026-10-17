import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { diagnosticResults } from "@/lib/diagnostic/service";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
import { sendResultsEmail } from "@/lib/diagnostic/results-email";
import { allowWaitlistRequest } from "@/lib/certifications/rate-limit";
export const runtime = "nodejs";
const schema = z.object({ email: z.string().trim().max(254).email().transform(value => value.toLowerCase()), consent: z.literal(true), website: z.string().max(300).optional() }).strict();
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  try {
    requireSameOrigin(request);
    if (!allowWaitlistRequest(request)) throw new DiagnosticError(429, "Too many requests. Try again in a minute.");
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (reader) while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new DiagnosticError(400, "Invalid request"); }
      chunks.push(value);
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) throw new DiagnosticError(400, "Enter a valid email and consent to this one email.");
    if (!parsed.data.website) {
      const client = createServiceSupabaseClient();
      const { sessionId } = await context.params;
      const result = await diagnosticResults(client, sessionId, await diagnosticCredentials());
      await sendResultsEmail(client, parsed.data.email, result);
    }
    return NextResponse.json({ message: "Your results email has been sent." }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
    if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "We couldn't send your email. Please try again." }, { status: 503, headers });
  }
}
