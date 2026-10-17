import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { certifications, PMLE_CERT_ID } from "@/lib/certifications/catalog";
import { allowWaitlistRequest } from "@/lib/certifications/rate-limit";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { requireSameOrigin, DiagnosticError } from "@/lib/diagnostic/http";
import { scheduleFunnelEvent } from "@/lib/analytics/server";

export const runtime = "nodejs";
const schema = z.object({
  email: z.string().trim().max(254).email().transform(value => value.toLowerCase()),
  cert_id: z.string().refine(id => id !== PMLE_CERT_ID && certifications.some(cert => cert.cert_id === id)),
  source_path: z.string().max(300).regex(/^\/(?!\/)[a-zA-Z0-9/_-]*$/).optional(),
  utm_source: z.string().max(200).optional(), utm_medium: z.string().max(200).optional(), utm_campaign: z.string().max(200).optional(),
  website: z.string().max(300).optional(),
}).strict();
const headers = { "Cache-Control": "private, no-store" };
const joined = () => NextResponse.json({ message: "You're on the list" }, { headers });
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!allowWaitlistRequest(request)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) { await reader.cancel(); return NextResponse.json({ error: "Invalid request" }, { status: 400, headers }); }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const parsed = schema.safeParse(JSON.parse(body));
    if (!parsed.success) return NextResponse.json({ error: "Invalid email or certification" }, { status: 400, headers });
    const { website, ...data } = parsed.data;
    if (website) return joined();
    const { data: inserted, error } = await createServiceSupabaseClient().from("cert_waitlist")
      .upsert(data, { onConflict: "email,cert_id", ignoreDuplicates: true }).select("id");
    if (error) throw new Error("Waitlist unavailable");
    if (inserted?.length) scheduleFunnelEvent(request, "cert_waitlist_joined", randomUUID(), { cert_id: data.cert_id });
    return joined();
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
    if (error instanceof DiagnosticError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "We couldn't save your request. Please try again." }, { status: 503, headers });
  }
}
