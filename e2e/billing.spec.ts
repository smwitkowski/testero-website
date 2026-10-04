import { test, expect } from "@playwright/test";
import { assertRestoredSession, assertRestoredPaidReview } from "./prod-bank";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import type { DiagnosticProgress, DiagnosticResult } from "../lib/diagnostic/types";
import type { PracticeAnswerResponse, PracticeSummary } from "../lib/practice/types";

function noPaidContent(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(["explanation", "optionExplanations", "explanation_text", "question_id", "anonymous_owner_hash", "doc_links"]).not.toContain(key);
    noPaidContent(child);
  }
}
test("local signed webhook grants paid explanations and unlimited practice; refund wins over replay", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(url.hostname).toBe("127.0.0.1"); expect(url.port).toBe("56541");
  expect(process.env.TESTERO_LOCAL_STRIPE).toBe("1");
  expect(process.env.STRIPE_SECRET_KEY).toBe("sk_test_testero_local_only");
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signer = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const email = `paid-${randomUUID()}@example.test`;
  const password = `Testero-${randomUUID()}-Aa9`;
  const user = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(user.error).toBeNull();
  const userId = user.data.user!.id;
  const eventIds: string[] = [], paymentIds: string[] = [];
  const foreign = await browser.newContext();
  const failures: string[] = [];
  const directory = "/tmp/testero-v2-phase3-visual";
  await mkdir(directory, { recursive: true });
  page.on("pageerror", error => failures.push(error.message));
  page.on("request", request => { if (!["127.0.0.1", "localhost"].includes(new URL(request.url()).hostname)) failures.push("External browser request"); });
  async function layout(name: string) {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `${directory}/${name}-${width}.png`, fullPage: true });
    }
  }
  async function fixture(path: string, data: object) {
    const response = await page.request.post(`http://127.0.0.1:56545/__testero__/${path}`, { headers: { Authorization: `Bearer ${secret}` }, data });
    expect(response.status()).toBe(200); return response.json();
  }
  async function deliver(type: string, object: object, eventId = `evt_local_${randomUUID().replaceAll("-", "")}`) {
    if (!eventIds.includes(eventId)) eventIds.push(eventId);
    const payload = JSON.stringify({ id: eventId, object: "event", type, created: Math.floor(Date.now() / 1000), livemode: false, data: { object } });
    const signature = signer.webhooks.generateTestHeaderString({ payload, secret });
    // No browser session: the webhook bypasses proxy auth and uses only the signature.
    const response = await foreign.request.post("http://127.0.0.1:3000/api/billing/webhook", { headers: { "stripe-signature": signature, "Content-Type": "application/json" }, data: payload });
    expect(response.status()).toBe(200); return eventId;
  }
  async function completePractice(id: string, paid: boolean) {
    const restoredItems = await assertRestoredSession(service, id, 5);
    for (let ordinal = 1; ordinal <= 5; ordinal++) {
      const progress = await (await page.request.get(`/api/practice/${id}`)).json() as DiagnosticProgress;
      expect(progress.currentQuestion!.ordinal).toBe(ordinal); noPaidContent(progress);
      const response = await page.request.post(`/api/practice/${id}/answer`, { data: { itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label } });
      expect(response.status()).toBe(200);
      const accepted = await response.json() as PracticeAnswerResponse;
      expect(accepted.feedback.itemId).toBe(progress.currentQuestion!.id);
      if (paid) {
        expect(accepted.feedback.explanation).toBeTruthy();
        expect(accepted.feedback.optionExplanations).toHaveLength(4);
        expect(accepted.feedback.optionExplanations!.every(option => option.explanation.trim().length > 0)).toBe(true);
        if (process.env.TESTERO_PROD_SCHEMA === "1") {
          const restored = restoredItems.get(progress.currentQuestion!.id)!;
          expect(accepted.feedback.explanation).toBe(restored.question.explanations[0].explanation_text);
          for (const option of accepted.feedback.optionExplanations!) {
            expect(option.explanation).toBe(restored.question.answers.find(answer => answer.choice_text === option.text)!.explanation_text);
          }
        }
      } else noPaidContent(accepted);
    }
    const response = await page.request.get(`/api/practice/${id}/summary`);
    expect(response.status()).toBe(200);
    const summary = await response.json() as PracticeSummary;
    expect(summary.review).toHaveLength(5);
    if (paid) {
      expect(summary.review.every(item => item.explanation && item.options.every(option => option.explanation))).toBe(true);
      assertRestoredPaidReview(summary.review, restoredItems);
    } else noPaidContent(summary);
    return summary;
  }
  try {
    expect((await page.request.post("/api/billing/checkout", { data: {} })).status()).toBe(401);
    const badSignature = await foreign.request.post("http://127.0.0.1:3000/api/billing/webhook", { headers: { "stripe-signature": "t=1,v1=invalid" }, data: "{}" });
    expect(badSignature.status()).toBe(400);
    await page.goto("/pricing");
    await expect(page.getByRole("link", { name: "Create an account to get PMLE Pass", exact: true })).toHaveAttribute("href", "/signup?next=/pricing");
    await page.goto("/login?next=%2Fdashboard");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your study dashboard", exact: true })).toBeVisible();

    const diagnostic = await page.request.post("/api/diagnostic", { data: {} });
    expect(diagnostic.status()).toBe(201);
    const { sessionId: diagnosticId } = await diagnostic.json() as { sessionId: string };
    const diagnosticBank = await assertRestoredSession(service, diagnosticId);
    for (let i = 0; i < 20; i++) {
      const progress = await (await page.request.get(`/api/diagnostic/${diagnosticId}`)).json() as DiagnosticProgress;
      const response = await page.request.post(`/api/diagnostic/${diagnosticId}/answer`, { data: { itemId: progress.currentQuestion!.id, selectedLabel: progress.currentQuestion!.options[0].label } });
      expect(response.status()).toBe(200); noPaidContent(await response.json());
    }
    const freeReview = await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json() as DiagnosticResult;
    expect(freeReview.review).toHaveLength(20); noPaidContent(freeReview);
    const domainCode = freeReview.domainBreakdown[0].domainCode;
    const freeStart = await page.request.post("/api/practice", { data: { domainCode } });
    expect(freeStart.status()).toBe(201);
    const { sessionId: freePracticeId } = await freeStart.json() as { sessionId: string };
    await completePractice(freePracticeId, false);
    expect((await page.request.post("/api/practice", { data: { domainCode } })).status()).toBe(429);

    await page.goto("/pricing"); await layout("pricing");
    const checkoutResponse = page.waitForResponse(response => response.url().endsWith("/api/billing/checkout") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Get PMLE Pass — $39", exact: true }).click();
    const checkout = await checkoutResponse;
    expect(checkout.status()).toBe(200);
    // The client navigates immediately; Chromium may discard the fetch body.
    await expect(page).toHaveURL(/\/checkout\/success\?session_id=cs_/);
    const destination = new URL(page.url());
    expect(destination.origin).toBe("http://127.0.0.1:3000");
    const sessionId = destination.searchParams.get("session_id")!;
    await expect(page.getByText(/Your payment is processing/)).toBeVisible();
    expect(await (await page.request.get(`/api/billing/status?session_id=${sessionId}`)).json()).toEqual({ status: "processing", accessUntil: null });
    const before = await service.from("pmle_passes").select("id").eq("user_id", userId);
    expect(before.data).toHaveLength(0);
    const retryCheckout = await page.request.post("/api/billing/checkout", { data: {} });
    expect(retryCheckout.status()).toBe(200);
    expect((await retryCheckout.json()).href).toBe(destination.href);
    const paid = await fixture("pay", { sessionId });
    paymentIds.push(paid.intent.id);
    const completionId = await deliver("checkout.session.completed", paid.session);
    const pass = await service.from("pmle_passes").select("id,paid_at,expires_at,refunded_at").eq("user_id", userId).single();
    expect(pass.error).toBeNull(); expect(pass.data!.refunded_at).toBeNull();
    expect(Date.parse(pass.data!.expires_at) - Date.parse(pass.data!.paid_at)).toBe(90 * 24 * 60 * 60 * 1000);
    await deliver("checkout.session.completed", paid.session, completionId);
    const duplicateCharge = await page.request.post("/api/billing/checkout", { data: {} });
    expect(await duplicateCharge.json()).toEqual({ href: "/account", alreadyActive: true });
    await page.reload(); await expect(page.getByText("Your PMLE Pass is active.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "View account", exact: true }).click();
    await expect(page.getByText(/Access until/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Manage legacy subscription", exact: true })).toHaveCount(0);
    expect((await page.request.post("/api/billing/portal", { data: {} })).status()).toBe(403);
    await layout("account-paid");
    await page.goto(`/diagnostic/${diagnosticId}/results`);
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    await expect(page.getByText("Explanation", { exact: true }).first()).toBeVisible();
    const paidReview = await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json() as DiagnosticResult;
    expect(paidReview.review!.every(item => item.explanation && item.options.every(option => option.explanation))).toBe(true);
    assertRestoredPaidReview(paidReview.review!, diagnosticBank);
    await layout("diagnostic-paid");
    const paidPracticeIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const started = await page.request.post("/api/practice", { data: { domainCode } });
      expect(started.status()).toBe(201);
      const paidSessionId = (await started.json()).sessionId as string;
      paidPracticeIds.push(paidSessionId);
      await assertRestoredSession(service, paidSessionId, 5);
    }
    const quota = await service.from("free_practice_quota").select("questions_used").eq("user_id", userId).single();
    expect(quota.data!.questions_used).toBe(5);
    const paidPracticeId = paidPracticeIds[0];
    await page.goto(`/practice/${paidPracticeId}`);
    await expect(page.getByText("Question 1 of 5", { exact: true })).toBeVisible();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Submit answer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Option explanations", exact: true })).toBeVisible();
    await layout("practice-paid");
    const first = await service.from("session_items").select("id,selected_label").eq("session_id", paidPracticeId).eq("ordinal", 1).single();
    const withContent = await page.request.post(`/api/practice/${paidPracticeId}/answer`, { data: { itemId: first.data!.id, selectedLabel: first.data!.selected_label } });
    expect((await withContent.json()).feedback.optionExplanations).toHaveLength(4);
    await completePractice(paidPracticeIds[1], true);

    const refunded = await fixture("refund", { paymentIntentId: paid.intent.id });
    await deliver("charge.refunded", refunded.charge);
    const replayId = await deliver("checkout.session.completed", paid.session);
    const final = await service.from("pmle_passes").select("id,paid_at,expires_at,refunded_at").eq("user_id", userId).single();
    expect(final.data).toMatchObject({ id: pass.data!.id, paid_at: pass.data!.paid_at, expires_at: pass.data!.expires_at });
    expect(final.data!.refunded_at).toBeTruthy();
    const receipt = await service.from("payment_history").select("user_id,amount,currency,status").eq("stripe_payment_intent_id", paid.intent.id).single();
    expect(receipt.data).toEqual({ user_id: userId, amount: 3900, currency: "usd", status: "refunded" });
    const ledger = await service.from("webhook_events").select("processed").eq("stripe_event_id", replayId).single();
    expect(ledger.data!.processed).toBe(true);
    const redacted = await (await page.request.get(`/api/diagnostic/${diagnosticId}/results`)).json() as DiagnosticResult;
    expect(redacted.review).toHaveLength(20); noPaidContent(redacted);
    const retryAnswer = await page.request.post(`/api/practice/${paidPracticeId}/answer`, { data: { itemId: first.data!.id, selectedLabel: first.data!.selected_label } });
    expect(retryAnswer.status()).toBe(200); noPaidContent(await retryAnswer.json());
    const redactedSummary = await (await page.request.get(`/api/practice/${paidPracticeIds[1]}/summary`)).json() as PracticeSummary;
    noPaidContent(redactedSummary);
    expect((await page.request.post("/api/practice", { data: { domainCode } })).status()).toBe(429);
    await page.goto(`/diagnostic/${diagnosticId}/results`);
    await expect(page.getByRole("heading", { name: "Question review", exact: true })).toBeVisible();
    await expect(page.getByText("Explanation", { exact: true })).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Upgrade to PMLE Pass", exact: true })).toBeVisible();
    await expect(page.getByLabel("Practice domain", { exact: true })).toHaveCount(0);
    await layout("dashboard-refunded");
    await page.goto(destination.href);
    await expect(page.getByText(/This payment was refunded/)).toBeVisible();
    // Existing active legacy subscribers retain their portal and paid access.
    const legacy = await service.from("user_subscriptions").insert({ user_id: userId, stripe_customer_id: `cus_local_legacy_${randomUUID().replaceAll("-", "")}`, stripe_subscription_id: `sub_local_${randomUUID().replaceAll("-", "")}`, status: "active", current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() });
    expect(legacy.error).toBeNull();
    await page.goto("/account");
    await expect(page.getByText("Active legacy subscription", { exact: true })).toBeVisible();
    const portalResponse = page.waitForResponse(response => response.url().endsWith("/api/billing/portal") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Manage legacy subscription", exact: true }).click();
    expect((await portalResponse).status()).toBe(200);
    await expect(page).toHaveURL("http://127.0.0.1:3000/account");
    const legacyPractice = await page.request.post("/api/practice", { data: { domainCode } });
    expect(legacyPractice.status()).toBe(201);
    await assertRestoredSession(service, (await legacyPractice.json()).sessionId, 5);
    expect(failures).toEqual([]);
  } finally {
    await foreign.close();
    await service.from("webhook_events").delete().in("stripe_event_id", eventIds);
    await service.from("pmle_pass_refunds").delete().in("stripe_payment_intent_id", paymentIds);
    const account = await service.auth.admin.getUserById(userId); expect(account.data.user?.email).toBe(email);
    expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
