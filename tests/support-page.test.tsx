import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SupportPage, { metadata } from "@/app/support/page";
import TermsPage from "@/app/terms/page";
import { MarkdownContent } from "@/components/markdown-content";
import robots, { privatePaths } from "@/app/robots";

describe("public support page", () => {
  it("renders a selectable contact address and useful request details without sign-in", () => {
    const html = renderToStaticMarkup(<SupportPage />);
    expect(html).toContain(">Support</h1>");
    expect(html).toMatch(/<a href="mailto:support@testero\.ai" class="[^"]*select-text[^"]*">support@testero\.ai<\/a>/);
    expect(html).toContain("You do not need to sign in to contact us.");
    for (const detail of ["What to include", "email address", "page URL", "steps to reproduce", "browser and device", "purchase date", "receipt or payment reference"]) {
      expect(html).toContain(detail);
    }
    expect(html).toContain("Do not send passwords, sign-in codes, full payment card details or confidential exam content.");
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain("<form");
  });

  it("states response expectations without promising a response or refund outcome", () => {
    const html = renderToStaticMarkup(<SupportPage />);
    expect(html).toContain("Response times vary by request.");
    expect(html).toContain("We do not guarantee a response or resolution time.");
    expect(html).toContain("reply in the same email thread");
    expect(html).not.toMatch(/within \d+|business days|24 hours|refund guaranteed/i);
  });

  it("links to an actual refund section in the terms and to the privacy policy", () => {
    const html = renderToStaticMarkup(<SupportPage />);
    expect(html).toContain('href="/terms#refunds"');
    expect(html).toContain('href="/privacy"');
    const terms = renderToStaticMarkup(<TermsPage />);
    expect(terms).toContain('<h2 id="refunds">Seven-day refund policy</h2>');
  });

  it("only adds explicitly mapped heading IDs and leaves defaults unchanged", () => {
    const content = "## Seven-day refund policy\n\nDetails.\n\n## Other section";
    const defaultHtml = renderToStaticMarkup(<MarkdownContent content={content} />);
    expect(defaultHtml).toContain("<h2>Seven-day refund policy</h2>");
    expect(defaultHtml).not.toContain('id="');
    const mappedHtml = renderToStaticMarkup(<MarkdownContent content={content} headingIds={{ "Seven-day refund policy": "refunds" }} />);
    expect(mappedHtml).toContain('<h2 id="refunds">Seven-day refund policy</h2>');
    expect(mappedHtml).toContain("<h2>Other section</h2>");
  });

  it("has canonical public metadata and permits crawling", () => {
    expect(metadata.title).toBe("Support");
    expect(metadata.description).toContain("Contact Testero support");
    expect(metadata.alternates).toEqual({ canonical: "https://testero.ai/support" });
    expect(metadata.openGraph).toMatchObject({ url: "https://testero.ai/support", title: "Support | Testero" });
    expect(metadata.robots).toBeUndefined();
    expect(privatePaths.some(path => "/support".startsWith(path))).toBe(false);
    expect(robots().rules).toMatchObject({ userAgent: "*", allow: "/" });
  });
});
