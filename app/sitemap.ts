import type { MetadataRoute } from "next";
import { canonicalUrl, publicPaths } from "@/lib/seo";
import { getLegalDocument } from "@/lib/content/loader";

export default function sitemap(): MetadataRoute.Sitemap {
  // Unapproved legal placeholders are public but noindex, so omit until approved.
  return publicPaths.filter(path => {
    if (path === "/terms") return getLegalDocument("terms").approved;
    if (path === "/privacy") return getLegalDocument("privacy").approved;
    return true;
  }).map(path => ({ url: canonicalUrl(path) }));
}
