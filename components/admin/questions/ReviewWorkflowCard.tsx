"use client";

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
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import type { AdminQuestionReviewStatus } from "@/lib/admin/questions/filter-utils";

export function ReviewNotesCard() {
  const form = useFormContext();
  const reviewStatus = form.watch("review_status") as AdminQuestionReviewStatus;
  const needsFix = reviewStatus === "NEEDS_ANSWER_FIX" || reviewStatus === "NEEDS_EXPLANATION_FIX";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="review_notes"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Add notes about issues found or changes made during review..."
                  rows={4}
                  className="resize-none"
                />
              </FormControl>
              <FormDescription>
                {needsFix ? (
                  <span className="text-warn-foreground">Required if &apos;Needs Fix&apos; is selected</span>
                ) : (
                  "Optional notes about issues found or changes made during review."
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
