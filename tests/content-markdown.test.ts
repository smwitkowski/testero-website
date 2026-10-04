import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/markdown-content";
import { markdownTokens, parseFrontmatter, safeHref, safeImageSrc } from "@/lib/content/markdown";

const render = (content: string) => renderToStaticMarkup(createElement(MarkdownContent, { content }));

describe("frontmatter subset", () => {
  it("reads quoted strings, folded strings, lists, wrapped questions and literal approval", () => {
    const document = parseFrontmatter(`---
title: 'A title'
question: Is this worth
  it?
description: >-
  first line
  second line
tags: ["ML", "cloud"]
citations:
- https://example.com/guide
approved: true
data_points:
  cost_usd: 200
---

## Body`);
    expect(document.attributes).toMatchObject({ title: "A title", question: "Is this worth it?", description: "first line second line", tags: ["ML", "cloud"], citations: ["https://example.com/guide"], approved: true });
    expect(document.attributes.cost_usd).toBeUndefined();
    expect(document.body).toBe("## Body");
  });
  it("handles plain Markdown, BOM/CRLF, and rejects unclosed frontmatter", () => {
    expect(parseFrontmatter("text").body).toBe("text");
    expect(parseFrontmatter("\uFEFF---\r\napproved: false\r\n---\r\nBody").attributes.approved).toBe(false);
    expect(() => parseFrontmatter("---\ntitle: test")).toThrow("Unclosed frontmatter");
  });
});

describe("safe destinations", () => {
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,test", "vbscript:test", "//evil.test", "/\\evil.test", "https://user:password@example.com", "https://example.com/%0aevil", "java\nscript:alert(1)", "javascript&#58;alert(1)"])("rejects %s", (href) => expect(safeHref(href)).toBeUndefined());
  it.each(["/faq/topic", "#section", "https://cloud.google.com/learn/certification", "http://example.com"])("allows %s", (href) => expect(safeHref(href)).toBe(href));
  it("permits only local raster image files and blocks all external fetches", () => {
    expect(safeImageSrc("/images/blog/cover.jpg")).toBe("/images/blog/cover.jpg");
    for (const href of ["https://example.com/image.png", "data:image/png;base64,AAA", "//evil.test/img.png", "/images/evil.svg", "/images/../secret.png", "/images/%2e%2e/x.png"]) expect(safeImageSrc(href)).toBeUndefined();
  });
});

describe("React Markdown renderer", () => {
  it("renders real GFM structure, nested lists, code and escaped content", () => {
    const html = render("## Heading\n\n**Strong** and *emphasis* with `code`\n\n1. First\n2. Second\n   - Nested\n\n> quote\n\n| A | B |\n|---|---|\n| one | two |\n\n```html\n<script>alert(1)</script>\n```");
    for (const tag of ["<h2>", "<strong>", "<em>", "<code>", "<ol", "<ul>", "<blockquote>", "<table>", "<th scope=", "<td>", "<pre>"]) expect(html).toContain(tag);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(markdownTokens("## Heading")[0].type).toBe("heading");
  });
  it("never renders raw HTML or executable links/images", () => {
    const html = render('<script>alert(1)</script>\n\n<img src="https://evil.test/track" onerror="alert(1)">\n\n[bad](javascript:alert(1)) [safe](/faq)\n\n![tracking](https://evil.test/track.png)');
    expect(html).not.toMatch(/<script|<img|javascript:|onerror=|evil\.test/);
    expect(html).toContain('href="/faq"');
    expect(html).toContain("tracking");
  });
});
