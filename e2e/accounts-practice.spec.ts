import { armTransition, assertTransition } from "./transition-timing";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { captureV3 } from "./v3-capture";
import { assertRestoredSession } from "./prod-bank";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { DiagnosticProgress, DiagnosticResult } from "../lib/diagnostic/types";
import type { PracticeAnswerResponse, PracticeSummary } from "../lib/practice/types";

function localSetup() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
  expect(url.port).toBe("56541");
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
  return createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}
function noExplanations(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(["explanation", "explanation_text", "explanationText", "doc_links", "source_ref", "anonymous_owner_hash"]).not.toContain(key);
    noExplanations(child);
  }
}
async function mailLink(request: APIRequestContext, email: string, type: "signup" | "recovery") {
  let link = "";
  await expect.poll(async () => {
    const index = await request.get("http://127.0.0.1:56544/api/v1/messages");
    expect(index.status()).toBe(200);
    const mailbox = await index.json() as { messages: { ID: string; To: { Address: string }[] }[] };
    for (const message of mailbox.messages.filter(message => message.To.some(to => to.Address.toLowerCase() === email))) {
      const details = await (await request.get(`http://127.0.0.1:56544/api/v1/message/${encodeURIComponent(message.ID)}`)).json() as { HTML: string };
      const matches = [...details.HTML.matchAll(/href=["']([^"']+)["']/g)];
      for (const match of matches) {
        const candidate = new URL(match[1].replaceAll("&amp;", "&"));
        if (candidate.pathname !== "/auth/confirm" || candidate.searchParams.get("type") !== type) continue;
        expect(candidate.hostname).toBe("127.0.0.1");
        expect(candidate.port).toBe("3000");
        expect(candidate.searchParams.get("token_hash")).toBeTruthy();
        link = candidate.href;
        return true;
      }
    }
    return false;
  }, { timeout: 30_000, message: `Local ${type} email was not delivered` }).toBe(true);
  return link;
}

