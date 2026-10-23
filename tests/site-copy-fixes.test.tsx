import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ReportQuestion } from "@/components/report-question";
import { questionReportBody } from "@/lib/question-reports/schema";

const state = vi.hoisted(() => ({ index: 0 }));
beforeEach(() => { state.index = 0; });
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (value: unknown) => [state.index++ === 0 ? true : value, vi.fn()],
}));

it("requires the user to choose a report reason instead of defaulting to wrong answer", () => {
  const html = renderToStaticMarkup(createElement(ReportQuestion, { sessionId: "session", itemId: "item", kind: "diagnostic" }));
  expect(html).toMatch(/<select[^>]*name="reason"[^>]*required/);
  expect(html).toContain('<option value="" disabled="" selected="">Choose a reason</option>');
  const input = { sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", itemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", kind: "diagnostic" };
  expect(questionReportBody.safeParse(input).success).toBe(false);
  expect(questionReportBody.safeParse({ ...input, reason: "" }).success).toBe(false);
  expect(questionReportBody.safeParse({ ...input, reason: "typo" }).success).toBe(true);
});

it("omits pricing count freshness rather than showing tomorrow's UTC date", () => {
  expect(readFileSync("app/pricing/page.tsx", "utf8")).not.toContain("Count checked");
});
