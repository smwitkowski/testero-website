import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/content/legacy-url-manifest.json";
import { publicPaths, SITE_ORIGIN } from "@/lib/seo";
import { getLegacyRedirect, legacyPaths, nextLegacyRedirects, redirectRules, resolveLegacyPath } from "@/lib/navigation/legacy-redirects";
import nextConfig from "../next.config";
import { getRedirectUrl, unstable_getResponseFromNextConfig } from "next/experimental/testing/server";
import sitemap from "@/app/sitemap";
import { generateStaticParams } from "@/app/blog/[slug]/page";
import { getBlogEntries, getBlogEntry, getFaqEntries } from "@/lib/content/loader";
import { relatedPmleGuides } from "@/lib/content/related";

const root = resolve(import.meta.dirname, "..");
function extractLocations(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc\s*>\s*([^<]+?)\s*<\/loc\s*>/g), match => match[1].replaceAll("&amp;", "&"));
}
function extractPaths(xml: string): string[] {
  return extractLocations(xml).map(loc => {
    const url = new URL(loc);
    expect(url.origin).toBe(SITE_ORIGIN);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    return url.pathname;
  });
}
const unique = (paths: string[]) => [...new Set(paths)].sort();
const fixturePaths = manifest.files.flatMap(file => extractPaths(readFileSync(resolve(root, file.fixture), "utf8")));
let referenceFiles: string[] | undefined;
try {
  referenceFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", manifest.source.commit, "public"], { cwd: root, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" })
    .trim().split("\n").filter(path => /^public\/sitemap-.*\.xml$/.test(path)).sort();
} catch { /* Shallow CI may omit the historical commit; frozen fixtures still prove coverage. */ }

const retainedPaths = new Set([
  ...publicPaths, "/dashboard", "/account", "/login", "/signup", "/forgot-password", "/reset-password",
]);

