import type { Metadata } from "next";
import { DiagnosticSession } from "@/components/diagnostic-session";

export const metadata: Metadata = { title: "Your diagnostic" };
export default async function DiagnosticPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <DiagnosticSession key={sessionId} sessionId={sessionId} />;
}
