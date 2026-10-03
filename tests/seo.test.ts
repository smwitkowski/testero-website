import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalUrl, pageMetadata, publicPaths, SITE_ORIGIN, SOCIAL_IMAGE } from "@/lib/seo";
import catalog from "@/content/catalog.json";
import sitemap from "@/app/sitemap";
import robots, { privatePaths } from "@/app/robots";

describe("SEO function contracts", () => {
  it("sets page-specific canonical, description and social previews on production origin", () => {
    const result = pageMetadata("PMLE Pass pricing", "$39 one-time for 90 days of access.", "/pricing");
    expect(result.title).toBe("PMLE Pass pricing");
    expect(result.description).toBe("$39 one-time for 90 days of access.");
    expect(result.alternates).toEqual({ canonical: "https://testero.ai/pricing" });
    expect(result.openGraph).toMatchObject({ title: "PMLE Pass pricing | Testero", description: result.description, url: "https://testero.ai/pricing", images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630 }] });
    expect(result.twitter).toMatchObject({ card: "summary_large_image", title: "PMLE Pass pricing | Testero", description: result.description, images: [SOCIAL_IMAGE] });
    expect(SOCIAL_IMAGE).toBe(`${SITE_ORIGIN}/og-v2.png`);
    const asset = readFileSync(resolve(import.meta.dirname, "../public/og-v2.png"));
    expect(asset.subarray(1, 4).toString()).toBe("PNG");
    expect([asset.readUInt32BE(16), asset.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it("handles root and trailing slash canonicals without duplicate root entries", () => {
    expect(canonicalUrl("/")).toBe("https://testero.ai/");
    expect(canonicalUrl("/pricing/")).toBe("https://testero.ai/pricing");
    expect(publicPaths.filter(path => path === "/")).toHaveLength(1);
  });

  it.each(["https://evil.example", "//evil.example", "/%2Fevil.example", "/pricing?preview=true", "/pricing#top", "/%2e%2e/other", "/%5cevil"])
    ("rejects non-path or unsafe canonical input %s", path => { expect(() => canonicalUrl(path)).toThrow(); });

  it("sitemap includes only public pages and all five blog and nine FAQ entries", () => {
    expect(catalog.blog).toHaveLength(5);
    expect(catalog.faq).toHaveLength(9);
    const entries = sitemap();
    expect(entries.map(entry => entry.url)).toEqual(publicPaths.map(canonicalUrl));
    expect(entries).toHaveLength(21);
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length);
    for (const entry of entries) {
      const url = new URL(entry.url);
      expect(url.origin).toBe(SITE_ORIGIN);
      expect(url.pathname).not.toMatch(/^\/(?:api|auth|account|dashboard|practice|login|signup|checkout|reset-password|forgot-password)(?:\/|$)/);
      expect(url.pathname).not.toMatch(/^\/diagnostic\//);
    }
  });

  it("robots advertises canonical sitemap and excludes auth, sessions and private APIs", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: privatePaths }, sitemap: `${SITE_ORIGIN}/sitemap.xml`, host: SITE_ORIGIN });
    expect(privatePaths).toEqual(expect.arrayContaining(["/api/", "/auth/", "/account", "/dashboard", "/practice/", "/diagnostic/", "/checkout/", "/login", "/signup", "/forgot-password", "/reset-password"]));
  });
});
