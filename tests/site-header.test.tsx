import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/site-header";
import { hasVerifiedNavigationSession } from "@/lib/auth/navigation";
vi.mock("@/lib/auth/navigation", () => ({ hasVerifiedNavigationSession: vi.fn() }));
beforeEach(() => vi.mocked(hasVerifiedNavigationSession).mockReset());
describe("account navigation", () => {
  it("makes real logout discoverable for a verified account", async () => {
    vi.mocked(hasVerifiedNavigationSession).mockResolvedValue(true);
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain('href="/login"');
  });
  it("does not advertise protected account routes when signed out", async () => {
    vi.mocked(hasVerifiedNavigationSession).mockResolvedValue(false);
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/account"');
    expect(html).not.toContain('href="/dashboard"');
  });
});
