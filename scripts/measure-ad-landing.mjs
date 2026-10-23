// Loopback only. Usage: MEASURE_ORIGIN=http://127.0.0.1:3002 node scripts/measure-ad-landing.mjs after-production
// Optional RESUME_DELAY_MS=5000 simulates a slow saved-progress API, not a live-service measurement.
// "interactive" requires the enabled button's hydrated React onClick; "enabled" alone includes static HTML.
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
const phase = process.argv[2] || "before";
const out = process.env.MEASURE_OUTPUT || `.qa/ad-landing/${phase}`;
const origin = process.env.MEASURE_ORIGIN || "http://127.0.0.1:3000";
const target = new URL(origin);
if (target.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(target.hostname)) throw new Error("Measurement requires a loopback HTTP server");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const rows = [];
try {
  const warm = await browser.newPage();
  await warm.goto(`${origin}/diagnostic?length=5`, { timeout: 120000 });
  await warm.getByRole("button", { name: /^(Begin diagnostic|Start the 5-question check)$/ }).waitFor({timeout: 120000});
  await warm.close();
  for (const width of [1280, 375]) {
    for (let run = 1; run <= 3; run++) {
      const context = await browser.newContext({ viewport: { width, height: 812 } });
      const page = await context.newPage();
      if (process.env.RESUME_DELAY_MS) await page.route("**/api/diagnostic", async route => {
        if (route.request().method() !== "GET") return route.continue();
        await delay(Number(process.env.RESUME_DELAY_MS));
        await route.fulfill({status: 200, json: {resumeId: null}}).catch(() => {});
      });
      const cdp = await context.newCDPSession(page);
      // Chrome DevTools Fast 4G preset: 4 Mbps down, 3 Mbps up, 20ms latency.
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 20, downloadThroughput: 4000000 / 8, uploadThroughput: 3000000 / 8 });
      await page.addInitScript(() => {
        window.__landing = { enabled: null, interactive: null, question: null, aboveFold: null, y: null };
        const check = () => {
          const buttons = [...document.querySelectorAll("button")];
          const cta = buttons.find(b => /^(Begin diagnostic|Start 5-question check|Start quick check|Start the 5-question check|Start a new 5-question check|Start over)$/.test(b.textContent.trim()));
          if (cta && !cta.disabled && cta.getClientRects().length && window.__landing.enabled === null) {
            const box = cta.getBoundingClientRect();
            window.__landing.enabled = performance.now(); window.__landing.aboveFold = box.bottom <= innerHeight && box.top >= 0; window.__landing.y = box.top;
          }
          const reactPropsKey = cta && Object.keys(cta).find(key => key.startsWith("__reactProps$"));
          if (cta && !cta.disabled && cta.getClientRects().length && reactPropsKey && typeof cta[reactPropsKey]?.onClick === "function" && window.__landing.interactive === null) window.__landing.interactive = performance.now();
          if (document.body?.textContent.includes("Question 1 of 5") && window.__landing.question === null) window.__landing.question = performance.now();
        };
        new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true });
        document.addEventListener("DOMContentLoaded", check);
        const frame = () => { check(); if (window.__landing.interactive === null) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      });
      const path = "/diagnostic?length=5&src=ad";
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForFunction(() => window.__landing.interactive !== null, null, { timeout: 120000 });
      if (run === 1) await page.screenshot({ path: `${out}/fresh-${width}.png`, fullPage: true });
      const metric = await page.evaluate(() => ({ ...window.__landing, domContentLoaded: performance.getEntriesByType("navigation")[0].domContentLoadedEventEnd }));
      rows.push({ width, run, ...metric });
      await context.close();
    }
  }
} finally { await browser.close(); }
await writeFile(`${out}/timing.json`, JSON.stringify({phase, resumeDelayMs: Number(process.env.RESUME_DELAY_MS || 0), throttle: "Fast 4G: 4Mbps down / 3Mbps up / 20ms RTT, no CPU throttling", mode: process.env.MEASURE_MODE || "local Next dev, route warmed, cold browser context each run", rows}, null, 2));
console.log(JSON.stringify(rows, null, 2));
