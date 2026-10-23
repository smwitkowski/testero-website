import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement, useState, type FormEvent, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthForm } from "@/components/auth-form";
import { LogoutButton } from "@/components/logout-button";
import { AnalyticsIdentity } from "@/components/analytics-identity";
import { Button } from "@/components/ui/button";
import { AUTH_MESSAGES } from "@/lib/auth/errors";

const mocks = vi.hoisted(() => ({ identify: vi.fn(), reset: vi.fn(), assign: vi.fn() }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn((value: unknown) => [value, vi.fn()]),
    useEffect: (effect: () => void) => { effect(); } };
});
vi.mock("@/lib/analytics/client", () => ({ identifyAnalytics: mocks.identify, resetAnalytics: mocks.reset, analyticsHeaders: () => ({}) }));

function find(node: ReactElement, type: unknown): ReactElement | undefined {
  if (node.type === type) return node;
  const children = (node.props as { children?: unknown }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child && typeof child === "object" && "props" in child) {
      const match = find(child as ReactElement, type); if (match) return match;
    }
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:3000", assign: mocks.assign } });
  vi.stubGlobal("FormData", class {
    get(name: string) { return name === "email" ? "learner@example.com" : "private-password"; }
  });
});
afterEach(() => vi.unstubAllGlobals());

it.each([200, 401])("identifies only successful login responses (%s)", async status => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ userId, href: "/dashboard" }), { status }));
  const form = find(AuthForm({ mode: "login" }), "form")!;
  const submit = (form.props as { onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }).onSubmit;
  await submit({ preventDefault: vi.fn(), currentTarget: { reset: vi.fn(), elements: { namedItem: () => ({ validity: { typeMismatch: false }, focus: vi.fn() }) } } } as unknown as FormEvent<HTMLFormElement>);
  if (status === 200) {
    expect(mocks.identify.mock.calls).toEqual([[userId]]);
    expect(mocks.assign).toHaveBeenCalledWith("/dashboard");
    expect(mocks.identify.mock.invocationCallOrder[0]).toBeLessThan(mocks.assign.mock.invocationCallOrder[0]);
  } else {
    expect(mocks.identify).not.toHaveBeenCalled(); expect(mocks.assign).not.toHaveBeenCalled();
  }
});
it.each([200, 503])("resets identity only after successful logout (%s)", async status => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status }));
  const button = find(LogoutButton(), Button)!;
  await (button.props as { onClick: () => Promise<void> }).onClick();
  if (status === 200) {
    expect(mocks.reset).toHaveBeenCalledOnce();
    expect(mocks.assign).toHaveBeenCalledWith("http://127.0.0.1:3000/");
    expect(mocks.reset.mock.invocationCallOrder[0]).toBeLessThan(mocks.assign.mock.invocationCallOrder[0]);
  } else {
    expect(mocks.reset).not.toHaveBeenCalled(); expect(mocks.assign).not.toHaveBeenCalled();
  }
});
it("identifies the verified server user when the identity component mounts", () => {
  const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(AnalyticsIdentity({ userId })).toBeNull();
  expect(mocks.identify.mock.calls).toEqual([[userId]]);
});

it("offers sign-in and password reset links in the generic signup success message", () => {
  vi.mocked(useState).mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => ["", vi.fn()] as never)
    .mockImplementationOnce(() => [AUTH_MESSAGES.signup, vi.fn()] as never);
  const form = AuthForm({ mode: "signup" });
  const success = find(form, "h2")!;
  expect(renderToStaticMarkup(success)).toContain("Check your email");
  const status = (form.props as { children: ReactElement[] }).children[0];
  const html = renderToStaticMarkup(status);
  expect(html).toContain(AUTH_MESSAGES.signup);
  expect(html).toContain('Already have an account? <a');
  expect(html).toMatch(/href="\/login"[^>]*>Sign in<\/a>/);
  expect(html).toMatch(/href="\/forgot-password"[^>]*>reset your password<\/a>/);
  expect(html).not.toMatch(/account already exists|email already registered/i);
});
it("does not show signup recovery help before submission or after a password reset request", () => {
  expect(renderToStaticMarkup(createElement(AuthForm, { mode: "signup" }))).not.toContain("reset your password");
  vi.mocked(useState).mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => ["", vi.fn()] as never)
    .mockImplementationOnce(() => [AUTH_MESSAGES.recovery, vi.fn()] as never);
  expect(renderToStaticMarkup(createElement(AuthForm, { mode: "forgot-password" }))).not.toContain("Already have an account?");
});

it("hides confirmation resend before login fails", () => {
  const html = renderToStaticMarkup(createElement(AuthForm, { mode: "login" }));
  expect(html).not.toContain("Resend confirmation email");
});
it("offers generic confirmation resend after a failed login without exposing account state", () => {
  vi.mocked(useState).mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => [AUTH_MESSAGES.credentials, vi.fn()] as never)
    .mockImplementationOnce(() => ["", vi.fn()] as never)
    .mockImplementationOnce(() => ["learner@example.com", vi.fn()] as never);
  const html = renderToStaticMarkup(createElement(AuthForm, { mode: "login" }));
  expect(html).toContain("Resend confirmation email");
  expect(html).not.toContain("isn’t confirmed yet");
});
it("sets the same resend affordance after generic rejected credentials", async () => {
  const confirmation = vi.fn();
  vi.mocked(useState).mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => [false, vi.fn()] as never)
    .mockImplementationOnce(() => ["", vi.fn()] as never)
    .mockImplementationOnce(() => ["", vi.fn()] as never)
    .mockImplementationOnce(() => [null, confirmation] as never);
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: AUTH_MESSAGES.credentials }, { status: 401 }));
  const form = find(AuthForm({ mode: "login" }), "form")!;
  await (form.props as { onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> }).onSubmit({ preventDefault: vi.fn(), currentTarget: { reset: vi.fn(), elements: { namedItem: () => ({ validity: { typeMismatch: false }, focus: vi.fn() }) } } } as unknown as FormEvent<HTMLFormElement>);
  expect(confirmation).toHaveBeenCalledWith("learner@example.com");
});
