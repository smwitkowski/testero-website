import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CheatSheetPage from "@/app/pmle/vertex-ai-agent-platform-cheat-sheet/page";
import BlogPage from "@/app/blog/[slug]/page";
import { nameMappings, mappingSource, CHEAT_SHEET_EMAIL_ENABLED } from "@/lib/pmle/name-mappings";
import sitemap from "@/app/sitemap";

describe("printable PMLE reference", () => {
  it("renders sourced mappings, original approximate weights and no email promise", async () => {
    const html = renderToStaticMarkup(<CheatSheetPage />);
    expect(nameMappings.length).toBeGreaterThan(0);
    for (const row of nameMappings) { expect(html).toContain(row.old); expect(html).toContain(row.new); }
    expect(html).toContain(mappingSource);
    expect(html).toContain("Print / save PDF"); expect(html).toContain("print:");
    for (const weight of [13, 16, 21, 20, 18]) expect(html).toContain(`~${weight}%`);
    expect(html).toContain("101%"); expect(html).toContain("Omitted:");
    expect(CHEAT_SHEET_EMAIL_ENABLED).toBe(false); expect(html).not.toContain('type="email"');
    expect(sitemap().map(row => row.url)).toContain("https://testero.ai/pmle/vertex-ai-agent-platform-cheat-sheet");
    const article = renderToStaticMarkup(await BlogPage({ params: Promise.resolve({ slug: "vertex-ai-agent-platform-name-mapping" }) }));
    expect(article).toContain('href="/pmle/vertex-ai-agent-platform-cheat-sheet"');
  });
});
