import type { MetadataRoute } from "next";
import { canonicalUrl, publicPaths } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only public indexable pages. Session, auth and account URLs stay private.
  return publicPaths.map(path => ({ url: canonicalUrl(path) }));
}
