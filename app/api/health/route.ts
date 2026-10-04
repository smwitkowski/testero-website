import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Public readiness probe. Never expose credentials, database rows, or errors. */
export async function GET() {
  let ok = false;
  try {
    const { error } = await createServiceSupabaseClient()
      .from("exam_domains")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(5_000));
    ok = error === null;
  } catch {
    // Missing configuration, database failures, and timeouts share one safe response.
  }
  return NextResponse.json({ ok }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
