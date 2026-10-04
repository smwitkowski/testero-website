import type { Metadata } from "next";
import { PracticeSession } from "@/components/practice-session";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Practice session" };
export const dynamic = "force-dynamic";
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/practice/${encodeURIComponent(id)}`);
  return <PracticeSession key={id} sessionId={id} />;
}
