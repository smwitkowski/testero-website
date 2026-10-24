import type { Metadata } from "next";
import { PracticeSession } from "@/components/practice-session";
import { requireUser } from "@/lib/auth/require-user";

import { readPractice } from "@/lib/practice/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Practice session" };
export const dynamic = "force-dynamic";
export default async function PracticePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ focus?: string }> }) {
  const { id } = await params;
  const { focus } = await searchParams;
  const user = await requireUser(`/practice/${encodeURIComponent(id)}`);
  const initialData = await readPractice(createServiceSupabaseClient(), id, user.id).catch(() => null);
  return <>{focus && <p role="status" className="mx-auto mb-6 max-w-[760px] rounded-md border border-border bg-muted p-4">{focus.slice(0, 500)}</p>}<PracticeSession key={id} sessionId={id} initialData={initialData} /></>;
}
