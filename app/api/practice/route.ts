import { NextResponse } from "next/server";
import { z } from "zod";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createPractice } from "@/lib/practice/service";
import { practiceUser, practiceErrorResponse } from "@/lib/practice/http";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
const startBody = z.object({ domainCode: z.enum(PMLE_BLUEPRINT.map(domain => domain.domainCode)) }).strict();
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await practiceUser();
    const parsed = startBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DiagnosticError(400, "Choose a valid practice domain");
    const sessionId = await createPractice(createServiceSupabaseClient(), user.id, parsed.data.domainCode);
    return NextResponse.json({ sessionId, href: `/practice/${sessionId}` }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return practiceErrorResponse(error); }
}
