"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RenderedQuestionStemProps {
  stem: string;
  questionId: string;
}

/**
 * Simple markdown renderer for question stems
 * Handles: **bold**, *italic*, `code`, and line breaks
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

export function RenderedQuestionStem({ stem, questionId }: RenderedQuestionStemProps) {
  const renderedContent = useMemo(() => renderMarkdown(stem), [stem]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question ID: #{questionId.slice(0, 8)}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-sm max-w-none text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
      </CardContent>
    </Card>
  );
}
