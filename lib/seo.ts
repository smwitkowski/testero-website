import type { Metadata } from "next";
import catalog from "@/content/catalog.json";
import { certifications, certificationPath } from "@/lib/certifications/catalog";
import { toolPaths } from "@/lib/tools/pages";
import { editorialRedirects } from "@/lib/navigation/legacy-redirects";

/** Public production origin. Preview hosts and request headers never set canonicals. */
export const SITE_ORIGIN = "https://testero.ai";
export const DEFAULT_DESCRIPTION = "PMLE practice for the June 2026 exam guide. Start with a free 5-question readiness check, no account needed.";
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-pmle-2026.png`;

export const publicPaths: readonly string[] = [
  "/", "/diagnostic", "/pricing", "/blog", "/faq", "/terms", "/privacy", "/support", "/about", "/certifications",
  ...toolPaths,
  "/pmle/sample-questions",
  "/pmle/vertex-ai-agent-platform-cheat-sheet",
  "/pmle/practice-options-compared",
  ...certifications.map(cert => certificationPath(cert.cert_id)),
  ...catalog.blog.filter(entry => !editorialRedirects.some(rule => rule.source === entry.href)).map(entry => entry.href),
  ...catalog.faq.map(entry => entry.href),
];

export function canonicalUrl(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || /[\\?#]/.test(path)) {
    throw new Error("Canonical path must be an internal pathname");
  }
  const decoded = decodeURIComponent(path);
  if (decoded.startsWith("//") || /[\\?#]/.test(decoded) || decoded.split("/").some(part => part === "." || part === "..")) {
    throw new Error("Unsafe canonical pathname");
  }
  const pathname = path === "/" ? path : path.replace(/\/+$/, "");
  return `${SITE_ORIGIN}${pathname}`;
}

/** Per-page metadata: avoid inheriting the landing page's canonical or social text. */
export function pageMetadata(title: string, description: string, path: string, article?: { publishedAt?: string; updatedAt?: string }): Metadata {
  const url = canonicalUrl(path);
  const socialTitle = `${title} | Testero`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      ...(article ? { type: "article" as const, publishedTime: article.publishedAt, modifiedTime: article.updatedAt ?? article.publishedAt } : { type: "website" as const }),
      siteName: "Testero", locale: "en_US", url,
      title: socialTitle, description,
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "Testero — PMLE practice for the June 2026 exam guide. Free 5-question check." }],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [SOCIAL_IMAGE] },
  };
}

/** Auth and error pages override root social copy without publishing a canonical. */
export function noIndexMetadata(title: string, description: string): Metadata {
  const metadata = pageMetadata(title, description, "/");
  return {
    ...metadata,
    alternates: undefined,
    openGraph: { ...metadata.openGraph, url: undefined },
    robots: { index: false, follow: false },
  };
}
