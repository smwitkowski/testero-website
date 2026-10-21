import { test, expect, type APIResponse, type Page, type Response } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { DiagnosticAnswerResponse, DiagnosticProgress, DiagnosticResult, DiagnosticStartResponse } from "../lib/diagnostic/types";

// Run against a fresh local bank, with this allowlist inherited by the test web server.
// No browser routes or API responses are mocked. Never point this fixture at a hosted DB.
const betaCerts = ["data-engineer", "cloud-architect", "cloud-engineer", "generative-ai-leader", "agentic-architect"];
const configuredCerts = (process.env.BETA_DIAGNOSTIC_CERTS ?? "").split(",").map(value => value.trim());
const certId = "data-engineer";
const certName = "Professional Data Engineer";
const fixtureId = randomUUID();
const questionIds: string[] = [];
const domainIds: string[] = [];
const sessionIds = new Set<string>();
const emails: string[] = [];
let service: SupabaseClient;
let twentiethCloudQuestion: string;

function assertLocalDatabase() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid");
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.protocol).toBe("http:");
  expect(url.port).toBe("56541");
  expect(url.search).toBe("");
  expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy();
  expect(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").toBe("");
}

function noAnswerKeys(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    expect(["correct_label", "correctLabel", "is_correct", "isCorrect", "explanation", "explanation_text", "anonymous_owner_hash", "user_id"]).not.toContain(key);
    noAnswerKeys(child);
  }
}

async function seedQuestions(exam: string, domains: { id: string; code: string }[], count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: randomUUID(), exam, domain_id: domains[index % domains.length].id,
    stem: `Local beta browser fixture ${fixtureId}: ${exam} scenario ${index + 1}. Which approach fits?`,
    source_ref: `local-beta-browser-${fixtureId}`, status: "ACTIVE", review_status: "GOOD", question_type: "single_select",
  }));
  // Record ownership before inserting, so failed setup still has a bounded cleanup.
  questionIds.push(...rows.map(row => row.id));
  expect((await service.from("questions").insert(rows)).error).toBeNull();
  expect((await service.from("answers").insert(rows.flatMap(row => ["A", "B", "C", "D"].map((label, index) => ({
    question_id: row.id, choice_label: label, choice_text: `Fixture approach ${index + 1} for ${row.id}`,
    is_correct: index === 0, explanation_text: `Fixture explanation for option ${label}.`,
  }))))).error).toBeNull();
  expect((await service.from("explanations").insert(rows.map(row => ({ question_id: row.id, explanation_text: "Private fixture explanation must not appear in a beta diagnostic." })))).error).toBeNull();
  return rows;
}

async function rememberCreated(response: APIResponse | Response) {
  if (response.status() !== 201) return null;
  const body = await response.json() as DiagnosticStartResponse;
  sessionIds.add(body.sessionId);
  return body;
}

