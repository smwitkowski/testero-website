"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

/**
 * Simple markdown renderer for explanation text
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

export function RenderedExplanation() {
  const form = useFormContext();
  const explanationText = useWatch({ control: form.control, name: "explanation_text" }) || "";
  const docLinks = useWatch({ control: form.control, name: "doc_links" }) || [];

  const hasContent = explanationText.trim() || (docLinks && docLinks.length > 0);

  if (!hasContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>General Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center text-sm text-muted-foreground">
            No explanation provided
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Explanation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {explanationText.trim() && (
          <div
            className="prose prose-sm max-w-none text-base leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(explanationText),
            }}
          />
        )}
        {docLinks && docLinks.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Reference Links:
            </div>
            <ul className="space-y-1">
              {docLinks.map((link: string, index: number) => (
                <li key={index}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {link}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

