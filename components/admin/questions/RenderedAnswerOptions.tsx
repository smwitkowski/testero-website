"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuestionAnswer } from "@/lib/admin/questions/editor-types";

/**
 * Simple markdown renderer for answer text
 * Processes in order to avoid conflicts (code blocks first, then inline code, then formatting)
 */
function renderMarkdown(text: string): string {
  if (!text) return "";

  // Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Store code blocks with placeholders
  const codeBlocks: string[] = [];
  html = html.replace(/```([^`]+)```/g, (match, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="bg-muted p-2 rounded text-sm overflow-x-auto my-2"><code>${code}</code></pre>`);
    return placeholder;
  });

  // Process inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

  // Process bold (**text**) first
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Process italic (*text*) - this won't match **text** since bold was already processed
  html = html.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>');

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

export function RenderedAnswerOptions() {
  const form = useFormContext();
  const answers = useWatch({ control: form.control, name: "answers" }) || [];

  const correctAnswer = answers.find((a: QuestionAnswer) => a.is_correct);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Answer Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {["A", "B", "C", "D"].map((label) => {
          const answer = answers.find(
            (a: QuestionAnswer) => a.choice_label === label
          ) as QuestionAnswer | undefined;
          const isCorrect = answer?.is_correct || false;
          const hasText = answer?.choice_text?.trim() || false;

          if (!hasText) {
            return (
              <div
                key={label}
                className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground"
              >
                Option {label} (empty)
              </div>
            );
          }

          return (
            <div
              key={label}
              className={`rounded-lg border-2 p-4 transition-colors ${
                isCorrect
                  ? "border-success bg-success/5"
                  : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold ${
                    isCorrect
                      ? "bg-success text-success-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="mb-2 flex items-start gap-2">
                    <div
                      className="prose prose-sm max-w-none text-base flex-1 min-w-0"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(answer?.choice_text || ""),
                      }}
                    />
                    {isCorrect && (
                      <Badge 
                        tone="success" 
                        variant="soft" 
                        size="sm" 
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                        className="shrink-0"
                      >
                        Correct
                      </Badge>
                    )}
                  </div>
                  {answer?.explanation_text && (
                    <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm">
                      <div className="mb-1 font-medium text-muted-foreground">
                        Explanation:
                      </div>
                      <div
                        className="prose prose-sm max-w-none text-sm text-muted-foreground"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(answer.explanation_text),
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!correctAnswer && (
          <div className="rounded-lg border border-warn bg-warn/5 p-3 text-sm text-warn-foreground">
            <XCircle className="mr-2 inline h-4 w-4" />
            No correct answer selected
          </div>
        )}
      </CardContent>
    </Card>
  );
}

