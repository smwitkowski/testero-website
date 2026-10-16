import { expect, it } from "vitest";
import { allowWaitlistRequest } from "@/lib/certifications/rate-limit";
it("bounds attempts per instance, separates buckets and expires them", () => {
  const req = new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.1" } });
  for (let i = 0; i < 5; i++) expect(allowWaitlistRequest(req, 0)).toBe(true);
  expect(allowWaitlistRequest(req, 0)).toBe(false);
  expect(allowWaitlistRequest(new Request("http://localhost", { headers: { "x-forwarded-for": "192.0.2.2" } }), 0)).toBe(true);
  expect(allowWaitlistRequest(req, 60_000)).toBe(true);
});

it("bounds rotated forwarded headers per instance", () => {
  for (let i = 0; i < 100; i++) expect(allowWaitlistRequest(new Request("http://localhost", { headers: { "x-forwarded-for": `rotated-${i}` } }), 120_000)).toBe(true);
  expect(allowWaitlistRequest(new Request("http://localhost", { headers: { "x-forwarded-for": "another-rotated" } }), 120_000)).toBe(false);
});
