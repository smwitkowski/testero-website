import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import { publicSampleSchema, publicSamplesSchema } from "@/lib/public-samples/schema";
import { getPublicSamples } from "@/lib/public-samples/loader";
import { PublicSampleQuestion } from "@/components/public-sample-question";
import Page from "@/app/pmle/sample-questions/page";
import { RelatedPmleGuides } from "@/components/related-pmle-guides";
import sitemap from "@/app/sitemap";

vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: vi.fn(actual.useState) };
});
const sample = {
  id: "00000000-0000-4000-8000-000000000001", domain: "MONITORING_ML_SOLUTIONS", stem: "Your model needs monitoring. What should you do?",
  options: { A: "First approach", B: "Second approach", C: "Third approach", D: "Fourth approach" }, key: "B" as const,
  rationale: { A: "Not A because of drift.", B: "B measures the required change.", C: "C does not measure drift.", D: "D measures another signal." },
  officialDocs: [{ title: "Model monitoring", url: "https://cloud.google.com/vertex-ai/docs/model-monitoring/overview" }],
};
describe("public-only PMLE sample publication", () => {
  it("validates reviewed content, exact A–D options, official docs, domains, size and unique identities", () => {
    expect(publicSampleSchema.parse(sample)).toEqual(sample);
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...sample, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
    expect(publicSamplesSchema.parse(ten)).toHaveLength(10);
    for (const invalid of [
      { ...sample, options: { A: "A", B: "B", C: "C" } }, { ...sample, rationale: { ...sample.rationale, D: " " } },
      { ...sample, key: "E" }, { ...sample, domain: "not-a-domain" },
      { ...sample, officialDocs: [{ title: "Fake", url: "https://cloud.google.com.evil.example/doc" }] },
      { ...sample, officialDocs: [] }, { ...sample, stem: " " },
    ]) expect(publicSampleSchema.safeParse(invalid).success).toBe(false);
    expect(publicSamplesSchema.safeParse([sample]).success).toBe(false);
    expect(publicSamplesSchema.safeParse(Array(10).fill(sample)).success).toBe(false);
    expect(() => publicSamplesSchema.parse(getPublicSamples())).not.toThrow();
  });
  it("shows no false question-count or quiz structured-data claim while samples are empty", () => {
    const html = renderToStaticMarkup(<Page />);
    if (getPublicSamples().length === 0) {
      expect(html).toContain("Samples are being prepared");
      expect(html).not.toContain("application/ld+json");
    }
    expect(html).toContain('href="/diagnostic"');
    expect(html).toContain("Take the free 20-question diagnostic");
    expect(sitemap().map(entry => entry.url)).toContain("https://testero.ai/pmle/sample-questions");
    expect(renderToStaticMarkup(<RelatedPmleGuides exam="Professional Machine Learning Engineer" />)).toContain('href="/pmle/sample-questions"');
  });
  it("renders all ten reviewed public samples with four choices each", () => {
    const questions = getPublicSamples();
    expect(questions).toHaveLength(10);
    const html = renderToStaticMarkup(<Page />);
    expect((html.match(/<fieldset/g) ?? [])).toHaveLength(10);
    expect((html.match(/type="radio"/g) ?? [])).toHaveLength(40);
    for (const question of questions) expect(html).toContain(`id="sample-${question.id}"`);
    expect(html).not.toContain("Samples are being prepared");
    expect(html).toContain("application/ld+json");
  });
  it("hides feedback until reveal and renders every rationale and source once revealed", () => {
    let html = renderToStaticMarkup(<PublicSampleQuestion question={sample} index={0} />);
    expect(html).toContain('type="radio"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain(sample.rationale.B);
    vi.mocked(useState).mockReturnValueOnce(["A", vi.fn()]).mockReturnValueOnce([true, vi.fn()]);
    html = renderToStaticMarkup(<PublicSampleQuestion question={sample} index={0} />);
    expect(html).toContain("Hide explanations");
    expect(html).toContain("You chose A.");
    expect(html).toContain("Answer: B.");
    for (const text of Object.values(sample.rationale)) expect(html).toContain(text);
    expect(html).toContain(sample.officialDocs[0].url);
    expect(html).toContain('href="/diagnostic"');
  });
});
