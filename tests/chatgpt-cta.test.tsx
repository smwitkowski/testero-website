import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatgptPracticeUrl } from "@/lib/chatgpt-cta";
import { ChatgptCta } from "@/components/chatgpt-cta";
import { DiagnosticStart } from "@/components/diagnostic-start";
import CertPage from "@/app/certifications/[slug]/page";
import BlogPage from "@/app/blog/[slug]/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/analytics/client", () => ({ trackDiagnostic: vi.fn() }));
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CHATGPT_CTA_ENABLED", "");
  vi.stubEnv("NEXT_PUBLIC_CHATGPT_CTA_URL", "");
});
afterEach(() => vi.unstubAllEnvs());
const listing = "https://chatgpt.com/plugins/example?existing=keep&utm_source=old#practice";
function enable() {
  vi.stubEnv("NEXT_PUBLIC_CHATGPT_CTA_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_CHATGPT_CTA_URL", listing);
}
async function publicPages() {
  return [
    renderToStaticMarkup(createElement(DiagnosticStart)),
    renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "machine-learning-engineer" }) })),
    renderToStaticMarkup(await BlogPage({ params: Promise.resolve({ slug: "pmle-passing-score" }) })),
  ];
}
describe("default-off ChatGPT invitation", () => {
  it.each([undefined, "", "false", "1", "TRUE"])("requires exact opt-in, not %s", flag => {
    expect(chatgptPracticeUrl(flag, listing)).toBeNull();
  });
  it.each([undefined, "", "not a URL", "http://chatgpt.com/plugins/example", "javascript:alert(1)", "https://user:password@chatgpt.com/plugins/example"])("suppresses missing or unsafe URL %s", url => {
    expect(chatgptPracticeUrl("true", url)).toBeNull();
  });
  it("adds the requested source while preserving other URL parts", () => {
    const url = new URL(chatgptPracticeUrl("true", listing)!);
    expect(url.searchParams.getAll("utm_source")).toEqual(["chatgpt-cta"]);
    expect(url.searchParams.get("existing")).toBe("keep");
    expect(url.hash).toBe("#practice");
  });
  it("renders nothing by default, even with a configured URL", () => {
    expect(renderToStaticMarkup(createElement(ChatgptCta))).toBe("");
    vi.stubEnv("NEXT_PUBLIC_CHATGPT_CTA_URL", listing);
    expect(renderToStaticMarkup(createElement(ChatgptCta))).toBe("");
  });
  it("renders no invitation at any placement while off", async () => {
    for (const html of await publicPages()) expect(html).not.toContain("Practice in ChatGPT");
  });
  it("renders enabled demo practice at all three placements", async () => {
    enable();
    for (const html of await publicPages()) {
      expect(html).toContain('aria-label="Practice in ChatGPT"');
      expect(html).toContain("utm_source=chatgpt-cta");
      expect(html).toContain("PMLE demo questions");
    }
    const diagnostic = renderToStaticMarkup(createElement(DiagnosticStart));
    expect(diagnostic.indexOf("Begin diagnostic")).toBeLessThan(diagnostic.indexOf('aria-label="Practice in ChatGPT"'));
    const resume = renderToStaticMarkup(createElement(DiagnosticStart, { resumeId: "owned" }));
    expect(resume.indexOf("Resume diagnostic")).toBeLessThan(resume.indexOf('aria-label="Practice in ChatGPT"'));
    const blog = (await publicPages())[2];
    expect(blog.indexOf("<footer")).toBeLessThan(blog.indexOf('aria-label="Practice in ChatGPT"'));
  });
  it("does not advertise PMLE ChatGPT practice on other certifications or articles", async () => {
    enable();
    const cert = renderToStaticMarkup(await CertPage({ params: Promise.resolve({ slug: "cloud-engineer" }) }));
    const blog = renderToStaticMarkup(await BlogPage({ params: Promise.resolve({ slug: "ace-exam-guide-2026" }) }));
    expect(cert).not.toContain("Practice in ChatGPT");
    expect(blog).not.toContain("Practice in ChatGPT");
  });
});
