import type { ContentEntry } from "@/lib/content/loader";
import { canonicalUrl, SITE_ORIGIN } from "@/lib/seo";

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const organization = {
  "@type": "Organization", "@id": `${SITE_ORIGIN}/#organization`,
  name: "Testero", url: SITE_ORIGIN,
};

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [organization, {
    "@type": "WebSite", "@id": `${SITE_ORIGIN}/#website`, name: "Testero",
    url: SITE_ORIGIN, publisher: { "@id": organization["@id"] },
  }],
};

export function articleStructuredData(entry: ContentEntry, section: "Blog" | "FAQ") {
  const url = canonicalUrl(entry.href);
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "BlogPosting", "@id": `${url}#article`, headline: entry.title,
      description: entry.description, url, mainEntityOfPage: url,
      datePublished: entry.publishedAt, dateModified: entry.updatedAt ?? entry.publishedAt,
      author: organization, publisher: organization,
    }, {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
        { "@type": "ListItem", position: 2, name: section, item: canonicalUrl(`/${section.toLowerCase()}`) },
        { "@type": "ListItem", position: 3, name: entry.title, item: url },
      ],
    }],
  };
}
