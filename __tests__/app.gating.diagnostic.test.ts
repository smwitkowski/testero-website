/** @jest-environment node */
import React from "react";
import Layout from "@/app/diagnostic/layout";
import { canUseFeature } from "@/lib/access/pmleEntitlements";
it.each(["ANONYMOUS", "FREE", "SUBSCRIBER"] as const)("allows diagnostics and retakes for %s", (level) => {
  const children = React.createElement("div", null, "Diagnostic");
  expect(Layout({ children })).toBe(children);
  expect(canUseFeature(level, "DIAGNOSTIC_RUN")).toBe(true);
});
