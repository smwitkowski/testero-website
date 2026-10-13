import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SiteChrome } from "@/components/site-chrome";

const route = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

it.each(["/diagnostic/session-id", "/diagnostic/session-id/"])("hides site chrome on question route %s", pathname => {
  route.pathname = pathname;
  expect(renderToStaticMarkup(<SiteChrome><nav /></SiteChrome>)).toBe("");
});
it.each(["/", "/diagnostic", "/diagnostic/session-id/results", "/blog", "/faq", "/dashboard", "/practice/session-id"])("keeps site chrome on %s", pathname => {
  route.pathname = pathname;
  expect(renderToStaticMarkup(<SiteChrome><nav /></SiteChrome>)).toContain("<nav");
});
