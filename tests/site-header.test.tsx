import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/site-header";
import { verifiedNavigationUserId } from "@/lib/auth/navigation";
vi.mock("@/lib/auth/navigation", () => ({ verifiedNavigationUserId: vi.fn() }));
beforeEach(() => vi.mocked(verifiedNavigationUserId).mockReset());
describe("account navigation", () => {
  it("makes real logout discoverable for a verified account", async () => {
    vi.mocked(verifiedNavigationUserId).mockResolvedValue("verified-user");
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain('href="/account"');
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain('href="/login"');
  });
  it("does not advertise protected account routes when signed out", async () => {
    vi.mocked(verifiedNavigationUserId).mockResolvedValue(null);
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/account"');
    expect(html).not.toContain('href="/dashboard"');
  });
});