describe("complete frozen legacy URL inventory", () => {
  it("records all XML files, raw hashes, locations and unique paths", () => {
    expect(manifest.source.ref).toBe("prime/pmle-pass");
    expect(manifest.source.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(readdirSync(resolve(root, "tests/fixtures/legacy-sitemaps")).sort())
      .toEqual(manifest.files.map(file => file.path.split("/").at(-1)).sort());
    for (const file of manifest.files) {
      const raw = readFileSync(resolve(root, file.fixture));
      expect(createHash("sha256").update(raw).digest("hex")).toBe(file.sha256);
      expect(extractLocations(raw.toString())).toHaveLength(file.locCount);
    }
    expect(manifest.counts).toEqual({ files: 2, locations: 390, uniquePaths: 390 });
    expect(fixturePaths).toHaveLength(manifest.counts.locations);
    expect(unique(fixturePaths)).toEqual(manifest.paths);
    expect(legacyPaths).toEqual(manifest.paths);
    expect(legacyPaths).toContain("/");
  });

  it.skipIf(!referenceFiles)("compares every historical sitemap and location against git when history is available", () => {
    expect(referenceFiles).toEqual(manifest.files.map(file => file.path).sort());
    const historicalPaths = referenceFiles!.flatMap(file => {
      const xml = execFileSync("git", ["show", `${manifest.source.commit}:${file}`], { cwd: root, encoding: "utf8" });
      expect(xml).toBe(readFileSync(resolve(root, "tests/fixtures/legacy-sitemaps", file.split("/").at(-1)!), "utf8"));
      return extractPaths(xml);
    });
    expect(unique(historicalPaths)).toEqual(manifest.paths);
    expect(historicalPaths).toHaveLength(manifest.counts.locations);
  });

  it("every manifest path renders a retained route or permanently redirects to one", () => {
    for (const path of legacyPaths) {
      const result = resolveLegacyPath(path);
      expect(retainedPaths.has(result.path), `${path} -> ${result.path}`).toBe(true);
      expect([200, 308]).toContain(result.status);
      if (result.status === 200 && !path.startsWith("/blog/") && !path.startsWith("/faq/")) {
        expect(existsSync(resolve(root, "app", path.slice(1), "page.tsx")), path).toBe(true);
      }
    }
    expect(legacyPaths.filter(path => path.startsWith("/practice/question/"))).toHaveLength(343);
    for (const path of legacyPaths.filter(path => path.startsWith("/practice/question"))) {
      expect(resolveLegacyPath(path)).toEqual({ path: "/dashboard", status: 308 });
    }
  });
});

describe("legacy redirects run in Next config before auth", () => {
  it("wires exact permanent rules and static known internal destinations", async () => {
    expect(await nextConfig.redirects?.()).toEqual(nextLegacyRedirects());
    expect(new Set(redirectRules.map(rule => rule.source)).size).toBe(redirectRules.length);
    for (const rule of redirectRules) {
      expect(rule.permanent).toBe(true);
      expect(rule.destination.startsWith("/")).toBe(true);
      expect(rule.destination.startsWith("//")).toBe(false);
      expect(retainedPaths.has(rule.destination), rule.source).toBe(true);
      expect(getLegacyRedirect(rule.destination), rule.source).toBeUndefined();
      expect(rule.destination).not.toMatch(/[:?#\\]/);
    }
  });

  it("preserves current blog and FAQ routes instead of redirecting all slugs", () => {
    for (const path of publicPaths) expect(getLegacyRedirect(path), path).toBeUndefined();
    expect(resolveLegacyPath("/")).toEqual({ path: "/", status: 200 });
  });

  it.each([
    ["/dashboard/settings/billing", "/account"], ["/dashboard/settings/privacy", "/account"],
    ["/blog/tags/vertex-ai", "/blog"], ["/blog/categories/pmle", "/blog"],
    ["/content/unknown.md", "/faq"], ["/content/hub/google-cloud-certification-guide.md", "/faq/what-is-google-cloud-certification"],
    ["/content/blog/5-hardest-pmle-questions.md", "/pmle/sample-questions"],
    ["/content/spokes/pmle-vs-aws-ml-vs-azure-ai", "/certifications/machine-learning-engineer"],
    ["/practice/question/anything/", "/dashboard"], ["/practice/question/%61nything", "/dashboard"],
  ])("resolves %s to closest v2 route %s", (path, destination) => {
    expect(resolveLegacyPath(path)).toEqual({ path: destination, status: 308 });
  });

  it.each(["https://evil.example/content", "//evil.example", "/%2Fevil.example", "/content/%2e%2e/login", "/content/%5cevil", "/content/%zz", "/content?next=https://evil.example"])
    ("does not resolve unsafe or external input %s", path => { expect(getLegacyRedirect(path)).toBeUndefined(); });
});

describe("retired PMLE articles", () => {
  const replacements = [
    ["5-hardest-pmle-questions", "/pmle/sample-questions"],
    ["pmle-vs-aws-ml-vs-azure-ai", "/certifications/machine-learning-engineer"],
    ["pmle-october-2024-exam-changes", "/blog/pmle-exam-changes-june-2026"],
    ["accelerated-google-ml-certification-30-day-success-story-2025", "/blog/pmle-study-plan-by-domain"],
  ] as const;

  it.each(replacements)("permanently redirects %s in Next config without a chain", async (slug, destination) => {
    const path = `/blog/${slug}`;
    const response = await unstable_getResponseFromNextConfig({ url: `${SITE_ORIGIN}${path}`, nextConfig });
    expect(response.status).toBe(308);
    expect(getRedirectUrl(response)).toBe(`${SITE_ORIGIN}${destination}`);
    const attributed = await unstable_getResponseFromNextConfig({ url: `${SITE_ORIGIN}${path}?utm_source=audit`, nextConfig });
    expect(attributed.status).toBe(308);
    expect(getRedirectUrl(attributed)).toBe(`${SITE_ORIGIN}${destination}?utm_source=audit`);
    expect(getLegacyRedirect(destination)).toBeUndefined();
    for (const prefix of ["blog", "spoke", "spokes"]) {
      for (const extension of ["", ".md"]) {
        const alias = `/content/${prefix}/${slug}${extension}`;
        expect(resolveLegacyPath(alias)).toEqual({ path: destination, status: 308 });
        const aliasResponse = await unstable_getResponseFromNextConfig({ url: `${SITE_ORIGIN}${alias}`, nextConfig });
        expect(aliasResponse.status).toBe(308);
        expect(getRedirectUrl(aliasResponse)).toBe(`${SITE_ORIGIN}${destination}`);
      }
    }
    expect(publicPaths).toContain(destination);
    if (destination.startsWith("/blog/")) expect(getBlogEntry(destination.slice("/blog/".length))).toBeDefined();
  });

  it.each(["", ".md"])("sends the retired success-story brief%s directly to the study plan", extension => {
    expect(resolveLegacyPath(`/content/briefs/accelerated-ml-cert-success${extension}`))
      .toEqual({ path: "/blog/pmle-study-plan-by-domain", status: 308 });
  });

  it("unpublishes retired articles from all public content surfaces while preserving their source files", () => {
    const entries = [...getBlogEntries(), ...getFaqEntries()];
    for (const [slug] of replacements) {
      const path = `/blog/${slug}`;
      expect(getBlogEntry(slug)).toBeUndefined();
      expect(generateStaticParams()).not.toContainEqual({ slug });
      expect(publicPaths).not.toContain(path);
      expect(sitemap().map(entry => entry.url)).not.toContain(`${SITE_ORIGIN}${path}`);
      expect(relatedPmleGuides().map(entry => entry.href)).not.toContain(path);
      for (const entry of entries) {
        expect(entry.href).not.toBe(path);
        expect(entry.body).not.toContain(path);
      }
      expect(existsSync(resolve(root, "content/blog", `${slug}.md`))).toBe(true);
    }
  });
});
