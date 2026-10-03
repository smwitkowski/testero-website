import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Practice summary" };
export default async function PracticeSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhasePlaceholder phase={2} title="Practice summary" description="Completed practice sessions will show their summaries here. There are no practice answers, scores, or explanations in this preview."
    primary={{ href: "/dashboard", label: "Preview dashboard" }} links={[{ href: `/practice/${encodeURIComponent(id)}`, label: "Back to practice preview" }]} />;
}
