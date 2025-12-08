"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, Search, ChevronDown, Loader2, MoreHorizontal, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Toast, useToastQueue } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  AdminQuestionFilters,
  AdminQuestionReviewStatus,
  AdminQuestionStatus,
  PAGE_SIZE_OPTIONS,
  SEARCH_PARAM_KEYS,
  deriveQuickFilterKey,
  type QuickFilterKey,
} from "@/lib/admin/questions/filter-utils";
import {
  type AdminQuestionListItem,
  type AdminQuestionListResult,
  type AdminQuestionStats,
} from "@/lib/admin/questions/query";

interface DomainOption {
  code: string;
  name: string;
}

interface AdminQuestionsViewProps {
  filters: AdminQuestionFilters;
  list: AdminQuestionListResult;
  stats: AdminQuestionStats;
  domainOptions: DomainOption[];
}

type FilterUpdates = {
  search?: string | null;
  domain?: string | null;
  status?: AdminQuestionStatus | null;
  reviewStatuses?: AdminQuestionReviewStatus[] | null;
  page?: number | null;
  pageSize?: number | null;
};

type ButtonTone = NonNullable<ComponentProps<typeof Button>["tone"]>;
type BulkReviewAction =
  | "review:GOOD"
  | "review:NEEDS_ANSWER_FIX"
  | "review:NEEDS_EXPLANATION_FIX"
  | "review:RETIRED";
type BulkStatusAction = "status:ACTIVE" | "status:DRAFT" | "status:RETIRED";

const REVIEW_STATUS_LABELS: Record<AdminQuestionReviewStatus, string> = {
  UNREVIEWED: "Unreviewed",
  GOOD: "Good",
  NEEDS_ANSWER_FIX: "Needs answer fix",
  NEEDS_EXPLANATION_FIX: "Needs explanation fix",
  RETIRED: "Retired",
};

const REVIEW_STATUS_TONES: Record<AdminQuestionReviewStatus, "neutral" | "success" | "warning" | "danger"> = {
  UNREVIEWED: "neutral",
  GOOD: "success",
  NEEDS_ANSWER_FIX: "warning",
  NEEDS_EXPLANATION_FIX: "warning",
  RETIRED: "danger",
};

const QUESTION_STATUS_TONES: Record<NonNullable<AdminQuestionStatus>, "success" | "neutral" | "danger"> = {
  ACTIVE: "success",
  DRAFT: "neutral",
  RETIRED: "danger",
};

const DIFFICULTY_TONES: Record<
  Exclude<AdminQuestionListItem["difficulty"], null>,
  "success" | "warning" | "danger"
> = {
  EASY: "success",
  MEDIUM: "warning",
  HARD: "danger",
};

const BULK_REVIEW_ACTIONS: ReadonlyArray<{ label: string; action: BulkReviewAction }> = [
  { label: "Mark Good", action: "review:GOOD" },
  { label: "Needs answer fix", action: "review:NEEDS_ANSWER_FIX" },
  { label: "Needs explanation fix", action: "review:NEEDS_EXPLANATION_FIX" },
  { label: "Mark Retired", action: "review:RETIRED" },
];

const BULK_STATUS_ACTIONS: ReadonlyArray<{
  label: string;
  action: BulkStatusAction;
  tone?: ButtonTone;
}> = [
  { label: "Set Active", action: "status:ACTIVE" },
  { label: "Set Draft", action: "status:DRAFT" },
  { label: "Set Retired", action: "status:RETIRED", tone: "danger" },
];

