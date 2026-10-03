/** @jest-environment node */
import type { User } from "@supabase/supabase-js";
import React from "react";
import { redirect } from "next/navigation";
import Layout from "@/app/practice/question/layout";
import SessionLayout from "@/app/practice/layout";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
jest.mock("next/navigation", () => ({ redirect: jest.fn(() => { throw new Error("REDIRECT"); }) }));
jest.mock("@/lib/access/pmleEntitlements.server", () => ({ getPmleAccessLevelForRequest: jest.fn() }));
const access = jest.mocked(getPmleAccessLevelForRequest);
const children = React.createElement("div", null, "Practice");
beforeEach(() => jest.clearAllMocks());
it.each(["ANONYMOUS", "FREE"] as const)("redirects %s standalone practice to the pass", async (accessLevel) => {
  access.mockResolvedValue({ accessLevel, user: accessLevel === "FREE" ? { id: "user" } as User : null });
  await expect(Layout({ children })).rejects.toThrow("REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/pricing?gated=1&feature=practice");
});
it("allows authenticated paid practice", async () => {
  access.mockResolvedValue({ accessLevel: "SUBSCRIBER", user: { id: "user" } as User });
  expect(await Layout({ children })).toBe(children);
});
it("fails closed on lookup errors", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  access.mockRejectedValue(new Error("lookup"));
  await expect(Layout({ children })).rejects.toThrow("REDIRECT");
  spy.mockRestore();
});
it("keeps quota-backed session routes open", () => {
  expect(SessionLayout({ children })).toBe(children);
  expect(access).not.toHaveBeenCalled();
});
