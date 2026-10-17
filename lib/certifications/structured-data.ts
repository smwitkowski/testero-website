import { checkedDate, type Certification } from "./data";
import { certificationPath, certificationSummaries } from "./catalog";
import { canonicalUrl } from "@/lib/seo";

export function certificationStructuredData(cert?: Certification) {
  const items = [{ name: "Home", item: canonicalUrl("/") }, { name: "Certifications", item: canonicalUrl("/certifications") }];
  if (cert) items.push({ name: cert.name, item: canonicalUrl(certificationPath(cert.cert_id)) });
  return {
    "@context": "https://schema.org",
    "@graph": [{ "@type": "BreadcrumbList", itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, ...item })) },
      ...(cert ? [{ "@type": "EducationalOccupationalCredential", "@id": `${canonicalUrl(certificationPath(cert.cert_id))}#credential`,
        name: cert.name, description: certificationSummaries[cert.cert_id], url: cert.cert_url, dateModified: checkedDate(cert).slice(0, 10),
        credentialCategory: `${cert.level} certification`, recognizedBy: { "@type": "Organization", name: "Google", url: "https://cloud.google.com/learn/certification" },
      }] : [])],
  };
}
