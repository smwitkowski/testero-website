import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { AdminQuestionsView } from "@/components/admin/questions/AdminQuestionsView";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { isAdmin } from "@/lib/auth/isAdmin";
import { parseAdminQuestionFilters } from "@/lib/admin/questions/filter-utils";
import { fetchAdminQuestionStats, fetchAdminQuestions } from "@/lib/admin/questions/query";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminQuestionsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminQuestionsPage({ searchParams }: AdminQuestionsPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user))) {
    redirect("/admin/forbidden");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filters = parseAdminQuestionFilters(resolvedSearchParams);
  const [listResult, stats] = await Promise.all([
    fetchAdminQuestions(supabase, filters),
    fetchAdminQuestionStats(supabase),
  ]);

  const domainOptions = PMLE_BLUEPRINT.map((domain) => ({
    code: domain.domainCode,
    name: domain.displayName,
  }));

  return (
    <AppShell>
      <AdminQuestionsView
        filters={filters}
        list={listResult}
        stats={stats}
        domainOptions={domainOptions}
      />
    </AppShell>
  );
}
