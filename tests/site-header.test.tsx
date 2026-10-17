import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteHeader } from "@/components/site-header";
import { verifiedNavigationUserId } from "@/lib/auth/navigation";
vi.mock("@/lib/auth/navigation", () => ({ verifiedNavigationUserId: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
describe("shared account navigation shell", () => {
  it("shows sign in without reading request cookies while prerendering", () => {
    const html = renderToStaticMarkup(SiteHeader());
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/account"');
    expect(html).not.toContain('href="/dashboard"');
    expect(verifiedNavigationUserId).not.toHaveBeenCalled();
  });
});