async function expectBetaResults(page: Page, count: number) {
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: `${certName} readiness report`, exact: true })).toBeVisible();
  await expect(main.getByText(/^Tier: (Low|Building|Ready|Strong)$/)).toBeVisible();
  await expect(main.getByRole("heading", { name: "Overall score", exact: true })).toHaveCount(0);
  await expect(main.locator('[aria-label="Overall score"]')).toHaveCount(0);
  await expect(main.getByRole("progressbar", { name: "Readiness score", exact: true })).toHaveCount(0);
  await expect(main.getByText(/\d+ of \d+ correct|\/ 100/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveCount(0);
  await expect(main.getByText(`Based on ${count} questions.`, { exact: false })).toBeVisible();
  await expect(main.getByRole("heading", { name: `Practice for ${certName} is in beta and coming soon`, exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: /Score by domain|One full explanation|Review your answers/i })).toHaveCount(0);
  await expect(main.locator('[aria-label="Domain results, weakest first"]')).toHaveCount(0);
  await expect(main.getByText(/PMLE|\$39|Private fixture explanation/)).toHaveCount(0);
  await expect(main.getByRole("link", { name: /Start practice|Pass|checkout|pricing|20-question/i })).toHaveCount(0);
  await expect(main.locator('a[href*="/pricing"], a[href*="/checkout"], a[href*="/practice"], a[href*="/signup"], a[href*="/dashboard"]')).toHaveCount(0);
  await expect(main.locator('[aria-labelledby="email-results-heading"]')).toHaveCount(0);
  await expect(main.getByRole("button", { name: /Email my results/i })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Retake the diagnostic", exact: true })).toHaveAttribute("href", "/diagnostic?cert=data-engineer");
}

test.describe("beta diagnostic with a real local bank and server allowlist", () => {
  test.skip(!configuredCerts.includes(certId), "Dedicated beta run requires BETA_DIAGNOSTIC_CERTS on the Playwright web server.");

  test.beforeAll(async () => {
    assertLocalDatabase();
    for (const cert of betaCerts) expect(configuredCerts).toContain(cert);
    expect(configuredCerts).not.toContain("cloud-developer");
    service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    // Refuse to change another test's bank. Parent resets the isolated local DB before this run.
    const existing = await service.from("questions").select("id", { count: "exact", head: true }).in("exam", [certId, "cloud-engineer", "cloud-developer"]);
    expect(existing.error).toBeNull();
    expect(existing.count, "Beta browser fixtures require an empty local beta bank").toBe(0);
    const domains = await service.from("exam_domains").select("id,code,exam").in("exam", [certId, "cloud-engineer"]).order("code");
    expect(domains.error).toBeNull();
    const dataDomains = domains.data!.filter(domain => domain.exam === certId);
    const cloudDomains = domains.data!.filter(domain => domain.exam === "cloud-engineer");
    expect(dataDomains).toHaveLength(5);
    expect(cloudDomains).toHaveLength(4);
    await seedQuestions(certId, dataDomains, 20);
    const cloud = await seedQuestions("cloud-engineer", cloudDomains, 23);
    twentiethCloudQuestion = cloud[19].id;
    // Only 19 count: DRAFT, UNREVIEWED, RETIRED and a GOOD ACTIVE variant do not.
    expect((await service.from("questions").update({ status: "DRAFT" }).eq("id", cloud[19].id)).error).toBeNull();
    expect((await service.from("questions").update({ review_status: "UNREVIEWED" }).eq("id", cloud[20].id)).error).toBeNull();
    expect((await service.from("questions").update({ status: "RETIRED" }).eq("id", cloud[21].id)).error).toBeNull();
    expect((await service.from("questions").update({ parent_question_id: cloud[0].id }).eq("id", cloud[22].id)).error).toBeNull();
    // Give the out-of-scope cert 20 otherwise eligible originals; bank size cannot open it.
    const domain = { id: randomUUID(), exam: "cloud-developer", code: `local-beta-${fixtureId}`, name: "Local scope fixture" };
    domainIds.push(domain.id);
    expect((await service.from("exam_domains").insert(domain)).error).toBeNull();
    await seedQuestions("cloud-developer", [domain], 20);
  });

  test.afterAll(async () => {
    if (!service) return;
    assertLocalDatabase();
    // Cleanup is restricted to identifiers owned by this spec, including partially seeded setup.
    if (emails.length) expect((await service.from("cert_waitlist").delete().in("email", emails)).error).toBeNull();
    if (sessionIds.size) expect((await service.from("study_sessions").delete().in("id", [...sessionIds])).error).toBeNull();
    if (questionIds.length) expect((await service.from("questions").delete().in("id", questionIds)).error).toBeNull();
    if (domainIds.length) expect((await service.from("exam_domains").delete().in("id", domainIds)).error).toBeNull();
    if (questionIds.length) {
      const remaining = await service.from("questions").select("id", { count: "exact", head: true }).in("id", questionIds);
      expect(remaining.error).toBeNull();
      expect(remaining.count).toBe(0);
    }
  });

  test("unknown and non-allowlisted certs stay closed even with 20 approved originals", async ({ page }) => {
    for (const cert of ["not-a-real-cert", "cloud-developer"]) {
      const response = await page.goto(`/diagnostic?cert=${cert}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("button", { name: "Begin diagnostic", exact: true })).toHaveCount(0);
      const denied = await page.request.post("/api/diagnostic", { data: { certId: cert, questionCount: 5 } });
      await rememberCreated(denied);
      expect(denied.status()).toBe(404);
    }
    await page.goto("/certifications/cloud-developer");
    await expect(page.getByRole("link", { name: "Try the free beta diagnostic", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notify me", exact: true })).toBeVisible();
  });

  test("19 approved originals stay closed; exactly 20 opens the diagnostic and cert CTA", async ({ page }) => {
    const closed = await page.goto("/diagnostic?cert=cloud-engineer");
    expect(closed?.status()).toBe(404);
    const denied = await page.request.post("/api/diagnostic", { data: { certId: "cloud-engineer", questionCount: 5 } });
    await rememberCreated(denied);
    expect(denied.status()).toBe(404);
    await page.goto("/certifications/cloud-engineer");
    await expect(page.getByRole("link", { name: "Try the free beta diagnostic", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Notify me", exact: true })).toBeVisible();
    try {
      expect((await service.from("questions").update({ status: "ACTIVE" }).eq("id", twentiethCloudQuestion)).error).toBeNull();
      expect((await page.goto("/diagnostic?cert=cloud-engineer"))?.status()).toBe(200);
      await expect(page.getByRole("button", { name: "Begin diagnostic", exact: true })).toBeVisible();
      await page.goto("/certifications/cloud-engineer");
      await expect(page.getByRole("link", { name: "Try the free beta diagnostic", exact: true })).toHaveAttribute("href", "/diagnostic?cert=cloud-engineer");
    } finally {
      expect((await service.from("questions").update({ status: "DRAFT" }).eq("id", twentiethCloudQuestion)).error).toBeNull();
    }
  });

  for (const count of [5, 10]) {
    test(`${count} questions: browser reveal, persisted certification, tier-only results and real practice waitlist`, async ({ page }) => {
      test.setTimeout(120_000);
      const failures: string[] = [];
      page.on("pageerror", error => failures.push(error.message));
      await page.goto("/certifications/data-engineer");
      const cta = page.getByRole("link", { name: "Try the free beta diagnostic", exact: true });
      await expect(cta).toHaveAttribute("href", "/diagnostic?cert=data-engineer");
      const notify = page.getByRole("button", { name: "Notify me", exact: true });
      expect((await cta.boundingBox())!.y).toBeLessThan((await notify.boundingBox())!.y);
      await cta.click();
      await page.goto(`/diagnostic?cert=data-engineer&length=${count === 5 ? 20 : 10}`);
      await expect(page.getByRole("heading", { name: `${certName} beta diagnostic`, exact: true })).toBeVisible();
      await expect(page.getByRole("radio")).toHaveCount(2);
      await expect(page.getByRole("radio", { name: "Full readiness (20)", exact: true })).toHaveCount(0);
      await expect(page.getByRole("radio", { name: count === 5 ? "Quick check (5)" : "Short (10)", exact: true })).toBeChecked();
      const forbidden = await page.request.post("/api/diagnostic", { data: { certId, questionCount: 20 } });
      await rememberCreated(forbidden);
      expect(forbidden.status()).toBe(400);
      const response = page.waitForResponse(response => new URL(response.url()).pathname === "/api/diagnostic" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Begin diagnostic", exact: true }).click();
      const createdResponse = await response;
      const created = await rememberCreated(createdResponse);
      expect(createdResponse.status()).toBe(201);
      expect(createdResponse.request().postDataJSON()).toEqual({ questionCount: count, certId });
      expect(created!.progress).toMatchObject({ certId, totalQuestions: count, answeredCount: 0 });
      const sessionId = created!.sessionId;
      const api = `/api/diagnostic/${sessionId}`;
      const persisted = await service.from("study_sessions").select("exam,question_count").eq("id", sessionId).single();
      expect(persisted.error).toBeNull();
      expect(persisted.data).toEqual({ exam: certId, question_count: count });
      const snapshots = await service.from("session_items").select("question_id,domain_code").eq("session_id", sessionId);
      expect(snapshots.error).toBeNull();
      expect(snapshots.data).toHaveLength(count);
      expect(snapshots.data!.every(item => questionIds.includes(item.question_id) && item.domain_code.startsWith("data-engineer:"))).toBe(true);
      const distribution = Object.fromEntries([1, 2, 3, 4, 5].map(section => [`data-engineer:standard:${section}`, snapshots.data!.filter(item => item.domain_code === `data-engineer:standard:${section}`).length]));
      expect(distribution).toEqual(count === 5
        ? { "data-engineer:standard:1": 1, "data-engineer:standard:2": 1, "data-engineer:standard:3": 1, "data-engineer:standard:4": 1, "data-engineer:standard:5": 1 }
        : { "data-engineer:standard:1": 2, "data-engineer:standard:2": 3, "data-engineer:standard:3": 2, "data-engineer:standard:4": 1, "data-engineer:standard:5": 2 });
      for (let index = 0; index < count; index++) {
        await expect(page.getByText(`Question ${index + 1} of ${count}`, { exact: true })).toBeVisible();
        const progress = await (await page.request.get(api)).json() as DiagnosticProgress;
        expect(progress).toMatchObject({ certId, answeredCount: index, totalQuestions: count });
        noAnswerKeys(progress);
        const question = progress.currentQuestion!;
        await page.getByRole("radio").first().check();
        const acceptedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `${api}/answer` && response.request().method() === "POST");
        await page.getByRole("button", { name: "Check answer", exact: true }).click();
        const accepted = await acceptedResponse;
        expect(accepted.status()).toBe(200);
        const answer = await accepted.json() as DiagnosticAnswerResponse;
        expect(answer.progress.certId).toBe(certId);
        noAnswerKeys(answer.progress);
        expect(Object.keys(answer.feedback).sort()).toEqual(["correctLabel", "isCorrect", "itemId", "selectedLabel"].sort());
        expect(answer.feedback.itemId).toBe(question.id);
        await expect(page.getByRole("status")).toContainText(`the correct answer is ${answer.feedback.correctLabel}.`);
        for (const radio of await page.getByRole("radio").all()) await expect(radio).toBeDisabled();
        await expect(page.getByText("Private fixture explanation", { exact: false })).toHaveCount(0);
        if (index === 0) {
          const changed = await page.request.post(`${api}/answer`, { data: { itemId: question.id, selectedLabel: question.options[1].label } });
          expect(changed.status()).toBe(409);
        }
        await page.getByRole("button", { name: index === count - 1 ? "See my results" : "Next question", exact: true }).click();
        if (index === 0) {
          await page.goto("/diagnostic?cert=data-engineer");
          await expect(page.getByRole("link", { name: "Resume diagnostic", exact: true })).toHaveAttribute("href", `/diagnostic/${sessionId}?cert=data-engineer`);
          await page.goto("/diagnostic");
          await expect(page.getByRole("button", { name: "Begin diagnostic", exact: true })).toBeVisible();
          // Remove the query: the saved session, not a client URL, owns the certification.
          await page.goto(`/diagnostic/${sessionId}`);
          await page.reload();
          await expect(page.getByText(`${certName} · Beta diagnostic`, { exact: true })).toBeVisible();
          await expect(page.getByText(`Question 2 of ${count}`, { exact: true })).toBeVisible();
          expect(await (await page.request.get(api)).json()).toMatchObject({ certId, answeredCount: 1 });
        }
      }
      await expect(page).toHaveURL(new RegExp(`/diagnostic/${sessionId}/results\\?cert=data-engineer$`));
      await expectBetaResults(page, count);
      const result = await (await page.request.get(`${api}/results`)).json() as DiagnosticResult;
      expect(result).toMatchObject({ certId, totalQuestions: count, domainBreakdown: [] });
      expect(result.review).toBeUndefined();
      noAnswerKeys(result);
      expect((await page.request.get(`${api}/free-explanation`)).status()).toBe(404);
      expect((await page.request.post(`${api}/email`, { data: { email: "blocked-beta@example.test", consent: true } })).status()).toBe(404);
      await page.goto(`/diagnostic/${sessionId}/results`);
      await page.reload();
      await expectBetaResults(page, count);
      await page.goto(`/diagnostic/${sessionId}/results?cert=machine-learning-engineer`);
      await expectBetaResults(page, count);
      const email = `beta-${count}-${fixtureId}@example.test`;
      emails.push(email);
      await page.getByLabel(`Get notified when practice for ${certName} opens`, { exact: true }).fill(email);
      const joinedResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/cert-waitlist" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Notify me", exact: true }).click();
      const joined = await joinedResponse;
      expect(joined.status()).toBe(200);
      expect(joined.request().postDataJSON()).toMatchObject({ cert_id: certId, email, source_path: `/diagnostic/${sessionId}/results` });
      await expect(page.getByRole("status")).toHaveText("You're on the list");
      const stored = await service.from("cert_waitlist").select("cert_id,source_path").eq("email", email);
      expect(stored.error).toBeNull();
      expect(stored.data).toEqual([{ cert_id: certId, source_path: `/diagnostic/${sessionId}/results` }]);
      expect(failures).toEqual([]);
    });
  }
});
