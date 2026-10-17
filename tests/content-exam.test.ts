import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComingSoonTag, ExamAvailabilityNotice } from "@/components/exam-availability";
import { certificationForExam } from "@/lib/certifications/catalog";
import { contentExam, isComingSoon, PMLE_EXAM } from "@/lib/content/exam";
import { getBlogEntries, getFaqEntries } from "@/lib/content/loader";
import HomePage from "@/app/page";
import BlogPage from "@/app/blog/page";
import FaqPage from "@/app/faq/page";
import BlogArticlePage from "@/app/blog/[slug]/page";
import FaqArticlePage from "@/app/faq/[slug]/page";

describe("exam preparation availability", () => {
  it("defaults missing catalog exam metadata to PMLE, without inferring from a slug", () => {
    expect(contentExam({})).toBe(PMLE_EXAM);
    expect(contentExam({ exam: "Associate Cloud Engineer" })).toBe("Associate Cloud Engineer");
    expect(isComingSoon(contentExam({}))).toBe(false);
    expect(isComingSoon(contentExam({ exam: "A future certificate" }))).toBe(true);
  });
  it("renders no notice or tag for PMLE, and clear linked availability for any other subject", () => {
    for (const Component of [ComingSoonTag, ExamAvailabilityNotice]) {
      expect(renderToStaticMarkup(createElement(Component, { exam: PMLE_EXAM }))).toBe("");
    }
    const notice = renderToStaticMarkup(createElement(ExamAvailabilityNotice, { exam: "A future certificate" }));
    expect(notice).toContain("Prep for A future certificate is not available");
    expect(notice).toContain("not available on Testero yet");
    expect(notice).toContain('href="/diagnostic"');
    expect(notice).toContain(PMLE_EXAM);
  });
  it("shows notices near the top of all non-PMLE pages, including mixed-platform and general topics", async () => {
    const entries = [...getBlogEntries(), ...getFaqEntries()];
    expect(entries.filter(e => isComingSoon(e.exam))).toHaveLength(14);
    for (const entry of entries) {
      const Page = entry.href.startsWith("/blog/") ? BlogArticlePage : FaqArticlePage;
      const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: entry.slug }) }));
      const position = html.indexOf('aria-label="Exam preparation availability"');
      if (isComingSoon(entry.exam)) {
        expect(position).toBeGreaterThan(html.indexOf("</header>"));
        expect(position).toBeLessThan(html.indexOf("Sources and current guidance"));
        expect(html).toContain(certificationForExam(entry.exam) || entry.exam === "other Google Cloud certifications" ? `Diagnostic coming for ${entry.exam}` : `Prep for ${entry.exam} is not available`);
      } else expect(position).toBe(-1);
    }
  });
  it("renders current articles with dated BlogPosting data and certification-specific final CTAs", async () => {
    for (const entry of getBlogEntries().filter(entry => !entry.republished)) {
      const html = renderToStaticMarkup(await BlogArticlePage({ params: Promise.resolve({ slug: entry.slug }) }));
      expect(html).not.toContain("(historical source)");
      expect(html).not.toContain("Edited historical article");
      const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      const nodes = scripts.flatMap(match => JSON.parse(match[1])["@graph"] ?? []);
      expect(nodes.find(node => node["@type"] === "BlogPosting")).toMatchObject({
        headline: entry.title, datePublished: entry.publishedAt, dateModified: entry.updatedAt,
      });
      const footer = html.slice(html.lastIndexOf("<footer"));
      const cert = certificationForExam(entry.exam);
      expect(footer).toContain(`href="${isComingSoon(entry.exam) ? cert ? `/certifications/${cert.cert_id}` : "/certifications" : "/diagnostic"}"`);
    }
  });
  it("tags only non-PMLE index items and selects only PMLE homepage teasers", () => {
    for (const [Page, entries] of [[BlogPage, getBlogEntries()], [FaqPage, getFaqEntries()]] as const) {
      const html = renderToStaticMarkup(createElement(Page));
      expect((html.match(/>(?:Diagnostic coming|Not on Testero yet)</g) ?? []).length).toBe(entries.filter(e => isComingSoon(e.exam)).length);
    }
    const home = renderToStaticMarkup(createElement(HomePage));
    expect(home.indexOf('id="questions"')).toBeGreaterThan(home.indexOf('id="domains"'));
    expect(home.indexOf('id="questions"')).toBeLessThan(home.indexOf('id="pass"'));
    for (const entry of getFaqEntries()) expect(home.includes(entry.href)).toBe(!isComingSoon(entry.exam));
  });
});
