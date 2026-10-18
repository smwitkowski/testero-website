import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getBlogEntry, getFaqEntry } from "@/lib/content/loader";
import { articleStructuredData } from "@/lib/structured-data";
import CertPage from "@/app/certifications/[slug]/page";
import FaqPage from "@/app/faq/[slug]/page";
import robots from "@/app/robots";

const blogs = ["pmle-exam-format-cost-languages-2026", "pmle-passing-score", "pmle-exam-domains-weights", "pmle-exam-changes-june-2026", "pmle-study-plan-by-domain"];
const faqs = ["how-long-is-the-google-ml-engineer-exam", "is-the-google-professional-machine-learning-engineer-certification-worth-it"];
const source = "https://cloud.google.com/learn/certification/machine-learning-engineer";
describe("answer-first PMLE publications", () => {
  it("keeps a self-contained lead, source and modification date on each article", () => {
    for (const entry of [...blogs.map(slug => getBlogEntry(slug)!), ...faqs.map(slug => getFaqEntry(slug)!)]) {
      expect(entry.body.split("\n\n")[0]).not.toMatch(/^#/);
      expect(entry.body.split("\n\n")[1]).toContain(source);
      expect(entry.body.split("\n\n")[1]).toContain("Updated October 17, 2026");
      expect(entry.updatedAt).toBe("2026-10-17");
      expect(articleStructuredData(entry, "Blog")["@graph"][0].dateModified).toBe(entry.updatedAt);
      expect(entry.body).not.toContain("updated in October 2024");
    }
  });
  it("renders fresh FAQ answers before editorial notices", async () => {
    for (const slug of faqs) {
      const html = renderToStaticMarkup(await FaqPage({ params: Promise.resolve({ slug }) }));
      expect(html.indexOf("Updated October 17, 2026")).toBeLessThan(html.indexOf('aria-label="Editorial notice"'));
      expect(html).not.toContain("Historical certification answer.");
    }
  });
  it("starts the PMLE certification page with logistics and synced sourced date", async () => {
    const html = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "machine-learning-engineer" }) }));
    expect(html).toContain("two hours long, costs $200 plus tax");
    expect(html).toContain("50–60 multiple-choice and multiple-select");
    expect(html).toContain("English and Japanese");
    expect(html).toContain('<time dateTime="2026-10-17">2026-10-17</time>');
    expect(html).toContain('"dateModified":"2026-10-17"');
    expect(html).not.toMatch(/Valid for|Validity/);
  });
  it("allows public content for search crawlers via the wildcard rule", () => {
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(false);
    expect(rules).toMatchObject({ userAgent: "*", allow: "/" });
    if (!Array.isArray(rules)) {
      for (const path of ["/blog/pmle-passing-score", "/faq/how-long-is-the-google-ml-engineer-exam", "/certifications/machine-learning-engineer"]) {
        expect((rules.disallow as string[]).some(prefix => path.startsWith(prefix))).toBe(false);
      }
    }
  });
});
