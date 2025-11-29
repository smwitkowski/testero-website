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
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ReviewWorkflowCardProps {
  onMarkGoodAndActive?: () => void;
  onMarkRetired?: () => void;
}

export function ReviewWorkflowCard({
  onMarkGoodAndActive,
  onMarkRetired,
}: ReviewWorkflowCardProps) {
  const form = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review status</CardTitle>
        <p className="text-sm text-muted-foreground">
          Use this to track where you are in the audit workflow. Only "Good + Active" questions are shown to learners.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="review_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Review status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select review status" />
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

        <FormField
          control={form.control}
          name="review_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Review notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="e.g., check BigQuery docs for latest syntax; confusion between online vs batch serving."
                  rows={4}
                />
              </FormControl>
              <FormDescription>
                Add notes about issues found or changes made during review.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-2 pt-2">
          {onMarkGoodAndActive && (
            <Button
              type="button"
              variant="outline"
              onClick={onMarkGoodAndActive}
              className="w-full"
            >
              Mark as Good & Active
            </Button>
          )}
          {onMarkRetired && (
            <Button
              type="button"
              variant="outline"
              tone="danger"
              onClick={onMarkRetired}
              className="w-full"
            >
              Mark as Retired
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