export function AdminQuestionsView({ filters, list, stats, domainOptions }: AdminQuestionsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const { toasts, addToast, dismissToast } = useToastQueue();

  const updateFilters = useCallback(
    (updates: FilterUpdates) => {
      const current = new URLSearchParams(searchParams?.toString() ?? "");

      const setParam = (key: string, value?: string | null) => {
        if (!value) {
          current.delete(key);
        } else {
          current.set(key, value);
        }
      };

      if ("search" in updates) {
        setParam(SEARCH_PARAM_KEYS.search, updates.search ?? null);
      }

      if ("domain" in updates) {
        setParam(SEARCH_PARAM_KEYS.domain, updates.domain ?? null);
      }

      if ("status" in updates) {
        setParam(SEARCH_PARAM_KEYS.status, updates.status ?? null);
      }

      if ("reviewStatuses" in updates) {
        current.delete(SEARCH_PARAM_KEYS.reviewStatus);
        const values = updates.reviewStatuses;
        if (values && values.length > 0) {
          values.forEach((value) => current.append(SEARCH_PARAM_KEYS.reviewStatus, value));
        }
      }

      if ("pageSize" in updates) {
        setParam(
          SEARCH_PARAM_KEYS.pageSize,
          updates.pageSize ? String(updates.pageSize) : null
        );
      }

      if ("page" in updates) {
        if (updates.page) {
          setParam(SEARCH_PARAM_KEYS.page, String(updates.page));
        } else {
          current.delete(SEARCH_PARAM_KEYS.page);
        }
      }

      startTransition(() => {
        const query = current.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams, startTransition]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected = list.items.length > 0 && selectedIds.length === list.items.length;
  const pageStart = list.items.length === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const pageEnd = list.items.length === 0 ? 0 : pageStart + list.items.length - 1;
  const totalPages = Math.max(1, Math.ceil((list.total || 0) / list.pageSize));
  const quickFilter = deriveQuickFilterKey(filters);
  const reviewedPercent =
    stats.totalExamCount > 0 ? Math.round((stats.reviewedGoodCount / stats.totalExamCount) * 100) : 0;

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    // Clear selection when the underlying list changes.
    setSelectedIds([]);
  }, [list.items]);

  useEffect(() => {
    if (searchDraft === filters.search) {
      return;
    }

    const timeout = setTimeout(() => {
      updateFilters({ search: searchDraft || null });
    }, 400);

    return () => clearTimeout(timeout);
  }, [searchDraft, filters.search, updateFilters]);

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? list.items.map((item) => item.id) : []);
    },
    [list.items]
  );

  const handleToggleRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(id)) {
          return prev;
        }
        return [...prev, id];
      }
      return prev.filter((existingId) => existingId !== id);
    });
  }, []);

  const applyQuickFilter = useCallback(
    (key: QuickFilterKey | null) => {
      if (key === quickFilter) {
        updateFilters({ reviewStatuses: null, status: null });
        return;
      }

      if (key === "unreviewed") {
        updateFilters({ reviewStatuses: ["UNREVIEWED"], status: null });
        return;
      }

      if (key === "needs_attention") {
        updateFilters({
          reviewStatuses: ["NEEDS_ANSWER_FIX", "NEEDS_EXPLANATION_FIX"],
          status: null,
        });
        return;
      }

      if (key === "active_good") {
        updateFilters({ reviewStatuses: ["GOOD"], status: "ACTIVE" });
      }
    },
    [quickFilter, updateFilters]
  );

  const handleBulkAction = useCallback(
    async (action: BulkReviewAction | BulkStatusAction) => {
      if (selectedIds.length === 0) {
        return;
      }
      setIsBulkUpdating(true);
      try {
        const response = await fetch("/api/admin/questions/bulk-update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: selectedIds, action }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || "Unknown error");
        }

        addToast({
          title: "Bulk update scheduled",
          description: `Updated ${selectedIds.length} question${selectedIds.length === 1 ? "" : "s"}.`,
          tone: "success",
        });
        setSelectedIds([]);
        router.refresh();
      } catch (error) {
        console.error("Bulk update failed", error);
        addToast({
          title: "Bulk update failed",
          description: error instanceof Error ? error.message : "Try again later.",
          tone: "danger",
        });
      } finally {
        setIsBulkUpdating(false);
      }
    },
    [addToast, router, selectedIds]
  );

  const handlePageChange = useCallback(
    (direction: "prev" | "next") => {
      const nextPage = direction === "prev" ? filters.page - 1 : filters.page + 1;
      if (nextPage < 1 || nextPage > totalPages) {
        return;
      }
      updateFilters({ page: nextPage });
    },
    [filters.page, totalPages, updateFilters]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      updateFilters({ pageSize: size, page: 1 });
    },
    [updateFilters]
  );

  const activeFilterBadges = useMemo(() => {
    const badges: Array<{ label: string; value: string }> = [];
    if (filters.domain) {
      const domain = domainOptions.find((d) => d.code === filters.domain);
      badges.push({
        label: "Domain",
        value: domain ? domain.name : filters.domain,
      });
    }
    if (filters.status) {
      badges.push({ label: "Status", value: filters.status });
    }
    if (filters.reviewStatuses.length > 0) {
      badges.push({
        label: "Review",
        value: filters.reviewStatuses.map((status) => REVIEW_STATUS_LABELS[status]).join(", "),
      });
    }
    if (filters.search) {
      badges.push({ label: "Search", value: filters.search });
    }
    return badges;
  }, [domainOptions, filters.domain, filters.reviewStatuses, filters.search, filters.status]);

  return (
    <div className="space-y-6 pb-24">
      {/* Progress Pulse Section */}
      <section className="space-y-3 rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Progress Pulse</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
            <span>Review Progress: {reviewedPercent}%</span>
          </div>
          <Progress value={reviewedPercent} className="h-3 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="px-3 py-1">
            Total: {stats.totalExamCount}
          </Badge>
          <Badge tone="success" variant="soft" className="px-3 py-1">
            Good: {stats.reviewedGoodCount}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Unreviewed: {stats.unreviewedCount}
          </Badge>
          <Badge variant="outline" className="px-3 py-1">
            Needs Fix: {stats.needsFixCount}
          </Badge>
        </div>
      </section>

      <div className="sticky top-4 z-30 space-y-3 rounded-3xl border border-border/70 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={searchDraft} onChange={setSearchDraft} isLoading={isPending} />
            <FiltersDropdown
              label="Domain"
              icon={<Filter className="h-4 w-4" />}
              value={filters.domain ?? ""}
              onChange={(value) => updateFilters({ domain: value || null })}
              options={domainOptions.map((option) => ({
                label: option.name,
                value: option.code,
              }))}
              placeholder="All domains"
            />
            <FiltersDropdown
              label="Status"
              icon={<Filter className="h-4 w-4" />}
              value={filters.status ?? ""}
              onChange={(value) => updateFilters({ status: (value as AdminQuestionStatus) || null })}
              options={[
                { label: "Active", value: "ACTIVE" },
                { label: "Draft", value: "DRAFT" },
                { label: "Retired", value: "RETIRED" },
              ]}
              placeholder="All statuses"
            />
            <ReviewStatusMultiSelect
              selected={filters.reviewStatuses}
              onChange={(next) => updateFilters({ reviewStatuses: next })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <QuickFilterPill
              label="Unreviewed"
              active={quickFilter === "unreviewed"}
              onClick={() => applyQuickFilter("unreviewed")}
            />
            <QuickFilterPill
              label="Needs attention"
              active={quickFilter === "needs_attention"}
              onClick={() => applyQuickFilter("needs_attention")}
            />
            <QuickFilterPill
              label="Active & Good"
              active={quickFilter === "active_good"}
              onClick={() => applyQuickFilter("active_good")}
            />
            <Button asChild size="sm">
              <Link href="/admin/questions/new">+ New Question</Link>
            </Button>
          </div>
        </div>
        {activeFilterBadges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/90">Active filters:</span>
            {activeFilterBadges.map((badge) => (
              <Badge key={`${badge.label}-${badge.value}`} tone="neutral" variant="soft" size="sm">
                <span className="font-medium">{badge.label}:</span>&nbsp;{badge.value}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>


      <section className="space-y-4 rounded-3xl border border-border/70 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {list.total === 0 ? 0 : `${pageStart}-${pageEnd}`}
              </span>{" "}
              of <span className="font-semibold text-foreground">{stats.totalExamCount}</span> PMLE
              questions
            </p>
            <p className="text-xs text-muted-foreground">
              {list.total} match current filters
            </p>
          </div>
          <PaginationControls
            page={filters.page}
            totalPages={totalPages}
            pageSize={list.pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/70">
          <table className="min-w-full divide-y divide-border/70">
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase text-muted-foreground">
              <tr>
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
                    aria-label="Select all questions on this page"
                  />
                </th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Question Snippet</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 bg-white text-sm">
              {list.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                    No questions match your filters yet.
                  </td>
                </tr>
              ) : (
                list.items.map((question) => {
                  const selected = selectedSet.has(question.id);
                  return (
                    <tr
                      key={question.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/40",
                        selected && "bg-accent/5"
                      )}
                      onClick={() => router.push(`/admin/questions/${question.id}`)}
                    >
                      <td className="px-4 py-3 align-top">
                        <Checkbox
                          checked={selected}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={(checked) =>
                            handleToggleRow(question.id, Boolean(checked))
                          }
                          aria-label={`Select question ${question.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 align-top text-sm font-mono text-muted-foreground">
                        #{truncateId(question.id)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="line-clamp-2 font-medium text-foreground">{question.stem}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {question.domainName ? (
                          <Badge tone="neutral" size="sm">
                            {question.domainName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Badge
                          tone={REVIEW_STATUS_TONES[question.reviewStatus]}
                          variant="soft"
                          size="sm"
                        >
                          {REVIEW_STATUS_LABELS[question.reviewStatus]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {question.status ? (
                          <Badge
                            tone={QUESTION_STATUS_TONES[question.status]}
                            variant="soft"
                            size="sm"
                          >
                            {question.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-muted-foreground">
                        {formatDate(question.updatedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          page={filters.page}
          totalPages={totalPages}
          pageSize={list.pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          wrap
        />
      </section>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center gap-4">
            <span className="text-sm text-muted-foreground">floating</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isBulkUpdating}>
                  Set Status to... <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {BULK_STATUS_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.action}
                    onClick={() => handleBulkAction(action.action)}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isBulkUpdating}>
                  Set Visibility to... <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleBulkAction("status:ACTIVE")}
                >
                  Visible
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkAction("status:DRAFT")}
                >
                  Hidden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={isBulkUpdating}>
                  Assign Domain <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {domainOptions.map((domain) => (
                  <DropdownMenuItem
                    key={domain.code}
                    onClick={() => {
                      // TODO: Implement domain assignment bulk action
                      addToast({
                        title: "Domain assignment",
                        description: `Assigning ${selectedIds.length} questions to ${domain.name}...`,
                        tone: "success",
                      });
                    }}
                  >
                    {domain.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="ml-auto text-sm font-medium text-foreground">
              {selectedIds.length} question{selectedIds.length === 1 ? "" : "s"} selected
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              disabled={isBulkUpdating}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={() => toast.id && dismissToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search Keywords (Stem/Explanation)..."
        className="w-72 pl-9"
      />
      {isLoading ? (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  );
}

function FiltersDropdown({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
}) {
  const activeLabel = value ? options.find((option) => option.value === value)?.label : placeholder;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          tone="neutral"
          className="inline-flex items-center gap-2 border-dashed"
        >
          {icon}
          <span className="text-sm font-medium">{label}:</span>
          <span className="text-sm text-foreground">{activeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ReviewStatusMultiSelect({
  selected,
  onChange,
}: {
  selected: AdminQuestionReviewStatus[];
  onChange: (statuses: AdminQuestionReviewStatus[]) => void;
}) {
  const toggle = (status: AdminQuestionReviewStatus) => {
    if (selected.includes(status)) {
      onChange(selected.filter((value) => value !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" tone="neutral" className="border-dashed">
          Review status
          <Badge variant="soft" tone="neutral" size="sm">
            {selected.length > 0 ? `${selected.length} selected` : "All"}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Review status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {Object.entries(REVIEW_STATUS_LABELS).map(([status, label]) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selected.includes(status as AdminQuestionReviewStatus)}
            onCheckedChange={() => toggle(status as AdminQuestionReviewStatus)}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange([])}>Clear selection</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickFilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "solid" : "outline"}
      tone={active ? "accent" : "neutral"}
      size="sm"
      className="rounded-full"
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}


function PaginationControls({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  wrap = false,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (direction: "prev" | "next") => void;
  onPageSizeChange: (size: number) => void;
  wrap?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-sm",
        wrap ? "flex-wrap justify-between" : "flex-nowrap justify-end"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows per page:</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" tone="neutral" size="sm" className="w-16 justify-between">
              {pageSize}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option} value={String(option)}>
                  {option}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        Page{" "}
        <span className="min-w-[2ch] text-center font-medium text-foreground">{page}</span>
        <span>/ {totalPages}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange("prev")}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          tone="neutral"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange("next")}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function truncateId(id: string) {
  if (id.length <= 8) {
    return id;
  }
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatDate(date: string): string {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) {
    return "—";
  }
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}
