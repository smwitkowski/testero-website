import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";

const directory = process.env.QA_SCREENSHOT_DIR;
async function shot(page: Page, name: string, width: number) {
  await expect(page.getByText(/Loading your (?:diagnostic|practice|free explanation)/)).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const header = page.locator("header").first();
  if (/^(?:paid-|isolated-free-|checkout-)/.test(name)) await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  if (await header.isVisible() && await header.getByRole("link", { name: "Dashboard", exact: true }).count()) {
    await expect(header.getByRole("link", { name: "Start free", exact: true })).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (directory) { await mkdir(directory, { recursive: true }); await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true }); }
}
function local(info: { project: { name: string } }) {
  test.skip(process.env.TESTERO_QA !== "1" || info.project.name !== "qa-1280", "Both widths once using local QA accounts");
}
async function login(page: Page, kind: string) {
  const accounts = JSON.parse(await readFile(".qa/accounts.json", "utf8"));
  await page.context().clearCookies(); await page.goto("/login?next=/dashboard");
  await page.getByLabel("Email", { exact: true }).fill(accounts[kind].email);
  await page.getByLabel("Password", { exact: true }).fill(accounts[kind].password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
}

test("ui-audit-p2 public auth tools", async ({ page }, info) => {
  local(info); test.setTimeout(180_000);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    // G05/06/07 H02/03 C02-06 P01 A01-03 T04/05: real anonymous public surfaces.
    for (const [route, name] of [["/", "home"], ["/missing-p2-page", "404"], ["/certifications", "directory"], ["/certifications/cloud-architect", "cloud-architect"], ["/certifications/data-engineer", "data-engineer"], ["/certifications/cloud-engineer", "cloud-engineer"], ["/certifications/agentic-architect", "agentic-architect"], ["/pricing", "pricing-anonymous"], ["/signup", "signup"], ["/login", "login"], ["/forgot-password", "forgot"], ["/faq", "faq"], ["/faq/what-is-google-cloud-certification", "faq-article"], ["/blog", "blog"], ["/blog/pmle-study-plan-by-domain", "blog-article"], ["/pmle/vertex-ai-agent-platform-cheat-sheet", "cheat-sheet"], ["/pmle/practice-options-compared", "practice-options"]]) {
      await page.goto(route); await expect(page.locator("main h1")).toBeVisible();
      await shot(page, name, width);
      if (["/signup", "/login", "/forgot-password"].includes(route)) {
        const authPosts: string[] = [];
        const watch = (request: import("@playwright/test").Request) => { if (request.method() === "POST") authPosts.push(request.url()); };
        page.on("request", watch);
        await page.locator("main form button[type=submit]").first().click();
        await shot(page, `${name}-empty-invalid`, width);
        await page.getByLabel("Email", { exact: true }).fill("malformed");
        await page.locator("main form button[type=submit]").first().click();
        await shot(page, `${name}-email-invalid`, width);
        expect(authPosts).toEqual([]); page.off("request", watch);
      }
      if (route === "/certifications") {
        for (const summary of await page.locator("details[open] > summary").all()) await summary.click();
        await shot(page, name, width);
      }
      if (route.startsWith("/certifications/")) {
        const email = page.locator('input[type="email"]').first();
        await email.fill("malformed");
        const posts: string[] = [];
        const watch = (request: import("@playwright/test").Request) => { if (request.method() === "POST") posts.push(request.url()); };
        page.on("request", watch);
        await page.getByRole("button", { name: "Notify me", exact: true }).first().click();
        await shot(page, `${name}-notify-invalid`, width);
        expect(posts).toEqual([]); page.off("request", watch);
      }
      if (route === "/certifications/cloud-architect" && width === 1280) {
        await page.evaluate(() => window.scrollTo(0, 1500));
        const sidebar = page.getByRole("complementary", { name: "Diagnostic availability" });
        expect(Math.round((await sidebar.boundingBox())!.y)).toBe(96);
        if (directory) await page.screenshot({ path: `${directory}/cloud-architect-sticky-${width}.png` });
      }
    }
    for (const [route, prefix] of [["/diagnostic", "diagnostic"], ["/pricing", "pricing"], ["/", "home"]]) {
      await page.emulateMedia({ colorScheme: "light" }); await page.goto(route);
      const light = await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor);
      await page.emulateMedia({ colorScheme: "dark" });
      expect(await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor)).toBe(light);
      expect(await page.locator("html").evaluate(element => getComputedStyle(element).colorScheme)).toBe("light");
      await shot(page, `${prefix}-dark-preference`, width); await page.emulateMedia({ colorScheme: "light" });
    }
    if (width === 390) {
      const menu = page.locator("header details > summary");
      await menu.click(); await page.keyboard.press("Tab"); await shot(page, "mobile-menu-focus", width);
      await page.keyboard.press("Escape"); await expect(page.locator("header details")).not.toHaveAttribute("open", ""); await expect(menu).toBeFocused();
      await menu.click();
      const mobileLinks = page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link");
      await mobileLinks.last().focus(); await page.keyboard.press("Tab"); await expect(page.locator("header details")).not.toHaveAttribute("open", "");
    }
    await page.goto("/pmle/sample-questions");
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Reveal answer and explanations" }).first().click();
    await shot(page, "sample-revealed", width);
    await page.goto("/tools/study-plan");
    await page.getByRole("button", { name: "Create study plan" }).click(); await shot(page, "study-plan-invalid", width);
    const exam = new Date(); exam.setDate(exam.getDate() + 43);
    await page.getByLabel("Exam date", { exact: true }).fill(exam.toISOString().slice(0, 10));
    await page.getByLabel("Study hours per week").fill("5");
    await page.getByRole("button", { name: "Create study plan" }).click();
    await expect(page.locator("#plan-result")).toBeVisible(); await shot(page, "study-plan-result", width);
    await page.getByLabel("Study hours per week").fill("0"); await page.getByRole("button", { name: "Create study plan" }).click();
    await expect(page.locator("#plan-result")).toHaveCount(0); await shot(page, "study-plan-invalid-after-result", width);
    await page.goto("/tools/which-google-cloud-certification");
    await page.getByLabel("4. What do you want to focus on?").selectOption("ml");
    await page.getByRole("button", { name: "Show my matches" }).click();
    await expect(page.locator("#picker-result")).toBeFocused(); await shot(page, "cert-picker-result", width);
  }
});

