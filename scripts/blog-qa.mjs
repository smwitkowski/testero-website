import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const stage = process.argv[2];
if (!["before", "after"].includes(stage)) throw new Error("Expected before or after");
const base = "http://127.0.0.1:3000";
const catalog = JSON.parse(readFileSync("content/catalog.json", "utf8"));
const routes = ["/blog", "/faq", ...catalog.blog.map(e => e.href), ...catalog.faq.map(e => e.href)];
const out = process.argv[3] ?? "docs/blog-qa/screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [], links = new Set();
try {
  for (const width of [1280, 375]) for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
    const page = await context.newPage();
    for (const route of routes) {
      const errors = [];
      const onError = error => errors.push(error.message);
      page.on("pageerror", onError);
      const response = await page.goto(base + route);
      await page.locator("main h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const data = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        h1Count: document.querySelectorAll("main h1").length,
        headings: [...document.querySelectorAll("main h1,main h2,main h3,main h4")].map(e => ({level: Number(e.tagName.slice(1)),text:e.textContent})),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        background: getComputedStyle(document.body).backgroundColor,
        header: document.querySelector("body > header")?.textContent,
        footer: document.querySelector("body > footer")?.textContent,
        notice: document.querySelector('[aria-label="Exam preparation availability"]')?.textContent ?? null,
        links: [...document.querySelectorAll("a[href]")].map(e => e.getAttribute("href")),
        brokenImages: [...document.images].filter(e => e.complete && !e.naturalWidth).map(e => e.src),
      }));
      for (const href of data.links) if (href.startsWith("/") && !href.startsWith("//")) links.add(href.split("#")[0]);
      const name = route.slice(1).replaceAll("/", "--");
      await page.screenshot({ path: path.join(out, `${stage}-${name}-${width}-${colorScheme}.png`), fullPage: true });
      results.push({route,width,colorScheme,status:response.status(),errors,...data});
      page.off("pageerror", onError);
      console.log(stage, width, colorScheme, route, response.status(), data.documentWidth);
    }
    await context.close();
  }
  const crawl = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const href of links) {
    const response = await page.goto(base + href);
    crawl.push({href,status:response.status(),finalUrl:page.url()});
  }
  await context.close();
  writeFileSync(path.join(out, `${stage}.json`), JSON.stringify({results,crawl}, null, 2));
  const failures = results.filter(r => r.status !== 200 || r.documentWidth > r.viewportWidth || r.errors.length || r.brokenImages.length || r.h1Count !== 1 || !r.title || !r.description || r.canonical !== `https://testero.ai${r.route}`);
  if (failures.length || crawl.some(r => r.status !== 200)) throw new Error("Blog QA failed; inspect the JSON evidence");
} finally { await browser.close(); }
