import type { Metadata } from "next";
import catalog from "@/content/catalog.json";

/** Public production origin. Preview hosts and request headers never set canonicals. */
export const SITE_ORIGIN = "https://testero.ai";
export const DEFAULT_DESCRIPTION = "Take a free 20-question PMLE diagnostic and see your readiness and domain breakdown.";
export const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-v2.png`;

export const publicPaths: readonly string[] = [
  "/", "/diagnostic", "/pricing", "/blog", "/faq", "/terms", "/privacy",
  ...catalog.blog.map(entry => entry.href),
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
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const url = canonicalUrl(path);
  const socialTitle = `${title} | Testero`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website", siteName: "Testero", locale: "en_US", url,
      title: socialTitle, description,
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: "Testero — PMLE readiness diagnostic" }],
    },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [SOCIAL_IMAGE] },
  };
}
