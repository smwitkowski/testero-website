const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const MAX_PAGE = 10_000;

const ALLOWED_STATUSES = ["ACTIVE", "DRAFT", "RETIRED"] as const;
const ALLOWED_REVIEW_STATUSES = [
  "UNREVIEWED",
  "GOOD",
  "NEEDS_ANSWER_FIX",
  "NEEDS_EXPLANATION_FIX",
  "RETIRED",
] as const;

const SEARCH_PARAM_KEYS = {
  search: "q",
  domain: "domain",
  status: "status",
  reviewStatus: "reviewStatus",
  page: "page",
  pageSize: "pageSize",
} as const;

type AdminQuestionStatus = (typeof ALLOWED_STATUSES)[number];
type AdminQuestionReviewStatus = (typeof ALLOWED_REVIEW_STATUSES)[number];

interface AdminQuestionFilters {
  search: string;
  domain: string | null;
  status: AdminQuestionStatus | null;
  reviewStatuses: AdminQuestionReviewStatus[];
  page: number;
  pageSize: number;
}

type QuickFilterKey = "unreviewed" | "needs_attention" | "active_good" | null;

type RawParamValue = string | string[] | undefined;
type RawParams = Record<string, RawParamValue>;

const NEEDS_ATTENTION_SET = new Set<AdminQuestionReviewStatus>([
  "NEEDS_ANSWER_FIX",
  "NEEDS_EXPLANATION_FIX",
]);

function parseAdminQuestionFilters(params: RawParams): AdminQuestionFilters {
  const search = sanitizeSearchQuery(
    getFirst(params[SEARCH_PARAM_KEYS.search]) ?? ""
  );
  const domain = normalizeDomain(getFirst(params[SEARCH_PARAM_KEYS.domain]));
  const status = normalizeStatus(getFirst(params[SEARCH_PARAM_KEYS.status]));
  const reviewStatuses = normalizeReviewStatuses(
    toArray(params[SEARCH_PARAM_KEYS.reviewStatus])
  );
  const page = normalizePage(getFirst(params[SEARCH_PARAM_KEYS.page]));
  const pageSize = normalizePageSize(getFirst(params[SEARCH_PARAM_KEYS.pageSize]));

  return {
    search,
    domain,
    status,
    reviewStatuses,
    page,
    pageSize,
  };
}

function deriveQuickFilterKey(filters: AdminQuestionFilters): QuickFilterKey {
  const { status, reviewStatuses } = filters;
  if (reviewStatuses.length === 1 && reviewStatuses[0] === "UNREVIEWED") {
    return "unreviewed";
  }

  if (
    reviewStatuses.length === NEEDS_ATTENTION_SET.size &&
    reviewStatuses.every((value) => NEEDS_ATTENTION_SET.has(value)) &&
    NEEDS_ATTENTION_SET.size === new Set(reviewStatuses).size
  ) {
    return "needs_attention";
  }

  if (status === "ACTIVE" && reviewStatuses.length === 1 && reviewStatuses[0] === "GOOD") {
    return "active_good";
  }

  return null;
}

function sanitizeSearchQuery(value: string): string {
  if (!value) {
    return "";
  }

  return value.trim();
}

function getFirst(value: RawParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function toArray(value: RawParamValue): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function normalizeDomain(value?: string): string | null {
  if (!value) return null;
  return value.trim().toUpperCase() || null;
}

function normalizeStatus(value?: string): AdminQuestionStatus | null {
  if (!value) return null;
  const upper = value.toUpperCase() as AdminQuestionStatus;
  return (ALLOWED_STATUSES as readonly string[]).includes(upper) ? upper : null;
}

function normalizeReviewStatuses(values: string[]): AdminQuestionReviewStatus[] {
  const unique = new Set<AdminQuestionReviewStatus>();
  for (const value of values) {
    const upper = value.toUpperCase() as AdminQuestionReviewStatus;
    if ((ALLOWED_REVIEW_STATUSES as readonly string[]).includes(upper)) {
      unique.add(upper);
    }
  }
  return Array.from(unique);
}

function normalizePage(value?: string): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), MAX_PAGE);
}

function normalizePageSize(value?: string): number {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }

  const allowed = PAGE_SIZE_OPTIONS.find((option) => option === parsed);
  return allowed ?? PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1];
}

export {
  ALLOWED_REVIEW_STATUSES,
  ALLOWED_STATUSES,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE,
  PAGE_SIZE_OPTIONS,
  SEARCH_PARAM_KEYS,
  deriveQuickFilterKey,
  parseAdminQuestionFilters,
  sanitizeSearchQuery,
};
export type {
  AdminQuestionFilters,
  AdminQuestionReviewStatus,
  AdminQuestionStatus,
  QuickFilterKey,
};
