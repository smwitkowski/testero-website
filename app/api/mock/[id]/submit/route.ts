import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { submitMock } from "@/lib/mock/service";
import { mockUser, mockErrorResponse, mockHeaders } from "@/lib/mock/http";
import { requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await mockUser();
    const { id } = await context.params;
    return NextResponse.json(await submitMock(createServiceSupabaseClient(), id, user.id), { headers: mockHeaders });
  } catch (error) { return mockErrorResponse(error); }
}
