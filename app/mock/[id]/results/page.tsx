import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { MockResults } from "@/components/mock-results";
export const metadata: Metadata = { title: "PMLE mock results", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function MockResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/mock/${encodeURIComponent(id)}/results`);
  return <MockResults sessionId={id} />;
}
