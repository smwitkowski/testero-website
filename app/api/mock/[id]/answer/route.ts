import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { answerMock } from "@/lib/mock/service";
import { mockUser, mockErrorResponse, mockHeaders } from "@/lib/mock/http";
import { DiagnosticError, requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
const body = z.object({ itemId: z.uuid(), selectedLabel: z.string().regex(/^[A-Z]$/) }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await mockUser();
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new DiagnosticError(400, "Invalid mock answer");
    const { id } = await context.params;
    return NextResponse.json(await answerMock(createServiceSupabaseClient(), id, user.id, parsed.data.itemId, parsed.data.selectedLabel), { headers: mockHeaders });
  } catch (error) { return mockErrorResponse(error); }
}
