import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StructuredData } from "@/components/structured-data";
import { articleStructuredData, serializeJsonLd, siteStructuredData } from "@/lib/structured-data";
import { getBlogEntries, getFaqEntries } from "@/lib/content/loader";
import { relatedPmleGuides } from "@/lib/content/related";
import { isComingSoon } from "@/lib/content/exam";
import { pageMetadata } from "@/lib/seo";
import sitemap from "@/app/sitemap";

function parseRendered(value: unknown) {
  const html = renderToStaticMarkup(<StructuredData value={value} />);
  return JSON.parse(html.match(/<script[^>]*>([\s\S]*)<\/script>/)![1]);
}
describe("public structured data", () => {
  it("renders parseable Organization and WebSite without claims or FAQPage", () => {
    const data = parseRendered(siteStructuredData);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual(["Organization", "WebSite"]);
    expect(data["@graph"][0]).toMatchObject({ name: "Testero", url: "https://testero.ai" });
  });
  it("escapes script boundaries without changing the parsed text", () => {
    const value = { headline: "</script><script>alert(1)</script>" };
    expect(serializeJsonLd(value)).not.toContain("<");
    expect(parseRendered(value)).toEqual(value);
  });
  it("supplies article fields, dates, organization attribution and breadcrumbs for every route", () => {
    for (const [section, entries] of [["Blog", getBlogEntries()], ["FAQ", getFaqEntries()]] as const) {
      for (const entry of entries) {
        const [article, breadcrumbs] = parseRendered(articleStructuredData(entry, section))["@graph"];
        expect(article).toMatchObject({ "@type": "BlogPosting", headline: entry.title, description: entry.description,
          mainEntityOfPage: `https://testero.ai${entry.href}`, datePublished: entry.publishedAt,
          dateModified: entry.updatedAt ?? entry.publishedAt, author: { "@type": "Organization", name: "Testero" },
          publisher: { "@type": "Organization", name: "Testero" } });
        expect(Number.isFinite(Date.parse(article.datePublished))).toBe(true);
        expect(Number.isFinite(Date.parse(article.dateModified))).toBe(true);
        expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
        expect(breadcrumbs.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2, 3]);
        const metadata = pageMetadata(entry.title, entry.description, entry.href, entry);
        expect(metadata.openGraph).toMatchObject({ type: "article", publishedTime: entry.publishedAt, modifiedTime: entry.updatedAt ?? entry.publishedAt });
        expect(sitemap().find(item => item.url === article.url)?.lastModified).toBe(article.dateModified);
      }
    }
  });
  it("keeps FAQ descriptions short and catalog titles within search result length", () => {
    for (const entry of [...getBlogEntries(), ...getFaqEntries()]) {
      if (entry.href.startsWith("/faq/")) expect(entry.description.length).toBeLessThanOrEqual(150);
      expect(`${entry.title} | Testero`.length).toBeLessThanOrEqual(70);
    }
  });
  it("links only eligible PMLE guides and excludes the current article", () => {
    for (const entry of [...getBlogEntries(), ...getFaqEntries()]) {
      const links = relatedPmleGuides(entry.href);
      expect(links.length).toBeGreaterThanOrEqual(3);
      expect(links.length).toBeLessThanOrEqual(4);
      expect(links.every(link => !isComingSoon(link.exam) && link.href !== entry.href)).toBe(true);
    }
  });
});