test("local account confirmation claims only owned diagnostics, practices past sixty with free tracking and locked Pass features", async ({ page, browser }) => {
  test.setTimeout(process.env.TESTERO_V3_SCREENSHOTS ? 300_000 : 240_000);
  const service = localSetup();
  const visualDirectory = process.env.TESTERO_V3_SCREENSHOTS ?? "test-results/accounts-visual";
  await mkdir(visualDirectory, { recursive: true });
  async function checkLayout(name: string) {
    const original = page.viewportSize();
    for (const width of process.env.TESTERO_QA === "1" ? [original!.width] : [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${visualDirectory}/${name}-${width}.png`, fullPage: true });
    }
  }
  const email = `v2-${randomUUID()}@example.test`;
  const password = `Testero-${randomUUID()}-Aa9`;
  const ids: string[] = [];
  const failures: string[] = [];
  const foreign = await browser.newContext();
  let userId: string | null = null;
  page.on("pageerror", error => failures.push(error.message));
  page.on("request", request => {
    if (!["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname)) failures.push("Unexpected external browser request");
  });
  try {
    for (const path of ["/dashboard", "/account", "/practice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "/practice/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/summary"]) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      const location = new URL(response.headers().location, "http://127.0.0.1:3000");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("next")).toBe(path);
    }
    const denied = await page.request.post("/api/practice", { data: { domainCode: "MONITORING_ML_SOLUTIONS" } });
    expect(denied.status()).toBe(401);

    const created = await page.request.post("/api/diagnostic", { data: { questionCount: 20 } });
    expect(created.status()).toBe(201);
    const { sessionId: diagnosticId } = await created.json() as { sessionId: string };
    ids.push(diagnosticId);
    await assertRestoredSession(service, diagnosticId);
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      const progress = await (await page.request.get(`/api/diagnostic/${diagnosticId}`)).json() as DiagnosticProgress;
      expect(progress.currentQuestion!.ordinal).toBe(ordinal);
      const response = await page.request.post(`/api/diagnostic/${diagnosticId}/answer`, { data: { itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label } });
      expect(response.status(), (await response.text()).slice(0, 180)).toBe(200);
    }
    const anonymousResult = await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json() as DiagnosticResult;
    expect(anonymousResult.review).toBeUndefined();
    noExplanations(anonymousResult);
    const foreignCreated = await foreign.request.post("http://127.0.0.1:3000/api/diagnostic", { data: {} });
    expect(foreignCreated.status()).toBe(201);
    const { sessionId: foreignId } = await foreignCreated.json() as { sessionId: string };
    ids.push(foreignId);
    await assertRestoredSession(service, foreignId);

    await page.goto(`/signup?next=${encodeURIComponent(`/diagnostic/${diagnosticId}/results`)}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    const signupResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/signup") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    expect((await signupResponse).status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();
    const before = await service.from("study_sessions").select("user_id").eq("id", diagnosticId).single();
    expect(before.data!.user_id).toBeNull();
    const confirmation = await mailLink(page.request, email, "signup");
    await page.goto(confirmation);
    await expect(page).toHaveURL(new RegExp(`/diagnostic/${diagnosticId}/results\\?signup=confirmed$`));
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const account = users.data.users.find(user => user.email === email);
    expect(account?.email_confirmed_at).toBeTruthy();
    userId = account!.id;
    const claims = await service.from("study_sessions").select("id,user_id,anonymous_owner_hash").in("id", [diagnosticId, foreignId]);
    expect(claims.data!.find(row => row.id === diagnosticId)).toMatchObject({ user_id: userId, anonymous_owner_hash: null });
    expect(claims.data!.find(row => row.id === foreignId)!.user_id).toBeNull();
    const result = await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json() as DiagnosticResult;
    expect(result.review).toHaveLength(20);
    expect(result.score).toBe(anonymousResult.score);
    noExplanations(result);
    expect((await page.request.get(`/api/diagnostic/${foreignId}`)).status()).toBe(404);
    expect((await foreign.request.get(`http://127.0.0.1:3000/api/diagnostic/${diagnosticId}/results`)).status()).toBe(404);
    const authCookies = (await page.context().cookies()).filter(cookie => cookie.name.includes("-auth-token") && !cookie.name.includes("code-verifier"));
    expect(authCookies.length).toBeGreaterThan(0);
    expect(authCookies.every(cookie => cookie.httpOnly)).toBe(true);
    await expect(page.getByRole("heading", { name: "Latest diagnostic by domain", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Practice / })).toHaveCount(1);
    await checkLayout("dashboard");
    await captureV3(page, "dashboard");
    if (process.env.TESTERO_V3_SCREENSHOTS) {
      for (const width of [768, 820, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const domainWidth = await page.locator("table tbody th").first().evaluate(cell => cell.getBoundingClientRect().width);
        expect(domainWidth).toBeGreaterThan(140);
        await page.screenshot({ path: `${process.env.TESTERO_V3_SCREENSHOTS}/dashboard-${width}.png`, fullPage: true });
      }
    }
    await page.getByRole("link", { name: "View diagnostic results", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    await expect(page.locator("[data-question-review-items] > li")).toHaveCount(1);
    const reviewNav = page.getByRole("navigation", { name: "Question review navigation" });
    await expect(reviewNav.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
    await expect(reviewNav.getByRole("button", { name: /^Review question / })).toHaveCount(20);
    await reviewNav.getByRole("button", { name: "Next", exact: true }).click();
    await expect(reviewNav.getByRole("button", { name: /^Review question 2,/ })).toHaveAttribute("aria-current", "step");
    await reviewNav.getByRole("button", { name: /^Review question 20,/ }).click();
    await expect(reviewNav.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await expect(page.locator("[data-question-review-items] > li")).toHaveCount(1);
    await reviewNav.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(reviewNav.getByRole("button", { name: /^Review question 19,/ })).toHaveAttribute("aria-current", "step");
    await page.goto("/dashboard");

    const startedResponse = page.waitForResponse(response => response.url().endsWith("/api/practice") && response.request().method() === "POST");
    await page.getByRole("button", { name: /^Practice / }).first().click();
    const started = await startedResponse;
    expect(started.status()).toBe(201);
    const { sessionId: practiceId } = await started.json() as { sessionId: string };
    ids.push(practiceId);
    await assertRestoredSession(service, practiceId, 5);
    await expect(page).toHaveURL(new RegExp(`/practice/${practiceId}$`));
    // No background progress GET: the committed answer carries the next safe item.
    const browserProgressReads: string[] = [];
    page.on("request", request => { if (request.method() === "GET" && request.url().endsWith(`/api/practice/${practiceId}`)) browserProgressReads.push(request.url()); });
    for (let ordinal = 1; ordinal <= 5; ordinal++) {
      await expect(page.getByText(`Question ${ordinal} of 5`, { exact: true })).toBeVisible();
      if (ordinal === 1) { await checkLayout("practice"); await captureV3(page, "practice-question"); }
      const progress = await (await page.request.get(`/api/practice/${practiceId}`)).json() as DiagnosticProgress;
      expect(progress.currentQuestion!.ordinal).toBe(ordinal);
      expect(Object.keys(progress.currentQuestion!).sort()).toEqual(["id", "ordinal", "domainCode", "stem", "options"].sort());
      noExplanations(progress);
      await page.getByRole("radio").first().check();
      if (ordinal <= 3) await armTransition(page, { path: `/api/practice/${practiceId}`, ordinal, total: 5, feedback: true });
      let releaseAnswer: (() => void) | undefined;
      let committedAnswer: Promise<void> | undefined;
      if (ordinal === 1) {
        await page.route(`**/api/practice/${practiceId}/answer`, async route => {
          const response = await route.fetch();
          committedAnswer = new Promise<void>(resolve => { releaseAnswer = resolve; });
          await committedAnswer;
          await route.fulfill({ response });
        }, { times: 1 });
      }
      const answerResponse = page.waitForResponse(response => response.url().endsWith(`/api/practice/${practiceId}/answer`) && response.request().method() === "POST");
      await page.getByRole("button", { name: "Submit answer", exact: true }).click();
      if (ordinal === 1) {
        await expect.poll(() => !!releaseAnswer).toBe(true);
        await expect(page.getByRole("button", { name: "Next question", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Saving answer…", exact: true })).toBeDisabled();
        releaseAnswer!();
      }
      const accepted = await answerResponse;
      expect(accepted.status()).toBe(200);
      const answer = await accepted.json() as PracticeAnswerResponse;
      if (ordinal <= 3) await assertTransition(page, `/api/practice/${practiceId}`, "feedback");
      expect(answer.answeredCount).toBe(ordinal);
      expect(answer.feedback!.itemId).toBe(progress.currentQuestion!.id);
      expect(answer.feedback!.correctLabel).toMatch(/^[A-D]$/);
      noExplanations(answer);
      await expect(page.getByRole("status")).toContainText(`the correct answer is ${answer.feedback!.correctLabel}.`);
      if (ordinal < 5) {
        if (ordinal > 1) await armTransition(page, { path: `/api/practice/${practiceId}`, ordinal: ordinal + 1, total: 5 });
        const next = page.getByRole("button", { name: "Next question", exact: true });
        await next.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
        await expect(page.getByText(`Question ${ordinal + 1} of 5`, { exact: true })).toBeVisible();
        if (ordinal > 1) await assertTransition(page, `/api/practice/${practiceId}`, "next");
        expect(browserProgressReads).toEqual([]);
      }
      else await page.getByRole("link", { name: "View summary", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Your practice summary", exact: true })).toBeVisible();
    await captureV3(page, "practice-summary");
    await expect(page.locator("[data-question-review-items] > li")).toHaveCount(5);
    await checkLayout("summary");
    const summaryResponse = await page.request.get(`/api/practice/${practiceId}/summary`);
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json() as PracticeSummary;
    expect(summary.review).toHaveLength(5);
    expect(summary).not.toHaveProperty("hasPaidTracking");
    expect(summary.correctAnswers).toBeGreaterThanOrEqual(0);
    expect(summary.score).toBeGreaterThanOrEqual(0);
    expect(summary.domainBreakdown).toHaveLength(1);
    await expect(page.getByRole("heading", { name: "Practice score", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Progress by domain", exact: true })).toBeVisible();
    noExplanations(summary);
    expect((await foreign.request.get(`http://127.0.0.1:3000/api/practice/${practiceId}/summary`)).status()).toBe(401);
    await page.getByRole("link", { name: "Back to dashboard", exact: true }).click();
    await expect(page.getByLabel("Practice domain", { exact: true })).toBeVisible();
    // These are real committed answers after a real email-confirmed signup, not seeded usage.
    for (let session = 0; session < 12; session++) {
      const started = await page.request.post("/api/practice", { data: { domainCode: "MONITORING_ML_SOLUTIONS" } });
      expect(started.status()).toBe(201);
      const nextId = (await started.json()).sessionId as string;
      ids.push(nextId);
      for (let ordinal = 1; ordinal <= 5; ordinal++) {
        const progress = await (await page.request.get(`/api/practice/${nextId}`)).json() as DiagnosticProgress;
        expect(progress.currentQuestion!.ordinal).toBe(ordinal);
        const accepted = await page.request.post(`/api/practice/${nextId}/answer`, { data: {
          itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label,
        } });
        expect(accepted.status()).toBe(200);
        noExplanations(await accepted.json());
      }
    }
    const answeredCount = await service.from("session_items").select("id", { count: "exact", head: true })
      .in("session_id", ids.slice(2)).not("selected_label", "is", null);
    expect(answeredCount.error).toBeNull();
    expect(answeredCount.count).toBe(65);
    const practices = await service.from("study_sessions").select("id").eq("user_id", userId).eq("kind", "practice");
    expect(practices.error).toBeNull();
    expect(practices.data).toHaveLength(13);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Your progress", exact: true })).toBeVisible();
    await expect(page.getByText(/questions left this month|quota exhausted/i)).toHaveCount(0);
    expect((await page.request.post("/api/practice", { data: { mode: "weak" } })).status()).toBe(403);
    expect((await page.request.post("/api/mock/start", { data: {} })).status()).toBe(403);
    await expect(page.getByRole("link", { name: "Unlock Timed mock exams with PMLE Pass", exact: true })).toBeVisible();
    await expect(page.getByText(/Fresh-first practice/).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Unlock Weak-area drills with PMLE Pass", exact: true })).toBeVisible();
    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "PMLE Pass", exact: true })).toBeVisible();
    await expect(page.getByText(/Coming in Phase 3/i)).toHaveCount(0);

    if (page.viewportSize()!.width < 1024) await page.locator("summary").click();
    await page.getByRole("navigation", { name: page.viewportSize()!.width < 1024 ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    expect((await page.request.get("/dashboard", { maxRedirects: 0 })).status()).toBe(307);
    await page.goto("/login?next=%2Fdashboard");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    expect((await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json()).review).toHaveLength(20);

    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill(email);
    const forgotResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/forgot-password"));
    await page.getByRole("button", { name: "Send reset link", exact: true }).click();
    const forgot = await forgotResponse;
    expect(forgot.status()).toBe(200);
    const generic = await forgot.json();
    const unknown = await page.request.post("/api/auth/forgot-password", { data: { email: `missing-${randomUUID()}@example.test`, next: "/dashboard" } });
    expect(unknown.status()).toBe(200);
    expect(await unknown.json()).toEqual(generic);
    const recovery = await mailLink(page.request, email, "recovery");
    await page.goto(recovery);
    await expect(page).toHaveURL(/\/reset-password$/);
    await captureV3(page, "reset-password");
    const newPassword = `${password}-new`;
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Update password", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Password updated" })).toContainText("Password updated", { timeout: 15_000 });
    if (new URL(page.url()).pathname === "/login") {
      await expect(page.getByRole("status")).toContainText("Please sign in again");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Password", { exact: true }).fill(newPassword);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    if (page.viewportSize()!.width < 1024) await page.locator("summary").click();
    await page.getByRole("navigation", { name: page.viewportSize()!.width < 1024 ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: "Account", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    expect(failures).toEqual([]);
  } finally {
    await foreign.close();
    if (!userId) {
      const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = users.data.users.find(user => user.email === email)?.id ?? null;
    }
    for (const id of ids) await service.from("study_sessions").delete().eq("id", id);
    if (userId) {
      const account = await service.auth.admin.getUserById(userId);
      expect(account.data.user?.email).toBe(email);
      expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
    }
  }
});
