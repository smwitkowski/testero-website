import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CertificationsPage from "@/app/certifications/page";
import CertPage, { generateStaticParams } from "@/app/certifications/[slug]/page";
import { certifications, certificationPath } from "@/lib/certifications/catalog";
import { getCertification, checkedDate, variantFacts, deliveryLabel, skillsRenewalSummary } from "@/lib/certifications/data";
import { certificationEditorial } from "@/lib/certifications/editorial";
import { certificationStructuredData } from "@/lib/certifications/structured-data";
import { serializeJsonLd } from "@/lib/structured-data";
import sitemap from "@/app/sitemap";
import overviews from "@/lib/certifications/verified-overviews.json";

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
    expect(html).toContain("Who this exam is for"); expect(html).toContain("How to prepare");
    expect(html.indexOf('aria-label="Exam summary"')).toBeLessThan(html.indexOf('aria-label="Diagnostic availability"'));
    expect(html.indexOf('aria-label="Diagnostic availability"')).toBeLessThan(html.indexOf('id="exam-audience"'));
    if (cert.recommended_experience) {
      expect(html).toContain("Google recommends:");
      expect(cert.recommended_experience_source?.url).toBe(cert.cert_url);
      expect(Number.isNaN(Date.parse(cert.recommended_experience_source!.retrieved_at))).toBe(false);
    }
    if (entry.cert_id !== "machine-learning-engineer" && entry.cert_id !== "agentic-architect") {
      const overview = overviews[entry.cert_id as keyof typeof overviews];
      expect(overview).toBeDefined();
      expect(html).toContain(overview.checked);
      for (const area of overview.areas) expect(html).toContain(area.replaceAll("&", "&amp;"));
      expect(html).toContain('id="cert-overview"');
      expect(html).toContain('href="/certifications/machine-learning-engineer"');
      expect(html).toContain("Notify me");
    }
    const prose = certificationEditorial[entry.cert_id];
    const wordCount = [prose.audience, ...prose.steps].join(" ").split(/\s+/).length;
    expect(prose.steps.length).toBeGreaterThanOrEqual(3); expect(prose.steps.length).toBeLessThanOrEqual(5);
    expect(wordCount).toBeGreaterThanOrEqual(150); expect(wordCount).toBeLessThanOrEqual(250);
    const schema = JSON.parse(serializeJsonLd(certificationStructuredData(cert)));
    expect(schema["@graph"][0].itemListElement).toHaveLength(3);
    expect(schema["@graph"][1]).toMatchObject({ "@type": "EducationalOccupationalCredential", name: cert.name, url: cert.cert_url });
    expect(sitemap().find(item => item.url.endsWith(certificationPath(entry.cert_id)))?.lastModified).toBe(checkedDate(cert));
  });
  it("does not normalize weights, infer validity or call beta facts GA facts", async () => {
    const pmle = getCertification("machine-learning-engineer")!;
    expect(pmle.guides[0].sections.reduce((sum, s) => sum + (s.weight_percent ?? 0), 0)).toBe(101);
    const sparse = { ...pmle.exam_variants[0], validity_stated: null, duration_stated: null, duration_minutes: null };
    expect(variantFacts(sparse)).not.toContainEqual(["Validity", "Not stated by Google"]);
    expect(variantFacts(sparse)).toContainEqual(["Duration", "Not stated by Google"]);
    expect(variantFacts(sparse).some(([name]) => name.startsWith("Case stud"))).toBe(false);
    expect(deliveryLabel(pmle.exam_variants[0].delivery_stated)).toBe("Online proctored or at a test center");
    const beta = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "agentic-architect" }) }));
    expect(beta).toContain("Beta"); expect(beta).toContain("without a year");
    const ace = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "cloud-engineer" }) }));
    expect(ace).toContain("(not included)"); expect(ace).toContain("Skills renewal: complete designated courses or skill badges; renews for 1 year.");
    expect(ace).toContain("~20%"); expect(ace).not.toContain("Status in snapshot");
    expect(skillsRenewalSummary(getCertification("cloud-engineer")!.exam_variants[2])).toContain("1 year");
    const pca = getCertification("cloud-architect")!;
    expect(variantFacts(pca.exam_variants[0])).toContainEqual(["Case studies per exam", "2"]);
  });
});
