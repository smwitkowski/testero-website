import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CertificationsPage from "@/app/certifications/page";
import CertPage, { generateStaticParams } from "@/app/certifications/[slug]/page";
import { certifications, certificationPath } from "@/lib/certifications/catalog";
import { getCertification, checkedDate, variantFacts } from "@/lib/certifications/data";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { serializeJsonLd } from "@/lib/structured-data";
import sitemap from "@/app/sitemap";

describe("sourced certification directory", () => {
  it("generates exactly the registry, groups levels and links PMLE practice", () => {
    expect(generateStaticParams()).toEqual(certifications.map(cert => ({ slug: cert.cert_id })));
    expect(getCertification("../registry")).toBeUndefined();
    const html = renderToStaticMarkup(createElement(CertificationsPage));
    for (const cert of certifications) expect(html).toContain(`href="${certificationPath(cert.cert_id)}"`);
    expect(html).toContain('id="foundational"'); expect(html).toContain('id="associate"'); expect(html).toContain('id="professional"');
    expect(html).toContain("Practice available"); expect((html.match(/Diagnostic coming<\/p>/g) ?? []).length).toBe(14);
  });
  it.each(certifications)("renders sourced $cert_id with valid credential/breadcrumb data", async entry => {
    const cert = getCertification(entry.cert_id)!;
    const html = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: entry.cert_id }) }));
    expect(html).toContain(cert.name); expect(html).toContain(cert.cert_url); expect(html).toContain(checkedDate(cert).slice(0, 10));
    expect(html).toContain("Recommended experience"); expect(html).toContain("Not stated by Google");
    const schema = JSON.parse(serializeJsonLd(certificationStructuredData(cert)));
    expect(schema["@graph"][0].itemListElement).toHaveLength(3);
    expect(schema["@graph"][1]).toMatchObject({ "@type": "EducationalOccupationalCredential", name: cert.name, url: cert.cert_url });
    expect(sitemap().find(item => item.url.endsWith(certificationPath(entry.cert_id)))?.lastModified).toBe(checkedDate(cert));
  });
  it("does not normalize weights, infer validity or call beta facts GA facts", async () => {
    const pmle = getCertification("machine-learning-engineer")!;
    expect(pmle.guides[0].sections.reduce((sum, s) => sum + (s.weight_percent ?? 0), 0)).toBe(101);
    expect(variantFacts(pmle.exam_variants[0])).toContainEqual(["Validity", "Not stated by Google"]);
    const beta = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "agentic-architect" }) }));
    expect(beta).toContain("Beta"); expect(beta).toContain("without a year");
    const ace = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "cloud-engineer" }) }));
    expect(ace).toContain("(not included)"); expect(ace).toContain("Skills renewal");
  });
});
