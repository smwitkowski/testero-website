import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import catalog from "@/content/catalog.json";
import { parseFrontmatter, safeHref } from "@/lib/content/markdown";
import { BLOG_EDITORIAL_NOTICE, BLOG_PUBLICATION_OVERLAYS, FAQ_PUBLICATION_OVERLAYS } from "@/lib/content/editorial";

export interface ContentEntry {
  slug: string;
  href: string;
  title: string;
  description: string;
  body: string;
  citations: string[];
  publishedAt?: string;
  editorialNotice?: string;
}

function readDocument(kind: "blog" | "faq" | "legal", slug: string) {
  // Public callers must use catalog entries; defense in depth for filesystem access.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid content slug");
  const source = readFileSync(path.join(process.cwd(), "content", kind, `${slug}.md`), "utf8");
  return { source, ...parseFrontmatter(source) };
}

export function getBlogEntries(): ContentEntry[] {
  return catalog.blog.map((item) => {
    const document = readDocument("blog", item.slug);
    const overlay = BLOG_PUBLICATION_OVERLAYS[item.slug];
    if (!overlay || createHash("sha256").update(document.source).digest("hex") !== overlay.sourceSha256) {
      throw new Error(`Blog source requires editorial review: ${item.slug}`);
    }
    return { ...item, description: overlay.description, body: overlay.body,
      citations: overlay.citations, editorialNotice: BLOG_EDITORIAL_NOTICE,
      publishedAt: typeof document.attributes.publishedAt === "string" ? document.attributes.publishedAt : undefined };
  });
}

export function getBlogEntry(slug: string): ContentEntry | undefined {
  if (!catalog.blog.some((item) => item.slug === slug)) return undefined;
  return getBlogEntries().find((item) => item.slug === slug);
}

export function faqDocumentForPublication(slug: string, source: string): { body: string; editorialNotice?: string } {
  let body = parseFrontmatter(source).body;
  const overlay = FAQ_PUBLICATION_OVERLAYS[slug];
  if (!overlay) return { body };
  if (createHash("sha256").update(source).digest("hex") !== overlay.sourceSha256) {
    throw new Error(`FAQ source requires editorial review: ${slug}`);
  }
  for (const replacement of overlay.replacements) {
    if (!body.includes(replacement.original)) throw new Error(`FAQ replacement requires editorial review: ${slug}`);
    body = body.replace(replacement.original, replacement.replacement);
  }
  return { body, editorialNotice: overlay.notice };
}

export function getFaqEntries(): ContentEntry[] {
  return catalog.faq.map((item) => {
    const document = readDocument("faq", item.slug);
    const sources = document.attributes.citations;
    const publication = faqDocumentForPublication(item.slug, document.source);
    // Legacy hub routes are not in v2. Point retained Markdown links to the
    // official certification directory rather than silently sending readers to 404.
    const body = publication.body.replace(/\]\(\/content\/[^)]+\)/g, "](https://cloud.google.com/learn/certification)");
    const description = body.split("\n\n")[0].replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`]/g, "").slice(0, 180);
    return { ...item, description, body, editorialNotice: publication.editorialNotice,
      citations: Array.isArray(sources) ? sources.filter((value) => typeof value === "string" && safeHref(value)) : [] };
  });
}

export function getFaqEntry(slug: string): ContentEntry | undefined {
  if (!catalog.faq.some((item) => item.slug === slug)) return undefined;
  return getFaqEntries().find((item) => item.slug === slug);
}

export interface LegalDocument { title: string; approved: boolean; body: string }

// Publication gate: only literal top-level `approved: true` publishes the body.
// Founder workflow: replace only content/legal/{terms,privacy}.md with approved
// text and approved:true frontmatter, then review/deploy through normal release.
// Nothing reads hq/drafts. An approval string, absent flag, or false stays closed.
export function legalDocumentFromSource(source: string, kind: "terms" | "privacy"): LegalDocument {
  const document = parseFrontmatter(source);
  const title = kind === "terms" ? "Terms of service" : "Privacy policy";
  const approved = document.attributes.approved === true;
  return { title, approved, body: approved ? document.body :
    `## Being finalized\n\nThe ${kind === "terms" ? "terms of service are" : "privacy policy is"} being finalized and awaiting founder approval. This placeholder is not ${kind === "terms" ? "a legal agreement" : "a privacy policy"}. Approved text must be published before launch.` };
}

export function getLegalDocument(kind: "terms" | "privacy"): LegalDocument {
  return legalDocumentFromSource(readDocument("legal", kind).source, kind);
}
