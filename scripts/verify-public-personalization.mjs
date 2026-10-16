import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:3116";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Use a local built app");
const browser = await chromium.launch();
try {
  for (const [name, userId, access] of [
    ["anonymous", null, { signedIn: false }],
    ["free", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { signedIn: true, owned: false }],
    ["owned", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { signedIn: true, owned: true, expiresAt: "2027-01-01T00:00:00Z" }],
    ["legacy", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", { signedIn: true, owned: true, expiresAt: null }],
    ["unavailable", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", null],
  ]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let navigationRequests = 0;
    await page.route("**/api/auth/navigation", route => {
      navigationRequests++;
      return route.fulfill({ json: { userId } });
    });
    await page.route("**/api/billing/access", route => access
      ? route.fulfill({ json: access })
      : route.fulfill({ status: 503, json: { error: "Billing unavailable" } }));
    await page.goto(`${base}/pricing`);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await nav.getByRole("link", { name: userId ? "Dashboard" : "Sign in", exact: true }).waitFor();
    assert.equal(await nav.getByRole("link", { name: "Account", exact: true }).count(), userId ? 1 : 0);
    if (!access) await page.getByText("Unable to check pass access.", { exact: false }).waitFor();
    else if (access.owned) {
      await page.getByRole("link", { name: "Go to practice", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: /Get PMLE Pass/ }).count(), 0);
      await page.getByText(access.expiresAt ? "January 1, 2027" : "Your active subscription already includes PMLE Pass features.", { exact: true }).waitFor();
    } else if (access.signedIn) await page.getByRole("button", { name: /Get PMLE Pass/ }).waitFor();
    else await page.getByRole("link", { name: "Create an account to get PMLE Pass" }).waitFor();
    await page.goto(`${base}/`);
    await nav.getByRole("link", { name: userId ? "Dashboard" : "Sign in", exact: true }).waitFor();
    assert.equal(await page.locator('link[rel="preload"][as="font"]').count(), 2);
    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter(face => face.family.includes("Testero IBM Plex Sans")).map(face => ({ weight: face.weight, style: face.style, status: face.status }));
    });
    assert.equal(faces.length, 4);
    assert(faces.some(face => face.weight === "400" && face.style === "normal" && face.status === "loaded"));
    assert(faces.some(face => face.weight === "600" && face.status === "loaded"));
    assert(faces.some(face => face.style === "italic" && face.status === "unloaded"));
    assert(navigationRequests >= 2);
    assert.deepEqual(errors, []);
    console.log(`${name}: navigation, pricing, fonts, hydration passed`);
    await context.close();
  }
} finally { await browser.close(); }
