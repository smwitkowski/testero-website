import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { PMLE_BLUEPRINT } from "../lib/constants/pmle-blueprint";

const shots = "test-results/pmle-tiers";
async function capture(page: Page, name: string) {
  await mkdir(shots, { recursive: true });
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (name === "mock-in-progress" && width === 375) {
      const navigator = page.getByRole("navigation", { name: "Mock questions", exact: true });
      const lines = await navigator.getByRole("button").evaluateAll(buttons => buttons.flatMap(button => {
        const number = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && /^\d{2}$/.test(node.textContent?.trim() ?? ""));
        if (!number) return [];
        const range = document.createRange(); range.selectNodeContents(number);
        return [{ number: number.textContent, lines: range.getClientRects().length }];
      }));
      expect(lines).toHaveLength(41);
      expect(lines.filter(item => item.lines !== 1), "two-digit question labels must not wrap on375px").toEqual([]);
    }
    await page.screenshot({ path: `${shots}/${name}-${width}.png`, fullPage: true, style: "nextjs-portal { display: none !important; }" });
  }
}
function noReveal(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(["correctLabel", "correct_label", "isCorrect", "is_correct", "score", "explanation", "optionExplanations", "explanation_text"]).not.toContain(key);
    noReveal(child);
  }
}
interface MockQuestion { id: string; ordinal: number; domainCode: string; options: { label: string; text: string }[]; selectedLabel: string | null }
interface MockProgress { sessionId: string; status: string; startedAt: string; deadlineAt: string; totalQuestions: number; answeredCount: number; allocationNotice: string | null; questions: MockQuestion[] }

