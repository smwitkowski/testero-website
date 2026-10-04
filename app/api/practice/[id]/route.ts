import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { readPractice } from "@/lib/practice/service";
import { practiceUser, practiceErrorResponse } from "@/lib/practice/http";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await practiceUser();
    const { id } = await context.params;
    const data = await readPractice(createServiceSupabaseClient(), id, user.id);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return practiceErrorResponse(error); }
}
