import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth-form";
import { AuthScreen } from "@/components/auth-screen";
vi.mock("@/lib/analytics/client", () => ({ identifyAnalytics: vi.fn() }));
it("keeps password rules in account creation and recovery, not sign in", () => {
  expect(renderToStaticMarkup(createElement(AuthForm, { mode: "login" }))).not.toContain("Use 8–72 characters.");
  for (const mode of ["signup", "reset-password"] as const) expect(renderToStaticMarkup(createElement(AuthForm, { mode }))).toContain("Use 8–72 characters.");
});
it("labels the account tabpanel with the selected tab", () => {
  const html = renderToStaticMarkup(createElement(AuthScreen, { mode: "login", next: "/dashboard", confirmationFailed: false }));
  expect((html.match(/role="tab"/g) ?? [])).toHaveLength(2);
  expect((html.match(/aria-selected="true"/g) ?? [])).toHaveLength(1);
  expect(html).toContain('aria-labelledby="account-tab-1"');
});
