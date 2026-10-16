import type { MetadataRoute } from "next";
import { canonicalUrl, publicPaths } from "@/lib/seo";
import { getBlogEntries, getFaqEntries, getLegalDocument } from "@/lib/content/loader";

const BUILD_TIME = process.env.TESTERO_BUILD_TIME;

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = [...getBlogEntries(), ...getFaqEntries()];
  // Unapproved legal placeholders are public but noindex, so omit until approved.
  return publicPaths.filter(path => {
    if (path === "/terms") return getLegalDocument("terms").approved;
    if (path === "/privacy") return getLegalDocument("privacy").approved;
    return true;
    }).map(path => {
    const article = articles.find(entry => entry.href === path);
    return { url: canonicalUrl(path), lastModified: article ? article.updatedAt ?? article.publishedAt : BUILD_TIME };
  });
}
