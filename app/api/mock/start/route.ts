import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createMock } from "@/lib/mock/service";
import { mockUser, mockErrorResponse, mockHeaders } from "@/lib/mock/http";
import { requireSameOrigin } from "@/lib/diagnostic/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await mockUser();
    const sessionId = await createMock(createServiceSupabaseClient(), user.id);
    return NextResponse.json({ sessionId, href: `/mock/${sessionId}` }, { status: 201, headers: mockHeaders });
  } catch (error) { return mockErrorResponse(error); }
}
