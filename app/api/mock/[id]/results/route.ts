import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { mockResults } from "@/lib/mock/service";
import { mockUser, mockErrorResponse, mockHeaders } from "@/lib/mock/http";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    
    const user = await mockUser();
    const { id } = await context.params;
    return NextResponse.json(await mockResults(createServiceSupabaseClient(), id, user.id), { headers: mockHeaders });
  } catch (error) { return mockErrorResponse(error); }
}
