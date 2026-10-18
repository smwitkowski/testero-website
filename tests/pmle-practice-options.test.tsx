import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page, { metadata } from "@/app/pmle/practice-options-compared/page";
import { practiceOptions, comparisonChecked } from "@/lib/pmle/practice-options";
import sitemap from "@/app/sitemap";

describe("dated PMLE preparation comparison", () => {
  it("publishes eight sourced options with transparent unknowns and commercial disclosure", () => {
    const html = renderToStaticMarkup(<Page />);
    expect(practiceOptions).toHaveLength(8);
    for (const option of practiceOptions) {
      expect(html).toContain(option.name);
      for (const source of option.sources) expect(html).toContain(source);
    }
    expect(html).toContain(comparisonChecked);
    expect(html).toContain("Check site; not verified.");
    expect(practiceOptions[0].name).toBe("Testero");
    expect(html).toContain("not a quality ranking"); expect(html).toContain("Testero publishes this page");
    expect(practiceOptions.find(option => option.name === "Testero")!.price).toContain("USD $39 one-time for 90 days");
    expect(practiceOptions.find(option => option.name === "GCP Study Hub")!.price).toContain("$39/month");
    expect(html).toContain('href="/diagnostic"');
    expect(metadata.alternates?.canonical).toBe("https://testero.ai/pmle/practice-options-compared");
    expect(sitemap().map(item => item.url)).toContain("https://testero.ai/pmle/practice-options-compared");
  });
});
