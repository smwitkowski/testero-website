"use client";

import { useFormContext, useFieldArray } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ExplanationCard() {
  const form = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "doc_links",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Explanation</CardTitle>
        <FormDescription>
          This is what paying users see to learn from the question. Be explicit about why the correct option is correct and why the others are not.
        </FormDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="explanation_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Explanation text</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Explain why the correct answer is correct and why the others are not..."
                  rows={8}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Supporting docs</FormLabel>
          <FormDescription>
            Link to relevant official GCP docs, blog posts, or whitepapers that support this answer.
          </FormDescription>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <FormField
                key={field.id}
                control={form.control}
                name={`doc_links.${index}`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          {...field}
                          type="url"
                          placeholder="https://example.com/doc"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append("")}
            >
              + Add doc link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
