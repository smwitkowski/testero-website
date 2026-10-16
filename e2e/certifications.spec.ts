import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("certification directory is responsive and stores private, idempotent launch requests", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(process.env.PLAYWRIGHT_MANAGED_SERVER !== "1", "Uses production build and isolated local Supabase.");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(url.hostname).toBe("127.0.0.1"); expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const anon = createClient(url.href, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const email = `cert-hub-${randomUUID()}@example.test`;
  const screenshots = process.env.TESTERO_SCREENSHOTS || "test-results/certifications";
  await mkdir(screenshots, { recursive: true });
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [slug, heading] of [["", "Find the exam that fits your next step."], ["/machine-learning-engineer", "Professional Machine Learning Engineer"], ["/cloud-engineer", "Associate Cloud Engineer"]]) {
      const response = await page.goto(`/certifications${slug}`);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["cache-control"]).toMatch(/s-maxage=300(?:,|$)/);
      expect(response?.headers()["set-cookie"]).toBeUndefined();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: path.join(screenshots, `${slug.slice(1) || "index"}-${width}.png`), fullPage: true });
    }
  }
  try {
    await page.goto("/certifications/cloud-engineer?utm_source=local-check&utm_medium=browser&utm_campaign=hub-check");
    await page.getByLabel("Get notified when the Associate Cloud Engineer diagnostic is ready").fill(email);
    const submit = async () => {
      const response = page.waitForResponse(response => response.url().endsWith("/api/cert-waitlist") && response.request().method() === "POST");
      await page.getByRole("button", { name: "Notify me", exact: true }).click();
      return await response;
    };
    const fresh = await submit(); expect(fresh.status()).toBe(200); expect(fresh.headers()["cache-control"]).toBe("private, no-store");
    await expect(page.getByRole("status")).toHaveText("You're on the list");
    await page.reload(); await page.getByLabel("Get notified when the Associate Cloud Engineer diagnostic is ready").fill(email.toUpperCase());
    const duplicate = await submit(); expect(duplicate.status()).toBe(200); await expect(page.getByRole("status")).toHaveText("You're on the list");
    const rows = await service.from("cert_waitlist").select("id,cert_id,source_path,utm_source,utm_medium,utm_campaign").eq("email", email);
    expect(rows.error).toBeNull(); expect(rows.data).toHaveLength(1);
    expect(rows.data![0]).toMatchObject({ cert_id: "cloud-engineer", source_path: "/certifications/cloud-engineer", utm_source: "local-check", utm_medium: "browser", utm_campaign: "hub-check" });
    await page.reload(); await page.getByLabel("Get notified when the Associate Cloud Engineer diagnostic is ready").fill("not-an-email");
    expect(await page.locator("input[type=email]").evaluate(input => (input as HTMLInputElement).checkValidity())).toBe(false);
    const bad = await page.request.post("/api/cert-waitlist", { data: { email: "not-an-email", cert_id: "cloud-engineer" } });
    expect(bad.status()).toBe(400);
    expect((await anon.from("cert_waitlist").select("id")).error).not.toBeNull();
    expect((await anon.from("cert_waitlist").insert({ email, cert_id: "cloud-developer" })).error).not.toBeNull();
    console.log("PASS responsive index/PMLE/ACE1280+375; new+duplicate+invalid;1 stored row;UTM; anon read/write denied");
  } finally { expect((await service.from("cert_waitlist").delete().eq("email", email)).error).toBeNull(); }
});
