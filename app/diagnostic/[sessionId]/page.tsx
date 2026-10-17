import type { Metadata } from "next";
import { DiagnosticSession } from "@/components/diagnostic-session";

import { readDiagnostic } from "@/lib/diagnostic/service";
import { diagnosticCredentials } from "@/lib/diagnostic/request";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your diagnostic" };
export default async function DiagnosticPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const initialData = await readDiagnostic(createServiceSupabaseClient(), sessionId, await diagnosticCredentials()).catch(() => null);
  return <DiagnosticSession key={sessionId} sessionId={sessionId} initialData={initialData} />;
}
