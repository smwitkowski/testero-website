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
    expect(blogs).toHaveLength(14);
    expect(faqs).toHaveLength(9);
    for (const entry of [...blogs, ...faqs]) {
      expect(entry.body.length).toBeGreaterThan(300);
      expect(entry.title).toBeTruthy();
      expect(entry.description).toBeTruthy();
      expect(entry.citations.length).toBeGreaterThan(0);
      expect(entry.href).toMatch(/^\/(blog|faq)\/[a-z0-9-]+$/);
    }
    for (const entry of blogs.filter(entry => entry.republished)) {
      expect(entry.editorialNotice).toContain("Edited historical article");
      expect(entry.body).toBe(BLOG_PUBLICATION_OVERLAYS[entry.slug].body);
      expect(entry.body + entry.description).not.toMatch(/Sarah|85%|20\+ hours|40\+ hours|50,000|2,000|pass in 30 days|proven blueprint|expert review/i);
      const archive = parseFrontmatter(readFileSync(`content/blog/${entry.slug}.md`, "utf8"));
      expect(archive.attributes.title).toBeTruthy();
      expect(entry.title).toBe(BLOG_PUBLICATION_OVERLAYS[entry.slug].title);
      expect(entry.title).not.toMatch(/success story|expert solutions|hardest|complete guide|complete 2025 guide/i);
    }
  });
  it("publishes reviewed current articles without historical notices", () => {
    const entries = getBlogEntries().filter(entry => !entry.republished);
    expect(entries).toHaveLength(11);
    for (const entry of entries) {
      const document = parseFrontmatter(readFileSync(`content/blog/${entry.slug}.md`, "utf8"));
      expect(entry.body).toBe(BLOG_PUBLICATION_OVERLAYS[entry.slug].body);
      expect(entry.title).toBe(document.attributes.title);
      expect(entry.description).toBe(document.attributes.description);
      expect(entry.editorialNotice).toBeUndefined();
      expect(entry.title.length).toBeLessThanOrEqual(60);
      expect(entry.description.length).toBeLessThanOrEqual(150);
      expect(entry.publishedAt).toBe(entry.slug === "professional-agentic-architect-exam-ga-2026" ? "2026-10-17" : "2026-10-16");
      expect(entry.updatedAt).toBe(BLOG_PUBLICATION_OVERLAYS[entry.slug].updatedAt ?? "2026-10-16");
      expect(entry.body).toContain(entry.updatedAt === "2026-10-17" ? "Updated October 17, 2026" : "Last checked October 16, 2026");
    }
  });
  it("separates the certification path comparison from the personal picker", () => {
    const entry = getBlogEntry("google-cloud-certification-path")!;
    expect(entry.href).toBe("/blog/google-cloud-certification-path");
    expect(entry.title).toBe("Google Cloud certification path: all 15 certs compared");
    const picker = "[Want a personal shortlist? Try the certification picker](/tools/which-google-cloud-certification)";
    expect(entry.body).toContain(picker);
    expect(entry.body.indexOf(picker)).toBeLessThan(entry.body.indexOf("## How the certification paths fit together"));
    expect(entry.body).toContain("related paths, not a required ladder");
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
    const published = faqDocumentForPublication(slug, source);
    expect(published.body).toBe(overlay.replacements.reduce((body, { original, replacement }) => body.replace(original, replacement), originalBody));
    expect(published.body).not.toMatch(/widely considered worth the investment/);
    expect(published.body).not.toContain("among the highest earners");
    expect(published.editorialNotice).toBe(overlay.notice);
    expect(getFaqEntry(slug)?.editorialNotice).toBe(overlay.notice);
    expect(() => faqDocumentForPublication(slug, `${source}\n`)).toThrow("FAQ source requires editorial review");

  });
  it("audits exactly seven FAQ sources and leaves all text outside each narrow replacement unchanged", () => {
    expect(Object.keys(FAQ_PUBLICATION_OVERLAYS).sort()).toEqual([
      "how-do-you-register-for-google-cloud-certification", "how-long-is-the-google-ml-engineer-exam", "how-much-does-google-cloud-digital-leader-cost",
      "is-google-cloud-certification-worth-it", "is-google-data-analytics-certification-worth-it",
      "is-the-google-professional-machine-learning-engineer-certification-worth-it", "what-is-google-cloud-certification",
    ]);
    for (const [slug, overlay] of Object.entries(FAQ_PUBLICATION_OVERLAYS)) {
      const source = readFileSync(`content/faq/${slug}.md`, "utf8");
      let expected = parseFrontmatter(source).body;
      for (const replacement of overlay.replacements) {
        expect(expected.split(replacement.original)).toHaveLength(2);
        expected = expected.replace(replacement.original, replacement.replacement);
      }
      expect(faqDocumentForPublication(slug, source)).toEqual({ body: expected, editorialNotice: overlay.notice, ...(overlay.citations ? { citations: overlay.citations } : {}) });
      expect(() => faqDocumentForPublication(slug, source.replace("Google", "Changed"))).toThrow("FAQ source requires editorial review");
      expect(getFaqEntry(slug)?.editorialNotice).toBe(overlay.notice);
    }
  });
  it("removes unsourced value claims and known-broken citations", () => {
    const faqs = getFaqEntries();
    for (const entry of faqs) {
      expect(entry.body).not.toMatch(/highly valuable|widely considered/);
      expect(entry.citations.join(" ")).not.toMatch(/answer\/9907651|coursera\.org\/professional-certificates\/google-cloud-digital-leader|datacamp\.blog/);
    }
  });
  it("ends FAQ excerpts at a sentence boundary when the first sentence fits", async () => {
    const { sentenceExcerpt } = await import("@/lib/content/loader");
    expect(sentenceExcerpt("Short.")).toBe("Short.");
    expect(sentenceExcerpt(`${"a".repeat(100)}. ${"b".repeat(100)}.`)).toBe(`${"a".repeat(100)}.`);
    expect(sentenceExcerpt(`${"word ".repeat(50)}end. Next.`)).toBe(`${"word ".repeat(50)}end.`);
    expect(sentenceExcerpt(`${"word ".repeat(80)}end.`)).toMatch(/word…$/);
    for (const entry of getFaqEntries()) expect(entry.description).toMatch(/[.!?]$/);
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
