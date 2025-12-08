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
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Code } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionStemCardProps {
  questionId: string;
}

export function QuestionStemCard({ questionId }: QuestionStemCardProps) {
  const form = useFormContext();
  const stemValue = form.watch("stem") || "";

  const handleFormat = (format: "bold" | "italic" | "code") => {
    const textarea = document.querySelector('textarea[name="stem"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = stemValue.substring(start, end);
    const before = stemValue.substring(0, start);
    const after = stemValue.substring(end);

    let formattedText = "";
    switch (format) {
      case "bold":
        formattedText = `${before}**${selectedText}**${after}`;
        break;
      case "italic":
        formattedText = `${before}*${selectedText}*${after}`;
        break;
      case "code":
        formattedText = `${before}\`${selectedText}\`${after}`;
        break;
    }

    form.setValue("stem", formattedText, { shouldDirty: true });
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + (format === "bold" ? 2 : format === "code" ? 1 : 1);
      textarea.setSelectionRange(newPosition, newPosition + selectedText.length);
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question ID: #{questionId.slice(0, 8)}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormField
          control={form.control}
          name="stem"
          render={({ field }) => (
            <FormItem>
              <div className="space-y-2">
                <div className="flex items-center gap-1 border border-border rounded-md p-1 w-fit">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleFormat("bold")}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleFormat("italic")}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleFormat("code")}
                    title="Code"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Write a clear, scenario-based question stem. Avoid trivia; focus on PMLE-style decisions."
                    rows={6}
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
