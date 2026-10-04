import type { Metadata } from "next";
import { PracticeSummary } from "@/components/practice-summary";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Practice summary" };
export const dynamic = "force-dynamic";
export default async function PracticeSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/practice/${encodeURIComponent(id)}/summary`);
  return <PracticeSummary key={id} sessionId={id} />;
}
