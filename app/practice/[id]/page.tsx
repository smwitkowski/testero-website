import type { Metadata } from "next";
import { PracticeSession } from "@/components/practice-session";
import { requireUser } from "@/lib/auth/require-user";

import { readPractice } from "@/lib/practice/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Practice session" };
export const dynamic = "force-dynamic";
export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/practice/${encodeURIComponent(id)}`);
  const initialData = await readPractice(createServiceSupabaseClient(), id, user.id).catch(() => null);
  return <PracticeSession key={id} sessionId={id} initialData={initialData} />;
}
