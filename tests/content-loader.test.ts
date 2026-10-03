import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getBlogEntries, getBlogEntry, getFaqEntries, getFaqEntry, getLegalDocument, legalDocumentFromSource } from "@/lib/content/loader";
import { BLOG_PUBLICATION_OVERLAYS } from "@/lib/content/editorial";
import { parseFrontmatter } from "@/lib/content/markdown";
import { pageMetadata } from "@/lib/seo";

describe("local content loader", () => {
  it("returns all preserved catalog routes with bodies and safe publication metadata", () => {
    const blogs = getBlogEntries();
    const faqs = getFaqEntries();
    expect(blogs).toHaveLength(5);
    expect(faqs).toHaveLength(9);
    for (const entry of [...blogs, ...faqs]) {
      expect(entry.body.length).toBeGreaterThan(300);
      expect(entry.title).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.citations.length).toBeGreaterThan(0);
      expect(entry.href).toMatch(/^\/(blog|faq)\/[a-z0-9-]+$/);
    }
    for (const entry of blogs) {
      expect(entry.editorialNotice).toContain("Edited historical article");
      expect(entry.body).toBe(BLOG_PUBLICATION_OVERLAYS[entry.slug].body);
      expect(entry.body + entry.description).not.toMatch(/Sarah|85%|20\+ hours|40\+ hours|50,000|2,000|pass in 30 days|proven blueprint|expert review/i);
      const archive = parseFrontmatter(readFileSync(`content/blog/${entry.slug}.md`, "utf8"));
      expect(entry.title).toBe(archive.attributes.title);
    }
  });
  it("passes each entry's safe title, description and path to canonical/social metadata", () => {
    for (const entry of [...getBlogEntries(), ...getFaqEntries()]) {
      const metadata = pageMetadata(entry.title, entry.description, entry.href);
      expect(metadata.title).toBe(entry.title);
      expect(metadata.description).toBe(entry.description);
      expect(metadata.alternates?.canonical).toBe(`https://testero.ai${entry.href}`);
      expect(metadata.openGraph).toMatchObject({ description: entry.description, url: `https://testero.ai${entry.href}` });
    }
  });
  it("does not access arbitrary paths and returns undefined for unknown routes", () => {
    for (const slug of ["../terms", "%2e%2e", "unknown", "", "/etc/passwd"]) {
      expect(getBlogEntry(slug)).toBeUndefined();
      expect(getFaqEntry(slug)).toBeUndefined();
    }
  });
  it("shows FAQ citations while replacing legacy hub destinations", () => {
    for (const entry of getFaqEntries()) {
      expect(entry.body).not.toContain("](/content/");
      expect(entry.citations.every((href) => href.startsWith("https://"))).toBe(true);
    }
  });
});

describe("legal approval gate", () => {
  it.each(["", "approved: false", 'approved: "true"', "approved: yes", "approved: TRUE", "  approved: true"])("fails closed for %s", (frontmatter) => {
    const entry = legalDocumentFromSource(`---\n${frontmatter}\n---\nPRIVATE DRAFT`, "terms");
    expect(entry.approved).toBe(false);
    expect(entry.body).not.toContain("PRIVATE DRAFT");
    expect(entry.body).toContain("Being finalized");
  });
  it("publishes approved text only for literal approved:true", () => {
    const entry = legalDocumentFromSource("---\napproved: true\n---\n## Approved terms\n\nText", "terms");
    expect(entry.approved).toBe(true);
    expect(entry.body).toBe("## Approved terms\n\nText");
  });
  it("keeps both checked-in legal placeholders gated", () => {
    for (const kind of ["terms", "privacy"] as const) {
      expect(getLegalDocument(kind).approved).toBe(false);
      expect(getLegalDocument(kind).body).toContain("before launch");
    }
  });
});
