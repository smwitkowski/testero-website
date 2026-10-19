import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";

const shots = "test-results/free-tier-monthly";
async function capture(page: Page, name: string, signedIn = true) {
  await mkdir(shots, { recursive: true });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    // The header verifies identity separately from the server-rendered dashboard.
    // Wait for its settled state after login, reload and paid-access changes.
    const header = page.getByRole("banner");
    if (signedIn && width === 1280) {
      const navigation = header.getByRole("navigation", { name: "Main navigation", exact: true });
      await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Account", exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
    } else if (signedIn) {
      await expect(header.getByRole("link", { name: "Dashboard", exact: true }).filter({ visible: true })).toBeVisible();
      await expect(header.getByRole("link", { name: "Start free", exact: true })).toHaveCount(0);
    } else if (width === 1280) {
      const navigation = header.getByRole("navigation", { name: "Main navigation", exact: true });
      await expect(navigation.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Account", exact: true })).toHaveCount(0);
    } else {
      await expect(header.getByRole("link", { name: "Start free", exact: true })).toBeVisible();
      await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0);
    }
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true });
  }
}

test("monthly free questions: fresh, 59→60 concurrent boundary, paid tracking and refund", async ({ page }, info) => {
  test.skip(process.env.TESTERO_QA === "1" && info.project.name !== "qa-1280", "Both capture widths in one isolated scenario");
  test.setTimeout(180_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname); expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `monthly-${randomUUID()}@example.test`, password = `Local-${randomUUID()}-Aa9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull(); const userId = created.data.user!.id;
  const monthStart = new Date().toISOString().slice(0, 7) + "-01";
  const domainCode = "MONITORING_ML_SOLUTIONS";
  try {
    await page.goto("/pricing"); await expect(page.getByRole("heading", { name: "Pricing", exact: true })).toBeVisible();
    await capture(page, "pricing", false);
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("60 of 60 free practice questions left this month");
    await capture(page, "quota-fresh");
    // Old exhausted month cannot affect the current allowance.
    const previous = new Date(`${monthStart}T00:00:00Z`); previous.setUTCMonth(previous.getUTCMonth() - 1);
    expect((await service.from("free_practice_quota").insert({ user_id: userId, month_start: previous.toISOString().slice(0, 10), questions_used: 60 })).error).toBeNull();
    await page.reload(); await expect(page.getByRole("status")).toContainText("60 of 60");
    const diagnostic = await page.request.post("/api/diagnostic", { data: { questionCount: 5 } });
    expect(diagnostic.status()).toBe(201); const diagnosticId = (await diagnostic.json()).sessionId;
    for (let i = 0; i < 5; i++) {
      const progress = await (await page.request.get(`/api/diagnostic/${diagnosticId}`)).json();
      expect((await page.request.post(`/api/diagnostic/${diagnosticId}/answer`, { data: { itemId: progress.currentQuestion.id, selectedLabel: progress.currentQuestion.options[0].label } })).status()).toBe(200);
    }
    await page.goto("/dashboard"); await expect(page.getByRole("heading", { name: "Latest diagnostic by domain", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore PMLE Pass", exact: true })).toBeVisible();
    await capture(page, "dashboard-free");
    expect((await service.from("free_practice_quota").insert({ user_id: userId, month_start: monthStart, questions_used: 59 })).error).toBeNull();
    await page.reload(); await expect(page.getByRole("status")).toContainText("1 of 60 free practice questions left this month");
    await capture(page, "quota-near-limit");
    const starts = await Promise.all(Array.from({ length: 4 }, () => page.request.post("/api/practice", { data: { domainCode } })));
    expect(starts.filter(response => response.status() === 201)).toHaveLength(1);
    expect(starts.filter(response => response.status() === 429)).toHaveLength(3);
    const practiceId = (await starts.find(response => response.status() === 201)!.json()).sessionId;
    const progress = await (await page.request.get(`/api/practice/${practiceId}`)).json(); expect(progress.totalQuestions).toBe(1);
    const answered = await page.request.post(`/api/practice/${practiceId}/answer`, { data: { itemId: progress.currentQuestion.id, selectedLabel: progress.currentQuestion.options[0].label } });
    expect(answered.status()).toBe(200); const feedback = (await answered.json()).feedback;
    expect(feedback.correctLabel).toBeTruthy(); expect(feedback).not.toHaveProperty("explanation"); expect(feedback).not.toHaveProperty("optionExplanations");
    const freeSummary = await (await page.request.get(`/api/practice/${practiceId}/summary`)).json();
    expect(freeSummary.hasPaidTracking).toBe(false);
    for (const key of ["score", "domainBreakdown", "readiness", "correctAnswers"]) expect(freeSummary).not.toHaveProperty(key);
    await page.goto(`/practice/${practiceId}/summary`); await expect(page.getByRole("heading", { name: "Your practice summary", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Practice score", exact: true })).toHaveCount(0);
    await capture(page, "summary-free");
    await page.goto("/dashboard"); await expect(page.getByRole("status")).toContainText("0 of 60 free practice questions left this month");
    await capture(page, "quota-exhausted");
    const intent = `pi_local_monthly_${randomUUID()}`;
    expect((await service.rpc("fulfill_pmle_pass", { p_user_id: userId, p_stripe_checkout_session_id: `cs_test_monthly_${randomUUID()}`, p_stripe_payment_intent_id: intent, p_stripe_customer_id: "cus_local_monthly", p_paid_at: new Date().toISOString() })).error).toBeNull();
    await page.reload(); await expect(page.getByText("Your paid access includes unlimited practice sessions.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore PMLE Pass", exact: true })).toHaveCount(0);
    await capture(page, "dashboard-paid");
    const paidSummary = await (await page.request.get(`/api/practice/${practiceId}/summary`)).json();
    expect(paidSummary.hasPaidTracking).toBe(true); expect(paidSummary.domainBreakdown).toHaveLength(1); expect(paidSummary.review[0].explanation).toBeTruthy();
    await page.goto(`/practice/${practiceId}/summary`); await expect(page.getByRole("heading", { name: "Practice score", exact: true })).toBeVisible(); await capture(page, "summary-paid");
    expect((await page.request.post("/api/practice", { data: { domainCode } })).status()).toBe(201);
    expect((await service.from("free_practice_quota").select("questions_used").eq("user_id", userId).eq("month_start", monthStart).single()).data!.questions_used).toBe(60);
    expect((await service.rpc("refund_pmle_pass", { p_stripe_payment_intent_id: intent, p_refunded_at: new Date().toISOString() })).error).toBeNull();
    expect((await (await page.request.get(`/api/practice/${practiceId}/summary`)).json()).hasPaidTracking).toBe(false);
    expect((await page.request.post("/api/practice", { data: { domainCode } })).status()).toBe(429);
  } finally { expect((await service.auth.admin.deleteUser(userId)).error).toBeNull(); }
});
