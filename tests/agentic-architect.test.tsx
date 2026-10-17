import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "@/app/certifications/[slug]/page";
import Blog from "@/app/blog/[slug]/page";
import { getCertification, checkedDate } from "@/lib/certifications/data";
import { getBlogEntry } from "@/lib/content/loader";
import sitemap from "@/app/sitemap";

describe("Agentic Architect checked GA and beta explanation", () => {
  it("keeps GA duration and unstated question count separate from preserved beta facts", async () => {
    const cert = getCertification("agentic-architect")!;
    const ga = cert.exam_variants.find(exam => exam.variant === "ga")!;
    const beta = cert.exam_variants.find(exam => exam.variant === "beta")!;
    expect(ga).toMatchObject({ duration_minutes: 120, question_count: null, price_usd: 200, languages: null, delivery_stated: null });
    expect(beta).toMatchObject({ duration_minutes: 180, question_count: { min: 80, max: 80, approximate: true }, price_usd: 120 });
    expect(checkedDate(cert).slice(0, 10)).toBe("2026-10-17");
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: "agentic-architect" }) }));
    expect(html).toContain("GA exam (upcoming)"); expect(html).toContain("Beta required lab deadline");
    expect(html).toContain("mid-November"); expect(html).toContain("registration opens November 2");
    expect(html).toContain("7–10 business days"); expect(html).toContain("two months");
    expect(html).toContain("not an Agentic Architect assessment"); expect(html).toContain("optional preparation");
    expect(html).toContain('id="cert-email-agentic-architect"');
    expect(html).toContain("https://support.google.com/cloud-certification/answer/18080541?hl=en");
  });
  it("publishes the dated original article, sources, sitemap and cert-specific waitlist link", async () => {
    const slug = "professional-agentic-architect-exam-ga-2026";
    const entry = getBlogEntry(slug)!;
    expect(entry.republished).toBe(false); expect(entry.publishedAt).toBe("2026-10-17");
    expect(entry.exam).toBe("Professional Agentic Architect");
    expect(entry.citations).toContain("https://services.google.com/fh/files/misc/professional_agentic_architect_exam_guide_english.pdf");
    const html = renderToStaticMarkup(await Blog({ params: Promise.resolve({ slug }) }));
    expect(html).toContain('href="/certifications/agentic-architect"');
    expect(html).toContain("Get notified about the Professional Agentic Architect diagnostic");
    expect(html).toContain("not a measured overlap percentage");
    expect(sitemap().map(item => item.url)).toContain(`https://testero.ai/blog/${slug}`);
  });
});
