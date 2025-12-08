import { redirect, notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { QuestionEditor } from "@/components/admin/questions/QuestionEditor";
import { isAdmin } from "@/lib/auth/isAdmin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  fetchQuestionForEditor,
  fetchDomainOptions,
  fetchAdjacentQuestionIds,
} from "@/lib/admin/questions/editor-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminQuestionDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminQuestionDetailPage({
  params,
}: AdminQuestionDetailPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(user))) {
    redirect("/admin/forbidden");
  }

  const resolvedParams = await params;
  const questionId = resolvedParams.id;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(questionId)) {
    notFound();
  }

  try {
    const [question, domains, adjacentIds] = await Promise.all([
      fetchQuestionForEditor(supabase, questionId),
      fetchDomainOptions(supabase),
      fetchQuestionForEditor(supabase, questionId).then((q) =>
        q ? fetchAdjacentQuestionIds(supabase, questionId, q.exam) : { previousId: null, nextId: null }
      ),
    ]);

    if (!question) {
      notFound();
    }

    return (
      <AppShell>
        <QuestionEditor
          question={question}
          domainOptions={domains}
          previousQuestionId={adjacentIds.previousId}
          nextQuestionId={adjacentIds.nextId}
        />
      </AppShell>
    );
  } catch (error) {
    console.error("[AdminQuestionDetail] Error loading question:", error);
    throw error;
  }
}
