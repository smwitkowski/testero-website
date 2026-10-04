import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { answerPractice } from "@/lib/practice/service";
import { practiceUser, practiceErrorResponse } from "@/lib/practice/http";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
const answerBody = z.object({ itemId: z.uuid(), selectedLabel: z.string().regex(/^[A-Z]$/) }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await practiceUser();
    const parsed = answerBody.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DiagnosticError(400, "Invalid answer request");
    const { id } = await context.params;
    const data = await answerPractice(createServiceSupabaseClient(), id, user.id, parsed.data.itemId, parsed.data.selectedLabel);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return practiceErrorResponse(error); }
}
