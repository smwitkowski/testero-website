import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SiteNavigation } from "@/components/site-navigation";
const state = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/components/account-navigation", () => ({ AccountNavigation: () => null, useNavigationUser: () => state.userId }));
it.each([null, "free-user", "paid-user"])("uses verified navigation identity for the mobile action: %s", userId => {
  state.userId = userId;
  const html = renderToStaticMarkup(createElement(SiteNavigation));
  expect(html).toContain(userId ? 'href="/dashboard">Dashboard</a>' : 'href="/diagnostic">Start free</a>');
  if (userId) expect(html).not.toContain("Start free");
});