test("D-044 free locks and Pass mock: blueprint, no reveal, resume, domain scoring, review and timeout", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname); expect(url.port).toBe("56541");
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `tiers-${randomUUID()}@example.test`, password = `Local-${randomUUID()}-Aa9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull(); const userId = created.data.user!.id;
  const foreign = await browser.newContext();
  const intent = `pi_local_tiers_${randomUUID()}`;
  const failures: string[] = [];
  page.on("pageerror", error => failures.push(error.message));
  page.on("request", request => { if (!["localhost", "127.0.0.1"].includes(new URL(request.url()).hostname)) failures.push("External browser request"); });
  try {
    await page.goto("/pricing"); await expect(page.getByRole("heading", { name: "Pricing", exact: true })).toBeVisible();
    await expect(page.getByText("$39.99", { exact: true })).toBeVisible();
    await capture(page, "pricing");
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    for (const feature of ["Timed mock exams", "Fresh-first practice", "Weak-area drills"]) {
      await expect(page.getByRole("link", { name: `Unlock ${feature} with PMLE Pass`, exact: true })).toHaveAttribute("href", "/pricing");
    }
    await capture(page, "dashboard-free");
    expect((await page.request.post("/api/mock/start", { data: {} })).status()).toBe(403);
    expect((await page.request.post("/api/practice", { data: { mode: "weak" } })).status()).toBe(403);
    await page.goto("/mock");
    await expect(page.getByRole("link", { name: /PMLE Pass/ }).first()).toBeVisible();
    expect((await service.rpc("fulfill_pmle_pass", { p_user_id: userId, p_stripe_checkout_session_id: `cs_test_tiers_${randomUUID()}`, p_stripe_payment_intent_id: intent, p_stripe_customer_id: "cus_local_tiers", p_paid_at: new Date().toISOString() })).error).toBeNull();
    await page.goto("/dashboard"); await expect(page.getByRole("link", { name: "Open mock exams", exact: true })).toBeVisible();
    await capture(page, "dashboard-paid");
    await page.getByRole("link", { name: "Open mock exams", exact: true }).click();
    const startResponse = page.waitForResponse(response => response.url().endsWith("/api/mock/start") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Start timed mock", exact: true }).click();
    const started = await startResponse; expect(started.status()).toBe(201);
    const mockId = (await started.json()).sessionId as string;
    await expect(page).toHaveURL(new RegExp(`/mock/${mockId}$`));
    const getProgress = async () => {
      const response = await page.request.get(`/api/mock/${mockId}`); expect(response.status()).toBe(200);
      const value = await response.json() as MockProgress; noReveal(value); return value;
    };
    const initial = await getProgress();
    expect(initial.totalQuestions).toBe(50); expect(initial.questions).toHaveLength(50);
    expect(new Set(initial.questions.map(item => item.id)).size).toBe(50);
    expect(Math.abs(Date.parse(initial.deadlineAt) - Date.parse(initial.startedAt) - 120 * 60 * 1000)).toBeLessThan(100);
    const stored = await service.from("mock_exam_items").select("id,question_id,domain_code,correct_label,ordinal").eq("session_id", mockId).order("ordinal");
    expect(stored.error).toBeNull(); expect(stored.data).toHaveLength(50);
    const bank = await service.from("questions").select("id", { count: "exact", head: true })
      .eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD").is("parent_question_id", null);
    expect(bank.error).toBeNull();
    expect(new Set(stored.data!.map(row => row.question_id)).size).toBe(Math.min(50, bank.count!));
    if (bank.count! < 50) expect(initial.allocationNotice).toBeTruthy();
    const domainCounts = new Map(PMLE_BLUEPRINT.map(domain => [domain.domainCode, initial.questions.filter(item => item.domainCode === domain.domainCode).length]));
    // The local educational seed has only30 questions; a disclosed repeat fallback fills50.
    // Where a full bank can supply the mix, each domain stays within one rounding slot.
    if (!initial.allocationNotice) {
      for (const domain of PMLE_BLUEPRINT) expect(Math.abs(domainCounts.get(domain.domainCode)! - domain.weight * 50)).toBeLessThanOrEqual(1);
    } else {
      expect(initial.allocationNotice.trim().length).toBeGreaterThan(10);
      await expect(page.getByText(initial.allocationNotice, { exact: true })).toBeVisible();
    }
    const first = initial.questions[0];
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Save and next", exact: true }).click();
    await expect.poll(async () => (await getProgress()).answeredCount).toBe(1);
    await expect(page.getByText(/correct answer|option explanations/i)).toHaveCount(0);
    expect((await page.request.get(`/api/mock/${mockId}/results`)).status()).toBe(409);
    expect((await foreign.request.get(`http://127.0.0.1:3000/api/mock/${mockId}`)).status()).toBe(401);
    await capture(page, "mock-in-progress");
    await page.goto("/dashboard"); await page.goto("/mock");
    await page.getByRole("link", { name: /Resume/ }).click();
    await expect(page).toHaveURL(new RegExp(`/mock/${mockId}$`));
    const resumed = await getProgress();
    expect(resumed.deadlineAt).toBe(initial.deadlineAt);
    expect(resumed.questions.find(item => item.id === first.id)!.selectedLabel).toBe(first.options[0].label);
    // A mock accepts saved answers in any order. Small concurrent batches keep
    // this real50-question flow bounded while still checking every response.
    for (let offset = 1; offset < resumed.questions.length; offset += 5) {
      await Promise.all(resumed.questions.slice(offset, offset + 5).map(async item => {
        const response = await page.request.post(`/api/mock/${mockId}/answer`, { data: { itemId: item.id, selectedLabel: item.options[0].label } });
        expect(response.status()).toBe(200); noReveal(await response.json());
      }));
    }
    await page.reload();
    await page.getByRole("button", { name: "Submit mock exam", exact: true }).click();
    await page.getByRole("button", { name: "Confirm submission", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/mock/${mockId}/results$`));
    const resultResponse = await page.request.get(`/api/mock/${mockId}/results`); expect(resultResponse.status()).toBe(200);
    const result = await resultResponse.json();
    const expectedCorrect = stored.data!.filter(row => resumed.questions.find(item => item.id === row.id)!.options[0].label === row.correct_label).length;
    expect(result.correctAnswers).toBe(expectedCorrect); expect(result.score).toBe(Math.round(expectedCorrect / 50 * 100));
    expect(result.domainBreakdown).toHaveLength(domainCounts.size);
    for (const domain of result.domainBreakdown) {
      const rows = stored.data!.filter(row => row.domain_code === domain.domainCode);
      const correct = rows.filter(row => resumed.questions.find(item => item.id === row.id)!.options[0].label === row.correct_label).length;
      expect(domain.total).toBe(rows.length); expect(domain.correct).toBe(correct);
    }
    expect(result.review).toHaveLength(50);
    expect(result.review.every((item: { explanation?: string; options: { explanation?: string }[] }) => item.explanation && item.options.every(option => option.explanation))).toBe(true);
    await expect(page.getByRole("heading", { name: "Your mock results", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Score by domain", exact: true })).toBeVisible();
    await capture(page, "mock-results");
    const late = await page.request.post(`/api/mock/${mockId}/answer`, { data: { itemId: first.id, selectedLabel: first.options[1].label } });
    expect(late.status()).toBe(200); expect((await late.json()).status).toBe("completed");
    const immutable = await service.from("mock_exam_items").select("selected_label").eq("id", first.id).single();
    expect(immutable.error).toBeNull(); expect(immutable.data!.selected_label).toBe(first.options[0].label);
    await page.goto("/mock"); await expect(page.getByRole("link", { name: /Review results/ }).first()).toBeVisible();
    const timerStart = await page.request.post("/api/mock/start", { data: {} }); expect(timerStart.status()).toBe(201);
    const timerId = (await timerStart.json()).sessionId as string;
    expect((await service.from("mock_exam_sessions").update({ created_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(), deadline_at: new Date(Date.now() + 4_000).toISOString() }).eq("id", timerId).eq("user_id", userId)).error).toBeNull();
    await page.goto(`/mock/${timerId}`);
    await expect(page).toHaveURL(new RegExp(`/mock/${timerId}/results$`), { timeout: 20_000 });
    const timed = await (await page.request.get(`/api/mock/${timerId}/results`)).json();
    expect(timed.correctAnswers).toBe(0); expect(timed.score).toBe(0); expect(timed.review).toHaveLength(50);
    expect((await service.rpc("refund_pmle_pass", { p_stripe_payment_intent_id: intent, p_refunded_at: new Date().toISOString() })).error).toBeNull();
    expect((await page.request.get(`/api/mock/${mockId}/results`)).status()).toBe(403);
    expect((await page.request.post("/api/mock/start", { data: {} })).status()).toBe(403);
    expect(failures).toEqual([]);
  } finally {
    await foreign.close();
    expect((await service.from("pmle_pass_refunds").delete().eq("stripe_payment_intent_id", intent)).error).toBeNull();
    expect((await service.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});

test("D-044 Pass fresh-first ordering, weak-drill diagnostic fallback and sufficient-history selection", async ({ page }) => {
  test.setTimeout(180_000);
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname); expect(url.port).toBe("56541");
  const service = createClient(url.href, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `selection-${randomUUID()}@example.test`, password = `Local-${randomUUID()}-Aa9`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  expect(created.error).toBeNull(); const userId = created.data.user!.id;
  const domainCode = PMLE_BLUEPRINT[0].domainCode;
  const domainName = PMLE_BLUEPRINT[0].displayName;
  const forgedFocus = "Forged URL focus must not replace saved selection";
  async function expectSavedSelection(session: { sessionId: string; href: string; selection: unknown }, reason: "general" | "diagnostic_focus" | "history", message: string) {
    const metadata = { reason, domainCode };
    const selection = { ...metadata, message };
    expect(session.href).toBe(`/practice/${session.sessionId}`);
    expect(session.selection).toEqual(selection);
    const expectStored = async () => {
      const stored = await service.from("study_sessions").select("practice_selection").eq("id", session.sessionId).eq("user_id", userId).single();
      expect(stored.error).toBeNull();
      expect(stored.data!.practice_selection).toEqual(metadata);
      const response = await page.request.get(`/api/practice/${session.sessionId}`);
      expect(response.status()).toBe(200);
      expect((await response.json()).selection).toEqual(selection);
    };
    const expectCanonicalLabel = async () => {
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      await expect(page.getByText(forgedFocus, { exact: true })).toHaveCount(0);
    };
    await expect(page).toHaveURL(new RegExp(`/practice/${session.sessionId}$`));
    await expectStored();
    await expectCanonicalLabel();
    await page.goto(`${session.href}?focus=${encodeURIComponent(forgedFocus)}`);
    await expectCanonicalLabel();
    await page.reload();
    await expectCanonicalLabel();
    await page.goto("/dashboard");
    const resume = page.getByRole("link", { name: "Resume practice", exact: true });
    await expect(resume).toHaveAttribute("href", session.href);
    await resume.click();
    await expect(page).toHaveURL(new RegExp(`/practice/${session.sessionId}$`));
    await expectCanonicalLabel();
    await expectStored();
  }
  try {
    expect((await service.rpc("fulfill_pmle_pass", { p_user_id: userId, p_stripe_checkout_session_id: `cs_test_selection_${randomUUID()}`, p_stripe_payment_intent_id: `pi_local_selection_${randomUUID()}`, p_stripe_customer_id: "cus_local_selection", p_paid_at: new Date().toISOString() })).error).toBeNull();
    await page.goto("/login?next=/dashboard");
    await page.getByLabel("Email", { exact: true }).fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    const generalResponse = await page.request.post("/api/practice", { data: { mode: "weak" } }); expect(generalResponse.status()).toBe(201);
    const general = await generalResponse.json();
    await page.goto(general.href);
    await expectSavedSelection(general, "general", `Not enough answered history or a completed diagnostic yet. Start with ${domainName} to build your study history.`);

    const diagnostic = await page.request.post("/api/diagnostic", { data: { questionCount: 20 } }); expect(diagnostic.status()).toBe(201);
    const diagnosticId = (await diagnostic.json()).sessionId as string;
    const diagnosticItems = await service.from("session_items").select("id,question_id,domain_code,correct_label,options").eq("session_id", diagnosticId);
    expect(diagnosticItems.error).toBeNull(); expect(diagnosticItems.data).toHaveLength(20);
    const history = new Set(diagnosticItems.data!.map(item => item.question_id));
    for (let ordinal = 1; ordinal <= 20; ordinal++) {
      const progress = await (await page.request.get(`/api/diagnostic/${diagnosticId}`)).json();
      const item = diagnosticItems.data!.find(item => item.id === progress.currentQuestion.id)!;
      const wrongLabel = (item.options as { label: string }[]).find(option => option.label !== item.correct_label)!.label;
      const selectedLabel = item.domain_code === domainCode ? wrongLabel : item.correct_label;
      expect((await page.request.post(`/api/diagnostic/${diagnosticId}/answer`, { data: { itemId: item.id, selectedLabel } })).status()).toBe(200);
    }
    const fallbackResponse = await page.request.post("/api/practice", { data: { mode: "weak" } }); expect(fallbackResponse.status()).toBe(201);
    const fallback = await fallbackResponse.json();
    await page.goto(fallback.href);
    await expectSavedSelection(fallback, "diagnostic_focus", `Not enough practice history yet. Starting with ${domainName}, the study focus from your latest diagnostic.`);
    const selected = await service.from("session_items").select("id,question_id,ordinal,correct_label,options,domain_code").eq("session_id", fallback.sessionId).order("ordinal");
    expect(selected.error).toBeNull(); expect(selected.data).toHaveLength(5);
    let seenReached = false;
    for (const item of selected.data!) {
      expect(item.domain_code).toBe(domainCode);
      if (history.has(item.question_id)) seenReached = true;
      else expect(seenReached, "fresh questions must precede previously answered questions").toBe(false);
    }
    expect(history.has(selected.data![0].question_id)).toBe(false);
    // The seed has five questions per domain: fresh-first must fall back to seen
    // questions, not shorten or reject the session when fewer than five are new.
    const uniqueAnswered = new Set(diagnosticItems.data!.filter(item => item.domain_code === domainCode).map(item => item.question_id));
    for (const item of selected.data!) {
      const wrongLabel = (item.options as { label: string }[]).find(option => option.label !== item.correct_label)!.label;
      expect((await page.request.post(`/api/practice/${fallback.sessionId}/answer`, { data: { itemId: item.id, selectedLabel: wrongLabel } })).status()).toBe(200);
      uniqueAnswered.add(item.question_id);
    }
    expect(uniqueAnswered.size).toBeGreaterThanOrEqual(5);
    await page.goto("/dashboard");
    const weakResponse = page.waitForResponse(response => response.url().endsWith("/api/practice") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Start weak-area drill", exact: true }).click();
    const weak = await weakResponse; expect(weak.status()).toBe(201);
    const drilled = await weak.json();
    await expectSavedSelection(drilled, "history", `Practicing ${domainName}: your lowest-scoring domain with at least 5 different answered questions.`);
    // Mock selection uses the same account answer history, across domains.
    for (const item of selected.data!) history.add(item.question_id);
    const freshMockResponse = await page.request.post("/api/mock/start", { data: {} }); expect(freshMockResponse.status()).toBe(201);
    const freshMockId = (await freshMockResponse.json()).sessionId as string;
    const mockItems = await service.from("mock_exam_items").select("question_id,ordinal").eq("session_id", freshMockId).order("ordinal");
    expect(mockItems.error).toBeNull(); expect(mockItems.data).toHaveLength(50);
    const eligible = await service.from("questions").select("id").eq("exam", "GCP_PM_ML_ENG").eq("status", "ACTIVE").eq("review_status", "GOOD").is("parent_question_id", null);
    expect(eligible.error).toBeNull();
    const unseenCount = eligible.data!.filter(item => !history.has(item.id)).length;
    expect(unseenCount).toBeGreaterThan(0);
    const freshPrefix = mockItems.data!.slice(0, Math.min(50, unseenCount));
    expect(freshPrefix.every(item => !history.has(item.question_id))).toBe(true);

  } finally { expect((await service.auth.admin.deleteUser(userId)).error).toBeNull(); }
});
