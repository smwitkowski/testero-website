"use client";

import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, Edit } from "lucide-react";
import type { AdminQuestionReviewStatus } from "@/lib/admin/questions/filter-utils";
import type { ReviewQueueMetadata } from "@/lib/admin/questions/editor-query";

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

interface DecisionMatrixCardProps {
  previousQuestionId?: string | null;
  nextQuestionId?: string | null;
  queueMetadata?: ReviewQueueMetadata;
  viewMode?: "review" | "edit";
  onViewModeChange?: (mode: "review" | "edit") => void;
  onMarkGoodAndNext?: () => Promise<void>;
  onMarkBadAndNext?: () => Promise<void>;
  onSaveAndNext?: () => Promise<void>;
  isSaving?: boolean;
}

export function DecisionMatrixCard({
  previousQuestionId,
  nextQuestionId,
  queueMetadata,
  viewMode = "review",
  onViewModeChange,
  onMarkGoodAndNext,
  onMarkBadAndNext,
  onSaveAndNext,
  isSaving = false,
}: DecisionMatrixCardProps) {
  const router = useRouter();
  const form = useFormContext();
  const reviewStatus = form.watch("review_status") as AdminQuestionReviewStatus;

  const handlePrevious = () => {
    if (previousQuestionId) {
      router.push(`/admin/questions/${previousQuestionId}`);
    }
  };

  const handleNext = () => {
    if (nextQuestionId) {
      router.push(`/admin/questions/${nextQuestionId}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Decision Matrix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {queueMetadata && queueMetadata.total > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
            <div className="text-xs text-muted-foreground">Review Queue</div>
            <div className="text-lg font-semibold text-foreground">
              {queueMetadata.position} of {queueMetadata.total}
            </div>
          </div>
        )}
        {onViewModeChange && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant={viewMode === "review" ? "solid" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onViewModeChange("review")}
              icon={<Eye className="h-4 w-4" />}
            >
              Review
            </Button>
            <Button
              type="button"
              variant={viewMode === "edit" ? "solid" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => onViewModeChange("edit")}
              icon={<Edit className="h-4 w-4" />}
            >
              Edit
            </Button>
          </div>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Current Status:</div>
          <Badge
            tone={REVIEW_STATUS_TONES[reviewStatus]}
            variant="soft"
            size="sm"
            className="text-sm"
          >
            {REVIEW_STATUS_LABELS[reviewStatus]}
          </Badge>
        </div>

        <div className="flex flex-col gap-2">
          {onMarkGoodAndNext && (
            <Button
              type="button"
              onClick={onMarkGoodAndNext}
              className="w-full"
              variant="outline"
              tone="success"
              loading={isSaving}
              disabled={!nextQuestionId || isSaving}
            >
              Mark Good & Next
            </Button>
          )}
          {onMarkBadAndNext && (
            <Button
              type="button"
              onClick={onMarkBadAndNext}
              className="w-full"
              variant="outline"
              tone="warn"
              loading={isSaving}
              disabled={!nextQuestionId || isSaving}
            >
              Mark Bad & Next
            </Button>
          )}
          {onSaveAndNext && (
            <Button
              type="button"
              onClick={onSaveAndNext}
              className="w-full"
              variant="outline"
              tone="accent"
              loading={isSaving}
              disabled={!nextQuestionId || isSaving}
            >
              Save & Next
            </Button>
          )}
          <FormField
            control={form.control}
            name="review_status"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Status Dropdown" />
                      <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="UNREVIEWED">Unreviewed</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="NEEDS_ANSWER_FIX">Needs answer fix</SelectItem>
                    <SelectItem value="NEEDS_EXPLANATION_FIX">Needs explanation fix</SelectItem>
                    <SelectItem value="RETIRED">Retired</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={!previousQuestionId}
              icon={<ChevronLeft className="h-4 w-4" />}
              className="flex-1"
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSaveAndNext}
              disabled={!nextQuestionId || isSaving}
              loading={isSaving}
              className="flex-1"
            >
              Save & Next
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!nextQuestionId}
              iconRight={<ChevronRight className="h-4 w-4" />}
              className="flex-1"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
