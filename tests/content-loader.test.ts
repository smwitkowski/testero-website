import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { faqDocumentForPublication, getBlogEntries, getBlogEntry, getFaqEntries, getFaqEntry, getLegalDocument, legalDocumentFromSource } from "@/lib/content/loader";
import { BLOG_PUBLICATION_OVERLAYS, FAQ_PUBLICATION_OVERLAYS } from "@/lib/content/editorial";
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
  it("applies only the source-hash-locked FAQ paragraph replacement with a visible notice", () => {
    const slug = "is-google-cloud-certification-worth-it";
    const source = readFileSync(`content/faq/${slug}.md`, "utf8");
    const originalBody = parseFrontmatter(source).body;
    const overlay = FAQ_PUBLICATION_OVERLAYS[slug];
    const replacement = overlay.replacements[0];
    const published = faqDocumentForPublication(slug, source);
    expect(published.body).toBe(originalBody.replace(replacement.original, replacement.replacement));
    expect(published.body).not.toContain("among the highest earners");
    expect(published.editorialNotice).toBe(overlay.notice);
    expect(getFaqEntry(slug)?.editorialNotice).toBe(overlay.notice);
    expect(() => faqDocumentForPublication(slug, `${source}\n`)).toThrow("FAQ source requires editorial review");
    const untouchedSlug = "how-long-is-the-google-ml-engineer-exam";
    const untouchedSource = readFileSync(`content/faq/${untouchedSlug}.md`, "utf8");
    expect(faqDocumentForPublication(untouchedSlug, untouchedSource)).toEqual({ body: parseFrontmatter(untouchedSource).body });
  });
  it("audits exactly three FAQ sources and leaves all text outside each narrow replacement unchanged", () => {
    expect(Object.keys(FAQ_PUBLICATION_OVERLAYS).sort()).toEqual([
      "is-google-cloud-certification-worth-it", "is-google-data-analytics-certification-worth-it", "what-is-google-cloud-certification",
    ]);
    for (const [slug, overlay] of Object.entries(FAQ_PUBLICATION_OVERLAYS)) {
      const source = readFileSync(`content/faq/${slug}.md`, "utf8");
      let expected = parseFrontmatter(source).body;
      for (const replacement of overlay.replacements) {
        expect(expected.split(replacement.original)).toHaveLength(2);
        expected = expected.replace(replacement.original, replacement.replacement);
      }
      expect(faqDocumentForPublication(slug, source)).toEqual({ body: expected, editorialNotice: overlay.notice });
      expect(() => faqDocumentForPublication(slug, source.replace("Google", "Changed"))).toThrow("FAQ source requires editorial review");
      expect(getFaqEntry(slug)?.editorialNotice).toBe(overlay.notice);
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
