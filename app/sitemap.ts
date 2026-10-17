import type { MetadataRoute } from "next";
import { canonicalUrl, publicPaths } from "@/lib/seo";
import { getBlogEntries, getFaqEntries, getLegalDocument } from "@/lib/content/loader";

import { catalogCheckedDate, checkedDate, getCertification } from "@/lib/certifications/data";

const BUILD_TIME = process.env.TESTERO_BUILD_TIME;

export const revalidate = 300;

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = [...getBlogEntries(), ...getFaqEntries()];
  // Unapproved legal placeholders are public but noindex, so omit until approved.
  return publicPaths.filter(path => {
    if (path === "/terms") return getLegalDocument("terms").approved;
    if (path === "/privacy") return getLegalDocument("privacy").approved;
    return true;
    }).map(path => {
    const article = articles.find(entry => entry.href === path);
    const cert = path.startsWith("/certifications/") ? getCertification(path.split("/")[2]) : undefined;
    const certDate = path === "/certifications" ? catalogCheckedDate() : cert ? checkedDate(cert) : undefined;
    return { url: canonicalUrl(path), lastModified: certDate ?? (article ? article.updatedAt ?? article.publishedAt : BUILD_TIME) };
  });
}
