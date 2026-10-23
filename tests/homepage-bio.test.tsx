import { createElement } from "react";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import AboutPage from "@/app/about/page";
import { CertificationPreview } from "@/components/certification-preview";
import { FOUNDER_BIO } from "@/lib/content/founder";
import { PMLE_EXAM_GUIDE_URL } from "@/lib/constants/pmle-guide";

const state = vi.hoisted(() => ({ slide: 0, availability: {} as Record<string, string> }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => typeof initial === "number" ? [state.slide, vi.fn()] : actual.useState(initial) };
});
vi.mock("@/lib/certifications/availability", () => ({ getDiagnosticAvailabilityMap: async () => state.availability }));
beforeEach(() => { state.slide = 0; state.availability = { "machine-learning-engineer": "available", "data-engineer": "beta", "cloud-architect": "coming-soon", "cloud-engineer": "coming-soon" }; });

async function homeMarkup() {
  return new Promise<string>((resolve, reject) => {
    let html = "";
    const output = new PassThrough();
    output.on("data", chunk => { html += chunk.toString(); });
    output.on("end", () => resolve(html));
    const stream = renderToPipeableStream(createElement(HomePage), {
      onAllReady() { stream.pipe(output); }, onError: reject,
    });
  });
}

describe("PMLE homepage and founder", () => {
  it("starts with the exact PMLE hero and one-click five-question CTA", async () => {
    const html = await homeMarkup();
    expect(html).toContain("PMLE practice for the June 2026 exam guide</h1>");
    expect(html).toContain("Every option explained and checked against current Google Cloud docs. Start with a free 5-question readiness check, no account needed.");
    expect(html).toContain('href="/diagnostic?start=1&amp;length=5"');
    expect(html).toContain(`href="${PMLE_EXAM_GUIDE_URL}"`);
    expect(html.indexOf('id="pass"')).toBeLessThan(html.indexOf('id="other-exams"'));
    expect((html.match(/Not affiliated with Google/g) ?? []).length).toBe(1);
  });
  it("uses live statuses in the other-exam box without calling PDE coming soon", async () => {
    const html = await homeMarkup();
    expect(html).toContain('href="/diagnostic?cert=data-engineer"');
    expect(html).toContain(">Beta</span>");
    const coming = html.slice(html.indexOf("Diagnostics coming soon"), html.indexOf("We do not promise a launch date"));
    expect(coming).not.toContain("Professional Data Engineer");
    expect(coming).toContain("Professional Cloud Architect");
    expect(html).not.toContain("Only PMLE has a diagnostic");
  });
  it("shares the exact editable founder copy across homepage and about", async () => {
    const bioMarkup = renderToStaticMarkup(createElement("p", null, FOUNDER_BIO)).slice(3, -4);
    expect(await homeMarkup()).toContain(bioMarkup);
    expect(renderToStaticMarkup(createElement(AboutPage))).toContain(bioMarkup);
    expect(FOUNDER_BIO).toBe("Testero is built by Stephen Witkowski, an independent developer. I started it because PMLE practice material kept lagging behind Google's exam guide. Questions are drafted with AI from current Google Cloud documentation, then checked against those docs before they go live. When you report a problem, I fix the question and note the change.");
  });
  it("uses the same map for the PDE beta carousel and removes its beta when unavailable", () => {
    state.slide = 3;
    const enabled = renderToStaticMarkup(createElement(CertificationPreview, { availability: { "data-engineer": "beta" } }));
    expect(enabled).toContain(">Beta</span>");
    expect(enabled).toContain('href="/diagnostic?cert=data-engineer"');
    expect(enabled).not.toContain("This diagnostic is not available yet");
    const closed = renderToStaticMarkup(createElement(CertificationPreview, { availability: { "data-engineer": "coming-soon" } }));
    expect(closed).toContain("Coming soon");
    expect(closed).not.toContain('href="/diagnostic?cert=data-engineer"');
  });
});
