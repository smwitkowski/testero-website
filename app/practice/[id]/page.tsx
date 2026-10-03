import type { Metadata } from "next";
import { PhasePlaceholder } from "@/components/phase-placeholder";

export const metadata: Metadata = { title: "Practice session" };
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhasePlaceholder phase={2} title="Practice session" description="Domain-targeted questions will help you work on your weakest areas. Free accounts will get 5 questions per week. No practice session is running in this preview."
    primary={{ href: `/practice/${encodeURIComponent(id)}/summary`, label: "Preview session summary" }} links={[{ href: "/dashboard", label: "Back to dashboard preview" }]} />;
}
