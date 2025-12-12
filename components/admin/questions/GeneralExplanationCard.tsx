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

export function GeneralExplanationCard() {
  const form = useFormContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Explanation</CardTitle>
        <FormDescription>
          Explain why the correct answer is right and why distractors are wrong.
        </FormDescription>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="explanation_text"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value || ""}
                  placeholder="Provide a comprehensive explanation that covers why the correct answer is correct and why each distractor is incorrect..."
                  rows={6}
                  className="resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}

