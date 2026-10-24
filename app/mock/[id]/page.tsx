import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/require-user";
import { MockSession } from "@/components/mock-session";
export const metadata: Metadata = { title: "PMLE mock exam", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function MockSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/mock/${encodeURIComponent(id)}`);
  return <MockSession sessionId={id} />;
}
