import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AdminQuestionFilters,
  AdminQuestionReviewStatus,
  AdminQuestionStatus,
} from "./filter-utils";

export interface AdminQuestionListItem {
  id: string;
  stem: string;
  domainCode: string | null;
  domainName: string | null;
  difficulty: AdminQuestionDifficulty | null;
  status: AdminQuestionStatus | null;
  reviewStatus: AdminQuestionReviewStatus;
  updatedAt: string;
  sourceRef: string | null;
  hasExplanation: boolean;
}

export interface AdminQuestionListResult {
  items: AdminQuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminQuestionStats {
  totalExamCount: number;
  reviewedGoodCount: number;
}

type AdminQuestionDifficulty = "EASY" | "MEDIUM" | "HARD";

const CANONICAL_EXAM_ID = "GCP_PM_ML_ENG";
const SEARCHABLE_COLUMNS = ["stem", "explanations.explanation_text"] as const;

interface QuestionRow {
  id: string;
  stem: string;
  difficulty: AdminQuestionDifficulty | null;
  status: AdminQuestionStatus | null;
  review_status: AdminQuestionReviewStatus;
  updated_at: string;
  source_ref: string | null;
  exam_domains: {
    id: string;
    code: string;
    name: string;
  } | null;
  explanations: Array<{ explanation_text: string }> | null;
}

export async function fetchAdminQuestions(
  supabase: SupabaseClient,
  filters: AdminQuestionFilters
): Promise<AdminQuestionListResult> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let query = supabase
    .from("questions")
    .select(
      `
        id,
        stem,
        difficulty,
        status,
        review_status,
        updated_at,
        source_ref,
        exam_domains!inner(id, code, name),
        explanations(explanation_text)
      `,
      { count: "exact" }
    )
    .eq("exam", CANONICAL_EXAM_ID)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.domain) {
    query = query.eq("exam_domains.code", filters.domain);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.reviewStatuses.length > 0) {
    query = query.in("review_status", filters.reviewStatuses);
  }

  if (filters.search) {
    const escaped = escapeForIlike(filters.search);
    const pattern = `*${escaped}*`;
    const orClause = SEARCHABLE_COLUMNS.map((column) => `${column}.ilike.${pattern}`).join(",");
    query = query.or(orClause);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Failed to load admin questions: ${error.message}`);
  }

  const rows: QuestionRow[] = ((data ?? []) as unknown) as QuestionRow[];
  const items: AdminQuestionListItem[] = rows.map((row) => ({
    id: row.id,
    stem: row.stem,
    domainCode: row.exam_domains?.code ?? null,
    domainName: row.exam_domains?.name ?? null,
    difficulty: row.difficulty,
    status: row.status,
    reviewStatus: row.review_status,
    updatedAt: row.updated_at,
    sourceRef: row.source_ref,
    hasExplanation: Boolean(row.explanations?.length),
  }));

  return {
    items,
    total: count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function fetchAdminQuestionStats(
  supabase: SupabaseClient
): Promise<AdminQuestionStats> {
  const [totalResult, reviewedResult] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("exam", CANONICAL_EXAM_ID),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("exam", CANONICAL_EXAM_ID)
      .eq("review_status", "GOOD"),
  ]);

  if (totalResult.error) {
    throw new Error(`Failed to fetch total question count: ${totalResult.error.message}`);
  }

  if (reviewedResult.error) {
    throw new Error(
      `Failed to fetch reviewed question count: ${reviewedResult.error.message}`
    );
  }

  return {
    totalExamCount: totalResult.count ?? 0,
    reviewedGoodCount: reviewedResult.count ?? 0,
  };
}

function escapeForIlike(term: string): string {
  return term.replace(/[%_*]/g, "");
}

export { CANONICAL_EXAM_ID };
export type { AdminQuestionDifficulty };