test("ui-audit-p2 diagnostic history saving report and results", async ({ page }, info) => {
  local(info); test.setTimeout(180_000);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 }); await page.context().clearCookies();
    await page.goto("/diagnostic");
    for (const count of [5, 10, 20]) {
      await page.locator(`input[name=diagnostic-length][value="${count}"]`).check(); await shot(page, `diagnostic-start-${count}`, width);
    }
    const created = await page.request.post("/api/diagnostic", { data: { questionCount: 10 } }); expect(created.status()).toBe(201);
    const { sessionId } = await created.json(); const api = `/api/diagnostic/${sessionId}`;
    await page.goto(`/diagnostic/${sessionId}`); await expect(page.getByText("Question 1 of 10", { exact: true })).toBeVisible(); await shot(page, "diagnostic-initial", width);
    const option = page.locator(".answer-option").first(); const optionBefore = await option.evaluate(element => ({ height: element.getBoundingClientRect().height, padding: getComputedStyle(element).padding, border: getComputedStyle(element).borderWidth, font: getComputedStyle(element).font, width: element.getBoundingClientRect().width, variable: getComputedStyle(element).getPropertyValue("--answer-padding") }));
    await page.getByRole("radio").first().check();
    expect(await option.evaluate(element => getComputedStyle(element).borderWidth)).toBe("3px");
    const optionAfter = await option.evaluate(element => ({ height: element.getBoundingClientRect().height, padding: getComputedStyle(element).padding, border: getComputedStyle(element).borderWidth, font: getComputedStyle(element).font, width: element.getBoundingClientRect().width, variable: getComputedStyle(element).getPropertyValue("--answer-padding") }));
    expect(optionAfter.height, JSON.stringify({ optionBefore, optionAfter })).toBe(optionBefore.height); await shot(page, "diagnostic-selected", width);
    const reportTrigger = page.getByRole("button", { name: "Report a problem with this question" });
    expect((await reportTrigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await reportTrigger.click();
    await page.getByLabel("Email (optional, only to follow up on this report)").fill("invalid");
    await page.getByRole("button", { name: "Send report", exact: true }).click(); await shot(page, "report-invalid", width);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let held = false;
    // Deliberate saving fixture: real local committed answer, held response only.
    await page.route(`**${api}/answer`, async route => { const response = await route.fetch(); held = true; await gate; await route.fulfill({ response }); }, { times: 1 });
    const action = page.locator("[data-diagnostic-actions]").getByRole("button").last();
    const nextWidth = (await action.boundingBox())!.width;
    await page.getByRole("button", { name: "Next question", exact: true }).click();
    expect((await action.boundingBox())!.width).toBe(nextWidth);
    await expect.poll(() => held).toBe(true); await shot(page, "diagnostic-saving-fixture", width); release();
    await expect(page.getByText("Question 2 of 10", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    expect((await action.boundingBox())!.width).toBe(nextWidth); await shot(page, "diagnostic-history", width);
    await page.getByRole("button", { name: "Next question", exact: true }).click();
    for (let ordinal = 2; ordinal <= 10; ordinal++) {
      if (ordinal === 6) { await page.reload(); await expect(page.getByText("Halfway there. Your domain picture is taking shape.")).toBeVisible(); await shot(page, "diagnostic-halfway", width); }
      const progress = await (await page.request.get(api)).json();
      expect((await page.request.post(`${api}/answer`, { data: { itemId: progress.currentQuestion.id, selectedLabel: progress.currentQuestion.options[0].label } })).status()).toBe(200);
    }
    await page.goto(`/diagnostic/${sessionId}/results`); await expect(page.getByRole("heading", { name: "PMLE readiness report", exact: true })).toBeVisible();
    expect((await page.getByRole("link", { name: "Retake the diagnostic", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const consent = page.locator('label:has(input[name="consent"])'); expect((await consent.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('input[name="email"]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(255, 255, 255)");
    for (const link of await page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await shot(page, "anonymous-results", width);
  }
});

test("ui-audit-p2 signed in free paid account pricing practice", async ({ page }, info) => {
  local(info); test.setTimeout(180_000);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const kind of ["paid"]) {
      await login(page, kind); await shot(page, `${kind}-dashboard`, width);
      await page.goto("/pricing"); await shot(page, `${kind}-pricing`, width);
      await page.goto("/account"); await shot(page, `${kind}-account`, width);
      const created = await page.request.post("/api/diagnostic", { data: { questionCount: 10 } }); expect(created.status()).toBe(201);
      const { sessionId } = await created.json(); const api = `/api/diagnostic/${sessionId}`;
      for (let index = 0; index < 10; index++) {
        const progress = await (await page.request.get(api)).json();
        expect((await page.request.post(`${api}/answer`, { data: { itemId: progress.currentQuestion.id, selectedLabel: progress.currentQuestion.options[0].label } })).status()).toBe(200);
      }
      await page.goto(`/diagnostic/${sessionId}/results`); await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
      await shot(page, `${kind}-results-review`, width);
      await page.goto("/dashboard"); await shot(page, `${kind}-dashboard-with-diagnostic`, width);
      const start = page.waitForResponse(response => response.url().endsWith("/api/practice") && response.request().method() === "POST");
      await page.getByRole("button", { name: /^(?:Practice |Start practice$)/ }).first().click();
      const started = await start;
      expect(started.status()).toBe(201);
      {
        await expect(page.getByRole("button", { name: "Submit answer", exact: true })).toBeVisible();
        await page.getByRole("radio").first().check();
        await page.getByRole("button", { name: "Submit answer", exact: true }).click();
        await expect(page.getByRole("button", { name: "Next question", exact: true })).toBeVisible(); await shot(page, `${kind}-practice-feedback`, width);
      }
    }
  }
});


test("ui-audit-p2 checkout UI fixtures processing active refunded error", async ({ page }, info) => {
  local(info); test.setTimeout(120_000);
  await login(page, "paid");
  // Deliberate UI fixtures, NOT evidence of live Stripe or a real grant/refund.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const status of ["processing", "active", "refunded", "error"]) {
      await page.route("**/api/billing/status?*", route => status === "error"
        ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture" }) })
        : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status, accessUntil: status === "active" ? "2027-01-16T00:00:00.000Z" : null }) }));
      await page.goto("/checkout/success?session_id=cs_p2_ui_fixture");
      await expect(page.locator("main").getByRole(status === "error" ? "alert" : "status")).toContainText(status === "active" ? "Your PMLE Pass is active" : status === "refunded" ? "This payment was refunded" : status === "error" ? "could not be verified" : "processing");
      await shot(page, `checkout-${status}-FIXTURE`, width);
      await page.unroute("**/api/billing/status?*");
    }
  }
});


test("ui-audit-p2 isolated free empty dashboard feedback and exhausted quota", async ({ page }, info) => {
  local(info); test.setTimeout(180_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname); expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const password = `Testero-${randomUUID()}-Aa9`;
  const email = `p2-free-${randomUUID()}@example.test`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(error).toBeNull(); expect(data.user).toBeTruthy();
  try {
    await page.context().clearCookies(); await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-empty-dashboard", width); }
    await page.goto("/account");
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-account", width); }
    await page.goto("/pricing");
    await expect(page.getByRole("link", { name: "Go to dashboard", exact: true })).toBeVisible();
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-pricing", width); }
    const diagnostic = await page.request.post("/api/diagnostic", { data: { questionCount: 10 } }); expect(diagnostic.status()).toBe(201);
    const diagnosticId = (await diagnostic.json()).sessionId;
    for (let i = 0; i < 10; i++) {
      const progress = await (await page.request.get(`/api/diagnostic/${diagnosticId}`)).json();
      expect((await page.request.post(`/api/diagnostic/${diagnosticId}/answer`, { data: { itemId: progress.currentQuestion.id, selectedLabel: progress.currentQuestion.options[0].label } })).status()).toBe(200);
    }
    await page.goto(`/diagnostic/${diagnosticId}/results`); await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-results-review", width); }
    await page.goto("/dashboard"); await expect(page.getByRole("heading", { name: "Latest diagnostic by domain", exact: true })).toBeVisible();
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-dashboard-with-diagnostic", width); }
    const created = page.waitForResponse(response => response.url().endsWith("/api/practice") && response.request().method() === "POST");
    await page.getByRole("button", { name: /^(?:Practice |Start practice$)/ }).first().click();
    const response = await created; expect(response.status()).toBe(201); const { sessionId } = await response.json();
    for (let ordinal = 1; ordinal <= 5; ordinal++) {
      await expect(page.getByText(`Question ${ordinal} of 5`, { exact: true })).toBeVisible();
      await page.getByRole("radio").first().check();
      const saved = page.waitForResponse(response => response.url().endsWith(`/api/practice/${sessionId}/answer`) && response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit answer", exact: true }).click(); expect((await saved).status()).toBe(200);
      if (ordinal === 1) for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-practice-feedback", width); }
      if (ordinal < 5) await page.getByRole("button", { name: "Next question", exact: true }).click();
    }
    const quota = await page.request.post("/api/practice", { data: { domainCode: "MONITORING_ML_SOLUTIONS" } }); expect(quota.status()).toBe(429);
    await page.goto("/dashboard");
    for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 844 }); await shot(page, "isolated-free-quota-exhausted", width); }
  } finally { const removed = await service.auth.admin.deleteUser(data.user!.id); expect(removed.error).toBeNull(); }
});
