import type { Metadata } from "next";
import { DiagnosticResults } from "@/components/diagnostic-results";

export const metadata: Metadata = { title: "Your readiness results" };
export default async function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <DiagnosticResults key={sessionId} sessionId={sessionId} />;
}
